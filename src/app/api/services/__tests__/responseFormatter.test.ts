import { describe, expect, it } from "vitest";
import { createResponseFormatter } from "../responseFormatter";

describe("ResponseFormatter", () => {
  it("should extract title from first line and rest as report", () => {
    const formatter = createResponseFormatter();
    const input = "TC DE ABDOMEN CON CONTRASTE\n\nHígado: dentro de límites normales.\nBazo: dentro de límites normales.";

    const result = formatter.format(input);

    expect(result.title).toBe("TC DE ABDOMEN CON CONTRASTE");
    expect(result.report).toBe("TC DE ABDOMEN CON CONTRASTE\n\nHígado: dentro de límites normales.\nBazo: dentro de límites normales.");
  });

  it("should handle single line content", () => {
    const formatter = createResponseFormatter();
    const input = "ECOGRAFÍA DE TIROIDES";

    const result = formatter.format(input);

    expect(result.title).toBe("ECOGRAFÍA DE TIROIDES");
    expect(result.report).toBe("ECOGRAFÍA DE TIROIDES");
  });

  it("should handle empty first line", () => {
    const formatter = createResponseFormatter();
    const input = "\n\nHígado: dentro de límites normales.";

    const result = formatter.format(input);

    expect(result.title).toBe("");
    expect(result.report).toBe("Hígado: dentro de límites normales.");
  });

  it("should return empty strings for empty input", () => {
    const formatter = createResponseFormatter();
    const input = "";

    const result = formatter.format(input);

    expect(result.title).toBe("");
    expect(result.report).toBe("");
  });

  it("should handle whitespace-only input", () => {
    const formatter = createResponseFormatter();
    const input = "   \n\n   ";

    const result = formatter.format(input);

    expect(result.title).toBe("");
    expect(result.report).toBe("");
  });

  it("should preserve multiple newlines in report body", () => {
    const formatter = createResponseFormatter();
    const input = "TC DE ABDOMEN\n\nHígado: normal.\n\nBazo: normal.";

    const result = formatter.format(input);

    expect(result.title).toBe("TC DE ABDOMEN");
    expect(result.report).toContain("Hígado: normal.");
    expect(result.report).toContain("Bazo: normal.");
  });
});
