import { describe, expect, it } from "vitest";

import { createResponseFormatter } from "../responseFormatter";

const formatter = createResponseFormatter();

describe("responseFormatter", () => {
  it("returns parsed JSON content when payload is valid", () => {
    const result = formatter.format(
      JSON.stringify({
        title: "Chest X-Ray",
        report: "Complete report text here",
      }),
    );

    expect(result).toEqual({
      title: "Chest X-Ray",
      report: "Complete report text here",
    });
  });

  it("strips markdown fences before parsing", () => {
    const content = [
      "```json",
      '{ "title": "Brain MRI", "report": "Complete report text" }',
      "```",
    ].join("\n");

    const result = formatter.format(content);
    expect(result.title).toBe("Brain MRI");
    expect(result.report).toBe("Complete report text");
  });

  it("falls back to raw content as report when JSON parse fails", () => {
    const raw = "Some raw text content that is not JSON";
    const result = formatter.format(raw);

    expect(result.title).toBe("");
    expect(result.report).toBe("Some raw text content that is not JSON");
  });

  it("handles empty content", () => {
    const result = formatter.format("");

    expect(result).toEqual({
      title: "",
      report: "",
    });
  });
});

