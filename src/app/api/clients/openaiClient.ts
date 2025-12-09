import OpenAI, { APIError } from "openai";

import { HttpError } from "../lib/errorHandler";
import type { ModelConfig, ModelInput } from "../types/model";

export interface OpenAIClient {
  generateReport(input: ModelInput): Promise<string>;
  generateCompletion(messages: Array<{ role: "system" | "user"; content: string }>): Promise<string>;
}

export const createOpenAIClient = (config: ModelConfig): OpenAIClient => {
  const { apiKey, model = "gpt-4o-mini", temperature = 0.2 } = config;

  if (!apiKey) {
    return {
      async generateReport() {
        throw new HttpError("OPENAI_API_KEY is not configured.", {
          status: 500,
        });
      },
      async generateCompletion() {
        throw new HttpError("OPENAI_API_KEY is not configured.", {
          status: 500,
        });
      },
    };
  }

  const client = new OpenAI({ apiKey });

  // Models that only support default temperature (1.0)
  const modelsWithFixedTemperature = ["gpt-5-mini", "gpt-5-nano"];

  const getEffectiveTemperature = (modelName: string, requestedTemp: number): number => {
    if (modelsWithFixedTemperature.includes(modelName)) {
      return 1.0; // Default temperature for gpt-5 models
    }
    return requestedTemp;
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
      
      // Better error handling for OpenAI API errors
      if (error instanceof APIError) {
        throw new HttpError(
          `OpenAI API error: ${error.message}`,
          {
            status: error.status ?? 502,
            details: error.code ? `Error code: ${error.code}` : undefined,
          }
        );
      }
      
      throw new HttpError("OpenAI request failed.", {
        status: 502,
        details: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return {
    async generateReport({ systemPrompt, userPrompt }) {
      return handleCompletion(model, temperature, [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ]);
    },
    async generateCompletion(messages) {
      return handleCompletion("gpt-4o-mini", 0, messages);
    },
  };
};

