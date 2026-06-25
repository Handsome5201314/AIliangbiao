# AI量表系统生产部署说明

本文是当前仓库的生产部署与运维说明，目标是让阅读者能基于仓库现状完成以下事情：

- 在单台 OpenCloudOS 9 / 类 RHEL 服务器上部署当前系统
- 正确准备 `app + db + hermes` 三容器拓扑
- 理解生产环境变量与数据恢复约束
- 做上线前 smoke check、日常备份与回滚

本文只描述当前仓库真实存在的部署链路，不创造新的部署方案。

---

## 当前生产拓扑

当前生产编排文件是：

- [docker-compose.prod.yml](./docker-compose.prod.yml)

生产拓扑固定为三部分：

- `app`
  - Next.js 应用容器
- `db`
  - PostgreSQL 16 容器
- `hermes`
  - Hermes API Server 容器

外部网络入口建议：

- 宿主机 Nginx 监听 `80/443`
- Nginx 反代到宿主机回环 `127.0.0.1:3000`
- PostgreSQL 只留在 Docker 内网，不对公网开放 `5432`

当前线上公开入口：

- `https://tongyimohe.cloud`
- `https://tongyimohe.cloud/agent`

---

## 目录与文件布局

推荐服务器路径：

- 仓库目录：`/opt/ai-scale-system/current`
- 运行时环境文件：`/opt/ai-scale-system/shared/.env.production`
- 数据库备份目录：`/var/backups/ai-scale-system/postgres`
- Nginx 配置：`/etc/nginx/conf.d/ai-scale-system.conf`

重要说明：

- 生产环境不要直接复用工作区的 `.env`
- 生产环境要从 [.env.production.example](./.env.production.example) 派生出独立 `.env.production`
- Hermes 与 Postgres 数据分别落在 Docker volume：`ai-scale-hermes-data`、`ai-scale-postgres-data`

---

## 服务器准备

### 系统软件

安装基础依赖：

```bash
sudo dnf install -y dnf-plugins-core ca-certificates curl gnupg2 nginx firewalld
```

安装 Docker Engine 与 Compose plugin：

```bash
sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

安装 Certbot：

```bash
sudo dnf install -y epel-release
sudo dnf install -y certbot python3-certbot-nginx
```

启用服务：

```bash
sudo systemctl enable --now docker
sudo systemctl enable --now nginx
sudo systemctl enable --now firewalld
```

开放宿主机防火墙：

```bash
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

验证基础运行时：

```bash
docker --version
docker compose version
sudo systemctl status docker --no-pager
```

---

## 生产环境变量

### 创建独立 env 文件

```bash
sudo mkdir -p /opt/ai-scale-system/shared
sudo cp /opt/ai-scale-system/current/.env.production.example /opt/ai-scale-system/shared/.env.production
sudo chmod 600 /opt/ai-scale-system/shared/.env.production
```

### 上线前必须复核的键

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `DIRECT_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_API_URL`
- `PUBLIC_APP_URL`
- `APP_BASE_URL`
- `SESSION_SECRET`
- `APP_SESSION_SECRET`
- `ADMIN_SESSION_SECRET`
- `BUSINESS_SECRET_ENCRYPTION_KEY`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `ENABLE_VOICE_INTERACTION`
- `ENABLE_MCP_SERVER`
- `LOG_LEVEL`
- `HERMES_API_SERVER_BASE_URL`
- `HERMES_API_SERVER_KEY`
- `HERMES_API_SERVER_MODEL`
- `PLATFORM_KNOWLEDGE_EMBEDDING_API_KEY`
- `PLATFORM_KNOWLEDGE_EMBEDDING_ENDPOINT`
- `PLATFORM_KNOWLEDGE_EMBEDDING_MODEL`

如果启用第三方联动，还应复核：

- `AGENTPIT_*`
- `DEEPSEEK_API_KEY`
- `TENCENT_*`

### 关键约束

