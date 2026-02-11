/**
 * Utility for handling database table suffixes based on environment scope
 */

const scope = process.env.NEXT_PUBLIC_SCOPE ?? "prod";

/**
 * Returns the table name with the appropriate suffix based on scope
 * @param baseName - The base table name (e.g., "users", "chat_sessions")
 * @returns The table name with suffix applied (e.g., "users_test", "chat_sessions_test")
 */
export const getTableName = (baseName: string): string => {
  if (scope === "test") {
    return `${baseName}_test`;
  }
  return baseName;
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
