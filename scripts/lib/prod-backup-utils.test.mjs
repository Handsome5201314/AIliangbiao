import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildManifest,
  buildEnvSnapshotInstructions,
  buildVerificationSql,
  formatUtcTimestamp,
  redactDatabaseUrl,
} from './prod-backup-utils.mjs';

test('formatUtcTimestamp formats a date as an ISO-like UTC bundle id', () => {
  const timestamp = formatUtcTimestamp(new Date('2026-04-28T12:34:56.789Z'));
  assert.equal(timestamp, '20260428T123456Z');
});

test('redactDatabaseUrl masks passwords but preserves host and database', () => {
  const redacted = redactDatabaseUrl(
    'postgresql://ai_scale_app:super-secret@db.example.com:5432/ai_scale_db?schema=public',
  );

  assert.equal(
    redacted,
    'postgresql://ai_scale_app:***@db.example.com:5432/ai_scale_db?schema=public',
  );
});

test('buildVerificationSql uses physical table names required by the current schema mapping', () => {
  const sql = buildVerificationSql();

  assert.match(sql, /"User"/);
  assert.match(sql, /"ChildProfile"/);
  assert.match(sql, /"DoctorProfile"/);
  assert.match(sql, /"AssessmentHistory"/);
  assert.match(sql, /"Admin"/);
  assert.match(sql, /"ApiKey"/);
  assert.match(sql, /"SystemConfig"/);
  assert.match(sql, /MemberProfile is mapped to ChildProfile/);
  assert.doesNotMatch(sql, /FROM "MemberProfile"/);
});

test('buildManifest records the generated backup bundle artifacts', () => {
  const manifest = buildManifest({
    timestamp: '20260428T123456Z',
    bundleDirectory: 'backups/prod/20260428T123456Z',
    dumpFilename: 'production.dump',
    dumpSha256: 'abc123',
    dumpSizeBytes: 4096,
    dumpContentsFilename: 'production.dump.contents.txt',
    verificationSqlFilename: 'restore-verification.sql',
    envSnapshotFilename: 'env-snapshot-instructions.md',
    sourceDatabaseUrl: 'postgresql://ai_scale_app:super-secret@db.example.com:5432/ai_scale_db',
  });

  assert.equal(manifest.timestamp, '20260428T123456Z');
  assert.equal(manifest.bundleDirectory, 'backups/prod/20260428T123456Z');
  assert.equal(manifest.dump.sha256, 'abc123');
  assert.equal(manifest.dump.sizeBytes, 4096);
  assert.equal(
    manifest.sourceDatabaseUrl,
    'postgresql://ai_scale_app:***@db.example.com:5432/ai_scale_db',
  );
  assert.deepEqual(manifest.artifacts, [
    'production.dump',
    'production.dump.contents.txt',
    'restore-verification.sql',
    'env-snapshot-instructions.md',
    'production.dump.sha256',
  ]);
});

test('buildEnvSnapshotInstructions captures the production env preservation checklist', () => {
  const instructions = buildEnvSnapshotInstructions();

  assert.match(instructions, /\.env\.production/);
  assert.match(instructions, /Do not commit the file or paste secrets into git/i);
  assert.match(instructions, /domain/i);
  assert.match(instructions, /certificate/i);
  assert.match(instructions, /SSH/i);
});
