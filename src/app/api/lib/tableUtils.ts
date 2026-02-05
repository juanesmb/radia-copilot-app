/**
 * Utility for handling database table names based on environment scope
 */

const scope = process.env.NEXT_PUBLIC_SCOPE ?? "prod";

/**
 * Returns the table name with the appropriate schema based on scope
 * @param baseName - The base table name (e.g., "users", "chat_sessions")
 * @returns The table name with schema applied (e.g., "dev.users", "public.users")
 */
export const getTableName = (baseName: string): string => {
  if (scope === "test") {
    return `dev.${baseName}`;
  }
  return `public.${baseName}`;
};

/**
 * Check if we're running in test environment
 * @returns true if NEXT_PUBLIC_SCOPE is "test"
 */
export const isTestEnvironment = (): boolean => {
  return scope === "test";
};

/**
 * Get the current table suffix
 * @returns The current table suffix (e.g., "_test") or empty string
 */
export const getTableSuffix = (): string => {
  return scope === "test" ? "_test" : "";
};

/**
 * Get the current scope
 * @returns The current scope ("test" or "prod")
 */
export const getScope = (): string => {
  return scope;
};
