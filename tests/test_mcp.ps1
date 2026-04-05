# MCP 测试脚本 - PowerShell 版本
# 用法：在 PowerShell 中运行此脚本

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  MCP 服务测试" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

# 测试 1：主页
Write-Host "`n测试 1: 检查主页" -ForegroundColor Yellow
try {
    $home = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 5
    Write-Host "✅ 主页可访问 (状态码: $($home.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "❌ 主页访问失败: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 测试 2：MCP 端点（POST - 初始化）
Write-Host "`n测试 2: MCP 初始化" -ForegroundColor Yellow
try {
    # 先获取 Session ID（模拟 SSE 连接）
    $sessionUrl = "http://localhost:3000/api/mcp"
    $session = $null
    
    # 使用异步方式获取 Session ID
    $job = Start-Job -ScriptBlock {
        param($url)
        try {
            $response = Invoke-WebRequest -Uri $url -Method GET -UseBasicParsing -TimeoutSec 2
            return $response.Headers["X-Session-Id"]
        } catch {
            return $null
        }
    } -ArgumentList $sessionUrl
    
    Wait-Job $job -Timeout 3 | Out-Null
    $sessionId = Receive-Job $job
    Remove-Job $job
    
    if (-not $sessionId) {
        # 如果无法获取 Session ID，使用随机 ID 测试
        $sessionId = [guid]::NewGuid().ToString()
        Write-Host "⚠️  无法获取 Session ID，使用测试 ID: $sessionId" -ForegroundColor Yellow
    } else {
        Write-Host "✅ Session ID: $sessionId" -ForegroundColor Green
    }
    
    # 发送初始化请求
    $initBody = @{
        jsonrpc = "2.0"
        id = 1
        method = "initialize"
        params = @{}
    } | ConvertTo-Json
    
    $headers = @{
        "Content-Type" = "application/json"
        "X-Session-Id" = $sessionId
    }
    
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp" -Method POST -Body $initBody -Headers $headers -TimeoutSec 10
    
    if ($response.result) {
        Write-Host "✅ 初始化成功" -ForegroundColor Green
        Write-Host "   服务器: $($response.result.serverInfo.name)" -ForegroundColor Gray
        Write-Host "   版本: $($response.result.serverInfo.version)" -ForegroundColor Gray
    } else {
        Write-Host "❌ 初始化失败" -ForegroundColor Red
        Write-Host ($response | ConvertTo-Json) -ForegroundColor Red
    }
    
} catch {
    Write-Host "❌ 初始化失败: $($_.Exception.Message)" -ForegroundColor Red
}

# 测试 3：获取工具列表
Write-Host "`n测试 3: 获取工具列表" -ForegroundColor Yellow
try {
    $toolsBody = @{
        jsonrpc = "2.0"
        id = 2
        method = "tools/list"
        params = @{}
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp" -Method POST -Body $toolsBody -Headers $headers -TimeoutSec 10
    
    if ($response.result) {
        $tools = $response.result.tools
        Write-Host "✅ 找到 $($tools.Count) 个工具" -ForegroundColor Green
        foreach ($tool in $tools) {
            Write-Host "   - $($tool.name)" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "❌ 获取工具列表失败: $($_.Exception.Message)" -ForegroundColor Red
}

# 测试 4：调用推荐量表工具
Write-Host "`n测试 4: 调用 recommend_scale" -ForegroundColor Yellow
try {
    $callBody = @{
        jsonrpc = "2.0"
        id = 3
        method = "tools/call"
        params = @{
            name = "recommend_scale"
            arguments = @{
                symptoms = "转圈 不理人 自闭"
            }
        }
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp" -Method POST -Body $callBody -Headers $headers -TimeoutSec 10
    
    if ($response.result) {
        Write-Host "✅ 工具调用成功" -ForegroundColor Green
        Write-Host "   结果: $($response.result.content[0].text.Substring(0, [Math]::Min(100, $response.result.content[0].text.Length)))..." -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ 工具调用失败: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n======================================" -ForegroundColor Cyan
Write-Host "  测试完成" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
