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
  const defaultConfig = getAIConfig();

  const gatewayApiKey = config.gatewayApiKey || defaultConfig.gatewayApiKey;
  const model = config.model || defaultConfig.model;
  const baseUrl = config.baseUrl || defaultConfig.baseUrl;
  const temperature = config.temperature ?? defaultConfig.temperature;
  const reasoningEffort = config.reasoningEffort ?? defaultConfig.reasoningEffort;

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

  const formattedModel = formatModelName(model);

  const gateway = createGateway({
    baseURL: baseUrl,
    headers: {
      Authorization: `Bearer ${gatewayApiKey}`,
    },
  });

  const modelsWithFixedTemperature = ["gpt-5-mini", "gpt-5-nano"];

  const getEffectiveTemperature = (modelName: string, requestedTemp: number): number => {
    const modelWithoutPrefix = modelName.includes("/")
      ? modelName.split("/")[1]
      : modelName;

    if (modelsWithFixedTemperature.includes(modelWithoutPrefix)) {
      return 1.0;
    }
    return requestedTemp;
  };

  const handleError = (error: unknown): never => {
    if (error instanceof HttpError) {
      throw error;
    }

    const errorMessage = error instanceof Error ? error.message : "AI Gateway request failed";
    throw new HttpError(errorMessage, {
      status: 502,
      details: String(error),
    });
  };

  const buildGenerateOptions = (
    completionModel: string,
    completionTemperature: number,
    messages: Array<{ role: "system" | "user"; content: string }>
  ) => {
    const options: {
      model: ReturnType<typeof gateway>;
      messages: Array<{ role: "system" | "user"; content: string }>;
      temperature?: number;
      providerOptions?: { openai: { reasoningEffort: typeof reasoningEffort } };
    } = {
      model: gateway(completionModel),
      messages,
    };

    if (reasoningEffort) {
      options.providerOptions = {
        openai: {
          reasoningEffort,
        },
      };
    } else {
      options.temperature = getEffectiveTemperature(completionModel, completionTemperature);
    }

    return options;
  };

  const handleCompletion = async (
    completionModel: string,
    completionTemperature: number,
    completionMessages: Array<{ role: "system" | "user"; content: string }>
  ): Promise<string> => {
    try {
      const options = buildGenerateOptions(completionModel, completionTemperature, completionMessages);
      const { text } = await generateText(options);

      if (!text) {
        throw new HttpError("Model returned an empty response.", { status: 502 });
      }

      return text;
    } catch (error) {
      handleError(error);
    }
  };

  const handleStreamingCompletion = async function* (
    completionModel: string,
    completionTemperature: number,
    completionMessages: Array<{ role: "system" | "user"; content: string }>
  ): AsyncGenerator<string> {
    try {
      const options = buildGenerateOptions(completionModel, completionTemperature, completionMessages);
      const result = await streamText(options);

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
