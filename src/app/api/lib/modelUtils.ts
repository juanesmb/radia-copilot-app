/**
 * Supported AI providers in Vercel AI Gateway
 */
const SUPPORTED_PROVIDERS = ["openai", "anthropic", "google", "cohere", "mistral"] as const;

type Provider = (typeof SUPPORTED_PROVIDERS)[number];

/**
 * Checks if a model name already has a provider prefix.
 *
 * @param model - Model name to check
 * @returns True if model has a provider prefix (e.g., "provider/model-name")
 */
export function isProviderPrefixed(model: string): boolean {
  return SUPPORTED_PROVIDERS.some((provider) => model.startsWith(`${provider}/`));
}

/**
 * Extracts the provider from a model name if it has a prefix.
 *
 * @param model - Model name (e.g., "provider/model-name" or "model-name")
 * @returns Provider name if found, null otherwise
 */
export function extractProvider(model: string): Provider | null {
  for (const provider of SUPPORTED_PROVIDERS) {
    if (model.startsWith(`${provider}/`)) {
      return provider;
    }
  }
  return null;
}

/**
 * Formats a model name to include the provider prefix if not already present.
 * Vercel AI Gateway requires model names in the format: {provider}/{model-name}
 *
 * @param model - Model name (e.g., "gpt-4o-mini" or "provider/gpt-4o-mini")
 * @param defaultProvider - Default provider to use if model doesn't have a prefix
 * @returns Formatted model name with provider prefix
 *
 * @example
 * formatModelName("model-name", "provider") // returns "provider/model-name"
 * formatModelName("provider/model-name") // returns "provider/model-name"
 * formatModelName("claude-sonnet-4.5", "anthropic") // returns "anthropic/claude-sonnet-4.5"
 */
export function formatModelName(model: string, defaultProvider?: Provider): string {
  if (!model || typeof model !== "string") {
    throw new Error(`Invalid model name: ${model}`);
  }

  const trimmedModel = model.trim();

  if (isProviderPrefixed(trimmedModel)) {
    return trimmedModel;
  }

  if (!defaultProvider) {
    throw new Error(
      `Model name "${trimmedModel}" does not have a provider prefix and no default provider was provided. ` +
      `Please provide model in format: {provider}/{model-name} (e.g., "provider/model-name")`
    );
  }

  return `${defaultProvider}/${trimmedModel}`;
}
