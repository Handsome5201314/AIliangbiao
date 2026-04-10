# Tencent Cloud Migration

This guide is the short operational companion for `scripts/tencent-cloud-migrate.py`.

## What it does

- Exports the current production database from the old server
- Copies the current repo as a new release
- Restores data on the Tencent Cloud server
- Builds and starts the app with PM2
- Configures Nginx
- Optionally provisions Let's Encrypt if a domain is supplied

## Required ports

On the Tencent Cloud security group and host firewall:

- `22/tcp`
- `80/tcp`
- `443/tcp`

If `22/tcp` is blocked, the migration cannot run.

## Example

```powershell
python .\scripts\tencent-cloud-migrate.py `
  --source-host 136.110.9.74 `
  --source-user root `
  --source-password "<old-root-password>" `
  --target-host 124.220.184.17 `
  --target-user ubuntu `
  --target-password "<tencent-root-password>" `
  --validation-url "http://124.220.184.17"
```

## Optional SSL

Add these when a temporary or staging hostname already points to the Tencent server:

```powershell
  --domain "verify-ailiangbiao.example.com" `
  --validation-url "https://verify-ailiangbiao.example.com"
```

## Output

The script prints a final JSON object containing:

- `target_release`
- `backup_dir`
- `validation_url`
- `ssl_enabled`
- `app_name`

## Notes

- The script preserves the current production server as rollback
- The target database is recreated from production dump
- The target app URL is set from `--validation-url`
- Without `--domain`, SSL is skipped on purpose
- On many Tencent Cloud Ubuntu images, the login user is `ubuntu` instead of `root`
