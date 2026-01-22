import { HttpError } from "./errorHandler";

export type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh";

export interface AIConfig {
  gatewayApiKey: string;
  model: string;
  baseUrl: string;
  temperature: number;
  reasoningEffort: ReasoningEffort;
}

const DEFAULT_BASE_URL = "https://ai-gateway.vercel.sh/v3/ai";
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_REASONING_EFFORT: ReasoningEffort = "low";
const VALID_REASONING_VALUES: readonly ReasoningEffort[] = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
] as const;

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

  const model = process.env.AI_MODEL;

  if (!model) {
    throw new HttpError(
      "AI_MODEL is not configured. Please set AI_MODEL in your environment variables with format: {provider}/{model-name} (e.g., provider/model-name).",
      { status: 500 }
    );
  }

  const baseUrl = DEFAULT_BASE_URL;

  const reasoningEnv = process.env.AI_REASONING;
  let reasoningEffort: ReasoningEffort = DEFAULT_REASONING_EFFORT;

  if (reasoningEnv) {
    const normalizedReasoning = reasoningEnv.toLowerCase() as ReasoningEffort;
    if (VALID_REASONING_VALUES.includes(normalizedReasoning)) {
      reasoningEffort = normalizedReasoning;
    } else {
      console.warn(
        `Invalid AI_REASONING="${reasoningEnv}". Valid values: ${VALID_REASONING_VALUES.join(", ")}. Using default: "${DEFAULT_REASONING_EFFORT}"`
      );
    }
  }

  return {
    gatewayApiKey,
    model,
    baseUrl,
    temperature: DEFAULT_TEMPERATURE,
    reasoningEffort,
  };
}
