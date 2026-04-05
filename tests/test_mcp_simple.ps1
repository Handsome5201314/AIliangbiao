# 简单的 MCP 测试
Write-Host "MCP 服务测试" -ForegroundColor Cyan

# 测试主页
Write-Host "`n1. 测试主页..." -ForegroundColor Yellow
try {
    $r = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 5
    Write-Host "OK - 状态码: $($r.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "FAIL - $($_.Exception.Message)" -ForegroundColor Red
}

# 测试 MCP 端点
Write-Host "`n2. 测试 MCP 初始化..." -ForegroundColor Yellow
$sessionId = [guid]::NewGuid().ToString()
Write-Host "Using Session ID: $sessionId"

$body = @{
    jsonrpc = "2.0"
    id = 1
    method = "initialize"
    params = @{}
} | ConvertTo-Json

$headers = @{
    "Content-Type" = "application/json"
    "X-Session-Id" = $sessionId
}

try {
    $r = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp" -Method POST -Body $body -Headers $headers -TimeoutSec 10
    Write-Host "OK - 服务器: $($r.result.serverInfo.name)" -ForegroundColor Green
} catch {
    Write-Host "FAIL - $($_.Exception.Message)" -ForegroundColor Red
}

# 测试工具列表
Write-Host "`n3. 测试获取工具列表..." -ForegroundColor Yellow
$body = @{
    jsonrpc = "2.0"
    id = 2
    method = "tools/list"
    params = @{}
} | ConvertTo-Json

try {
    $r = Invoke-RestMethod -Uri "http://localhost:3000/api/mcp" -Method POST -Body $body -Headers $headers -TimeoutSec 10
    Write-Host "OK - 找到 $($r.result.tools.Count) 个工具" -ForegroundColor Green
    foreach ($t in $r.result.tools) {
        Write-Host "  - $($t.name)"
    }
} catch {
    Write-Host "FAIL - $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n测试完成" -ForegroundColor Cyan