- `DATABASE_URL` / `DIRECT_URL` 在容器内必须指向 `db:5432`，不能写 `localhost`
- `HERMES_API_SERVER_BASE_URL` 在默认 Compose 拓扑下应为 `http://hermes:8642/v1`
- `BUSINESS_SECRET_ENCRYPTION_KEY` 是后台业务密钥的加密/HMAC 主密钥，生产环境必须设置并离线备份；丢失后已保存的业务密钥无法解密，需要重新录入
- AI 服务商 API Key、MCP Key、医生 FastGPT Key 等业务调用密钥不写入 `.env.production`，应在后台重新录入
- 生产环境 `LOG_LEVEL` 推荐 `info` 或 `warn`
- 当前生产 `.env.production` 应保持离线保存，不进 git

容器内数据库 URL 示例：

```env
DATABASE_URL=postgresql://ai_scale_app:<password>@db:5432/ai_scale_db
DIRECT_URL=postgresql://ai_scale_app:<password>@db:5432/ai_scale_db
```

---

## 首次构建与启动

在服务器仓库根目录执行：

```bash
cd /opt/ai-scale-system/current
APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
docker compose -f docker-compose.prod.yml --env-file /opt/ai-scale-system/shared/.env.production build
```

启动：

```bash
APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
docker compose -f docker-compose.prod.yml --env-file /opt/ai-scale-system/shared/.env.production up -d
```

查看状态：

```bash
APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
docker compose -f docker-compose.prod.yml --env-file /opt/ai-scale-system/shared/.env.production ps
```

当前 compose 健康点：

- `app`
  - 通过 `http://127.0.0.1:3000/api/health`
- `db`
  - 通过 `pg_isready`
- `hermes`
  - 由容器存活与 app 侧联通性共同验证

---

## 数据迁移与恢复

### 迁移包导出

推荐在重装服务器或大迁移前做两阶段导出：

1. 线上仍可用时先做 rehearsal export
2. 验证 dump、checksum 与 `pg_restore --list`
3. 进入维护窗口后再做最终导出
4. 最终导出产物作为唯一恢复源

直接导出入口：

```bash
SOURCE_DATABASE_URL='postgresql://user:password@old-host:5432/dbname' \
bash scripts/export-production-db.sh
```

默认产物：

- `backups/prod/<UTC timestamp>/production.dump`
- `backups/prod/<UTC timestamp>/production.dump.sha256`
- `backups/prod/<UTC timestamp>/production.dump.contents.txt`
- `backups/prod/<UTC timestamp>/restore-verification.sql`
- `backups/prod/<UTC timestamp>/env-snapshot-instructions.md`
- `backups/prod/<UTC timestamp>/manifest.json`

### 启动目标数据库容器

```bash
APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
docker compose -f docker-compose.prod.yml --env-file /opt/ai-scale-system/shared/.env.production up -d db
```

### 恢复数据库

```bash
APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
bash scripts/docker-db-restore.sh /path/to/backups/prod/<timestamp>/production.dump
```

恢复前必须检查：

- `production.dump.sha256`
- `production.dump.contents.txt`
- `restore-verification.sql`
- `env-snapshot-instructions.md`
- `manifest.json`

必要时先做 dump 结构检查：

```bash
docker run --rm -i postgres:16-bookworm pg_restore --list < /path/to/backups/prod/<timestamp>/production.dump
```

### Prisma 同步

恢复后执行：

```bash
APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
bash scripts/docker-prisma-sync.sh
```

不要在生产恢复流程里无脑使用 `--accept-data-loss`。如果 Prisma 提示 destructive change，应先人工评估。

### 数据核验

使用迁移包中的 `restore-verification.sql` 对比老库与新库的行数。

当前应重点核对的物理表：

- `User`
- `ChildProfile`
- `DoctorProfile`
- `AssessmentHistory`
- `Admin`
- `ApiKey`
- `SystemConfig`

说明：

- Prisma 的 `MemberProfile` 当前映射到底层物理表 `ChildProfile`

---

## Nginx 与 HTTPS

### Nginx

参考模板：

- [deploy/nginx/ai-scale-system.conf.example](./deploy/nginx/ai-scale-system.conf.example)

部署：

```bash
sudo cp /opt/ai-scale-system/current/deploy/nginx/ai-scale-system.conf.example /etc/nginx/conf.d/ai-scale-system.conf
sudo nginx -t
sudo systemctl reload nginx
```

