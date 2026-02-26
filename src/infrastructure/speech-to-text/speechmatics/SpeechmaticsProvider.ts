import type {
  SpeechToTextProvider,
  TranscriptResult,
  STTConfig,
  STTState,
  STTError,
} from '@/domain/speech-to-text';

type TranscriptCallback = (result: TranscriptResult) => void;
type StateCallback = (state: STTState) => void;
type ErrorCallback = (error: STTError) => void;

const TOKEN_ENDPOINT = '/api/speechmatics/token';
const SPEECHMATICS_WS_URL = 'wss://eu.rt.speechmatics.com/v2';

const getDictatedPunctuationReplacements = (
  language: 'en' | 'es'
): Array<{ from: string; to: string }> => {
  if (language === 'es') {
    return [
      { from: '/^(coma|Coma)$/', to: ',' },
      { from: '/^(punto|Punto)$/', to: '.' },
      { from: '/^(punto final|Punto final)$/', to: '.' },
      { from: '/^(dos puntos|Dos puntos)$/', to: ':' }
    ];
  }

  // English
  return [
    { from: '/^([cC]omma|[cC]oma)$/', to: ',' },
    { from: '/^(period|Period)$/', to: '.' },
    { from: '/^(full stop|Full stop)$/', to: '.' },
    { from: '/^(colon|Colon)$/', to: ':' }
  ];
};

const log = (context: string, message: string, data?: unknown) => {
  const timestamp = new Date().toISOString();
  console.log(`[STT ${timestamp}] [${context}] ${message}`, data ?? '');
};

const logError = (context: string, message: string, error?: unknown) => {
  const timestamp = new Date().toISOString();
  console.error(`[STT ${timestamp}] [${context}] ERROR: ${message}`, error ?? '');
};

const appendTranscript = (base: string, addition: string): string => {
  const a = addition.trim();
  if (!a) {
    return base;
  }

  if (!base) {
    return a;
  }

  // Don't insert a space before punctuation tokens.
  if (/^[\]\[(){}.,!?;:]/.test(a)) {
    return `${base}${a}`;
  }

  return `${base} ${a}`;
};

export class SpeechmaticsProvider implements SpeechToTextProvider {
  private state: STTState = 'idle';
  private socket: WebSocket | null = null;
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private config: STTConfig | null = null;

  private silenceStartMs: number | null = null;
  private hasAutoStoppedForSilence = false;

  private transcriptCallbacks: TranscriptCallback[] = [];
  private stateCallbacks: StateCallback[] = [];
  private errorCallbacks: ErrorCallback[] = [];

  private accumulatedTranscript = '';
  private audioChunkCount = 0;
  private isIntentionallyDisconnecting = false;
  private isConnecting = false;
  private audioWorkletNode: AudioWorkletNode | null = null;

  getState(): STTState {
    return this.state;
  }

  onTranscript(callback: TranscriptCallback): void {
    this.transcriptCallbacks.push(callback);
  }

  onStateChange(callback: StateCallback): void {
    this.stateCallbacks.push(callback);
  }

  onError(callback: ErrorCallback): void {
    this.errorCallbacks.push(callback);
  }

  private setState(newState: STTState): void {
    log('STATE', `State change: ${this.state} -> ${newState}`);
    this.state = newState;
    this.stateCallbacks.forEach((cb) => cb(newState));
  }

  private emitTranscript(result: TranscriptResult): void {
    log('TRANSCRIPT', `Emitting transcript (final: ${result.isFinal})`, {
      textLength: result.text.length,
      preview: result.text.slice(0, 100)
    });
    this.transcriptCallbacks.forEach((cb) => cb(result));
  }

  private emitError(error: STTError): void {
    logError('ERROR', `Emitting error: ${error.code}`, error);
    this.errorCallbacks.forEach((cb) => cb(error));
  }

