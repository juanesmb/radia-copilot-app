import OpenAI from "openai";

import { HttpError } from "../lib/errorHandler";
import type { ModelConfig, ModelInput } from "../types/model";

export interface OpenAIClient {
  generateReport(input: ModelInput): Promise<string>;
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
    };
  }

  const client = new OpenAI({ apiKey });

  return {
    async generateReport({ systemPrompt, userPrompt }) {
      try {
        const completion = await client.chat.completions.create({
          model,
          temperature,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
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
        throw new HttpError("OpenAI request failed.", {
          status: 502,
          details: error instanceof Error ? error.message : undefined,
        });
      }
    },
  };
};

