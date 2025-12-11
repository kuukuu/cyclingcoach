# -*- coding: utf-8 -*-
# WatchZwiftZwo.ps1
#
# Aixle Sync Agent for Windows
# Watches the Google Drive folder and syncs .zwo files to Zwift "Aixle" folder.
#
# How to use:
# 1. Edit $sourceFolder (Your Google Drive path)
# 2. Edit $zwiftId (Your Zwift ID found in Documents\Zwift\Workouts\)
# 3. Run with PowerShell

# ================= CONFIGURATION (EDIT HERE) =================

# 1. Google Drive folder (Must match USER_SETTINGS.WORKOUT_FOLDER in GAS)
#    Googleドライブにある、GASがファイルを生成するフォルダのフルパス
$sourceFolder = "G:\My Drive\Aixle_Workouts" 

# 2. Your Zwift ID
#    ドキュメント\Zwift\Workouts\ の中にある数字のフォルダ名
$zwiftId = "123456" 

# 3. Folder name inside Zwift (Fixed to "Aixle")
#    Zwiftのゲーム画面で表示されるカテゴリ名になります
$destSubFolderName = "Aixle"

# 4. Cleanup: Delete files older than X days from Zwift folder
$daysToKeep = 7

# =============================================================

# Construct paths
$docsPath = [Environment]::GetFolderPath("MyDocuments")
$destinationFolder = Join-Path $docsPath "Zwift\Workouts\$zwiftId\$destSubFolderName"
$logFile = "$PSScriptRoot\aixle_sync.log"
$pollingIntervalSeconds = 30

# Import BurntToast for notifications (Optional)
Import-Module BurntToast -ErrorAction SilentlyContinue

# Setup Tray Icon
Add-Type -AssemblyName System.Windows.Forms
$notifyIcon = New-Object System.Windows.Forms.NotifyIcon
$notifyIcon.Icon = [System.Drawing.SystemIcons]::Information
$notifyIcon.Visible = $true
$notifyIcon.Text = "Aixle Sync (Running)"

# Logging Function
function Write-Log($msg) {
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $logMsg = "[$timestamp] $msg"
    Write-Host $logMsg
    $logMsg | Out-File -FilePath $script:logFile -Append -Encoding UTF8
}

Write-Log "===== Aixle Sync Agent Started ====="
Write-Log "Source: $sourceFolder"
Write-Log "Target: $destinationFolder"

# Validation
if (-not (Test-Path $sourceFolder)) {
    Write-Log "ERROR: Source folder not found. Check Google Drive path."
    if (Get-Module -ListAvailable -Name BurntToast) {
        New-BurntToastNotification -Text "Aixle Error", "Google Drive folder not found!"
    }
}

# Create Destination if missing
if (-not (Test-Path $destinationFolder)) {
    try {
        New-Item -Path $destinationFolder -ItemType Directory -Force | Out-Null
        Write-Log "Created Zwift/Aixle folder."
    } catch {
        Write-Log "ERROR: Could not create destination folder."
        return
    }
}

# Polling Function
function Start-Polling() {
    if (-not (Test-Path $sourceFolder)) { return }

    $sourceFiles = Get-ChildItem -Path $script:sourceFolder -Filter "*.zwo"
    $sourceFileNames = @($sourceFiles | Select-Object -ExpandProperty Name)

    # 1. Sync New Files
    foreach ($sourceFile in $sourceFiles) {
        $fileName = $sourceFile.Name
        $destFile = Join-Path $script:destinationFolder $fileName
        $shouldCopy = $false
        
        if (-not (Test-Path $destFile)) {
            $shouldCopy = $true
        } else {
            $destFileItem = Get-Item $destFile
            if ($sourceFile.LastWriteTime -gt $destFileItem.LastWriteTime) {
                $shouldCopy = $true
            }
        }

        if ($shouldCopy) {
            try {
                Copy-Item -Path $sourceFile.FullName -Destination $destFile -Force
                Write-Log "Synced: $fileName"
                if (Get-Module -ListAvailable -Name BurntToast) {
                    New-BurntToastNotification -Text "Aixle Workout Ready", "New Menu: $fileName"
                }
            } catch {
                Write-Log "Sync Failed: $_"
            }
        }
    }

    # 2. Cleanup Old Files
    $deadline = (Get-Date).AddDays(-$script:daysToKeep)
    
    Get-ChildItem -Path $script:destinationFolder -Filter "*.zwo" | ForEach-Object {
        # Delete if file is NOT in source (Google Drive) AND matches date criteria
        if (-not ($sourceFileNames -contains $_.Name) -and $_.LastWriteTime -lt $deadline) {
            try {
                Remove-Item $_.FullName -Force
                Write-Log "Cleaned up: $($_.Name)"
            } catch {
                Write-Log "Cleanup Failed: $_"
            }
        }
    }
}

# Main Loop
while ($true) {
    Start-Polling
    Start-Sleep -Seconds $script:pollingIntervalSeconds
}
