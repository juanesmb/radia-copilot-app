import { describe, expect, it } from "vitest";

import { createResponseFormatter } from "../responseFormatter";

const formatter = createResponseFormatter();

describe("responseFormatter", () => {
  it("returns parsed JSON content when payload is valid", () => {
    const result = formatter.format(
      JSON.stringify({
        studyTitle: "Chest X-Ray",
        findings: "findings text",
        impression: "impression text",
      }),
    );

    expect(result).toEqual({
      studyTitle: "Chest X-Ray",
      findings: "findings text",
      impression: "impression text",
    });
  });

  it("merges legacy results into findings", () => {
    const result = formatter.format(
      JSON.stringify({
        studyTitle: "Brain MRI",
        findings: "structured findings",
        results: "quantitative data",
        impression: "concise",
      }),
    );

    expect(result.findings).toContain("structured findings");
    expect(result.findings).toContain("quantitative data");
  });

  it("strips markdown fences before parsing", () => {
    const content = [
      "```json",
      '{ "studyTitle": "Brain MRI", "findings": "structured", "impression": "concise" }',
      "```",
    ].join("\n");

    const result = formatter.format(content);
    expect(result.studyTitle).toBe("Brain MRI");
    expect(result.findings).toBe("structured");
    expect(result.impression).toBe("concise");
  });

  it("falls back to raw content when JSON parse fails", () => {
    const raw = "STUDY TITLE\nChest X-Ray\n\nFINDINGS\nProbable pneumonia.\n\nRESULTS\nNo significant changes.\n\nIMPRESSION\nRecommend follow-up imaging.";
    const result = formatter.format(raw);

    expect(result.studyTitle).toContain("Chest X-Ray");
    expect(result.findings).toContain("Probable pneumonia");
    expect(result.findings).toContain("No significant changes");
    expect(result.impression).toContain("Recommend follow-up");
  });
});

