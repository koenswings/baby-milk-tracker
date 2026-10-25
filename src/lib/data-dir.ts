import path from "path";

/**
 * Single resolver for the data directory used by every server-side store
 * (feeds, settings, settings history, weights).
 * The DATA_DIR environment variable always wins (production compose sets
 * DATA_DIR=/app/data); otherwise default to `<cwd>/data`.
 * Resolved on every call so tests and late env changes are honoured.
 */
export function getDataDir(): string {
  const fromEnv = process.env.DATA_DIR;
  return fromEnv && fromEnv.trim() !== "" ? fromEnv : path.join(process.cwd(), "data");
}

export function dataFile(name: string): string {
  return path.join(getDataDir(), name);
}
