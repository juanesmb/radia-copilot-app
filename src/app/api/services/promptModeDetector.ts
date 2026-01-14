export interface PromptModeDetector {
  detectMode(transcription: string): 'transcription' | 'enhancement';
}

export const createPromptModeDetector = (): PromptModeDetector => ({
  detectMode(transcription: string): 'transcription' | 'enhancement' {
    const trimmed = transcription.trim();
    return trimmed.length === 0 ? 'enhancement' : 'transcription';
  },
});
