#!/bin/bash

# ==========================================
# AI 量表系统 - 服务器部署脚本
# ==========================================
# 服务器信息:
# - 主机名: agent1002
# - IP: 136.110.9.74
# - 用户: root
# ==========================================

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# ==========================================
# 1. 系统更新和基础工具安装
# ==========================================
install_basic_tools() {
    log_info "更新系统包管理器..."
    apt update && apt upgrade -y

    log_info "安装基础工具..."
    apt install -y \
        curl \
        wget \
        git \
        build-essential \
        nginx \
        certbot \
        python3-certbot-nginx \
        ufw \
        htop \
        vim
}

# ==========================================
# 2. 安装 Node.js 20.x
# ==========================================
install_nodejs() {
    log_info "安装 Node.js 20.x..."

    # 添加 NodeSource 仓库
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -

    # 安装 Node.js
    apt install -y nodejs

    # 验证安装
    node --version
    npm --version

    log_info "Node.js 安装完成!"
}

# ==========================================
# 3. 安装 PostgreSQL 15
# ==========================================
install_postgresql() {
    log_info "安装 PostgreSQL 15..."

    # 添加 PostgreSQL 仓库
    sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'

    # 导入 PostgreSQL 签名密钥
    wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -

    # 更新包列表
    apt update

    # 安装 PostgreSQL 15
    apt install -y postgresql-15 postgresql-contrib-15

    # 启动 PostgreSQL
    systemctl start postgresql
    systemctl enable postgresql

    log_info "PostgreSQL 安装完成!"
}

# ==========================================
# 4. 安装 PM2 (进程管理器)
# ==========================================
install_pm2() {
    log_info "安装 PM2..."

    npm install -g pm2

    # 设置 PM2 开机自启
    pm2 startup systemd

    log_info "PM2 安装完成!"
}

# ==========================================
# 5. 配置防火墙
# ==========================================
configure_firewall() {
    log_info "配置防火墙..."

    # 允许 SSH
    ufw allow 22/tcp

    # 允许 HTTP
    ufw allow 80/tcp

    # 允许 HTTPS
    ufw allow 443/tcp

    # 启用防火墙
    ufw --force enable

    # 查看状态
    ufw status

    log_info "防火墙配置完成!"
}

# ==========================================
# 6. 创建数据库和用户
# ==========================================
setup_database() {
    log_info "创建数据库和用户..."

    # 数据库配置
    DB_NAME="ai_scale_system"
    DB_USER="ai_scale_user"
    DB_PASSWORD="your_secure_password_here"  # 请修改为强密码

    # 创建数据库和用户
    sudo -u postgres psql <<EOF
CREATE DATABASE ${DB_NAME};
CREATE USER ${DB_USER} WITH ENCRYPTED PASSWORD '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
\q
EOF

    log_info "数据库创建完成!"
    log_warn "请记录以下数据库连接信息:"
    echo "  数据库名: ${DB_NAME}"
    echo "  用户名: ${DB_USER}"
    echo "  密码: ${DB_PASSWORD}"
    echo "  连接字符串: postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}"
}

# ==========================================
# 7. 创建应用目录
# ==========================================
create_app_directory() {
    log_info "创建应用目录..."

    APP_DIR="/var/www/ai-scale-system"

    mkdir -p ${APP_DIR}
    mkdir -p ${APP_DIR}/logs
    mkdir -p ${APP_DIR}/uploads

    # 设置权限
    chown -R www-data:www-data ${APP_DIR}
    chmod -R 755 ${APP_DIR}

    log_info "应用目录创建完成: ${APP_DIR}"
}

# ==========================================
# 8. 配置 Nginx
# ==========================================
configure_nginx() {
    log_info "配置 Nginx..."

    NGINX_CONF="/etc/nginx/sites-available/ai-scale-system"

    cat > ${NGINX_CONF} <<'EOF'
server {
    listen 80;
    server_name 136.110.9.74;  # 替换为您的域名或IP

    # 重定向到 HTTPS (可选，在配置SSL后启用)
    # return 301 https://$server_name$request_uri;

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

    # 静态文件缓存
    location /_next/static/ {
        alias /var/www/ai-scale-system/.next/static/;
        expires 365d;
        access_log off;
    }

    # 日志
    access_log /var/log/nginx/ai-scale-access.log;
    error_log /var/log/nginx/ai-scale-error.log;
}

# HTTPS 配置 (在配置SSL后启用)
# server {
#     listen 443 ssl http2;
#     server_name 136.110.9.74;
#
#     ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
#     ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
#
#     # SSL 配置
#     ssl_protocols TLSv1.2 TLSv1.3;
#     ssl_ciphers HIGH:!aNULL:!MD5;
#     ssl_prefer_server_ciphers on;
#
#     location / {
#         proxy_pass http://localhost:3000;
#         proxy_http_version 1.1;
#         proxy_set_header Upgrade $http_upgrade;
#         proxy_set_header Connection 'upgrade';
#         proxy_set_header Host $host;
#         proxy_set_header X-Real-IP $remote_addr;
#         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
#         proxy_set_header X-Forwarded-Proto $scheme;
#         proxy_cache_bypass $http_upgrade;
#     }
# }
EOF

    # 启用站点
    ln -sf ${NGINX_CONF} /etc/nginx/sites-enabled/

    # 测试配置
    nginx -t

    # 重启 Nginx
    systemctl restart nginx

    log_info "Nginx 配置完成!"
}

# ==========================================
# 主执行函数
# ==========================================
main() {
    log_info "=========================================="
    log_info "开始服务器环境准备..."
    log_info "=========================================="

    install_basic_tools
    install_nodejs
    install_postgresql
    install_pm2
    configure_firewall
    setup_database
    create_app_directory
    configure_nginx

    log_info "=========================================="
    log_info "服务器环境准备完成！"
    log_info "=========================================="
    log_info "下一步："
    log_info "1. 上传应用代码到 /var/www/ai-scale-system"
    log_info "2. 配置 .env 环境变量"
    log_info "3. 安装依赖: npm install"
    log_info "4. 构建应用: npm run build"
    log_info "5. 启动应用: pm2 start npm --name ai-scale-system -- start"
    log_info "6. 访问: http://136.110.9.74"
}

# 执行主函数
main
