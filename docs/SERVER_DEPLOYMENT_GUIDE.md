# 🚀 服务器部署完整指南

## 📋 服务器信息

| 项目 | 信息 |
|------|------|
| 主机名 | agent1002 |
| IP地址 | 136.110.9.74 |
| 用户名 | root |
| 密码 | kId8r69XoXM1i07TzWZ7 |
| 操作系统 | Ubuntu 22.04 LTS (推荐) |

---

## 🔐 安全提示

⚠️ **重要安全提醒：**
1. 请立即修改 root 密码
2. 创建新的 sudo 用户
3. 禁用 root SSH 登录
4. 配置 SSH 密钥认证

---

## 📦 部署架构

```
Internet (HTTP/HTTPS)
    ↓
Nginx (反向代理, SSL终止)
    ↓
Next.js App (Port 3000)
    ↓
PostgreSQL (本地数据库)
```

---

## 🛠️ 部署步骤

### 第一步：连接到服务器

```bash
# 从本地连接
ssh root@136.110.9.74

# 输入密码: kId8r69XoXM1i07TzWZ7
```

### 第二步：执行环境准备脚本

**方式1: 上传脚本并执行**

```bash
# 在本地机器上，上传部署脚本
scp scripts/deploy.sh root@136.110.9.74:/root/

# SSH 到服务器
ssh root@136.110.9.74

# 添加执行权限
chmod +x deploy.sh

# 执行脚本
./deploy.sh
```

**方式2: 手动逐步执行**

如果脚本执行失败，可以手动执行以下命令：

#### 1. 更新系统

```bash
apt update && apt upgrade -y
```

#### 2. 安装 Node.js 20

```bash
# 添加 NodeSource 仓库
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -

# 安装 Node.js
apt install -y nodejs

# 验证
node --version  # 应该显示 v20.x.x
npm --version
```

#### 3. 安装 PostgreSQL 15

```bash
# 添加 PostgreSQL 仓库
sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'

# 导入密钥
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -

# 安装
apt update
apt install -y postgresql-15 postgresql-contrib-15

# 启动服务
systemctl start postgresql
systemctl enable postgresql
```

#### 4. 创建数据库

```bash
# 切换到 postgres 用户
sudo -u postgres psql

# 在 psql 中执行
CREATE DATABASE ai_scale_system;
CREATE USER ai_scale_user WITH ENCRYPTED PASSWORD 'YourStrongPassword123!';
GRANT ALL PRIVILEGES ON DATABASE ai_scale_system TO ai_scale_user;
\q
```

#### 5. 安装 PM2

```bash
npm install -g pm2
pm2 startup systemd
```

#### 6. 配置防火墙

```bash
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable
```

### 第三步：上传应用代码

**方式1: 使用 Git (推荐)**

```bash
# 在服务器上
cd /var/www
git clone https://github.com/Handsome5201314/ai-scale-system.git
cd ai-scale-system
```

**方式2: 使用 SCP 上传**

```bash
# 在本地机器上
# 1. 先打包项目
tar -czf ai-scale-system.tar.gz \
  --exclude=node_modules \
  --exclude=.next \
  --exclude=.git \
  .

# 2. 上传到服务器
scp ai-scale-system.tar.gz root@136.110.9.74:/var/www/

# 3. 在服务器上解压
ssh root@136.110.9.74
cd /var/www
tar -xzf ai-scale-system.tar.gz
```

### 第四步：配置环境变量

```bash
# 在服务器上
cd /var/www/ai-scale-system

# 创建 .env 文件
cat > .env <<EOF
# 数据库配置
DATABASE_URL="postgresql://ai_scale_user:YourStrongPassword123!@localhost:5432/ai_scale_system"
DIRECT_URL="postgresql://ai_scale_user:YourStrongPassword123!@localhost:5432/ai_scale_system"

# AI 服务配置
DEEPSEEK_API_KEY="your-deepseek-api-key"
TENCENT_SECRET_ID="your-tencent-secret-id"
TENCENT_SECRET_KEY="your-tencent-secret-key"

# 语音识别
TENCENT_SPEECH_SECRET_ID="your-tencent-speech-secret-id"
TENCENT_SPEECH_SECRET_KEY="your-tencent-speech-secret-key"

# 应用配置
NEXT_PUBLIC_APP_URL="http://136.110.9.74"
NEXT_PUBLIC_APP_NAME="AI 量表系统"

# Session 密钥
SESSION_SECRET="$(openssl rand -base64 32)"

# 管理员账号
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="$(openssl rand -base64 16)"

# 功能开关
ENABLE_VOICE_INTERACTION="true"
ENABLE_MCP_SERVER="true"

# 性能配置
CACHE_TTL="3600"
MAX_CACHE_SIZE="1000"

# 日志
LOG_LEVEL="info"
EOF

# 查看配置
cat .env
```

### 第五步：安装依赖和构建

```bash
# 安装依赖
npm install

# 生成 Prisma Client
npx prisma generate

# 同步数据库结构
npx prisma db push

# 构建应用
npm run build
```

### 第六步：启动应用

```bash
# 使用 PM2 启动
pm2 start npm --name "ai-scale-system" -- start

# 查看状态
pm2 status

# 查看日志
pm2 logs ai-scale-system

# 保存 PM2 配置
pm2 save
```

### 第七步：配置 Nginx

