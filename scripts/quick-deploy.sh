#!/bin/bash

# ==========================================
# AI 量表系统 - 快速部署脚本
# ==========================================
# 此脚本用于在已准备好的服务器上快速部署应用
# 假设服务器已安装 Node.js, PostgreSQL, PM2, Nginx
# ==========================================

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

# ==========================================
# 配置变量
# ==========================================
APP_DIR="/var/www/ai-scale-system"
APP_NAME="ai-scale-system"
DB_NAME="ai_scale_system"
DB_USER="ai_scale_user"
DB_PASSWORD="ChangeThisPassword123!"  # ⚠️ 请修改

# ==========================================
# 步骤1: 检查环境
# ==========================================
check_environment() {
    log_step "检查服务器环境..."

    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js 未安装！请先运行 deploy.sh 脚本"
        exit 1
    fi
    log_info "Node.js 版本: $(node --version)"

    # 检查 npm
    if ! command -v npm &> /dev/null; then
        log_error "npm 未安装！"
        exit 1
    fi
    log_info "npm 版本: $(npm --version)"

    # 检查 PM2
    if ! command -v pm2 &> /dev/null; then
        log_error "PM2 未安装！请先运行 deploy.sh 脚本"
        exit 1
    fi
    log_info "PM2 已安装"

    # 检查 PostgreSQL
    if ! command -v psql &> /dev/null; then
        log_error "PostgreSQL 未安装！请先运行 deploy.sh 脚本"
        exit 1
    fi
    log_info "PostgreSQL 已安装"

    # 检查 Nginx
    if ! command -v nginx &> /dev/null; then
        log_error "Nginx 未安装！请先运行 deploy.sh 脚本"
        exit 1
    fi
    log_info "Nginx 已安装"

    log_info "环境检查通过！"
}

# ==========================================
# 步骤2: 创建应用目录
# ==========================================
create_directories() {
    log_step "创建应用目录..."

    mkdir -p ${APP_DIR}
    mkdir -p ${APP_DIR}/logs
    mkdir -p ${APP_DIR}/uploads

    log_info "应用目录创建完成: ${APP_DIR}"
}

# ==========================================
# 步骤3: 配置数据库
# ==========================================
setup_database() {
    log_step "配置数据库..."

    # 检查数据库是否存在
    DB_EXISTS=$(sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -w ${DB_NAME} | wc -l)

    if [ ${DB_EXISTS} -eq 0 ]; then
        log_info "创建数据库和用户..."

        sudo -u postgres psql <<EOF
CREATE DATABASE ${DB_NAME};
CREATE USER ${DB_USER} WITH ENCRYPTED PASSWORD '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
\q
EOF

        log_info "数据库创建完成！"
    else
        log_warn "数据库已存在，跳过创建"
    fi
}

# ==========================================
# 步骤4: 创建 .env 文件
# ==========================================
create_env_file() {
    log_step "创建环境变量文件..."

    # 生成随机密钥
    SESSION_SECRET=$(openssl rand -base64 32)
    ADMIN_PASSWORD=$(openssl rand -base64 16)

    cat > ${APP_DIR}/.env <<EOF
# 数据库配置
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}"
DIRECT_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}"

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
SESSION_SECRET="${SESSION_SECRET}"

# 管理员账号
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="${ADMIN_PASSWORD}"

# 功能开关
ENABLE_VOICE_INTERACTION="true"
ENABLE_MCP_SERVER="true"

# 性能配置
CACHE_TTL="3600"
MAX_CACHE_SIZE="1000"

# 日志
LOG_LEVEL="info"
EOF

    log_info ".env 文件创建完成！"
    log_warn "请编辑 ${APP_DIR}/.env 文件，填写真实的 API 密钥！"
    echo ""
    echo "管理员账号信息:"
    echo "  用户名: admin"
    echo "  密码: ${ADMIN_PASSWORD}"
    echo ""
}

# ==========================================
# 步骤5: 安装依赖
# ==========================================
install_dependencies() {
    log_step "安装应用依赖..."

    cd ${APP_DIR}

    log_info "正在安装 npm 包..."
    npm install

    log_info "依赖安装完成！"
}

# ==========================================
# 步骤6: 同步数据库
# ==========================================
sync_database() {
    log_step "同步数据库结构..."

    cd ${APP_DIR}

    log_info "生成 Prisma Client..."
    npx prisma generate

    log_info "同步数据库结构..."
    npx prisma db push

    log_info "数据库同步完成！"
}