该模板已经包含 `/api/mcp` 所需的 SSE 反代设置：

- `proxy_http_version 1.1`
- `proxy_buffering off`
- `proxy_read_timeout 3600s`
- `X-Accel-Buffering no`

### HTTPS

DNS 指向新服务器后：

```bash
sudo mkdir -p /var/www/certbot
sudo certbot --nginx -d example.com
```

检查自动续期：

```bash
sudo systemctl status certbot.timer
```

---

## 备份策略

### 手工备份

```bash
APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
bash scripts/docker-db-backup.sh
```

默认目录：

- `/var/backups/ai-scale-system/postgres`

默认保留：

- `14` 天

### 定时任务示例

```cron
30 3 * * * cd /opt/ai-scale-system/current && APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production DB_BACKUP_DIR=/var/backups/ai-scale-system/postgres bash scripts/docker-db-backup.sh >> /var/log/ai-scale-db-backup.log 2>&1
```

自动安装 cron：

```bash
sudo APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
DB_BACKUP_DIR=/var/backups/ai-scale-system/postgres \
BACKUP_RETENTION_DAYS=14 \
bash scripts/install-db-backup-cron.sh
```

建议定期把最近一份 dump 恢复到非生产库，验证备份不是“看起来存在但不可用”。

---

## 上线后 Smoke Check

### 无鉴权基础检查

- `GET /api/health`
- 首页 `/`
- `/agent`
- 管理登录页
- 医生登录页
- 患者登录页

### 业务链路检查

1. 用患者账号完成一次登录
2. 创建 `agent session`
3. 用返回的 `agent session token` 访问 `/api/skill/v1/scales`
4. 验证一个整表评估或会话型评估
5. 如启用医生端，再验证 `/api/doctor/workspace`

### MCP 检查

- 使用有效 `MCP API Key` 验证 `GET /api/mcp`
- 使用有效 `MCP API Key` 验证 canonical `/api/mcp` SSE / JSON-RPC 能正常建立
- 如仍依赖兼容端，再带 `MCP API Key` 验证 `/api/mcp/scale`

### 运行健康

- `docker compose ps` 显示 `app + db + hermes` 正常运行
- `docker logs ai-scale-app` 不应在生产持续打印 Prisma `query` 级日志
- app 容器能访问 `http://hermes:8642/v1`
- 公网无法直接访问 `5432`

---

## 常用运维命令

### 重启

```bash
APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
docker compose -f docker-compose.prod.yml --env-file /opt/ai-scale-system/shared/.env.production restart
```

### 查看 app 日志

```bash
APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
docker compose -f docker-compose.prod.yml --env-file /opt/ai-scale-system/shared/.env.production logs -f app
```

### 停止栈

```bash
APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
docker compose -f docker-compose.prod.yml --env-file /opt/ai-scale-system/shared/.env.production down
```

### 从本地工作站触发重部署

```bash
DEPLOY_PASSWORD='your-ssh-password' \
python scripts/docker-redeploy.py --host tongyimohe.cloud --user root
```

常用参数：

- `--skip-backup`
- `--skip-prisma-push`
- `--keep-releases 3`

### 服务端清理

```bash
sudo APP_BASE=/opt/ai-scale-system KEEP_RELEASES=3 \
bash scripts/docker-server-cleanup.sh
```

---

## 回滚原则

建议回滚顺序：

1. 优先保留当前 PostgreSQL volume，不要先动数据
2. 回滚到上一版 app 构建或上一版代码
3. 重启整套栈
4. 只有在确实需要数据回退时，才恢复已验证的 dump，并在人工复核后再跑 Prisma 同步

容器化回滚的第一选择应是“先回滚应用版本，保留现有数据库卷”。

---

## 参考资料

- OpenCloudOS Docker Guide: https://docs.opencloudos.org/OCS/Virtualization_and_Containers_Guide/Docker_guide/
- OpenCloudOS 9 Installation Docs: https://docs.opencloudos.org/en/OC9/install/
- Docker Engine on RPM-based distros: https://docs.docker.com/engine/install/centos/
