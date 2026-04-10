# 腾讯云迁移与验证指南

本文档对应当前项目的**独立新服务器迁移**流程，目标是把现有生产环境复制到腾讯云新机器，先独立验证，再决定是否切正式流量。

当前约束：
- 旧生产服务器：`136.110.9.74`
- 腾讯云新服务器：`124.220.184.17`
- 迁移策略：**保留现网数据，不覆盖旧机器**
- 验证策略：**先在腾讯云独立验证**
- HTTPS：只有在新域名或测试域名已解析到腾讯云时才直接申请正式证书

## 当前推荐目录结构

- 应用目录：`/opt/ai-scale-system/current`
- 发布目录：`/opt/ai-scale-system/releases/<timestamp>`
- 共享环境：`/opt/ai-scale-system/shared/.env.production`
- 日志目录：`/var/log/ai-scale-system`
- PM2 进程名：`ai-scale-system`

## 迁移前检查

开始前请确认：

1. 腾讯云安全组已放行：
   - `22/tcp`
   - `80/tcp`
   - `443/tcp`
2. 腾讯云实例系统是 Ubuntu
3. 可以使用 `root` 密码登录腾讯云
4. 旧生产服务器仍然在线
5. 本地机器可连接旧生产和腾讯云的 `22` 端口

如果腾讯云 `22` 端口未开放，迁移脚本会直接失败。

## 一键迁移脚本

仓库内已提供新脚本：

- 本地入口：`scripts/tencent-cloud-migrate.py`
- 远端执行：`scripts/remote-migrate-preserve.sh`

它们和旧的 `remote-redeploy.sh` 不同：

- **不会重置旧生产**
- **会从旧生产导出数据库**
- **会在腾讯云恢复数据后再部署**
- **支持 IP 验证或域名+SSL 验证**

## 典型执行方式

### 1. 先做 IP 验证

```powershell
python .\scripts\tencent-cloud-migrate.py `
  --source-host 136.110.9.74 `
  --source-user root `
  --source-password "<旧生产 root 密码>" `
  --target-host 124.220.184.17 `
  --target-user ubuntu `
  --target-password "<腾讯云 root 密码>" `
  --validation-url "http://124.220.184.17"
```

### 2. 有测试域名时直接带 SSL

```powershell
python .\scripts\tencent-cloud-migrate.py `
  --source-host 136.110.9.74 `
  --source-user root `
  --source-password "<旧生产 root 密码>" `
  --target-host 124.220.184.17 `
  --target-user ubuntu `
  --target-password "<腾讯云 root 密码>" `
  --domain "verify-ailiangbiao.example.com" `
  --validation-url "https://verify-ailiangbiao.example.com"
```

## 脚本做了什么

本地脚本会：

1. 打包当前仓库代码
2. SSH 到旧生产，读取现网 `.env.production`
3. 在旧生产导出 PostgreSQL 数据库
4. 把代码包、数据库 dump、远端部署脚本上传到腾讯云
5. 在腾讯云上：
   - 安装 `Node.js 20`、`PM2`、`Nginx`、`PostgreSQL`、`Certbot`
   - 备份腾讯云当前现状
   - 新建数据库并恢复旧生产数据
   - 写入新的 `.env.production`
   - 执行 `npm ci`、`npx prisma generate`、`npx prisma db push --accept-data-loss`、`npm run build`
   - 启动 `pm2`
   - 配置 `nginx`
   - 如果提供域名，则申请 SSL

## 迁移后验证

至少验证以下入口：

- 首页
- `/agent`
- `/api/agent/session`
- `/api/skill/v1/scales`
- `/api/skill/v1/profile/sync`
- 患者注册/登录
- 医生注册/登录
- 医生仪表盘

如果只做 IP 验证，使用：

- `http://124.220.184.17`

如果提供了测试域名，使用：

- `https://<你的测试域名>`

## 结果文件

迁移脚本会在本地临时目录输出一个 JSON 结果文件，里面包含：

- 目标 release 目录
- 腾讯云备份目录
- 实际验证 URL
- 是否启用了 SSL
- 管理员用户名

## 注意事项

- 脚本**不会切换正式域名**
- 脚本**不会删除旧生产数据**
- 如果腾讯云当前已经有旧站点，脚本会先备份再替换
- 如果没有测试域名，HTTPS 不会伪装为“已完成”
- 数据库恢复后会执行当前仓库的 Prisma schema 同步，因此腾讯云会变成“现网数据 + 当前最新代码”的验证副本
- 腾讯云 Ubuntu 镜像经常默认使用 `ubuntu` 用户而不是 `root`；如果 `root` 密码登录失败，优先改用 `--target-user ubuntu`
