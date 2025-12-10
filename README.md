# 🚴 Zwift AI Coach

An automated, personal cycling coach powered by **Google Gemini AI** and **Intervals.icu**.

This tool is a Google Apps Script that analyzes your training load (CTL/TSB), calculates your current training phase (Base/Build/Peak), and generates a custom **Zwift workout (.zwo)** for you every day.

## ✨ Features

*   **Smart Periodization:** Automatically calculates your training phase (Base, Build, or Peak) based on your target race date.
*   **Daily AI Generation:** Uses Gemini AI to create engaging workouts (Pyramids, Over-Unders) instead of boring steady-state rides.
*   **Context Aware:** Analyzes your Fatigue (TSB) and recent intensity. If you are tired, it recommends recovery; if you are fresh, it pushes you.
*   **Zwift Compatible:** Generates standard `.zwo` files with embedded text instructions and cadence targets.
*   **Auto-Sync (Windows):** Includes a PowerShell script to automatically sync generated workouts to your Zwift folder.

## 🛠 Prerequisites

1.  **Google Account** (for Google Sheets, Drive, and Gemini API).
2.  **Intervals.icu Account** (API Key).
3.  **Zwift** (PC/Mac with Google Drive for Desktop is recommended).

## 🚀 Setup Guide

### 1. Get API Keys
*   **Intervals.icu:** Go to Settings -> Developer -> API Key.
*   **Gemini API:** Get a free API key from [Google AI Studio](https://aistudio.google.com/).

### 2. Create Google Sheet
1.  Create a new Google Sheet.
2.  Rename the tab (sheet) to `training_log`.
3.  Go to `Extensions` > `Apps Script`.

### 3. Install Script
1.  Copy the code from `Code.gs` in this repository.
2.  Paste it into the Apps Script editor.
3.  Edit the **USER_SETTINGS** and **API_KEYS** sections at the top of the file:
    ```javascript
    const USER_SETTINGS = {
      LANGUAGE: "en", 
      GOAL_DESCRIPTION: "Improve FTP 10W for next month's race.",
      TARGET_DATE: "2026-06-01", 
      WORKOUT_FOLDER: "zwo_AI_generated", // Folder name in Google Drive
      // ...
    };
    ```

### 4. Set Triggers (Automation)
To ensure the AI has the latest data, set the triggers in the following order:

1.  Open **Triggers** (Clock icon) in Apps Script.
2.  **Step 1: Fetch Data**
    *   Function: `fetchAndLogActivities`
    *   Event Source: Time-driven -> Day timer -> **2:00 AM to 3:00 AM**
    *   *(Note: Intervals.icu usually processes daily data by this time.)*
3.  **Step 2: Generate Workout**
    *   Function: `generateOptimalZwiftWorkoutsAutoByGemini`
    *   Event Source: Time-driven -> Day timer -> **6:00 AM to 7:00 AM**
    *   *(Note: Runs before your morning ride.)*

### 5. Sync to Zwift

#### For Windows Users (Auto-Sync Script)
I have provided a PowerShell script to automate the file transfer.

1.  Install **Google Drive for Desktop**.
2.  Download `WatchZwiftZwo.ps1` from this repository.
3.  Open the file with Notepad or a code editor and edit the configuration at the top:
    ```powershell
    $sourceFolder = "G:\My Drive\zwo_AI_generated"  # Check your Drive letter
    $zwiftId = "123456"                             # Your Zwift ID
    ```
4.  Right-click the file and select "Run with PowerShell". It will watch for new files and copy them to Zwift automatically.
    *   *Optional:* Install `BurntToast` for desktop notifications: `Install-Module -Name BurntToast` in PowerShell.

#### For Mac / iOS / Apple TV
*   **Mac:** Use Google Drive for Desktop and create a symlink to your Zwift/Workouts folder.
*   **iOS/Apple TV:** You will need to download the `.zwo` file from the email or Google Drive and open it on a PC/Mac once to sync it to your account, or upload it via [Zwift.com](https://www.zwift.com/).

## ⚠️ Disclaimer
This is an experimental tool. Use the generated workouts at your own risk. Always listen to your body and consult a doctor before starting a high-intensity training program.

## License
MIT License
