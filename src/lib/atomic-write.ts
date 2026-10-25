import fs from "fs";
import path from "path";

/**
 * Write a file atomically: write to a temp file in the same directory, fsync,
 * then rename over the target. A crash at any point leaves either the old
 * file or the new file intact — never a half-written one.
 */
export function writeFileAtomicSync(file: string, data: string): void {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
  const fd = fs.openSync(tmp, "w");
  try {
    fs.writeSync(fd, data);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  try {
    fs.renameSync(tmp, file);
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    throw e;
  }
}

/** Append one line durably (used for the JSONL history; append is the atomic unit). */
export function appendLineSync(file: string, line: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const fd = fs.openSync(file, "a");
  try {
    fs.writeSync(fd, line.endsWith("\n") ? line : line + "\n");
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}
