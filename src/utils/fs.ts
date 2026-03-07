import { outputFile, outputJson } from "fs-extra/esm";
import path from "path";

/**
 * Write a text file, creating intermediate directories as needed.
 */
export async function writeFile(
  filePath: string,
  content: string,
): Promise<void> {
  await outputFile(filePath, content, "utf-8");
}

/**
 * Write a JSON file with 2-space indentation.
 */
export async function writeJsonFile(
  filePath: string,
  content: unknown,
): Promise<void> {
  await outputJson(filePath, content, { spaces: 2 });
}

/**
 * Resolve a path relative to a project root.
 */
export function projectPath(root: string, ...segments: string[]): string {
  return path.join(root, ...segments);
}
