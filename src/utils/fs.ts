import { mkdir, writeFile as fsWriteFile } from "node:fs/promises";
import { dirname } from "node:path";
import path from "path";

/**
 * Write a text file, creating intermediate directories as needed.
 */
export async function writeFile(
  filePath: string,
  content: string,
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await fsWriteFile(filePath, content, "utf-8");
}

/**
 * Write a JSON file with 2-space indentation.
 */
export async function writeJsonFile(
  filePath: string,
  content: unknown,
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await fsWriteFile(filePath, JSON.stringify(content, null, 2) + "\n", "utf-8");
}

/**
 * Resolve a path relative to a project root.
 */
export function projectPath(root: string, ...segments: string[]): string {
  return path.join(root, ...segments);
}
