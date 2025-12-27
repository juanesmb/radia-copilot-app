import type { SpeechToTextProvider } from '@/domain/speech-to-text';
import { SpeechmaticsProvider } from './speechmatics/SpeechmaticsProvider';

export type ProviderType = 'speechmatics' | 'deepgram' | 'assemblyai';

export function createSpeechToTextProvider(
  type: ProviderType = 'speechmatics'
): SpeechToTextProvider {
  switch (type) {
    case 'speechmatics':
      return new SpeechmaticsProvider();
    // Future providers can be added here:
    // case 'deepgram':
    //   return new DeepgramProvider();
    // case 'assemblyai':
    //   return new AssemblyAIProvider();
    default:
      return new SpeechmaticsProvider();
  }
}


