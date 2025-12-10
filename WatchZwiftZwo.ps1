# -*- coding: utf-8 -*-
# WatchZwiftZwo.ps1
#
# A script to auto-sync .zwo files from Google Drive to Zwift.
# It polls the source folder and copies new workouts to the Zwift folder.
# It also cleans up old workouts to keep the folder tidy.
#
# Requirement: Google Drive for Desktop
# Optional: 'BurntToast' module for Windows Notifications (Install-Module -Name BurntToast)

# ================= CONFIGURATION (EDIT HERE) =================

# 1. Path to the Google Drive folder where the AI saves .zwo files
#    Example: "G:\My Drive\zwo_AI_generated"
$sourceFolder = "G:\My Drive\zwo_AI_generated" 

# 2. Your Zwift ID (Found in Documents\Zwift\Workouts\XXXXXX)
$zwiftId = "123456" 

# 3. Destination folder name inside Zwift Workouts
#    It is recommended to use a subfolder like "AI_Workouts" to separate from manual files.
$destSubFolderName = "AI_Workouts"

# 4. Cleanup settings: Delete files from Zwift folder if they are older than X days
$daysToKeep = 3

# =============================================================

# Construct the full destination path
$docsPath = [Environment]::GetFolderPath("MyDocuments")
$destinationFolder = Join-Path $docsPath "Zwift\Workouts\$zwiftId\$destSubFolderName"
$logFile = "$PSScriptRoot\WatchZwiftZwo.log"
$pollingIntervalSeconds = 30

# Import BurntToast for notifications (Ignored if not installed)
Import-Module BurntToast -ErrorAction SilentlyContinue

# Setup Tray Icon
Add-Type -AssemblyName System.Windows.Forms
$notifyIcon = New-Object System.Windows.Forms.NotifyIcon
$notifyIcon.Icon = [System.Drawing.SystemIcons]::Information
$notifyIcon.Visible = $true
$notifyIcon.Text = "Zwift AI Sync (Running)"

# Logging Function
function Write-Log($msg) {
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $logMsg = "$timestamp $msg"
    Write-Host $logMsg
    $logMsg | Out-File -FilePath $script:logFile -Append -Encoding UTF8
}

Write-Log "===== Watcher Started ====="
Write-Log "Source: $sourceFolder"
Write-Log "Dest:   $destinationFolder"

# Validation
if (-not (Test-Path $sourceFolder)) {
    Write-Log "ERROR: Source folder not found. Check Google Drive path."
    if (Get-Module -ListAvailable -Name BurntToast) {
        New-BurntToastNotification -Text "Zwift Sync Error", "Source folder not found!"
    }
    # Keep running to retry later (e.g. if Drive takes time to mount)
}

# Create Destination if missing
if (-not (Test-Path $destinationFolder)) {
    try {
        New-Item -Path $destinationFolder -ItemType Directory -Force | Out-Null
        Write-Log "Created destination folder."
    } catch {
        Write-Log "ERROR: Could not create destination folder."
        return
    }
}

# Polling Function
function Start-Polling() {
    if (-not (Test-Path $sourceFolder)) { return }

    # Get source files
    $sourceFiles = Get-ChildItem -Path $script:sourceFolder -Filter "*.zwo"
    $sourceFileNames = @($sourceFiles | Select-Object -ExpandProperty Name)

    # 1. Copy New/Modified Files
    foreach ($sourceFile in $sourceFiles) {
        $fileName = $sourceFile.Name
        $destFile = Join-Path $script:destinationFolder $fileName
        $shouldCopy = $false
        
        if (-not (Test-Path $destFile)) {
            $shouldCopy = $true
        } else {
            $destFileItem = Get-Item $destFile
            # Copy if source is newer
            if ($sourceFile.LastWriteTime -gt $destFileItem.LastWriteTime) {
                $shouldCopy = $true
            }
        }

        if ($shouldCopy) {
            try {
                Copy-Item -Path $sourceFile.FullName -Destination $destFile -Force
                Write-Log "Copied: $fileName"
                if (Get-Module -ListAvailable -Name BurntToast) {
                    New-BurntToastNotification -Text "Zwift Workout Added", "Menu: $fileName"
                }
            } catch {
                Write-Log "Copy Failed: $_"
            }
        }
    }

    # 2. Cleanup Old Files
    # Remove files in the destination that are NOT in the source anymore (optional)
    # OR remove files that are simply too old to be relevant.
    # Here: We remove files older than $daysToKeep to keep the list short.
    
    $deadline = (Get-Date).AddDays(-$script:daysToKeep)
    
    Get-ChildItem -Path $script:destinationFolder -Filter "*.zwo" | ForEach-Object {
        # Only delete if it is NOT in the source folder (preserved in Drive) AND is old
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
