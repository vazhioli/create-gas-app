import pc from "picocolors";

export const logger = {
  info: (msg: string) => console.log(pc.cyan(`  ${msg}`)),
  success: (msg: string) => console.log(pc.green(`  ✓ ${msg}`)),
  warn: (msg: string) => console.log(pc.yellow(`  ⚠ ${msg}`)),
  error: (msg: string) => console.log(pc.red(`  ✗ ${msg}`)),
  step: (msg: string) => console.log(pc.white(`  ${msg}`)),
  dim: (msg: string) => console.log(pc.dim(`  ${msg}`)),
  break: () => console.log(),
};

export const gradient = (text: string) => {
  // Simple ASCII gradient effect using picocolors
  return pc.bold(pc.cyan(text));
};
