import fs from 'node:fs/promises';
import path from 'node:path';

import { exportResearchDataset, type ResearchExportFormat } from '../lib/services/research-export';

function readArg(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] || null;
}

function parseFormat(value: string | null): ResearchExportFormat {
  if (value === 'csv' || value === 'json') {
    return value;
  }

  throw new Error('Usage: tsx scripts/exportData.ts --format json|csv --out <path>');
}

async function main() {
  const format = parseFormat(readArg('--format'));
  const out = readArg('--out');
  if (!out) {
    throw new Error('Usage: tsx scripts/exportData.ts --format json|csv --out <path>');
  }

  const dataset = await exportResearchDataset({ format });
  const outputPath = path.resolve(process.cwd(), out);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, dataset.content, 'utf8');
  console.log(`Exported ${format.toUpperCase()} research dataset to ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
