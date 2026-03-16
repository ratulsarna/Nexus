import { mkdir, mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { writeFileAtomic } from "../utils/write-file-atomic.js";

describe("writeFileAtomic", () => {
  it("writes the target file without leaving temp files behind", async () => {
    const root = await mkdtemp(join(tmpdir(), "swarm-write-file-atomic-"));
    const targetPath = join(root, "nested", "state.json");

    await writeFileAtomic(targetPath, '{"ok":true}\n');

    await expect(readFile(targetPath, "utf8")).resolves.toBe('{"ok":true}\n');

    const nestedEntries = await readdir(join(root, "nested"));
    expect(nestedEntries).toEqual(["state.json"]);
  });

  it("cleans up the temp file when the final rename fails", async () => {
    const root = await mkdtemp(join(tmpdir(), "swarm-write-file-atomic-"));
    const targetPath = join(root, "target-dir");
    await mkdir(targetPath, { recursive: true });

    await expect(writeFileAtomic(targetPath, "should fail\n")).rejects.toThrow();

    const rootEntries = await readdir(root);
    expect(rootEntries).toEqual(["target-dir"]);
  });
});
