import { randomUUID } from "node:crypto";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

export async function writeFileAtomic(targetPath: string, contents: string): Promise<void> {
  await mkdir(dirname(targetPath), { recursive: true });

  const tempPath = resolve(dirname(targetPath), `.${basename(targetPath)}.${randomUUID()}.tmp`);

  try {
    await writeFile(tempPath, contents, "utf8");
    await rename(tempPath, targetPath);
  } catch (error) {
    await unlink(tempPath).catch(() => {});
    throw error;
  }
}
