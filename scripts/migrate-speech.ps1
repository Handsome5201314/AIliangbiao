# 语音识别组件迁移脚本
# 用途：从 Web Speech API 切换到 MediaRecorder API + 后端语音识别服务

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  语音识别组件迁移脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查是否在项目根目录
if (-Not (Test-Path "components")) {
    Write-Host "❌ 错误：请在项目根目录运行此脚本" -ForegroundColor Red
    exit 1
}

# 确认操作
Write-Host "此脚本将执行以下操作：" -ForegroundColor Yellow
Write-Host "1. 备份旧组件（.tsx -> .old.tsx）"
Write-Host "2. 启用新组件（New.tsx -> .tsx）"
Write-Host ""
$confirm = Read-Host "是否继续？(Y/N)"

if ($confirm -ne "Y" -and $confirm -ne "y") {
    Write-Host "已取消操作" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "开始迁移..." -ForegroundColor Green

# 1. 备份旧组件
Write-Host ""
Write-Host "步骤 1/2：备份旧组件" -ForegroundColor Cyan

$oldFile1 = "components\TriageVoiceRecorder.tsx"
$newFile1 = "components\TriageVoiceRecorder.old.tsx"

if (Test-Path $oldFile1) {
    if (Test-Path $newFile1) {
        Remove-Item $newFile1 -Force
    }
    Rename-Item $oldFile1 $newFile1
    Write-Host "  ✅ 已备份：$oldFile1 -> $newFile1" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  文件不存在，跳过：$oldFile1" -ForegroundColor Yellow
}

$oldFile2 = "components\Questionnaire.tsx"
$newFile2 = "components\Questionnaire.old.tsx"

if (Test-Path $oldFile2) {
    if (Test-Path $newFile2) {
        Remove-Item $newFile2 -Force
    }
    Rename-Item $oldFile2 $newFile2
    Write-Host "  ✅ 已备份：$oldFile2 -> $newFile2" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  文件不存在，跳过：$oldFile2" -ForegroundColor Yellow
}

# 2. 启用新组件
Write-Host ""
Write-Host "步骤 2/2：启用新组件" -ForegroundColor Cyan

$newFile3 = "components\TriageVoiceRecorderNew.tsx"
$oldFile3 = "components\TriageVoiceRecorder.tsx"

if (Test-Path $newFile3) {
    if (Test-Path $oldFile3) {
        Remove-Item $oldFile3 -Force
    }
    Rename-Item $newFile3 $oldFile3
    Write-Host "  ✅ 已启用：$newFile3 -> $oldFile3" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  新组件不存在：$newFile3" -ForegroundColor Yellow
}

$newFile4 = "components\QuestionnaireNew.tsx"
$oldFile4 = "components\Questionnaire.tsx"

if (Test-Path $newFile4) {
    if (Test-Path $oldFile4) {
        Remove-Item $oldFile4 -Force
    }
    Rename-Item $newFile4 $oldFile4
    Write-Host "  ✅ 已启用：$newFile4 -> $oldFile4" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  新组件不存在：$newFile4" -ForegroundColor Yellow
}

# 3. 完成
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ✅ 迁移完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "下一步操作：" -ForegroundColor Yellow
Write-Host "1. 重启开发服务器：npm run dev" -ForegroundColor Cyan
Write-Host "2. 配置语音识别 API Key：http://localhost:3000/admin/apikeys" -ForegroundColor Cyan
Write-Host "3. 测试语音识别功能" -ForegroundColor Cyan
Write-Host ""
Write-Host "详细文档：SPEECH_ERROR_FIX.md" -ForegroundColor Gray
Write-Host ""
