# 🚴 Aixle (エイクスル)

**Aixle** は、**Google Gemini AI** と **Intervals.icu** を活用した、オープンソースの自動サイクリングコーチシステムです。

あなたのトレーニングの「軸 (Axle)」として、毎日のデータを分析し、パフォーマンスを前進させます。疲労度 (TSB) や目標レースまでの期間を計算し、その日に最適な **Zwiftワークアウト (.zwo)** を毎朝自動生成します。

## ✨ 特徴

*   **自動ピリオダイゼーション:** レース日から逆算し、現在は「基礎期」か「強化期」かを自動判定してメニューを組みます。
*   **AIによるメニュー作成:** 単調なLSDだけでなく、AIが考えた変化に富んだインターバルメニューを提案します。
*   **コンディション分析:** 「元気なら高強度」「疲れているなら回復走」を論理的に判断します。
*   **Zwift完全互換:** 画面上に表示されるテキストメッセージや、ケイデンス指定を含んだファイルを生成します。
*   **Windows自動同期:** 生成されたファイルをZwiftフォルダへ自動転送するスクリプトを同梱。

## 🛠 前提条件

1.  **Google アカウント** (Gemini API, Sheets, Drive用)
2.  **Intervals.icu アカウント** (データ取得用)
3.  **Zwift** (PC/Mac版推奨)

## 🚀 導入手順

### 1. APIキーの取得
*   **Intervals.icu:** 設定画面 (Settings) -> Developer -> API Key
*   **Gemini API:** [Google AI Studio](https://aistudio.google.com/)

### 2. スクリプトの設置
1.  Googleスプレッドシートを新規作成し、`拡張機能` > `Apps Script` を開きます。
2.  このリポジトリの `Code.gs` をコピペします。
3.  コード冒頭の `USER_SETTINGS` を設定します：
    ```javascript
    const USER_SETTINGS = {
      LANGUAGE: "ja",
      GOAL_DESCRIPTION: "ヒルクライムで自己ベスト更新",
      TARGET_DATE: "2026-06-01",
      WORKOUT_FOLDER: "Aixle_Workouts", // Googleドライブに作られるフォルダ名
      // ...
    };
    ```

### 3. 自動化設定
Apps Scriptのトリガー設定で、`fetchAndLogActivities` を午前2時、`generateOptimalZwiftWorkoutsAutoByGemini` を午前6時に実行するようにセットします。

### 4. 同期設定
同梱の `WatchZwiftZwo.ps1` (Windows用) を使うか、Google Driveデスクトップ版を使用して、`Aixle_Workouts` フォルダをZwiftのワークアウトフォルダと同期させてください。

## ⚠️ 免責事項
本ツールは実験的なプロジェクトです。トレーニングの実施は自己責任で行ってください。

## ライセンス
MIT License
