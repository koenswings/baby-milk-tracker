import fs from "fs";
import os from "os";
import path from "path";

export function tmpDataDir(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "mw-data-"));
  process.env.DATA_DIR = d;
  return d;
}
export function readLines(file: string): Record<string, unknown>[] {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}
