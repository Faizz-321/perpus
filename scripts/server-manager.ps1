param(
    [ValidateSet("start", "stop", "status", "autostart-user", "autostart-system", "remove-autostart")]
    [string]$Action = "start"
)

$ErrorActionPreference = "SilentlyContinue"
$RootDir = Split-Path -Parent $PSScriptRoot
$BackendDir = Join-Path $RootDir "backend"
$LogDir = Join-Path $RootDir "logs"
$StopFlag = Join-Path $LogDir "stop.flag"
$NodePathFile = Join-Path $LogDir "node-path.txt"
$CfExePathFile = Join-Path $LogDir "cloudflared-exe-path.txt"
$CfConfigPathFile = Join-Path $LogDir "cloudflared-config-path.txt"
$TokenFile = Join-Path $RootDir "cloudflared-token.txt"

if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

function Save-EnvironmentHints {
    $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
    if ($nodeCmd -and (Test-Path $nodeCmd.Source)) {
        $nodeCmd.Source | Set-Content -Path $NodePathFile -Force
    }
    $cfCmd = Get-Command cloudflared -ErrorAction SilentlyContinue
    if ($cfCmd -and (Test-Path $cfCmd.Source)) {
        $cfCmd.Source | Set-Content -Path $CfExePathFile -Force
    }
    $userCfConfig = Join-Path $env:USERPROFILE ".cloudflared\config.yml"
    if (Test-Path $userCfConfig) {
        $userCfConfig | Set-Content -Path $CfConfigPathFile -Force
    }
}

function Get-CloudflaredExe {
    $localCf = Join-Path $RootDir "cloudflared.exe"
    if (Test-Path $localCf) { return $localCf }

    $cfCmd = Get-Command cloudflared -ErrorAction SilentlyContinue
    if ($cfCmd -and (Test-Path $cfCmd.Source)) {
        $cfCmd.Source | Set-Content -Path $CfExePathFile -Force
        return $cfCmd.Source
    }
    if (Test-Path $CfExePathFile) {
        $savedCf = (Get-Content $CfExePathFile -Raw).Trim()
        if ($savedCf -and (Test-Path $savedCf)) { return $savedCf }
    }
    $cfCandidates = @(
        "C:\Program Files (x86)\cloudflared\cloudflared.exe",
        "C:\Program Files\cloudflared\cloudflared.exe",
        "$env:LOCALAPPDATA\Microsoft\WinGet\Links\cloudflared.exe"
    )
    foreach ($c in $cfCandidates) {
        if ($c -and (Test-Path $c)) { return $c }
    }
    return ""
}

function Get-NodeExe {
    $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
    if ($nodeCmd -and (Test-Path $nodeCmd.Source)) {
        $nodeCmd.Source | Set-Content -Path $NodePathFile -Force
        return $nodeCmd.Source
    }
    if (Test-Path $NodePathFile) {
        $saved = (Get-Content $NodePathFile -Raw).Trim()
        if ($saved -and (Test-Path $saved)) { return $saved }
    }
    $candidates = @(
        "C:\Program Files\nodejs\node.exe",
        "C:\Program Files (x86)\nodejs\node.exe",
        "$env:LOCALAPPDATA\Programs\nodejs\node.exe",
        "C:\nvm4w\nodejs\node.exe"
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { return $c }
    }
    return "node"
}

function Test-PortListening([int]$Port) {
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    return ($null -ne $conn)
}

function Stop-PortProcess([int]$Port) {
    $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    foreach ($c in $conns) {
        if ($c.OwningProcess -and $c.OwningProcess -gt 4) {
            Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
        }
    }
}

function Stop-PidFile([string]$PidFile) {
    if (Test-Path $PidFile) {
        $pidVal = (Get-Content $PidFile -Raw).Trim()
        if ($pidVal -match '^\d+$') {
            Stop-Process -Id ([int]$pidVal) -Force -ErrorAction SilentlyContinue
        }
        Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
    }
}

