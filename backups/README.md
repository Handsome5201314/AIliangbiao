# Production Backup Bundles

The migration workflow writes direct production database exports into `backups/prod/<UTC timestamp>/`.

Each bundle is expected to contain:

- `production.dump`
- `production.dump.sha256`
- `production.dump.contents.txt`
- `restore-verification.sql`
- `env-snapshot-instructions.md`
- `manifest.json`

Do not commit production dump files or production `.env.production` snapshots to git.
