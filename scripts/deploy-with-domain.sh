#!/bin/bash

# ==========================================
# AI 量表系统 - 域名部署脚本
# ==========================================
# 用于已配置好环境的服务器
# ==========================================

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置变量
DOMAIN="ailiangbiao.agentpit.io"
APP_NAME="ai-scale"
APP_DIR="/root/AIliangbiao"

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

log_step() {
    echo -e "${BLUE}=========================================="
    echo -e "$1"
    echo -e "==========================================${NC}"
}

# ==========================================
# 步骤 1: 检查必要依赖
# ==========================================
check_dependencies() {
    log_step "📦 步骤 1: 检查必要依赖"

    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js 未安装"
        exit 1
    fi

    # 检查 npm
    if ! command -v npm &> /dev/null; then
        log_error "npm 未安装"
        exit 1
    fi

    # 检查 PostgreSQL
    if ! command -v psql &> /dev/null; then
        log_warn "PostgreSQL 客户端未安装，正在安装..."
        apt-get update && apt-get install -y postgresql postgresql-contrib
    fi

    # 检查 Nginx
    if ! command -v nginx &> /dev/null; then
        log_warn "Nginx 未安装，正在安装..."
        apt-get update && apt-get install -y nginx certbot python3-certbot-nginx
    fi

    # 检查 PM2
    if ! command -v pm2 &> /dev/null; then
        log_warn "PM2 未安装，正在安装..."
        npm install -g pm2
    fi

    log_info "✅ 所有依赖已就绪"
}

# ==========================================
# 步骤 2: 检查项目文件
# ==========================================
check_project_files() {
    log_step "📁 步骤 2: 检查项目文件"

    cd ${APP_DIR}

    # 检查必要文件
    if [ ! -f "package.json" ]; then
        log_error "package.json 不存在"
        exit 1
    fi

    if [ ! -f ".env" ]; then
        log_error ".env 文件不存在"
        exit 1
    fi

    if [ ! -f "prisma/schema.prisma" ]; then
        log_error "Prisma schema 不存在"
        exit 1
    fi

    log_info "✅ 项目目录: ${APP_DIR}"
    ls -la
}

# ==========================================
# 步骤 3: 安装项目依赖
# ==========================================
install_dependencies() {
    log_step "📦 步骤 3: 安装项目依赖"

    cd ${APP_DIR}

    log_info "安装 npm 依赖..."
    npm install

    log_info "✅ 依赖安装完成"
}

# ==========================================
# 步骤 4: 生成 Prisma Client
# ==========================================
generate_prisma_client() {
    log_step "🔧 步骤 4: 生成 Prisma Client"

    cd ${APP_DIR}

    log_info "生成 Prisma Client..."
    npx prisma generate

    log_info "✅ Prisma Client 生成完成"
}

# ==========================================
# 步骤 5: 同步数据库结构
# ==========================================
sync_database() {
    log_step "💾 步骤 5: 同步数据库结构"

    cd ${APP_DIR}

    log_info "同步数据库结构..."
    npx prisma db push

    log_info "✅ 数据库同步完成"
}

# ==========================================
# 步骤 6: 构建应用
# ==========================================
build_application() {
    log_step "🏗️  步骤 6: 构建应用"

    cd ${APP_DIR}

    log_info "开始构建..."
    npm run build

    log_info "✅ 构建完成"
}

# ==========================================
# 步骤 7: 启动应用
# ==========================================
start_application() {
    log_step "🚀 步骤 7: 启动应用"

    cd ${APP_DIR}

    # 停止旧进程
    pm2 delete ${APP_NAME} 2>/dev/null || true

    # 启动新进程
    pm2 start npm --name ${APP_NAME} -- start

    # 保存 PM2 配置
    pm2 save

    # 设置开机自启
    pm2 startup systemd -u root --hp /root

    log_info "✅ 应用已启动"
    pm2 status
}

# ==========================================
# 步骤 8: 配置 Nginx
# ==========================================
configure_nginx() {
    log_step "🌐 步骤 8: 配置 Nginx"

    NGINX_CONF="/etc/nginx/sites-available/${APP_NAME}"

    # 创建 Nginx 配置
    cat > ${NGINX_CONF} <<EOF
server {
    listen 80;
    server_name ${DOMAIN};

    # 客户端请求大小限制
    client_max_body_size 50M;

    # 代理到 Next.js 应用
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;

        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Next.js 静态文件缓存
    location /_next/static/ {
        proxy_pass http://localhost:3000;
        expires 365d;
        access_log off;
        add_header Cache-Control "public, immutable";
    }

    # 日志
    access_log /var/log/nginx/${APP_NAME}-access.log;
    error_log /var/log/nginx/${APP_NAME}-error.log;
}
EOF

    # 启用站点
    ln -sf ${NGINX_CONF} /etc/nginx/sites-enabled/

    # 删除默认站点
    rm -f /etc/nginx/sites-enabled/default

    # 测试配置
    nginx -t

    # 重启 Nginx
    systemctl restart nginx

    log_info "✅ Nginx 配置完成"
}

# ==========================================
# 步骤 9: 配置 SSL 证书
# ==========================================
setup_ssl() {
    log_step "🔐 步骤 9: 配置 SSL 证书"

    # 检查是否已有证书
    if [ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
        log_info "SSL 证书已存在，跳过申请"
        return 0
    fi

    log_info "申请 Let's Encrypt SSL 证书..."

    # 使用 certbot 申请证书
    certbot --nginx -d ${DOMAIN} --non-interactive --agree-tos --email admin@${DOMAIN} --redirect

    if [ $? -eq 0 ]; then
        log_info "✅ SSL 证书配置成功"
    else
        log_warn "SSL 证书申请失败，请手动配置"
    fi
}

# ==========================================
# 步骤 10: 验证部署
# ==========================================
verify_deployment() {
    log_step "✅ 步骤 10: 验证部署"

    log_info "检查应用状态..."
    pm2 status

    log_info "检查 Nginx 状态..."
    systemctl status nginx --no-pager

    log_info "检查端口监听..."
    netstat -tlnp | grep -E ':(80|443|3000)'

    log_info ""
    log_info "=========================================="
    log_info "🎉 部署完成！"
    log_info "=========================================="
    log_info ""
    log_info "访问地址:"
    log_info "  HTTP:  http://${DOMAIN}"
    log_info "  HTTPS: https://${DOMAIN} (如果已配置 SSL)"
    log_info ""
    log_info "管理后台:"
    log_info "  http://${DOMAIN}/admin/login"
    log_info ""
    log_info "常用命令:"
    log_info "  查看日志: pm2 logs ${APP_NAME}"
    log_info "  重启应用: pm2 restart ${APP_NAME}"
    log_info "  停止应用: pm2 stop ${APP_NAME}"
    log_info ""
}

# ==========================================
# 主执行函数
# ==========================================
main() {
    log_info ""
    log_info "=========================================="
    log_info "🚀 开始部署 AI 量表系统"
    log_info "域名: ${DOMAIN}"
    log_info "=========================================="
    log_info ""

    check_dependencies
    check_project_files
    install_dependencies
    generate_prisma_client
    sync_database
    build_application
    start_application
    configure_nginx
    setup_ssl
    verify_deployment
}

# 执行主函数
main
