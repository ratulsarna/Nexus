import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthStorage, type AuthCredential } from "@mariozechner/pi-coding-agent";

const oauthRefreshMockState = vi.hoisted(() => ({
  refreshAnthropicToken: vi.fn()
}));

vi.mock("@mariozechner/pi-ai/dist/utils/oauth/anthropic.js", () => ({
  refreshAnthropicToken: (...args: unknown[]) => oauthRefreshMockState.refreshAnthropicToken(...args)
}));

import { ClaudeAgentSdkRuntime } from "../swarm/claude-agent-sdk-runtime.js";
import type { AgentDescriptor } from "../swarm/types.js";

function createDescriptor(rootDir: string): AgentDescriptor {
  const now = "2026-01-01T00:00:00.000Z";

  return {
    agentId: "claude-worker",
    displayName: "Claude Worker",
    role: "worker",
    managerId: "manager",
    status: "idle",
    createdAt: now,
    updatedAt: now,
    cwd: rootDir,
    model: {
      provider: "claude-agent-sdk",
      modelId: "claude-opus-4-6",
      thinkingLevel: "xhigh"
    },
    sessionFile: join(rootDir, "sessions", "claude-worker.jsonl")
  };
}

async function createRuntimeRootDir(): Promise<string> {
  const rootDir = await mkdtemp(join(tmpdir(), "claude-agent-sdk-runtime-test-"));
  await mkdir(join(rootDir, "sessions"), { recursive: true });
  await mkdir(join(rootDir, "auth"), { recursive: true });
  return rootDir;
}

function setAuthCredential(
  authFile: string,
  provider: string,
  credential: AuthCredential
): void {
  const authStorage = AuthStorage.create(authFile);
  authStorage.set(provider, credential);
}