# ==========================================
# 步骤7: 构建应用
# ==========================================
build_application() {
    log_step "构建应用..."

    cd ${APP_DIR}

    log_info "开始构建..."
    npm run build

    log_info "应用构建完成！"
}

# ==========================================
# 步骤8: 启动应用
# ==========================================
start_application() {
    log_step "启动应用..."

    cd ${APP_DIR}

    # 检查是否已运行
    if pm2 describe ${APP_NAME} > /dev/null 2>&1; then
        log_warn "应用已在运行，正在重启..."
        pm2 restart ${APP_NAME}
    else
        log_info "启动新应用实例..."
        pm2 start npm --name ${APP_NAME} -- start
    fi

    # 保存 PM2 配置
    pm2 save

    log_info "应用启动完成！"
    pm2 status
}

# ==========================================
# 步骤9: 配置 Nginx
# ==========================================
configure_nginx() {
    log_step "配置 Nginx..."

    NGINX_CONF="/etc/nginx/sites-available/${APP_NAME}"

    cat > ${NGINX_CONF} <<EOF
server {
    listen 80;
    server_name 136.110.9.74;

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
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    location /_next/static/ {
        alias ${APP_DIR}/.next/static/;
        expires 365d;
        access_log off;
    }

    access_log /var/log/nginx/${APP_NAME}-access.log;
    error_log /var/log/nginx/${APP_NAME}-error.log;
}
EOF

    # 启用站点
    ln -sf ${NGINX_CONF} /etc/nginx/sites-enabled/

    # 测试配置
    nginx -t

    # 重启 Nginx
    systemctl restart nginx

    log_info "Nginx 配置完成！"
}

# ==========================================
# 步骤10: 验证部署
# ==========================================
verify_deployment() {
    log_step "验证部署..."

    # 等待应用启动
    sleep 5

    # 检查应用状态
    if pm2 describe ${APP_NAME} > /dev/null 2>&1; then
        log_info "✅ 应用运行正常"
        pm2 status
    else
        log_error "❌ 应用启动失败"
        pm2 logs ${APP_NAME} --lines 50
        exit 1
    fi

    # 检查端口
    if netstat -tulpn | grep 3000 > /dev/null; then
        log_info "✅ 端口 3000 正常监听"
    else
        log_error "❌ 端口 3000 未监听"
        exit 1
    fi

    # 检查 Nginx
    if systemctl is-active --quiet nginx; then
        log_info "✅ Nginx 运行正常"
    else
        log_error "❌ Nginx 未运行"
        exit 1
    fi

    # HTTP 测试
    if curl -s http://localhost > /dev/null; then
        log_info "✅ HTTP 访问正常"
    else
        log_warn "⚠️  HTTP 访问异常，请检查防火墙"
    fi
}

# ==========================================
# 显示完成信息
# ==========================================
show_completion_info() {
    echo ""
    echo "=========================================="
    echo -e "${GREEN}🎉 部署完成！${NC}"
    echo "=========================================="
    echo ""
    echo "访问地址:"
    echo "  http://136.110.9.74"
    echo ""
    echo "应用目录: ${APP_DIR}"
    echo "应用名称: ${APP_NAME}"
    echo ""
    echo "常用命令:"
    echo "  查看状态: pm2 status"
    echo "  查看日志: pm2 logs ${APP_NAME}"
    echo "  重启应用: pm2 restart ${APP_NAME}"
    echo "  停止应用: pm2 stop ${APP_NAME}"
    echo ""
    echo "下一步:"
    echo "  1. 编辑 ${APP_DIR}/.env 文件，填写真实的 API 密钥"
    echo "  2. 重启应用: pm2 restart ${APP_NAME}"
    echo "  3. 配置 SSL 证书 (可选)"
    echo ""
}

# ==========================================
# 主执行流程
# ==========================================
main() {
    log_info "=========================================="
    log_info "开始快速部署 AI 量表系统..."
    log_info "=========================================="
    echo ""

    check_environment
    create_directories
    setup_database
    create_env_file

    log_warn ""
    log_warn "⚠️  重要提示:"
    log_warn "请确保应用代码已上传到 ${APP_DIR}"
    log_warn "如果未上传，请先执行:"
    log_warn "  git clone https://github.com/Handsome5201314/ai-scale-system.git ${APP_DIR}"
    log_warn "或使用 scp 上传代码"
    log_warn ""
    read -p "代码已上传，按回车继续..."
    echo ""

    install_dependencies
    sync_database
    build_application
    start_application
    configure_nginx
    verify_deployment
    show_completion_info
}

# 执行主函数
main
