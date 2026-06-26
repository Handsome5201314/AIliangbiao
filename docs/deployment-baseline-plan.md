# 一键部署体系修复与生产库基线化计划

## 目标

把本项目整理成“本地开发、Git 仓库为唯一发布源、云服务器只部署已确认版本”的部署模式，并让空库可以通过 Prisma `migrate deploy` 初始化完整当前 schema。

## 明确不做

- 不修改 Nginx、域名、HTTPS、Docker volume 或无关服务。
- 不对生产数据库执行未经确认的写操作。
- 不使用 `prisma db push` 处理生产数据库。
- 不把 env、密钥、数据库 URL、dump、`node_modules` 或构建缓存放入 release。

## Source of Truth

- 数据库结构：`prisma/schema.prisma` 和 `prisma/migrations/20260627_baseline/migration.sql`。
- 部署拓扑：`docker-compose.prod.yml`。
- 本地依赖服务：`docker-compose.dev.yml`。
- 发布文件集：`scripts/docker-redeploy.py` 通过 `git ls-files` 读取 Git 跟踪文件。
- 生产 env：服务器 `/opt/ai-scale-system/shared/.env.production`，不进入 Git。
- 生产数据：Docker volume 中的 PostgreSQL 数据库和备份 dump。

## Module 边界

- Compose 负责 `app + db + hermes` 容器拓扑。
- Prisma migrations 负责 schema 初始化和后续迁移。
- `scripts/docker-redeploy.py` 负责 release 打包、远端 diff、备份、构建、迁移、健康检查和 `current` 切换。
- `scripts/docker-db-backup.sh` / `scripts/docker-db-restore.sh` 负责数据库 dump 和恢复。
- README/DEPLOYMENT 负责人类可执行的安装、升级、备份、恢复和回滚流程。

## Interface 契约

- `npm run db:dev:migrate`：本地空库运行 `prisma migrate deploy`。
- `scripts/docker-redeploy.py --diff-only`：只读检查远端状态和 release diff，不上传、不改服务。
- `scripts/docker-redeploy.py`：上传 Git 跟踪文件，备份后运行 `prisma migrate deploy`，健康检查通过后才切 `current`。
- 已有生产库首次接入 baseline：备份和演练通过后，人工确认执行 `prisma migrate resolve --applied 20260627_baseline`。

## 数据流

Git 已确认版本 -> release manifest -> 远端 release 目录 -> Docker build -> `prisma migrate deploy` -> app 容器 -> `/api/health` -> `/opt/ai-scale-system/current`。

生产数据库备份流：

生产 db container -> `pg_dump -Fc` -> `/var/backups/ai-scale-system/postgres` -> 本地隔离恢复 -> 核心表与 `vector` 扩展验证 -> 迁移演练 -> 人工确认。

## 风险与验证

- 旧 migration 链不完整：归档到 `prisma/migrations_archive/pre_20260627_baseline/`，不再让空库执行。
- pgvector 不可用：Compose、CI 和备份工具统一使用 `pgvector/pgvector:0.8.3-pg16-bookworm`，baseline 首行创建 `vector` 扩展。
- 误打包密钥：部署测试验证 release 只包含 Git 跟踪文件并排除 env/secret 类文件。
- 误用 `db push`：部署测试、CI 和脚本统一检查 `migrate deploy`。
- 健康失败切换：redeploy 脚本要求本地和公网健康检查都为 200 后才切 `current`。

## 必跑验证

```powershell
python -m unittest tests.docker_redeploy_test -v
python -m py_compile scripts/docker-redeploy.py
npx prisma validate
npm run ci:check
npm run build
docker compose -f docker-compose.dev.yml --env-file .env.local.example config --quiet
docker compose -f docker-compose.prod.yml --env-file .env.production.example config --quiet
```
