export interface StreamFormatter {
  formatChunk(content: string): string;
  formatMetadata(data: Record<string, unknown>): string;
  formatError(message: string): string;
  formatDone(data: Record<string, unknown>): string;
}

const escapeSSE = (str: string): string => {
  return str
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
};

const formatSSE = (data: Record<string, unknown>): string => {
  const json = JSON.stringify(data);
  const escaped = escapeSSE(json);
  return `data: ${escaped}\n\n`;
};

export const createStreamFormatter = (): StreamFormatter => ({
  formatChunk(content: string): string {
    return formatSSE({ type: "chunk", content });
  },

  formatMetadata(data: Record<string, unknown>): string {
    return formatSSE({ type: "metadata", ...data });
  },

  formatError(message: string): string {
    return formatSSE({ type: "error", message });
  },

  formatDone(data: Record<string, unknown>): string {
    return formatSSE({ type: "done", ...data });
  },
});