describe("ClaudeAgentSdkRuntime auth policy", () => {
  beforeEach(() => {
    oauthRefreshMockState.refreshAnthropicToken.mockReset();
    oauthRefreshMockState.refreshAnthropicToken.mockImplementation(async () => {
      throw new Error("Unexpected OAuth refresh call");
    });
  });

  it("fails closed when only anthropic credentials are present", async () => {
    const rootDir = await createRuntimeRootDir();
    const authFile = join(rootDir, "auth", "auth.json");

    setAuthCredential(authFile, "anthropic", {
      type: "oauth",
      access: "anthropic-oauth-token",
      refresh: "",
      expires: String(Date.now() + 60_000)
    } as unknown as AuthCredential);

    await expect(
      ClaudeAgentSdkRuntime.create({
        descriptor: createDescriptor(rootDir),
        callbacks: {
          onStatusChange: async () => {}
        },
        systemPrompt: "You are a worker",
        tools: [],
        authFile
      })
    ).rejects.toThrow("Missing claude-agent-sdk credentials.");
  });

  it("rejects api_key credentials for claude-agent-sdk", async () => {
    const rootDir = await createRuntimeRootDir();
    const authFile = join(rootDir, "auth", "auth.json");

    setAuthCredential(authFile, "claude-agent-sdk", {
      type: "api_key",
      key: "sk-ant-test"
    } as unknown as AuthCredential);

    await expect(
      ClaudeAgentSdkRuntime.create({
        descriptor: createDescriptor(rootDir),
        callbacks: {
          onStatusChange: async () => {}
        },
        systemPrompt: "You are a worker",
        tools: [],
        authFile
      })
    ).rejects.toThrow("claude-agent-sdk requires OAuth credentials.");
  });

  it("accepts oauth credentials for claude-agent-sdk", async () => {
    const rootDir = await createRuntimeRootDir();
    const authFile = join(rootDir, "auth", "auth.json");

    setAuthCredential(authFile, "claude-agent-sdk", {
      type: "oauth",
      access: "claude-oauth-token",
      refresh: "",
      expires: String(Date.now() + 60_000)
    } as unknown as AuthCredential);

    const runtime = await ClaudeAgentSdkRuntime.create({
      descriptor: createDescriptor(rootDir),
      callbacks: {
        onStatusChange: async () => {}
      },
      systemPrompt: "You are a worker",
      tools: [],
      authFile
    });

    expect(runtime.getStatus()).toBe("idle");
    await runtime.terminate({ abort: true });
  });

  it("rejects expired oauth credentials for claude-agent-sdk", async () => {
    const rootDir = await createRuntimeRootDir();
    const authFile = join(rootDir, "auth", "auth.json");

    setAuthCredential(authFile, "claude-agent-sdk", {
      type: "oauth",
      access: "claude-oauth-token",
      refresh: "",
      expires: String(Date.now() - 60_000)
    } as unknown as AuthCredential);

    await expect(
      ClaudeAgentSdkRuntime.create({
        descriptor: createDescriptor(rootDir),
        callbacks: {
          onStatusChange: async () => {}
        },
        systemPrompt: "You are a worker",
        tools: [],
        authFile
      })
    ).rejects.toThrow("claude-agent-sdk OAuth token expired.");
  });

  it("refreshes expired oauth credentials for claude-agent-sdk when refresh token is available", async () => {
    const rootDir = await createRuntimeRootDir();
    const authFile = join(rootDir, "auth", "auth.json");

    setAuthCredential(authFile, "claude-agent-sdk", {
      type: "oauth",
      access: "stale-oauth-token",
      refresh: "refresh-token",
      expires: String(Date.now() - 60_000)
    } as unknown as AuthCredential);
    oauthRefreshMockState.refreshAnthropicToken.mockResolvedValue({
      access: "fresh-oauth-token",
      refresh: "fresh-refresh-token",
      expires: Date.now() + 60_000
    });

    const runtime = await ClaudeAgentSdkRuntime.create({
      descriptor: createDescriptor(rootDir),
      callbacks: {
        onStatusChange: async () => {}
      },
      systemPrompt: "You are a worker",
      tools: [],
      authFile
    });

    expect(oauthRefreshMockState.refreshAnthropicToken).toHaveBeenCalledTimes(1);
    expect(oauthRefreshMockState.refreshAnthropicToken).toHaveBeenCalledWith("refresh-token");
    const stored = AuthStorage.create(authFile).get("claude-agent-sdk") as
      | (AuthCredential & { access?: string; refresh?: string })
      | undefined;
    expect(stored?.access).toBe("fresh-oauth-token");
    expect(stored?.refresh).toBe("fresh-refresh-token");
    expect(runtime.getStatus()).toBe("idle");

    await runtime.terminate({ abort: true });
  });

  it("fails when expired oauth credentials cannot be refreshed", async () => {
    const rootDir = await createRuntimeRootDir();
    const authFile = join(rootDir, "auth", "auth.json");

    setAuthCredential(authFile, "claude-agent-sdk", {
      type: "oauth",
      access: "stale-oauth-token",
      refresh: "refresh-token",
      expires: String(Date.now() - 60_000)
    } as unknown as AuthCredential);
    oauthRefreshMockState.refreshAnthropicToken.mockRejectedValue(new Error("refresh rejected"));

    await expect(
      ClaudeAgentSdkRuntime.create({
        descriptor: createDescriptor(rootDir),
        callbacks: {
          onStatusChange: async () => {}
        },
        systemPrompt: "You are a worker",
        tools: [],
        authFile
      })
    ).rejects.toThrow("refresh failed");
  });

  it("accepts oauth credentials when expiry is a future unix-seconds timestamp", async () => {
    const rootDir = await createRuntimeRootDir();
    const authFile = join(rootDir, "auth", "auth.json");

    setAuthCredential(authFile, "claude-agent-sdk", {
      type: "oauth",
      access: "claude-oauth-token",
      refresh: "",
      expires: String(Math.floor((Date.now() + 60_000) / 1_000))
    } as unknown as AuthCredential);

    const runtime = await ClaudeAgentSdkRuntime.create({
      descriptor: createDescriptor(rootDir),
      callbacks: {
        onStatusChange: async () => {}
      },
      systemPrompt: "You are a worker",
      tools: [],
      authFile
    });

    expect(runtime.getStatus()).toBe("idle");
    await runtime.terminate({ abort: true });
  });

  it("rejects oauth credentials when expiry is an expired unix-seconds timestamp", async () => {
    const rootDir = await createRuntimeRootDir();
    const authFile = join(rootDir, "auth", "auth.json");

    setAuthCredential(authFile, "claude-agent-sdk", {
      type: "oauth",
      access: "claude-oauth-token",
      refresh: "",
      expires: String(Math.floor((Date.now() - 60_000) / 1_000))
    } as unknown as AuthCredential);

    await expect(
      ClaudeAgentSdkRuntime.create({
        descriptor: createDescriptor(rootDir),
        callbacks: {
          onStatusChange: async () => {}
        },
        systemPrompt: "You are a worker",
        tools: [],
        authFile
      })
    ).rejects.toThrow("claude-agent-sdk OAuth token expired.");
  });

  it("accepts oauth credentials when expiry is a future numeric unix-seconds timestamp", async () => {
    const rootDir = await createRuntimeRootDir();
    const authFile = join(rootDir, "auth", "auth.json");

    setAuthCredential(authFile, "claude-agent-sdk", {
      type: "oauth",
      access: "claude-oauth-token",
      refresh: "",
      expires: Math.floor((Date.now() + 60_000) / 1_000)
    } as unknown as AuthCredential);

    const runtime = await ClaudeAgentSdkRuntime.create({
      descriptor: createDescriptor(rootDir),
      callbacks: {
        onStatusChange: async () => {}
      },
      systemPrompt: "You are a worker",
      tools: [],
      authFile
    });

    expect(runtime.getStatus()).toBe("idle");
    await runtime.terminate({ abort: true });
  });

  it("rejects oauth credentials when expiry is an expired numeric unix-seconds timestamp", async () => {
    const rootDir = await createRuntimeRootDir();
    const authFile = join(rootDir, "auth", "auth.json");

    setAuthCredential(authFile, "claude-agent-sdk", {
      type: "oauth",
      access: "claude-oauth-token",
      refresh: "",
      expires: Math.floor((Date.now() - 60_000) / 1_000)
    } as unknown as AuthCredential);

    await expect(
      ClaudeAgentSdkRuntime.create({
        descriptor: createDescriptor(rootDir),
        callbacks: {
          onStatusChange: async () => {}
        },
        systemPrompt: "You are a worker",
        tools: [],
        authFile
      })
    ).rejects.toThrow("claude-agent-sdk OAuth token expired.");
  });

  it("accepts oauth credentials when expiry is a future ISO timestamp", async () => {
    const rootDir = await createRuntimeRootDir();
    const authFile = join(rootDir, "auth", "auth.json");

    setAuthCredential(authFile, "claude-agent-sdk", {
      type: "oauth",
      access: "claude-oauth-token",
      refresh: "",
      expires: new Date(Date.now() + 60_000).toISOString()
    } as unknown as AuthCredential);

    const runtime = await ClaudeAgentSdkRuntime.create({
      descriptor: createDescriptor(rootDir),
      callbacks: {
        onStatusChange: async () => {}
      },
      systemPrompt: "You are a worker",
      tools: [],
      authFile
    });

    expect(runtime.getStatus()).toBe("idle");
    await runtime.terminate({ abort: true });
  });

  it("reports followUp when busy instead of steer", async () => {
    const rootDir = await createRuntimeRootDir();
    const authFile = join(rootDir, "auth", "auth.json");

    setAuthCredential(authFile, "claude-agent-sdk", {
      type: "oauth",
      access: "claude-oauth-token",
      refresh: "",
      expires: String(Date.now() + 60_000)
    } as unknown as AuthCredential);

    const runtime = await ClaudeAgentSdkRuntime.create({
      descriptor: createDescriptor(rootDir),
      callbacks: {
        onStatusChange: async () => {}
      },
      systemPrompt: "You are a worker",
      tools: [],
      authFile
    });

    // Force busy state without starting SDK query execution.
    (runtime as unknown as { processingLoop?: Promise<void> }).processingLoop = new Promise<void>(() => {});

    const receipt = await runtime.sendMessage("queued");
    expect(receipt.acceptedMode).toBe("followUp");

    (runtime as unknown as { processingLoop?: Promise<void> }).processingLoop = undefined;
    await runtime.terminate({ abort: true });
  });
});
