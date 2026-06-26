const VERIFICATION_TABLES = [
  { tableName: 'User', alias: 'users' },
  { tableName: 'ChildProfile', alias: 'child_profiles' },
  { tableName: 'DoctorProfile', alias: 'doctor_profiles' },
  { tableName: 'AssessmentHistory', alias: 'assessments' },
  { tableName: 'Admin', alias: 'admins' },
  { tableName: 'ApiKey', alias: 'api_keys' },
  { tableName: 'SystemConfig', alias: 'system_configs' },
];

export function formatUtcTimestamp(date) {
  const iso = date.toISOString();
  return iso.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function redactDatabaseUrl(value) {
  try {
    const parsed = new URL(value);
    if (parsed.password) {
      parsed.password = '***';
    }
    return parsed.toString();
  } catch {
    return value.replace(/(postgres(?:ql)?:\/\/[^:]+:)([^@]+)(@.+)/i, '$1***$3');
  }
}

export function buildVerificationSql() {
  const countClauses = VERIFICATION_TABLES.map(
    ({ tableName, alias }) => `  (SELECT COUNT(*) FROM "${tableName}") AS ${alias}`,
  ).join(',\n');

  return `-- Compare these row counts between the old production database and the restored database.
-- Note: Prisma model MemberProfile is mapped to ChildProfile in the physical PostgreSQL schema.
SELECT
${countClauses};

-- Verify pgvector is available in the restored database.
SELECT extname, extversion
FROM pg_extension
WHERE extname = 'vector';
`;
}

export function buildEnvSnapshotInstructions() {
  return `# Production Env Snapshot Instructions

1. Copy the current production \`.env.production\` file out of the server before reinstalling OpenCloudOS 9.
2. Store the file offline in a secure location that is not synced to git.
3. Do not commit the file or paste secrets into git, chat logs, or issue trackers.
4. Before cutover, confirm the snapshot still contains the current domain, HTTPS certificate workflow notes, exposed ports, and SSH access details.
5. Restore the same \`.env.production\` file to \`/opt/ai-scale-system/shared/.env.production\` on the rebuilt server before starting the app container.
`;
}

export function buildManifest({
  timestamp,
  bundleDirectory,
  dumpFilename,
  dumpSha256,
  dumpSizeBytes,
  dumpContentsFilename,
  verificationSqlFilename,
  envSnapshotFilename,
  sourceDatabaseUrl,
}) {
  return {
    createdAt: new Date().toISOString(),
    timestamp,
    bundleDirectory,
    sourceDatabaseUrl: redactDatabaseUrl(sourceDatabaseUrl),
    dump: {
      filename: dumpFilename,
      sha256: dumpSha256,
      sizeBytes: dumpSizeBytes,
    },
    artifacts: [
      dumpFilename,
      dumpContentsFilename,
      verificationSqlFilename,
      envSnapshotFilename,
      `${dumpFilename}.sha256`,
    ],
    notes: [
      'Keep the current production .env.production offline and out of git.',
      'Run restore-verification.sql against both source and restored databases before reopening traffic.',
    ],
  };
}
