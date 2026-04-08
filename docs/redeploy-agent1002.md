# Agent1002 Repeat Deploy

Use this when `ailiangbiao.agentpit.io` already points at `136.110.9.74` and the server already trusts your SSH key.

## Requirements

- Windows PowerShell
- `ssh`, `scp`, `tar`
- A private key that is already present in the server's `authorized_keys`

## Command

```powershell
pwsh -File .\scripts\redeploy-agent1002.ps1 -KeyPath C:\path\to\your\id_ed25519
```

## What it does

- Packages the current repo into a release tarball
- Uploads the tarball plus a remote deploy helper
- Backs up current nginx/app/postgres state under `/root/deploy-backup/<timestamp>`
- Rebuilds the app under `/opt/ai-scale-system/releases/<timestamp>`
- Updates `/opt/ai-scale-system/current`
- Restarts PM2 with `ai-scale-system`
- Reconfigures nginx for `ailiangbiao.agentpit.io`
- Verifies SSL renewal with `certbot renew --dry-run`
- Re-initializes the admin account from the generated environment file

## Outputs

The script writes a local JSON result file under:

```text
%TEMP%\ai-scale-deploy\deploy-result-<timestamp>.json
```

It contains the generated admin password, database URL, release path, and backup path.

## Notes

- The script intentionally rebuilds the database from scratch.
- The script deletes PM2 apps named `ai-scale` and `ai-scale-system` before switching to the new release.
- The script keeps server backups in `/root/deploy-backup/` and does not prune them automatically.
