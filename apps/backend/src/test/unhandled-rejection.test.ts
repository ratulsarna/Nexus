import { describe, expect, it } from "vitest";
import { assessUnhandledRejection } from "../utils/unhandled-rejection.js";

describe("assessUnhandledRejection", () => {
  it("classifies ProcessTransport write readiness failures as known SDK shutdown race", () => {
    const error = new Error("ProcessTransport is not ready for writing");

    expect(assessUnhandledRejection(error)).toMatchObject({
      classification: "known_claude_sdk_shutdown_race",
      message: "ProcessTransport is not ready for writing"
    });
  });

  it("requires Claude SDK context for generic write-after-end failures", () => {
    const error = new Error("write after end");
    error.stack = "Error: write after end\n    at someOtherDependency (x.js:1:1)";

    expect(assessUnhandledRejection(error)).toMatchObject({
      classification: "unknown",
      message: "write after end"
    });
  });

  it("classifies generic write-after-end failures with Claude SDK stack context", () => {
    const error = new Error("write after end");
    error.stack =
      "Error: write after end\n" +
      "    at U4.handleControlRequest (sdk.mjs:20:161)\n" +
      "    at file:///node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs:20:1";

    expect(assessUnhandledRejection(error)).toMatchObject({
      classification: "known_claude_sdk_shutdown_race",
      message: "write after end"
    });
  });

  it("classifies unrelated rejections as unknown", () => {
    const error = new Error("Database connection failed");

    expect(assessUnhandledRejection(error)).toMatchObject({
      classification: "unknown",
      message: "Database connection failed"
    });
  });
});