  async connect(config: STTConfig): Promise<void> {
    log('CONNECT', 'Starting connection', config);

    if (this.state !== 'idle') {
      log('CONNECT', `Provider in state "${this.state}", forcing reset...`);
      // Use a more aggressive cleanup if we are stuck in an error state
      if (this.state === 'error') {
        this.accumulatedTranscript = '';
        this.audioChunkCount = 0;
      }
      this.isIntentionallyDisconnecting = true;
      await this.disconnect();
      this.isIntentionallyDisconnecting = false;
    }

    this.config = config;
    this.setState('connecting');
    this.accumulatedTranscript = '';
    this.audioChunkCount = 0;
    this.silenceStartMs = null;
    this.hasAutoStoppedForSilence = false;

    try {
      // Fetch temporary JWT from backend
      log('TOKEN', 'Fetching temporary JWT from backend...');
      const tokenResponse = await fetch(TOKEN_ENDPOINT);
      log('TOKEN', `Token response status: ${tokenResponse.status}`);

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        logError('TOKEN', `Failed to fetch token: ${tokenResponse.status}`, errorText);
        throw new Error(`Failed to fetch Speechmatics token: ${tokenResponse.status}`);
      }

      const tokenData = await tokenResponse.json();
      log('TOKEN', 'Token received', { hasToken: !!tokenData.token, tokenLength: tokenData.token?.length });

      if (!tokenData.token) {
        logError('TOKEN', 'Token response missing token field', tokenData);
        throw new Error('Token response missing token');
      }

      // Cleanup existing socket if any
      if (this.socket) {
        log('WEBSOCKET', 'Closing existing socket before new connection');
        this.socket.onmessage = null;
        this.socket.onclose = null;
        this.socket.onerror = null;
        this.socket.onopen = null;
        this.socket.close();
        this.socket = null;
      }

      this.accumulatedTranscript = '';
      this.audioChunkCount = 0;

      const wsUrl = `${SPEECHMATICS_WS_URL}?jwt=${tokenData.token}`;
      log('WEBSOCKET', `Connecting to WebSocket: ${SPEECHMATICS_WS_URL}?jwt=[REDACTED]`);

      this.socket = new WebSocket(wsUrl);
      this.isConnecting = true;

      await new Promise<void>((resolve, reject) => {
        if (!this.socket) {
          this.isConnecting = false;
          return reject(new Error('Socket not initialized'));
        }

        const timeout = setTimeout(() => {
          this.isConnecting = false;
          logError('WEBSOCKET', 'Connection timeout after 10 seconds');
          reject(new Error('WebSocket connection timeout'));
        }, 10000);

        this.socket.onopen = () => {
          log('WEBSOCKET', 'WebSocket connected, sending StartRecognition message');
          clearTimeout(timeout);

          const dictatedPunctuationReplacements = getDictatedPunctuationReplacements(
            config.language
          );

          const startMessage = {
            message: 'StartRecognition',
            transcription_config: {
              language: config.language,
              operating_point: 'enhanced',
              enable_partials: config.enablePartials ?? true,
              max_delay: 2.0,
              ...(config.domain === 'medical' || (config.language === 'es' && !config.domain) ? { domain: 'medical' } : {}),
              transcript_filtering_config: {
                replacements: dictatedPunctuationReplacements,
              },
              punctuation_overrides: {
                permitted_marks: [','],
                sensitivity: 0.2,
              },
            },
            audio_format: {
              type: 'raw',
              encoding: 'pcm_f32le',
              sample_rate: config.sampleRate ?? 16000,
            },
          };

          log('WEBSOCKET', 'StartRecognition message', startMessage);
          this.socket?.send(JSON.stringify(startMessage));
        };

        this.socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.message === 'AddTranscript' || data.message === 'AddPartialTranscript') {
              log('WEBSOCKET', `Received: ${data.message}`, { resultsCount: data.results?.length });
            } else {
              log('WEBSOCKET', `Received: ${data.message}`, data);
            }

            if (data.message === 'RecognitionStarted') {
              log('WEBSOCKET', 'Recognition started successfully', data);
              clearTimeout(timeout);
              this.isConnecting = false;
              resolve();
            } else if (data.message === 'Error') {
              if (this.isConnecting) {
                logError('WEBSOCKET', 'Speechmatics error during connection', data);
                clearTimeout(timeout);
                this.isConnecting = false;
                reject(new Error(data.reason || data.type || 'Speechmatics error'));
              } else {
                if (this.state === 'stopping' || this.state === 'idle') {
                  log('WEBSOCKET', 'Ignoring error during stop/idle state', data);
                } else {
                  logError('WEBSOCKET', 'Speechmatics error', data);
                  this.emitError({ code: 'SPEECHMATICS_ERROR', message: data.reason || data.type || 'Speechmatics error' });
                }
              }
            } else if (data.message === 'AddTranscript' || data.message === 'AddPartialTranscript') {
              this.handleTranscriptMessage(data);
            } else if (data.message === 'EndOfTranscript') {
              log('WEBSOCKET', 'End of transcript received');
              this.setState('idle');
            } else if (data.message === 'AudioAdded') {
              if (this.audioChunkCount % 100 === 1) {
                log('WEBSOCKET', 'AudioAdded acknowledgment received');
              }
            } else if (data.message === 'Warning') {
              log('WEBSOCKET', 'Warning from Speechmatics', data);
            } else if (data.message === 'Info') {
              log('WEBSOCKET', 'Info from Speechmatics', data);
            }
          } catch (parseError) {
            logError('WEBSOCKET', 'Failed to parse message', { error: parseError, rawData: event.data?.slice?.(0, 200) });
          }
        };

