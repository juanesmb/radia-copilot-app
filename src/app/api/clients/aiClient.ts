// Using Vercel AI SDK for AI Gateway compatibility
// This SDK is used only for the API interface, generally agnostic of specific provider
import { createGateway, generateText, streamText } from "ai";

import { HttpError } from "../lib/errorHandler";
import { getAIConfig } from "../lib/config";
import { formatModelName } from "../lib/modelUtils";
import type { ModelConfig, ModelInput } from "../types/model";

export interface AIClient {
  generateReport(input: ModelInput): Promise<string>;
  generateCompletion(messages: Array<{ role: "system" | "user"; content: string }>): Promise<string>;
  generateReportStream(input: ModelInput): AsyncGenerator<string>;
}

export const createAIClient = (config: ModelConfig = {}): AIClient => {
  // Merge provided config with defaults from environment
  const defaultConfig = getAIConfig();

  const gatewayApiKey = config.gatewayApiKey || defaultConfig.gatewayApiKey;
  const model = config.model || defaultConfig.model;
  const baseUrl = config.baseUrl || defaultConfig.baseUrl;
  const temperature = config.temperature ?? defaultConfig.temperature;

  if (!gatewayApiKey) {
    return {
      async generateReport() {
        throw new HttpError("AI_GATEWAY_API_KEY is not configured.", {
          status: 500,
        });
      },
      async generateCompletion() {
        throw new HttpError("AI_GATEWAY_API_KEY is not configured.", {
          status: 500,
        });
      },
      async *generateReportStream() {
        throw new HttpError("AI_GATEWAY_API_KEY is not configured.", {
          status: 500,
        });
      },
    };
  }

  // Format model name to include provider prefix if needed
  const formattedModel = formatModelName(model);

  // Initialize AI Gateway client via Vercel AI SDK
  const gateway = createGateway({
    baseURL: baseUrl,
    headers: {
      Authorization: `Bearer ${gatewayApiKey}`,
    },
  });

  // Models that only support default temperature (1.0)
  // Check for both prefixed (e.g., "provider/model-name") and non-prefixed model names
  const modelsWithFixedTemperature = ["gpt-5-mini", "gpt-5-nano"];

  const getEffectiveTemperature = (modelName: string, requestedTemp: number): number => {
    // Extract model name without provider prefix for comparison
    const modelWithoutPrefix = modelName.includes("/")
      ? modelName.split("/")[1]
      : modelName;

    if (modelsWithFixedTemperature.includes(modelWithoutPrefix)) {
      return 1.0; // Default temperature for specific models
    }
    return requestedTemp;
  };

  const handleError = (error: unknown): never => {
    if (error instanceof HttpError) {
      throw error;
    }

    // Vercel AI SDK might throw various errors. 
    // We try to extract meaningful info similar to original implementation.
    const errorMessage = error instanceof Error ? error.message : "AI Gateway request failed";

    // Basic mapping of common error-like shapes or default to 502
    // If it's a specific API error from the provider, it might be wrapped.
    throw new HttpError(errorMessage, {
      status: 502,
      details: String(error),
    });
  };

  const handleCompletion = async (
    completionModel: string,
    completionTemperature: number,
    completionMessages: Array<{ role: "system" | "user"; content: string }>
  ): Promise<string> => {
    const effectiveTemperature = getEffectiveTemperature(completionModel, completionTemperature);

    try {
      // Cast the messages to any for Vercel AI SDK
      // The types are compatible: { role: 'user' | 'system', content: string }
      const messages = completionMessages as any[];

      const { text } = await generateText({
        model: gateway(completionModel),
        temperature: effectiveTemperature,
        messages: messages,
      });

      if (!text) {
        throw new HttpError("Model returned an empty response.", { status: 502 });
      }

      return text;
    } catch (error) {
      handleError(error);
      return ""; // Unreachable due to handleError throwing
    }
  };

  const handleStreamingCompletion = async function* (
    completionModel: string,
    completionTemperature: number,
    completionMessages: Array<{ role: "system" | "user"; content: string }>
  ): AsyncGenerator<string> {
    const effectiveTemperature = getEffectiveTemperature(completionModel, completionTemperature);

    try {
      const messages = completionMessages as any[];

      const result = await streamText({
        model: gateway(completionModel),
        temperature: effectiveTemperature,
        messages: messages,
      });

      for await (const chunk of result.textStream) {
        if (chunk) {
          yield chunk;
        }
      }
    } catch (error) {
      handleError(error);
    }
  };

  return {
    async generateReport({ systemPrompt, userPrompt }) {
      return handleCompletion(formattedModel, temperature, [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ]);
    },
    async generateCompletion(messages) {
      // Use the configured model for completion (study type detection)
      // Model name should already be formatted with provider prefix from config
      return handleCompletion(formattedModel, 0, messages);
    },
    async *generateReportStream({ systemPrompt, userPrompt }) {
      yield* handleStreamingCompletion(formattedModel, temperature, [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ]);
    },
  };
};
