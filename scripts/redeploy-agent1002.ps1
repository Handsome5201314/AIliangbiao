[CmdletBinding()]
param(
    [string]$Host = "136.110.9.74",
    [string]$User = "root",
    [string]$Domain = "ailiangbiao.agentpit.io",
    [string]$AppBase = "/opt/ai-scale-system",
    [string]$AppName = "ai-scale-system",
    [string]$DbName = "ai_scale_db",
    [string]$DbUser = "ai_scale_app",
    [string]$AdminUsername = "admin",
    [string]$KeyPath = (Join-Path $env:TEMP "ai-scale-deploy\agent1002_ed25519"),
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function New-Secret([int]$Bytes = 24) {
    $buffer = New-Object byte[] $Bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($buffer)
    return [Convert]::ToBase64String($buffer).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function Ensure-Command([string]$Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Missing required command: $Name"
    }
}

function Invoke-Cli([string]$FilePath, [string[]]$Arguments) {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $FilePath
    foreach ($argument in $Arguments) {
        [void]$psi.ArgumentList.Add($argument)
    }
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.UseShellExecute = $false

    $process = [System.Diagnostics.Process]::Start($psi)
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()

    if ($stdout) { Write-Host $stdout.TrimEnd() }
    if ($stderr) { Write-Warning ($stderr.TrimEnd()) }
    if ($process.ExitCode -ne 0) {
        throw "$FilePath failed with exit code $($process.ExitCode)"
    }

    return $stdout
}

Ensure-Command ssh
Ensure-Command scp
Ensure-Command tar

if (-not (Test-Path $KeyPath)) {
    throw "SSH private key not found: $KeyPath"
}

$releaseId = [DateTimeOffset]::UtcNow.ToString("yyyyMMdd-HHmmss")
$tempDir = Join-Path $env:TEMP "ai-scale-deploy"
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

$tarballName = "ai-scale-release-$releaseId.tar.gz"
$localTarball = Join-Path $tempDir $tarballName
$remoteTarball = "/root/$tarballName"
$remoteScript = "/tmp/remote-redeploy-$releaseId.sh"
$remoteEnv = "/tmp/remote-redeploy-$releaseId.env"
$resultFile = Join-Path $tempDir "deploy-result-$releaseId.json"

if (Test-Path $localTarball) {
    Remove-Item $localTarball -Force
}

Write-Host "Creating release tarball..."
Invoke-Cli tar @(
    "-czf", $localTarball,
    "--exclude=.git",
    "--exclude=.next",
    "--exclude=node_modules",
    "--exclude=.codebuddy",
    "--exclude=.vercel",
    "--exclude=.env",
    "--exclude=tsconfig.tsbuildinfo",
    "-C", $RepoRoot,
    "."
) | Out-Null

$dbPassword = New-Secret 24
$adminPassword = New-Secret 18
$sessionSecret = New-Secret 48
$backupDir = "/root/deploy-backup/$releaseId"
$releasesDir = "$AppBase/releases"
$currentLink = "$AppBase/current"
$sharedDir = "$AppBase/shared"
$envPath = "$sharedDir/.env.production"
$logDir = "/var/log/ai-scale-system"
$releaseDir = "$releasesDir/$releaseId"

$remoteEnvContent = @(
    "RELEASE_ID=$releaseId",
    "RELEASE_TARBALL=$remoteTarball",
    "DOMAIN=$Domain",
    "APP_BASE=$AppBase",
    "RELEASES_DIR=$releasesDir",
    "CURRENT_LINK=$currentLink",
    "SHARED_DIR=$sharedDir",
    "ENV_PATH=$envPath",
    "LOG_DIR=$logDir",
    "APP_NAME=$AppName",
    "DB_NAME=$DbName",
    "DB_USER=$DbUser",
    "DB_PASSWORD=$dbPassword",
    "SESSION_SECRET=$sessionSecret",
    "ADMIN_USERNAME=$AdminUsername",
    "ADMIN_PASSWORD=$adminPassword",
    "BACKUP_DIR=$backupDir",
    "RELEASE_DIR=$releaseDir"
) -join "`n"

$localEnvFile = Join-Path $tempDir "remote-redeploy-$releaseId.env"
$localScript = Join-Path $RepoRoot "scripts\remote-redeploy.sh"
Set-Content -Path $localEnvFile -Value $remoteEnvContent -Encoding UTF8

Write-Host "Uploading release artifacts..."
Invoke-Cli scp @("-i", $KeyPath, "-o", "StrictHostKeyChecking=no", $localTarball, "$User@$Host`:$remoteTarball") | Out-Null
Invoke-Cli scp @("-i", $KeyPath, "-o", "StrictHostKeyChecking=no", $localScript, "$User@$Host`:$remoteScript") | Out-Null
Invoke-Cli scp @("-i", $KeyPath, "-o", "StrictHostKeyChecking=no", $localEnvFile, "$User@$Host`:$remoteEnv") | Out-Null

Write-Host "Running remote deployment..."
$remoteCommand = "set -a && source $remoteEnv && set +a && chmod +x $remoteScript && bash $remoteScript"
$remoteOutput = Invoke-Cli ssh @("-i", $KeyPath, "-o", "StrictHostKeyChecking=no", "$User@$Host", $remoteCommand)

$jsonLine = ($remoteOutput -split "`r?`n" | Where-Object { $_.Trim().StartsWith("{") -and $_.Trim().EndsWith("}") } | Select-Object -Last 1)
if (-not $jsonLine) {
    throw "Deployment finished without a machine-readable result."
}

$result = $jsonLine | ConvertFrom-Json
$result | Add-Member -NotePropertyName host -NotePropertyValue $Host
$result | Add-Member -NotePropertyName domain -NotePropertyValue $Domain
$result | ConvertTo-Json -Depth 8 | Set-Content -Path $resultFile -Encoding UTF8

Write-Host ""
Write-Host "Deployment complete."
Write-Host "Result file: $resultFile"
Write-Host "Admin username: $($result.admin_username)"
Write-Host "Admin password: $($result.admin_password)"
Write-Host "Database URL: $($result.database_url)"
Write-Host "Current release: $($result.release_dir)"
