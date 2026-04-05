# 测试记忆中枢 MCP Skill

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  记忆中枢 MCP Skill 测试脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. 获取 deviceId
$deviceId = localStorage.getItem('device_id')
if (-not $deviceId) {
    Write-Host "[错误] 未找到 deviceId，请先在浏览器中访问应用" -ForegroundColor Red
    Write-Host "提示：在浏览器控制台运行 localStorage.getItem('device_id')" -ForegroundColor Yellow
    exit 1
}

Write-Host "[信息] 使用 deviceId: $deviceId" -ForegroundColor Green
Write-Host ""

# 2. 测试工具列表
Write-Host "测试 1: 获取工具列表..." -ForegroundColor Yellow
$toolsListBody = @{
    jsonrpc = "2.0"
    id = "test-001"
    method = "tools/list"
} | ConvertTo-Json -Depth 3

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/memory" `
        -Method POST `
        -ContentType "application/json" `
        -Body $toolsListBody
    
    Write-Host "✅ 成功获取工具列表:" -ForegroundColor Green
    $response.result.tools | ForEach-Object {
        Write-Host "  - $($_.name)" -ForegroundColor White
    }
} catch {
    Write-Host "❌ 测试失败: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# 3. 测试获取记忆
Write-Host "测试 2: 获取用户记忆..." -ForegroundColor Yellow
$getMemoryBody = @{
    jsonrpc = "2.0"
    id = "test-002"
    method = "tools/call"
    params = @{
        name = "get_user_memory"
        arguments = @{
            deviceId = $deviceId
        }
    }
} | ConvertTo-Json -Depth 3

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/memory" `
        -Method POST `
        -ContentType "application/json" `
        -Body $getMemoryBody
    
    Write-Host "✅ 成功获取用户记忆:" -ForegroundColor Green
    $result = $response.result.content[0].text | ConvertFrom-Json
    
    if ($result.error) {
        Write-Host "  错误: $($result.error)" -ForegroundColor Yellow
    } else {
        Write-Host "  昵称: $($result.nickname)" -ForegroundColor White
        Write-Host "  性别: $($result.gender)" -ForegroundColor White
        Write-Host "  月龄: $($result.ageMonths)" -ForegroundColor White
        Write-Host "  兴趣: $($result.traits.interests -join ', ')" -ForegroundColor White
        Write-Host "  恐惧: $($result.traits.fears -join ', ')" -ForegroundColor White
    }
} catch {
    Write-Host "❌ 测试失败: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# 4. 测试保存记忆
Write-Host "测试 3: 保存新记忆..." -ForegroundColor Yellow
$saveMemoryBody = @{
    jsonrpc = "2.0"
    id = "test-003"
    method = "tools/call"
    params = @{
        name = "save_user_memory"
        arguments = @{
            deviceId = $deviceId
            interest = "测试兴趣_$(Get-Date -Format 'HHmmss')"
            fear = "测试恐惧_$(Get-Date -Format 'HHmmss')"
        }
    }
} | ConvertTo-Json -Depth 3

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/memory" `
        -Method POST `
        -ContentType "application/json" `
        -Body $saveMemoryBody
    
    Write-Host "✅ 成功保存记忆:" -ForegroundColor Green
    $result = $response.result.content[0].text | ConvertFrom-Json
    Write-Host "  状态: $($result.status)" -ForegroundColor White
    Write-Host "  消息: $($result.message)" -ForegroundColor White
} catch {
    Write-Host "❌ 测试失败: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# 5. 验证记忆已更新
Write-Host "测试 4: 验证记忆已更新..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/memory" `
        -Method POST `
        -ContentType "application/json" `
        -Body $getMemoryBody
    
    $result = $response.result.content[0].text | ConvertFrom-Json
    $interests = $result.traits.interests
    $fears = $result.traits.fears
    
    $lastInterest = $interests[-1]
    $lastFear = $fears[-1]
    
    if ($lastInterest -like "测试兴趣_*" -and $lastFear -like "测试恐惧_*") {
        Write-Host "✅ 记忆已成功更新" -ForegroundColor Green
        Write-Host "  最新兴趣: $lastInterest" -ForegroundColor White
        Write-Host "  最新恐惧: $lastFear" -ForegroundColor White
    } else {
        Write-Host "⚠️  警告: 记忆可能未正确更新" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ 验证失败: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  所有测试完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
