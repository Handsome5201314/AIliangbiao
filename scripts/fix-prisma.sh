#!/bin/bash

# ==========================================
# Prisma 修复脚本
# ==========================================

echo "检查项目结构..."

# 检查 prisma 目录
if [ -d "prisma" ]; then
    echo "✅ prisma 目录存在"
    ls -la prisma/
else
    echo "❌ prisma 目录不存在"
    echo "正在创建 prisma 目录..."
    mkdir -p prisma
fi

# 检查 schema.prisma 文件
if [ -f "prisma/schema.prisma" ]; then
    echo "✅ schema.prisma 文件存在"
else
    echo "❌ schema.prisma 文件不存在"
    echo "请确保项目完整克隆"
    exit 1
fi

echo ""
echo "验证 Prisma Schema..."
npx prisma validate

if [ $? -eq 0 ]; then
    echo "✅ Prisma Schema 验证通过"
else
    echo "❌ Prisma Schema 验证失败"
    exit 1
fi