function Test-PidFileAlive([string]$PidFile) {
    if (-not (Test-Path $PidFile)) { return $false }
    $pidVal = (Get-Content $PidFile -Raw).Trim()
    if ($pidVal -notmatch '^\d+$') { return $false }
    $proc = Get-Process -Id ([int]$pidVal) -ErrorAction SilentlyContinue
    return ($null -ne $proc)
}

function Start-MySQLServiceOrXampp {
    if (Test-PortListening 3306) {
        Write-Host "  [OK] MySQL sudah berjalan (Port 3306)" -ForegroundColor Green
        return
    }

    Write-Host "  [..] Menyalakan MySQL Database..." -ForegroundColor Yellow
    $mysqlSvc = Get-Service -Name "mysql*", "mariadb*" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($mysqlSvc) {
        Start-Service -Name $mysqlSvc.Name -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }

    if (-not (Test-PortListening 3306)) {
        $xamppPaths = @(
            "C:\xampp\mysql\bin\mysqld.exe",
            "D:\xampp\mysql\bin\mysqld.exe",
            "E:\xampp\mysql\bin\mysqld.exe"
        )
        foreach ($mysqld in $xamppPaths) {
            if (Test-Path $mysqld) {
                $myIni = Join-Path (Split-Path -Parent $mysqld) "my.ini"
                if (Test-Path $myIni) {
                    Start-Process -FilePath $mysqld -ArgumentList "--defaults-file=`"$myIni`"" -WindowStyle Hidden
                } else {
                    Start-Process -FilePath $mysqld -WindowStyle Hidden
                }
                break
            }
        }
    }

    for ($i = 0; $i -lt 12; $i++) {
        if (Test-PortListening 3306) { break }
        Start-Sleep -Milliseconds 500
    }

    if (Test-PortListening 3306) {
        Write-Host "  [OK] MySQL berhasil dinyalakan (Port 3306)" -ForegroundColor Green
    } else {
        Write-Host "  [!!] MySQL belum terdeteksi di Port 3306 (pastikan XAMPP terpasang di C:\xampp atau nyalakan MySQL)" -ForegroundColor Red
    }
}

function Start-ApacheServiceOrXampp {
    $httpdProc = Get-Process -Name "httpd" -ErrorAction SilentlyContinue
    if ($httpdProc) {
        Write-Host "  [OK] Apache / phpMyAdmin sudah berjalan (http://localhost/phpmyadmin)" -ForegroundColor Green
        return
    }

    Write-Host "  [..] Menyalakan Apache XAMPP (untuk phpMyAdmin)..." -ForegroundColor Yellow
    $apacheSvc = Get-Service -Name "Apache*" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($apacheSvc) {
        Start-Service -Name $apacheSvc.Name -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }

    if (-not (Get-Process -Name "httpd" -ErrorAction SilentlyContinue)) {
        $apachePaths = @(
            "C:\xampp\apache\bin\httpd.exe",
            "D:\xampp\apache\bin\httpd.exe",
            "E:\xampp\apache\bin\httpd.exe"
        )
        foreach ($httpd in $apachePaths) {
            if (Test-Path $httpd) {
                $apacheRoot = Split-Path -Parent (Split-Path -Parent $httpd)
                Start-Process -FilePath $httpd -WorkingDirectory $apacheRoot -WindowStyle Hidden
                break
            }
        }
        Start-Sleep -Seconds 2
    }

    if (Get-Process -Name "httpd" -ErrorAction SilentlyContinue) {
        Write-Host "  [OK] Apache / phpMyAdmin aktif (http://localhost/phpmyadmin)" -ForegroundColor Green
    } else {
        Write-Host "  [i]  Apache belum berjalan (jika ingin buka phpMyAdmin, klik Start pada Apache di XAMPP)" -ForegroundColor Yellow
    }
}

function Start-AllServices {
    Save-EnvironmentHints
    if (Test-Path $StopFlag) {
        Remove-Item $StopFlag -Force -ErrorAction SilentlyContinue
    }

    $nodeExe = Get-NodeExe
    Write-Host ""
    Write-Host "=====================================================" -ForegroundColor Cyan
    Write-Host "   MENYALAKAN SERVER WEBSITE PERPUSTAKAAN PAREPARE   " -ForegroundColor Cyan
    Write-Host "=====================================================" -ForegroundColor Cyan

    # 1. MySQL & Apache (phpMyAdmin)
    Start-MySQLServiceOrXampp
    Start-ApacheServiceOrXampp

    # 2. Backend Express (Port 5000)
    $backendPidFile = Join-Path $LogDir "backend-watchdog.pid"
    $backendLog = Join-Path $LogDir "backend.log"
    $backendScript = Join-Path $PSScriptRoot "run-backend-loop.ps1"

    if ((Test-PortListening 5000) -and (Test-PidFileAlive $backendPidFile)) {
        Write-Host "  [OK] Backend API sudah berjalan di latar belakang (http://localhost:5000)" -ForegroundColor Green
    } else {
        if (Test-PortListening 5000) {
            Write-Host "  [..] Memindahkan Backend API dari terminal manual ke latar belakang..." -ForegroundColor Yellow
            Stop-PidFile $backendPidFile
            Stop-PortProcess 5000
            Start-Sleep -Milliseconds 600
        } else {
            Write-Host "  [..] Menyalakan Backend API (Port 5000)..." -ForegroundColor Yellow
        }
        $argsBackend = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$backendScript`" -NodeExe `"$nodeExe`" -BackendDir `"$BackendDir`" -LogFile `"$backendLog`" -PidFile `"$backendPidFile`" -StopFlag `"$StopFlag`""
        Start-Process -FilePath "powershell.exe" -ArgumentList $argsBackend -WindowStyle Hidden
        for ($i = 0; $i -lt 16; $i++) {
            if (Test-PortListening 5000) { break }
            Start-Sleep -Milliseconds 500
        }
        if (Test-PortListening 5000) {
            Write-Host "  [OK] Backend API aktif (http://localhost:5000 -> db.ilkomith.web.id)" -ForegroundColor Green
        } else {
            Write-Host "  [!!] Backend API masih memuat, cek logs\backend.log jika ada kendala" -ForegroundColor Yellow
        }
    }

    # 3. Frontend Vite (Port 5173)
    $frontendPidFile = Join-Path $LogDir "frontend-watchdog.pid"
    $frontendLog = Join-Path $LogDir "frontend.log"
    $frontendScript = Join-Path $PSScriptRoot "run-frontend-loop.ps1"

    if ((Test-PortListening 5173) -and (Test-PidFileAlive $frontendPidFile)) {
        Write-Host "  [OK] Frontend Website sudah berjalan di latar belakang (http://localhost:5173)" -ForegroundColor Green
    } else {
        if (Test-PortListening 5173) {
            Write-Host "  [..] Memindahkan Frontend Website dari terminal manual ke latar belakang..." -ForegroundColor Yellow
            Stop-PidFile $frontendPidFile
            Stop-PortProcess 5173
            Start-Sleep -Milliseconds 600
        } else {
            Write-Host "  [..] Menyalakan Frontend Website (Port 5173)..." -ForegroundColor Yellow
        }
        $argsFrontend = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$frontendScript`" -NodeExe `"$nodeExe`" -RootDir `"$RootDir`" -LogFile `"$frontendLog`" -PidFile `"$frontendPidFile`" -StopFlag `"$StopFlag`""
        Start-Process -FilePath "powershell.exe" -ArgumentList $argsFrontend -WindowStyle Hidden
        for ($i = 0; $i -lt 16; $i++) {
            if (Test-PortListening 5173) { break }
            Start-Sleep -Milliseconds 500
        }
        if (Test-PortListening 5173) {
            Write-Host "  [OK] Frontend Website aktif (http://localhost:5173 -> *.ilkomith.web.id)" -ForegroundColor Green
        } else {
            Write-Host "  [!!] Frontend masih memuat, cek logs\frontend.log jika ada kendala" -ForegroundColor Yellow
        }
    }

    # 4. Cloudflare Tunnel
    $cfProc = Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue
    if ($cfProc) {
        Write-Host "  [OK] Cloudflare Tunnel (cloudflared) sudah aktif" -ForegroundColor Green
    } else {
        $cfSvc = Get-Service -Name "Cloudflared" -ErrorAction SilentlyContinue
        if ($cfSvc) {
            Start-Service -Name "Cloudflared" -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
        }

        $cfProc = Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue
        if ($cfProc) {
            Write-Host "  [OK] Cloudflare Tunnel Service berhasil dinyalakan" -ForegroundColor Green
        } else {
            $cfExe = Get-CloudflaredExe

            $tunnelScript = Join-Path $PSScriptRoot "run-tunnel-loop.ps1"
            $tunnelPidFile = Join-Path $LogDir "tunnel-watchdog.pid"
            $tunnelLog = Join-Path $LogDir "tunnel.log"

            $tokenVal = ""
            if (Test-Path $TokenFile) {
                $cleanLines = @(Get-Content $TokenFile | Where-Object { $_.Trim() -ne "" -and (-not $_.Trim().StartsWith("#")) })
                $rawToken = ($cleanLines -join " ").Trim()
                if ($rawToken -match '(eyJ[A-Za-z0-9_\-\.=]{20,})') {
                    $tokenVal = $Matches[1]
                } elseif ($rawToken.Length -gt 20) {
                    $tokenVal = $rawToken
                }
            }

            $cfConfigPath = Join-Path $env:USERPROFILE ".cloudflared\config.yml"
            if (-not (Test-Path $cfConfigPath) -and (Test-Path $CfConfigPathFile)) {
                $cfConfigPath = (Get-Content $CfConfigPathFile -Raw).Trim()
            }

            if ($cfExe -and (Test-Path $cfExe) -and $tokenVal) {
                Write-Host "  [..] Menyalakan Cloudflare Tunnel via cloudflared-token.txt..." -ForegroundColor Yellow
                $argsTunnel = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$tunnelScript`" -CloudflaredExe `"$cfExe`" -Mode token -ArgValue `"$tokenVal`" -LogFile `"$tunnelLog`" -PidFile `"$tunnelPidFile`" -StopFlag `"$StopFlag`""
                Start-Process -FilePath "powershell.exe" -ArgumentList $argsTunnel -WindowStyle Hidden
                Start-Sleep -Seconds 2
                Write-Host "  [OK] Cloudflare Tunnel berjalan di latar belakang" -ForegroundColor Green
            } elseif ($cfExe -and (Test-Path $cfExe) -and (Test-Path $cfConfigPath)) {
                Write-Host "  [..] Menyalakan Cloudflare Tunnel via config.yml..." -ForegroundColor Yellow
                $argsTunnel = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$tunnelScript`" -CloudflaredExe `"$cfExe`" -Mode config -ArgValue `"$cfConfigPath`" -LogFile `"$tunnelLog`" -PidFile `"$tunnelPidFile`" -StopFlag `"$StopFlag`""
                Start-Process -FilePath "powershell.exe" -ArgumentList $argsTunnel -WindowStyle Hidden
                Start-Sleep -Seconds 2
                Write-Host "  [OK] Cloudflare Tunnel berjalan di latar belakang" -ForegroundColor Green
            } else {
                Write-Host "  [i]  Cloudflare Tunnel belum terdeteksi sebagai service." -ForegroundColor Yellow
                Write-Host "       Jika memakai token, simpan token Anda ke file cloudflared-token.txt" -ForegroundColor Gray
                Write-Host "       atau jalankan sekali (Admin): .\cloudflared.exe service install TOKEN_ANDA" -ForegroundColor Gray
            }
        }
    }

    Write-Host "=====================================================" -ForegroundColor Cyan
    Write-Host "  Semua server berjalan di latar belakang (Auto-Heal)" -ForegroundColor Green
    Write-Host "  Anda bebas menutup jendela terminal ini!" -ForegroundColor Green
    Write-Host "=====================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Stop-AllServices {
    Write-Host ""
    Write-Host "Menghentikan server Backend, Frontend, dan Watchdog..." -ForegroundColor Yellow
    "stopped" | Set-Content -Path $StopFlag -Force

    Stop-PidFile (Join-Path $LogDir "backend-watchdog.pid")
    Stop-PidFile (Join-Path $LogDir "frontend-watchdog.pid")
    Stop-PidFile (Join-Path $LogDir "tunnel-watchdog.pid")

    Stop-PortProcess 5000
    Stop-PortProcess 5173
    Stop-Service -Name "Cloudflared" -ErrorAction SilentlyContinue
    Stop-Process -Name "cloudflared" -Force -ErrorAction SilentlyContinue

    Write-Host "  [OK] Backend (5000), Frontend (5173), & Cloudflare Tunnel telah dihentikan." -ForegroundColor Green
    Write-Host ""
}

function Show-Status {
    Write-Host ""
    Write-Host "=== STATUS SERVER WEBSITE PERPUSTAKAAN ===" -ForegroundColor Cyan
    $m = Test-PortListening 3306
    $a = ($null -ne (Get-Process -Name "httpd" -ErrorAction SilentlyContinue))
    $b = Test-PortListening 5000
    $f = Test-PortListening 5173
    $c = ($null -ne (Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue))

    Write-Host ("  MySQL Database (3306)    : " + ($(if ($m) { "ONLINE" } else { "OFFLINE" }))) -ForegroundColor ($(if ($m) { "Green" } else { "Red" }))
    Write-Host ("  Apache / phpMyAdmin (80) : " + ($(if ($a) { "ONLINE (http://localhost/phpmyadmin)" } else { "OFFLINE" }))) -ForegroundColor ($(if ($a) { "Green" } else { "Yellow" }))
    Write-Host ("  Backend API (5000)       : " + ($(if ($b) { "ONLINE" } else { "OFFLINE" }))) -ForegroundColor ($(if ($b) { "Green" } else { "Red" }))
    Write-Host ("  Frontend Vite (5173)     : " + ($(if ($f) { "ONLINE" } else { "OFFLINE" }))) -ForegroundColor ($(if ($f) { "Green" } else { "Red" }))
    Write-Host ("  Cloudflare Tunnel        : " + ($(if ($c) { "ONLINE" } else { "OFFLINE" }))) -ForegroundColor ($(if ($c) { "Green" } else { "Yellow" }))
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""
}

function Install-AutoStartUser {
    Save-EnvironmentHints
    $startupDir = [Environment]::GetFolderPath("Startup")
    $vbsPath = Join-Path $startupDir "PerpustakaanParepareServer.vbs"
    $ps1Path = Join-Path $PSScriptRoot "server-manager.ps1"

    $vbsContent = @(
        'Set WshShell = CreateObject("WScript.Shell")',
        "WshShell.Run ""powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """"$ps1Path"""" -Action start"", 0, False"
    ) -join "`r`n"

    Set-Content -Path $vbsPath -Value $vbsContent -Encoding ASCII -Force
    Write-Host "  [OK] Auto-Start saat Login Windows terdaftar di:" -ForegroundColor Green
    Write-Host "       $vbsPath" -ForegroundColor Gray
}

function Install-AutoStartSystem {
    $ps1Path = Join-Path $PSScriptRoot "server-manager.ps1"
    $taskName = "PerpustakaanParepareServer"
    $taskCmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ps1Path`" -Action start"

    & schtasks.exe /Create /TN $taskName /TR $taskCmd /SC ONSTART /RU SYSTEM /RL HIGHEST /F | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [OK] Task Scheduler (ONSTART / SYSTEM) berhasil dibuat!" -ForegroundColor Green
        Write-Host "       Server otomatis menyala saat PC hidup bahkan sebelum login Windows." -ForegroundColor Gray
    } else {
        Write-Host "  [i]  Task ONSTART SYSTEM dilewati (butuh Run as Administrator). Startup Login tetap aktif." -ForegroundColor Yellow
    }

    $cfSvc = Get-Service -Name "Cloudflared" -ErrorAction SilentlyContinue
    if ($cfSvc) {
        Set-Service -Name "Cloudflared" -StartupType Automatic -ErrorAction SilentlyContinue
        Start-Service -Name "Cloudflared" -ErrorAction SilentlyContinue
        Write-Host "  [OK] Service Cloudflared diset ke Automatic Start." -ForegroundColor Green
    }

    $mysqlSvc = Get-Service -Name "mysql*", "mariadb*" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($mysqlSvc) {
        Set-Service -Name $mysqlSvc.Name -StartupType Automatic -ErrorAction SilentlyContinue
        Start-Service -Name $mysqlSvc.Name -ErrorAction SilentlyContinue
        Write-Host "  [OK] Service $($mysqlSvc.Name) diset ke Automatic Start." -ForegroundColor Green
    }
}

function Remove-AutoStart {
    $startupDir = [Environment]::GetFolderPath("Startup")
    $vbsPath = Join-Path $startupDir "PerpustakaanParepareServer.vbs"
    if (Test-Path $vbsPath) {
        Remove-Item $vbsPath -Force -ErrorAction SilentlyContinue
    }
    Get-ChildItem "C:\Users\*\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\PerpustakaanParepareServer.vbs" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
    Write-Host "  [OK] Startup Login dihapus." -ForegroundColor Green

    & schtasks.exe /Delete /TN "PerpustakaanParepareServer" /F 2>$null | Out-Null
    Write-Host "  [OK] Scheduled Task PerpustakaanParepareServer dihapus." -ForegroundColor Green

    $cfSvc = Get-Service -Name "Cloudflared" -ErrorAction SilentlyContinue
    if ($cfSvc) {
        Stop-Service -Name "Cloudflared" -Force -ErrorAction SilentlyContinue
        Set-Service -Name "Cloudflared" -StartupType Disabled -ErrorAction SilentlyContinue
        $cfExe = Get-CloudflaredExe
        if ($cfExe -and (Test-Path $cfExe)) {
            & $cfExe service uninstall 2>$null | Out-Null
        }
        Write-Host "  [OK] Windows Service Cloudflared dihentikan & dihapus." -ForegroundColor Green
    }

    & taskkill.exe /F /IM cloudflared.exe /T 2>$null | Out-Null

    foreach ($mysqlAdmin in @("C:\xampp\mysql\bin\mysqladmin.exe", "D:\xampp\mysql\bin\mysqladmin.exe", "E:\xampp\mysql\bin\mysqladmin.exe")) {
        if (Test-Path $mysqlAdmin) {
            & $mysqlAdmin --connect-timeout=2 -u root shutdown 2>$null | Out-Null
            break
        }
    }
    Stop-Process -Name "httpd" -Force -ErrorAction SilentlyContinue
    Write-Host "  [OK] Semua server & tunnel di perangkat ini sudah dimatikan permanen." -ForegroundColor Green
}

switch ($Action) {
    "start"            { Start-AllServices }
    "stop"             { Stop-AllServices }
    "status"           { Show-Status }
    "autostart-user"   { Install-AutoStartUser; Start-AllServices }
    "autostart-system" { Install-AutoStartSystem }
    "remove-autostart" { Stop-AllServices; Remove-AutoStart }
}

