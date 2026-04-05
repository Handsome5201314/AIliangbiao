#!/bin/bash

# ==========================================
# 项目结构诊断脚本
# ==========================================

echo "=========================================="
echo "项目结构诊断"
echo "=========================================="
echo ""

# 显示当前目录
echo "当前目录: $(pwd)"
echo ""

# 列出当前目录的所有文件和文件夹
echo "当前目录内容:"
ls -la
echo ""

# 检查关键目录
echo "检查关键目录:"
echo ""

# 检查 app 目录
if [ -d "app" ]; then
    echo "✅ app 目录存在"
    echo "   文件数: $(find app -type f | wc -l)"
else
    echo "❌ app 目录不存在"
fi

# 检查 lib 目录
if [ -d "lib" ]; then
    echo "✅ lib 目录存在"
    echo "   文件数: $(find lib -type f | wc -l)"
else
    echo "❌ lib 目录不存在"
fi

# 检查 components 目录
if [ -d "components" ]; then
    echo "✅ components 目录存在"
else
    echo "❌ components 目录不存在"
fi

# 检查 prisma 目录
if [ -d "prisma" ]; then
    echo "✅ prisma 目录存在"
else
    echo "❌ prisma 目录不存在"
fi

# 检查 package.json
if [ -f "package.json" ]; then
    echo "✅ package.json 存在"
else
    echo "❌ package.json 不存在"
fi

# 检查 .env 文件
if [ -f ".env" ]; then
    echo "✅ .env 文件存在"
else
    echo "❌ .env 文件不存在"
fi

echo ""
echo "=========================================="

# 如果 app 目录不存在，提供解决方案
if [ ! -d "app" ]; then
    echo "⚠️  问题诊断: 项目文件不完整"
    echo ""
    echo "可能的原因:"
    echo "1. 上传时排除了某些文件/目录"
    echo "2. 上传到了错误的位置"
    echo "3. git clone 不完整"
    echo ""
    echo "解决方案:"
    echo ""
    echo "方案1: 使用 git clone (推荐)"
    echo "  cd ~"
    echo "  rm -rf AIliangbiao"
    echo "  git clone https://github.com/Handsome5201314/ai-scale-system.git AIliangbiao"
    echo "  cd AIliangbiao"
    echo ""
    echo "方案2: 重新上传完整项目"
    echo "  在本地 Windows 执行:"
    echo "  cd \"c:\\Users\\lishuaishuai\\Desktop\\AI量表系统\""
    echo "  scp -r * root@136.110.9.74:~/AIliangbiao/"
    echo ""
fi

echo "=========================================="
