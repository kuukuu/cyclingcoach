# 🚴 Zwift AI Coach

**Google Gemini AI** と **Intervals.icu** を活用した、あなただけの自動サイクリングコーチです。

このツールは Google Apps Script (GAS) 上で動作し、あなたの疲労度 (TSB) やトレーニングフェーズ（基礎期・強化期・調整期）を分析し、その日に最適な **Zwiftワークアウトファイル (.zwo)** を自動生成します。

## ✨ 特徴

*   **自動ピリオダイゼーション:** 目標レース日から逆算して、現在はどのトレーニング期（Base/Build/Peak）かを自動判定します。
*   **AIによるメニュー作成:** Gemini AI が、単調なメニューではなく、変化に富んだ（ピラミッド走やクリスクロスなど）飽きないメニューを作成します。
*   **コンディション分析:** 直近の疲労度 (TSB) を考慮します。疲れているときは強度を落とし、元気なときは高強度を提案します。
*   **Zwift 完全互換:** 画面上のテキスト指示（英語メッセージ）やケイデンス指定を含む `.zwo` ファイルを生成します。
*   **Windows 自動同期:** GoogleドライブからZwiftフォルダへファイルを自動コピーするスクリプトを同梱しています。

## 🛠 前提条件

1.  **Google アカウント** (スプレッドシート、ドライブ、Gemini API利用のため)。
2.  **Intervals.icu アカウント** (自分の走行ログ取得のため)。
3.  **Zwift** (PC/Mac版での利用、およびGoogle Drive経由での同期を推奨)。

## 🚀 セットアップ手順

### 1. APIキーの取得
*   **Intervals.icu:** 設定画面 (Settings) -> Developer -> API Key から取得します。
*   **Gemini API:** [Google AI Studio](https://aistudio.google.com/) から無料でキーを取得します。

### 2. スプレッドシートの作成
1.  新規 Google スプレッドシートを作成します。
2.  シート名（タブ名）を `training_log` に変更します。
3.  メニューの `拡張機能` > `Apps Script` を開きます。

### 3. スクリプトのインストール
1.  このリポジトリの `Code.gs` の内容をコピーします。
2.  Apps Script エディタに貼り付けます。
3.  コード上部の **USER_SETTINGS** と **API_KEYS** をご自身の環境に合わせて書き換えます：
    ```javascript
    const USER_SETTINGS = {
      LANGUAGE: "ja", 
      GOAL_DESCRIPTION: "来月のレースに向けてFTPを上げたい",
      TARGET_DATE: "2026-06-01", 
      WORKOUT_FOLDER: "zwo_AI_generated", // Google Driveに作られるフォルダ名
      // ...
    };
    ```

### 4. トリガーの設定 (自動化)
AIが最新のデータを参照できるように、以下の順序・時刻でトリガーを設定することをお勧めします。

1.  Apps Script 左側の「トリガー（時計アイコン）」を開きます。
2.  **ステップ 1: ログ取得**
    *   実行する関数: `fetchAndLogActivities`
    *   イベントのソース: 時間主導型 -> 日付ベースのタイマー -> **午前 2:00 〜 3:00**
    *   *(理由: Intervals.icu のデータ処理が完了している時間帯です)*
3.  **ステップ 2: ワークアウト生成**
    *   実行する関数: `generateOptimalZwiftWorkoutsAutoByGemini`
    *   イベントのソース: 時間主導型 -> 日付ベースのタイマー -> **午前 6:00 〜 7:00**
    *   *(理由: 朝のライド前、または日中のメール確認に間に合う時間帯です)*

### 5. Zwift との同期設定

#### Windows の場合 (自動同期スクリプト)
`WatchZwiftZwo.ps1` を使用すると便利です。Googleドライブに生成されたファイルを検知し、自動でZwiftのフォルダにコピーします。

1.  PCに **Google Drive (パソコン版)** をインストールします。
2.  このリポジトリから `WatchZwiftZwo.ps1` をダウンロードします。
3.  メモ帳などで開き、冒頭の設定部分を書き換えます：
    ```powershell
    $sourceFolder = "G:\マイドライブ\zwo_AI_generated" # ご自身のドライブパス
    $zwiftId = "123456"                                # Zwift ID (ドキュメントフォルダを確認)
    ```
4.  ファイルを右クリックし「PowerShell で実行」を選択します。常駐して監視を開始します。
    *   *オプション:* PowerShellで `Install-Module -Name BurntToast` を実行しておくと、コピー時にデスクトップ通知が表示されます。

#### Mac / iOS / Apple TV の場合
*   **Mac:** Google Drive デスクトップ版を使い、Zwiftフォルダへのシンボリックリンクを作成することで自動化可能です。
*   **iOS/Apple TV:** PC/Macを経由して同期させるか、メールに添付されたファイルをPCのZwiftで一度開いてアカウントに紐付ける必要があります。

## ⚠️ 免責事項
このツールは実験的なものです。生成されたワークアウトの実施は自己責任で行ってください。過度なトレーニングは避け、体調に合わせて利用してください。

## ライセンス
MIT License
