import type { TranscriptResult, STTConfig, STTState, STTError } from './types';

export interface SpeechToTextProvider {
  connect(config: STTConfig): Promise<void>;
  disconnect(): Promise<void>;
  startRecording(): Promise<void>;
  stopRecording(): Promise<void>;
  pauseRecording(): void;
  resumeRecording(): void;

  // Event handlers
  onTranscript(callback: (result: TranscriptResult) => void): void;
  onStateChange(callback: (state: STTState) => void): void;
  onError(callback: (error: STTError) => void): void;

  // State
  getState(): STTState;
}

