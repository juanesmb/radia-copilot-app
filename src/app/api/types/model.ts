export interface ModelInput {
  systemPrompt: string;
  userPrompt: string;
}

export interface ModelConfig {
  apiKey?: string;
  model?: string;
  temperature?: number;
}

