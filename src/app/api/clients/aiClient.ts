// Using OpenAI SDK for AI Gateway compatibility (AI Gateway uses OpenAI-compatible API format)
// This SDK is used only for the API interface, not for direct OpenAI calls
import OpenAI, { APIError } from "openai";

import { HttpError } from "../lib/errorHandler";
import { getAIConfig } from "../lib/config";
import { formatModelName } from "../lib/modelUtils";
import type { ModelConfig, ModelInput } from "../types/model";

// Alias the OpenAI SDK to a generic name to avoid provider-specific naming
const AIGatewaySDK = OpenAI;

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

  // Initialize AI Gateway client
  // Using OpenAI-compatible SDK because AI Gateway uses OpenAI-compatible API format
  // All requests go through AI Gateway, not directly to any provider
  const client = new AIGatewaySDK({
    apiKey: gatewayApiKey,
    baseURL: baseUrl,
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

  const createAPIError = (error: APIError): HttpError => {
    // Extract status code - SDK uses 'status' property (number)
    const statusCode = 
      typeof error.status === 'number' ? error.status 
      : (error as unknown as { statusCode?: number }).statusCode ?? 502;
    
    const errorMessage = error.message || "AI Gateway API error";
    
    return new HttpError(
      errorMessage,
      {
        status: statusCode,
        details: error.code ? `Error code: ${error.code}` : undefined,
      }
    );
  };

  const handleCompletion = async (
    completionModel: string,
    completionTemperature: number,
    completionMessages: Array<{ role: "system" | "user"; content: string }>
  ): Promise<string> => {
    const effectiveTemperature = getEffectiveTemperature(completionModel, completionTemperature);
    
    try {
      const completion = await client.chat.completions.create({
        model: completionModel,
        temperature: effectiveTemperature,
        messages: completionMessages,
      });

      const content = completion.choices.at(0)?.message?.content;
      if (!content) {
        throw new HttpError("Model returned an empty response.", { status: 502 });
      }

      return content;
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      
      if (error instanceof APIError) {
        throw createAPIError(error);
      }
      
      throw new HttpError("AI Gateway request failed.", {
        status: 502,
        details: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleStreamingCompletion = async function* (
    completionModel: string,
    completionTemperature: number,
    completionMessages: Array<{ role: "system" | "user"; content: string }>
  ): AsyncGenerator<string> {
    const effectiveTemperature = getEffectiveTemperature(completionModel, completionTemperature);
    
    try {
      const stream = await client.chat.completions.create({
        model: completionModel,
        temperature: effectiveTemperature,
        messages: completionMessages,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      
      if (error instanceof APIError) {
        throw createAPIError(error);
      }
      
      throw new HttpError("AI Gateway streaming request failed.", {
        status: 502,
        details: error instanceof Error ? error.message : String(error),
      });
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