        this.socket.onerror = (event) => {
          logError('WEBSOCKET', 'WebSocket error', event);
          clearTimeout(timeout);
          this.isConnecting = false;
          reject(new Error('WebSocket connection error'));
        };

        this.socket.onclose = (event) => {
          log('WEBSOCKET', `WebSocket closed: code=${event.code}, reason="${event.reason}", wasClean=${event.wasClean}, intentionallyDisconnecting=${this.isIntentionallyDisconnecting}`);
          clearTimeout(timeout);
          if (this.isConnecting) {
            this.isConnecting = false;
            if (!event.wasClean && event.code !== 1000) {
              reject(new Error(`WebSocket closed unexpectedly during connection: code ${event.code}`));
            }
            return;
          }

          if (this.isIntentionallyDisconnecting || this.state === 'connecting' || this.state === 'idle' || this.state === 'stopping') {
            log('WEBSOCKET', 'Ignoring close event - intentional disconnect or already reconnecting');
            return;
          }

          if (event.code === 1000) {
            log('WEBSOCKET', 'Normal closure');
            this.setState('idle');
          } else {
            const errorMsg = event.reason || `Connection closed with code ${event.code}`;
            this.emitError({ code: 'CONNECTION_CLOSED', message: errorMsg });
            this.setState('error');
          }
        };
      });

      log('CONNECT', 'Connection established successfully');
    } catch (error) {
      logError('CONNECT', 'Connection failed', error);
      // Ensure we clean up if connection fails
      if (this.socket) {
        this.socket.onmessage = null;
        this.socket.onopen = null;
        this.socket.onclose = null;
        this.socket.onerror = null;
        this.socket.close();
        this.socket = null;
      }
      this.setState('error');
      this.emitError({
        code: 'CONNECTION_ERROR',
        message: error instanceof Error ? error.message : 'Failed to connect',
      });
      throw error;
    }
  }

  private handleTranscriptMessage(data: {
    message: string;
    results?: Array<{
      type: string;
      alternatives?: Array<{ content: string; confidence?: number }>;
      is_eos?: boolean;
    }>;
  }): void {
    // Ignore transcript messages when not recording (idle/stopping states)
    // These are late-arriving messages from a previous session that has already been finalized
    if (this.state !== 'recording' && this.state !== 'connecting') {
      log('TRANSCRIPT', `Ignoring transcript message in state "${this.state}"`);
      return;
    }

    const isFinal = data.message === 'AddTranscript';
    let text = '';

    if (data.results) {
      for (const result of data.results) {
        if (result.alternatives && result.alternatives.length > 0) {
          const content = result.alternatives[0].content;
          if (result.type === 'word') {
            text += ' ' + content;
          } else {
            text += content;
          }
        }
      }
    }

    text = text.trim();

    log('TRANSCRIPT', `Processing transcript: isFinal=${isFinal}, newText="${text.slice(0, 50)}..."`);

    if (isFinal && text) {
      this.accumulatedTranscript = appendTranscript(this.accumulatedTranscript, text);
      log('TRANSCRIPT', `Accumulated transcript length: ${this.accumulatedTranscript.length}`);
    }

    const emittedText = isFinal
      ? this.accumulatedTranscript
      : appendTranscript(this.accumulatedTranscript, text);

    this.emitTranscript({
      text: emittedText,
      isFinal,
      confidence: data.results?.[0]?.alternatives?.[0]?.confidence,
    });
  }

  async startRecording(): Promise<void> {
    log('RECORDING', `Starting recording, current state: ${this.state}`);

    if (this.state !== 'connecting') {
      logError('RECORDING', `Cannot start recording in state "${this.state}"`);
      throw new Error('Cannot start recording in current state');
    }

    try {
      // Get microphone access
      log('MICROPHONE', 'Requesting microphone access...');
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.config?.sampleRate ?? 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      const audioTracks = this.mediaStream.getAudioTracks();
      log('MICROPHONE', `Microphone access granted, tracks: ${audioTracks.length}`, {
        trackSettings: audioTracks[0]?.getSettings(),
      });

      // Set up AudioContext and processor for raw PCM
      log('AUDIO', 'Setting up AudioContext...');
      this.audioContext = new AudioContext({
        sampleRate: this.config?.sampleRate ?? 16000,
      });

      log('AUDIO', `AudioContext created: sampleRate=${this.audioContext.sampleRate}, state=${this.audioContext.state}`);

      const source = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Use AudioWorklet if supported, fallback to ScriptProcessor
      const useWorklet = !!this.audioContext.audioWorklet;

      if (useWorklet) {
        log('AUDIO', 'Setting up AudioWorklet...');
        try {
          const workletCode = `
            class AudioProcessor extends AudioWorkletProcessor {
              process(inputs) {
                const input = inputs[0];
                if (input && input[0]) {
                  this.port.postMessage(input[0]);
                }
                return true;
              }
            }
            registerProcessor('audio-processor', AudioProcessor);
          `;
          const blob = new Blob([workletCode], { type: 'application/javascript' });
          const url = URL.createObjectURL(blob);
          await this.audioContext.audioWorklet.addModule(url);
          URL.revokeObjectURL(url);

          this.audioWorkletNode = new AudioWorkletNode(this.audioContext, 'audio-processor');
          this.audioWorkletNode.port.onmessage = (event: MessageEvent) => {
            this.handleAudioData(event.data);
          };
          source.connect(this.audioWorkletNode);
          this.audioWorkletNode.connect(this.audioContext.destination);
          log('AUDIO', 'AudioWorklet connected');
        } catch (workletError) {
          logError('AUDIO', 'Failed to initialize AudioWorklet, falling back to ScriptProcessor', workletError);
          this.setupScriptProcessor(source);
        }
      } else {
        log('AUDIO', 'AudioWorklet not supported, using ScriptProcessor');
        this.setupScriptProcessor(source);
      }

      this.setState('recording');
      log('RECORDING', 'Recording started successfully');
    } catch (error) {
      logError('RECORDING', 'Failed to start recording', error);
      this.setState('error');
      this.emitError({
        code: 'MICROPHONE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to access microphone',
      });
      throw error;
    }
  }

  private setupScriptProcessor(source: MediaStreamAudioSourceNode): void {
    const bufferSize = 4096;
    this.scriptProcessor = this.audioContext!.createScriptProcessor(bufferSize, 1, 1);
    this.scriptProcessor.onaudioprocess = (event) => {
      this.handleAudioData(event.inputBuffer.getChannelData(0));
    };
    source.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.audioContext!.destination);
    log('AUDIO', `ScriptProcessor created: bufferSize=${bufferSize}`);
  }

  private handleAudioData(buffer: Float32Array): void {
    if (this.state !== 'recording') return;
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

    const nowMs = performance.now();
    let sumSquares = 0;
    for (let i = 0; i < buffer.length; i++) {
      const v = buffer[i];
      sumSquares += v * v;
    }
    const rms = Math.sqrt(sumSquares / Math.max(1, buffer.length));

    const SILENCE_RMS_THRESHOLD = 0.008;
    const SILENCE_STOP_AFTER_MS = 12500;

    if (rms < SILENCE_RMS_THRESHOLD) {
      if (this.silenceStartMs === null) {
        this.silenceStartMs = nowMs;
      } else if (!this.hasAutoStoppedForSilence && nowMs - this.silenceStartMs >= SILENCE_STOP_AFTER_MS) {
        this.hasAutoStoppedForSilence = true;
        log('RECORDING', `Auto-stopping due to silence: ${Math.round(nowMs - this.silenceStartMs)}ms`);
        setTimeout(() => { if (this.state === 'recording') void this.stopRecording(); }, 0);
      }
    } else {
      this.silenceStartMs = null;
    }

    this.audioChunkCount++;
    if (this.audioChunkCount % 100 === 0) {
      log('AUDIO', `Sent ${this.audioChunkCount} audio chunks, buffer size: ${buffer.length}, rms: ${rms.toFixed(5)}`);
    }

    this.socket.send(buffer.buffer);
  }

  async stopRecording(): Promise<void> {
    log('RECORDING', `Stopping recording, current state: ${this.state}, chunks sent: ${this.audioChunkCount}`);

    if (this.state !== 'recording') {
      log('RECORDING', 'Not in recording state, nothing to stop');
      return;
    }

    this.setState('stopping');

    // Stop microphone
    if (this.mediaStream) {
      log('MICROPHONE', 'Stopping microphone tracks');
      this.mediaStream.getTracks().forEach((track) => {
        track.stop();
        log('MICROPHONE', `Track stopped: ${track.kind}`);
      });
      this.mediaStream = null;
    }

    // Disconnect script processor
    if (this.scriptProcessor) {
      log('AUDIO', 'Disconnecting script processor');
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }

    if (this.audioWorkletNode) {
      log('AUDIO', 'Disconnecting AudioWorklet');
      this.audioWorkletNode.disconnect();
      this.audioWorkletNode = null;
    }

    if (this.audioContext) {
      log('AUDIO', `Closing AudioContext, state: ${this.audioContext.state}`);
      await this.audioContext.close();
      this.audioContext = null;
    }

    // Send EndOfStream to Speechmatics
    // Wait a brief moment to ensure all pending audio chunks are processed
    await new Promise(resolve => setTimeout(resolve, 100));

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        log('WEBSOCKET', 'Sending EndOfStream message', { last_seq_no: this.audioChunkCount });
        const endOfStreamMessage = {
          message: 'EndOfStream',
          last_seq_no: this.audioChunkCount
        };
        this.socket.send(JSON.stringify(endOfStreamMessage));
        log('WEBSOCKET', 'EndOfStream message sent successfully');
      } catch (error) {
        logError('WEBSOCKET', 'Failed to send EndOfStream', error);
      }
    } else {
      log('WEBSOCKET', `Cannot send EndOfStream: socket state=${this.socket?.readyState}`);
    }

    this.setState('idle');
    log('RECORDING', 'Recording stopped, state set to idle');
    // Ensure we are truly in idle state even if some async event weirdness happened
    this.state = 'idle';
  }

  async disconnect(): Promise<void> {
    log('DISCONNECT', `Disconnecting, current state: ${this.state}`);

    this.isIntentionallyDisconnecting = true;
    await this.stopRecording();

    if (this.socket) {
      log('WEBSOCKET', `Closing WebSocket, state: ${this.socket.readyState}`);
      this.socket.onmessage = null;
      this.socket.onclose = null;
      this.socket.onerror = null;
      this.socket.onopen = null;
      this.socket.close();
      this.socket = null;
    }

    this.accumulatedTranscript = '';
    this.audioChunkCount = 0;
    this.setState('idle');
    this.isIntentionallyDisconnecting = false;

    log('DISCONNECT', 'Disconnected successfully');
  }
}
