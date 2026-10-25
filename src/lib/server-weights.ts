import fs from 'fs';
import { WeightEntry } from './weights';
import { dataFile, getDataDir } from './data-dir';
import { writeFileAtomicSync } from './atomic-write';

const weightsFile = () => dataFile('weights.json');

function ensureDir() {
  const dir = getDataDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function readWeights(): WeightEntry[] {
  ensureDir();
  if (!fs.existsSync(weightsFile())) return [];
  try { return JSON.parse(fs.readFileSync(weightsFile(), 'utf8')); }
  catch { return []; }
}

export function writeWeights(weights: WeightEntry[]): void {
  ensureDir();
  writeFileAtomicSync(weightsFile(), JSON.stringify(weights));
}