```bash
# 创建 Nginx 配置
cat > /etc/nginx/sites-available/ai-scale-system <<'EOF'
server {
    listen 80;
    server_name 136.110.9.74;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    location /_next/static/ {
        alias /var/www/ai-scale-system/.next/static/;
        expires 365d;
        access_log off;
    }

    access_log /var/log/nginx/ai-scale-access.log;
    error_log /var/log/nginx/ai-scale-error.log;
}
EOF

# 启用站点
ln -sf /etc/nginx/sites-available/ai-scale-system /etc/nginx/sites-enabled/

# 测试配置
nginx -t

# 重启 Nginx
systemctl restart nginx
```

### 第八步：验证部署

```bash
# 检查应用状态
pm2 status

# 检查端口
netstat -tulpn | grep 3000

# 检查 Nginx
systemctl status nginx

# 查看应用日志
pm2 logs ai-scale-system --lines 100
```

**在浏览器访问：**

```
http://136.110.9.74
```

---

## 🔒 配置 SSL 证书 (HTTPS)

### 使用 Let's Encrypt (免费)

```bash
# 安装 Certbot
apt install -y certbot python3-certbot-nginx

# 获取证书 (需要域名)
certbot --nginx -d your-domain.com -d www.your-domain.com

# 自动续期测试
certbot renew --dry-run
```

### 修改 Nginx 配置支持 HTTPS

```bash
# 编辑配置
nano /etc/nginx/sites-available/ai-scale-system

# 添加 HTTPS 配置
```

---

## 🔧 常用运维命令

### PM2 命令

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs ai-scale-system

# 重启应用
pm2 restart ai-scale-system

# 停止应用
pm2 stop ai-scale-system

# 监控
pm2 monit

# 清空日志
pm2 flush
```

### Nginx 命令

```bash
# 测试配置
nginx -t

# 重启
systemctl restart nginx

# 重新加载配置
systemctl reload nginx

# 查看状态
systemctl status nginx

# 查看日志
tail -f /var/log/nginx/ai-scale-error.log
```

### 数据库命令

```bash
# 连接数据库
sudo -u postgres psql -d ai_scale_system

# 备份数据库
pg_dump -U ai_scale_user ai_scale_system > backup_$(date +%Y%m%d).sql

# 恢复数据库
psql -U ai_scale_user ai_scale_system < backup_20260405.sql
```

---

## 📊 监控和日志

### 应用日志

```bash
# PM2 日志
/var/www/ai-scale-system/logs/

# Nginx 日志
/var/log/nginx/ai-scale-access.log
/var/log/nginx/ai-scale-error.log
```

### 系统监控

```bash
# 安装监控工具
apt install -y htop iotop nethogs

# 查看系统资源
htop

# 查看磁盘使用
df -h

# 查看内存使用
free -h
```

---

## 🔄 更新部署

```bash
# 进入项目目录
cd /var/www/ai-scale-system

# 拉取最新代码
git pull origin main

# 安装新依赖
npm install

# 重新构建
npm run build

# 重启应用
pm2 restart ai-scale-system

# 查看日志
pm2 logs ai-scale-system
```

---

## 🛠️ 故障排查

### 1. 应用无法启动

```bash
# 查看错误日志
pm2 logs ai-scale-system --err

# 检查端口占用
lsof -i:3000

# 检查环境变量
cat .env

# 手动启动测试
npm run start
```

### 2. 数据库连接失败

```bash
# 测试数据库连接
psql -U ai_scale_user -d ai_scale_system -h localhost

# 检查 PostgreSQL 状态
systemctl status postgresql

# 查看 PostgreSQL 日志
tail -f /var/log/postgresql/postgresql-15-main.log
```

### 3. Nginx 502 错误

```bash
# 检查应用是否运行
pm2 status

# 检查端口
netstat -tulpn | grep 3000

# 查看 Nginx 错误日志
tail -f /var/log/nginx/ai-scale-error.log
```

---

## 📋 部署检查清单

- [ ] 服务器环境准备完成
  - [ ] Node.js 20.x 已安装
  - [ ] PostgreSQL 15 已安装
  - [ ] PM2 已安装
  - [ ] Nginx 已安装
  - [ ] 防火墙已配置

- [ ] 数据库配置完成
  - [ ] 数据库已创建
  - [ ] 用户已创建
  - [ ] 权限已配置

- [ ] 应用部署完成
  - [ ] 代码已上传
  - [ ] .env 已配置
  - [ ] 依赖已安装
  - [ ] 数据库已同步
  - [ ] 应用已构建

- [ ] 服务启动完成
  - [ ] PM2 进程运行中
  - [ ] Nginx 运行中
  - [ ] 端口正常监听

- [ ] 访问测试完成
  - [ ] HTTP 访问正常
  - [ ] 功能测试通过
  - [ ] 性能测试通过

---

## 🎯 性能优化建议

### 1. 启用 Gzip 压缩

```nginx
# 在 Nginx 配置中添加
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
gzip_min_length 1000;
```

### 2. 配置缓存

```nginx
# 静态文件缓存
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### 3. 优化 Node.js

```bash
# PM2 集群模式
pm2 start npm --name "ai-scale-system" -i max -- start
```

---

## 📞 技术支持

如遇到问题，请检查：
1. 应用日志: `pm2 logs ai-scale-system`
2. Nginx 日志: `/var/log/nginx/ai-scale-error.log`
3. 数据库日志: `/var/log/postgresql/`

---

**部署完成后，请立即修改默认密码并配置 SSL 证书！**
