import { HttpError } from "./errorHandler";

export interface AIConfig {
  gatewayApiKey: string;
  model: string;
  baseUrl: string;
  temperature: number;
}

const DEFAULT_BASE_URL = "https://ai-gateway.vercel.sh/v3/ai";
const DEFAULT_TEMPERATURE = 0.2;

/**
 * Gets AI Gateway configuration from environment variables.
 * Validates required variables and provides sensible defaults.
 *
 * @returns Typed configuration object
 * @throws {HttpError} If required environment variables are missing
 */
export function getAIConfig(): AIConfig {
  const gatewayApiKey = process.env.AI_GATEWAY_API_KEY;

  if (!gatewayApiKey) {
    throw new HttpError(
      "AI_GATEWAY_API_KEY is not configured. Please set AI_GATEWAY_API_KEY in your environment variables.",
      { status: 500 }
    );
  }

  // Model should include provider prefix (e.g., "provider/model-name")
  // If not provided, user must specify in AI_MODEL env var
  const model = process.env.AI_MODEL;

  if (!model) {
    throw new HttpError(
      "AI_MODEL is not configured. Please set AI_MODEL in your environment variables with format: {provider}/{model-name} (e.g., provider/model-name).",
      { status: 500 }
    );
  }
  // Prioritize configured DEFAULT_BASE_URL (v3) for AI SDK Gateway compatibility
  // ignoring potential legacy v1 env var
  const baseUrl = DEFAULT_BASE_URL;

  return {
    gatewayApiKey,
    model,
    baseUrl,
    temperature: DEFAULT_TEMPERATURE,
  };
}
