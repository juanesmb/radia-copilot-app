import { describe, expect, it } from "vitest";
import { createStreamFormatter } from "../streamFormatter";

describe("StreamFormatter", () => {
  const formatter = createStreamFormatter();

  describe("formatChunk", () => {
    it("should format chunk event correctly", () => {
      const result = formatter.formatChunk("Hello");
      expect(result).toContain('data: ');
      expect(result).toContain('"type":"chunk"');
      expect(result).toContain('"content":"Hello"');
      expect(result.endsWith("\n\n")).toBe(true);
    });

    it("should escape newlines in content", () => {
      const result = formatter.formatChunk("Line 1\nLine 2");
      expect(result).toContain('\\n');
      expect(result).not.toContain('\nLine');
    });

    it("should escape special characters", () => {
      const result = formatter.formatChunk('Text with "quotes" and \t tabs');
      expect(result).toContain('\\t');
    });
  });

  describe("formatMetadata", () => {
    it("should format metadata event correctly", () => {
      const data = {
        reportId: "123",
        title: "Test Report",
        studyType: "ct-abdomen",
      };
      const result = formatter.formatMetadata(data);

      expect(result).toContain('data: ');
      expect(result).toContain('"type":"metadata"');
      expect(result).toContain('"reportId":"123"');
      expect(result).toContain('"title":"Test Report"');
      expect(result).toContain('"studyType":"ct-abdomen"');
      expect(result.endsWith("\n\n")).toBe(true);
    });

    it("should handle empty metadata", () => {
      const result = formatter.formatMetadata({});
      expect(result).toContain('"type":"metadata"');
    });
  });

  describe("formatError", () => {
    it("should format error event correctly", () => {
      const result = formatter.formatError("Something went wrong");
      expect(result).toContain('data: ');
      expect(result).toContain('"type":"error"');
      expect(result).toContain('"message":"Something went wrong"');
      expect(result.endsWith("\n\n")).toBe(true);
    });

    it("should escape error message with special characters", () => {
      const result = formatter.formatError('Error with "quotes"');
      expect(result).toContain('\\"');
    });
  });

  describe("formatDone", () => {
    it("should format done event correctly", () => {
      const data = { reportId: "456" };
      const result = formatter.formatDone(data);

      expect(result).toContain('data: ');
      expect(result).toContain('"type":"done"');
      expect(result).toContain('"reportId":"456"');
      expect(result.endsWith("\n\n")).toBe(true);
    });

    it("should handle multiple fields in done event", () => {
      const data = { reportId: "789", status: "completed" };
      const result = formatter.formatDone(data);

      expect(result).toContain('"reportId":"789"');
      expect(result).toContain('"status":"completed"');
    });
  });

  describe("SSE format compliance", () => {
    it("should always end with double newline", () => {
      const chunk = formatter.formatChunk("test");
      const metadata = formatter.formatMetadata({ test: "value" });
      const error = formatter.formatError("error");
      const done = formatter.formatDone({});

      expect(chunk.endsWith("\n\n")).toBe(true);
      expect(metadata.endsWith("\n\n")).toBe(true);
      expect(error.endsWith("\n\n")).toBe(true);
      expect(done.endsWith("\n\n")).toBe(true);
    });

    it("should always start with 'data: ' prefix", () => {
      const chunk = formatter.formatChunk("test");
      const metadata = formatter.formatMetadata({});
      const error = formatter.formatError("error");
      const done = formatter.formatDone({});

      expect(chunk.startsWith("data: ")).toBe(true);
      expect(metadata.startsWith("data: ")).toBe(true);
      expect(error.startsWith("data: ")).toBe(true);
      expect(done.startsWith("data: ")).toBe(true);
    });
  });
});
