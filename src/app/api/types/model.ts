export interface ModelInput {
  systemPrompt: string;
  userPrompt: string;
}

export interface ModelConfig {
  gatewayApiKey?: string;
  model?: string;
  baseUrl?: string;
  temperature?: number;
}

