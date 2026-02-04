/**
 * Utility for handling database table suffixes based on environment
 */

const tableSuffix = process.env.NEXT_PUBLIC_DB_TABLE_SUFFIX ?? "";

/**
 * Returns the table name with the appropriate suffix based on environment
 * @param baseName - The base table name (e.g., "users", "chat_sessions")
 * @returns The table name with suffix applied (e.g., "users_test", "chat_sessions_test")
 */
export const getTableName = (baseName: string): string => {
  return `${baseName}${tableSuffix}`;
};

/**
 * Check if we're running in test environment
 * @returns true if NEXT_PUBLIC_DB_TABLE_SUFFIX is set and not empty
 */
export const isTestEnvironment = (): boolean => {
  return tableSuffix.length > 0;
};

/**
 * Get the current table suffix
 * @returns The current table suffix (e.g., "_test") or empty string
 */
export const getTableSuffix = (): string => {
  return tableSuffix;
};
