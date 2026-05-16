#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';

import {
  buildEnvSnapshotInstructions,
  buildManifest,
  buildVerificationSql,
  formatUtcTimestamp,
} from './lib/prod-backup-utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const DUMP_FILENAME = 'production.dump';
const DUMP_CONTENTS_FILENAME = 'production.dump.contents.txt';
const VERIFICATION_SQL_FILENAME = 'restore-verification.sql';
const ENV_SNAPSHOT_FILENAME = 'env-snapshot-instructions.md';
const MANIFEST_FILENAME = 'manifest.json';

function usage() {
  console.error('Usage: SOURCE_DATABASE_URL=postgresql://... node scripts/export-production-db.mjs');
  console.error("   or: node scripts/export-production-db.mjs 'postgresql://...'");
}

function getSourceDatabaseUrl() {
  return process.env.SOURCE_DATABASE_URL || process.argv[2] || '';
}

function getTimestamp() {
  return process.env.BACKUP_TIMESTAMP || formatUtcTimestamp(new Date());
}

function getBackupRoot() {
  return process.env.BACKUP_ROOT_DIR || path.join(ROOT_DIR, 'backups', 'prod');
}

function dockerPgDumpArgs(sourceDatabaseUrl) {
  return [
    'run',
    '--rm',
    'postgres:16-bookworm',
    'pg_dump',
    '--format=custom',
    '--no-owner',
    '--no-privileges',
    `--dbname=${sourceDatabaseUrl}`,
  ];
}

function dockerPgRestoreListArgs() {
  return ['run', '--rm', '-i', 'postgres:16-bookworm', 'pg_restore', '--list'];
}

function waitForExit(child, label) {
  return new Promise((resolve, reject) => {
    child.once('error', (error) => {
      reject(new Error(`${label} failed to start: ${error.message}`));
    });

    child.once('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${label} exited with code ${code}`));
    });
  });
}

async function runPgDump(sourceDatabaseUrl, dumpPath) {
  const child = spawn('docker', dockerPgDumpArgs(sourceDatabaseUrl), {
    stdio: ['ignore', 'pipe', 'inherit'],
  });

  await Promise.all([
    pipeline(child.stdout, createWriteStream(dumpPath)),
    waitForExit(child, 'docker pg_dump'),
  ]);
}

async function runPgRestoreList(dumpPath, dumpContentsPath) {
  const child = spawn('docker', dockerPgRestoreListArgs(), {
    stdio: ['pipe', 'pipe', 'inherit'],
  });

  await Promise.all([
    pipeline(createReadStream(dumpPath), child.stdin),
    pipeline(child.stdout, createWriteStream(dumpContentsPath)),
    waitForExit(child, 'docker pg_restore --list'),
  ]);
}

async function sha256File(filePath) {
  const hash = createHash('sha256');
  const stream = createReadStream(filePath);

  for await (const chunk of stream) {
    hash.update(chunk);
  }

  return hash.digest('hex');
}

async function main() {
  const sourceDatabaseUrl = getSourceDatabaseUrl();
  if (!sourceDatabaseUrl) {
    usage();
    process.exitCode = 1;
    return;
  }

  const timestamp = getTimestamp();
  const backupRoot = getBackupRoot();
  const outputDir = path.join(backupRoot, timestamp);
  const dumpPath = path.join(outputDir, DUMP_FILENAME);
  const dumpContentsPath = path.join(outputDir, DUMP_CONTENTS_FILENAME);
  const verificationSqlPath = path.join(outputDir, VERIFICATION_SQL_FILENAME);
  const envSnapshotPath = path.join(outputDir, ENV_SNAPSHOT_FILENAME);
  const manifestPath = path.join(outputDir, MANIFEST_FILENAME);

  await mkdir(outputDir, { recursive: true });
  await writeFile(verificationSqlPath, buildVerificationSql(), 'utf8');
  await writeFile(envSnapshotPath, buildEnvSnapshotInstructions(), 'utf8');

  await runPgDump(sourceDatabaseUrl, dumpPath);

  const dumpSha256 = await sha256File(dumpPath);
  await writeFile(path.join(outputDir, `${DUMP_FILENAME}.sha256`), `${dumpSha256}  ${DUMP_FILENAME}\n`, 'utf8');

  await runPgRestoreList(dumpPath, dumpContentsPath);

  const dumpStats = await stat(dumpPath);
  const manifest = buildManifest({
    timestamp,
    bundleDirectory: path.relative(ROOT_DIR, outputDir).replace(/\\/g, '/'),
    dumpFilename: DUMP_FILENAME,
    dumpSha256,
    dumpSizeBytes: dumpStats.size,
    dumpContentsFilename: DUMP_CONTENTS_FILENAME,
    verificationSqlFilename: VERIFICATION_SQL_FILENAME,
    envSnapshotFilename: ENV_SNAPSHOT_FILENAME,
    sourceDatabaseUrl,
  });

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log(`Backup bundle created: ${path.relative(ROOT_DIR, outputDir)}`);
  console.log(`Dump: ${path.relative(ROOT_DIR, dumpPath)}`);
  console.log(`SHA256: ${dumpSha256}`);
  console.log(`Manifest: ${path.relative(ROOT_DIR, manifestPath)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
