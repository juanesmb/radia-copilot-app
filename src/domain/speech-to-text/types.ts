export interface TranscriptResult {
  text: string;
  isFinal: boolean;
  confidence?: number;
  timestamp?: number;
}

export interface STTConfig {
  language: 'en' | 'es';
  sampleRate?: number;
  enablePartials?: boolean;
}

export type STTState = 'idle' | 'connecting' | 'recording' | 'stopping' | 'error';

export interface STTError {
  code: string;
  message: string;
}

