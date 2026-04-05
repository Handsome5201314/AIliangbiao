#!/bin/bash

# ==========================================
# 快速修复脚本 - 重新获取完整项目
# ==========================================

set -e

echo "=========================================="
echo "修复项目文件结构"
echo "=========================================="
echo ""

# 备份 .env 文件（如果存在）
if [ -f ".env" ]; then
    echo "备份 .env 文件..."
    cp .env /tmp/.env.backup
    echo "✅ .env 已备份到 /tmp/.env.backup"
fi

# 返回上级目录
cd ..

# 删除不完整的目录
echo "删除不完整的项目目录..."
rm -rf AIliangbiao

# 使用 git clone 获取完整项目
echo "克隆完整项目..."
git clone https://github.com/Handsome5201314/ai-scale-system.git AIliangbiao

# 进入项目目录
cd AIliangbiao

# 恢复 .env 文件
if [ -f "/tmp/.env.backup" ]; then
    echo "恢复 .env 文件..."
    cp /tmp/.env.backup .env
    echo "✅ .env 已恢复"
fi

# 验证项目结构
echo ""
echo "验证项目结构..."
if [ -d "app" ] && [ -d "lib" ] && [ -f "package.json" ]; then
    echo "✅ 项目结构正确"
else
    echo "❌ 项目结构仍然不完整"
    exit 1
fi

# 安装依赖
echo ""
echo "安装依赖..."
npm install

echo ""
echo "=========================================="
echo "✅ 修复完成！"
echo "=========================================="
echo ""
echo "下一步:"
echo "1. 配置 .env 文件 (如果还没有)"
echo "2. 运行: npx prisma generate"
echo "3. 运行: npx prisma db push"
echo "4. 运行: npm run build"
echo "5. 运行: npm run dev (开发模式)"
echo "   或: pm2 start npm --name ai-scale-system -- start (生产模式)"
echo ""
