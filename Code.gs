/**
 * Aixle - AI Cycling Coach (Powered by Gemini & Intervals.icu)
 * 
 * This script automates daily workout generation based on your fitness data.
 * Features:
 * - Fetches activities from Intervals.icu.
 * - Analyzes fitness (CTL, TSB) and training phases (Base, Build, Peak).
 * - Generates .zwo workout files using Google Gemini (AI).
 * - Saves workouts to Google Drive (auto-sync to Zwift via Drive for Desktop).
 * - Sends a daily summary email with the recommended workout.
 * 
 * Author: [Your Name/GitHub Username]
 * License: MIT
 */

// =========================================================
// 1. USER SETTINGS
// =========================================================
const USER_SETTINGS = {
  // Language for Email and Analysis ("en", "ja", "es", "fr")
  LANGUAGE: "ja",

  // Your primary training goal
  // Be specific. The AI uses this to design the workout structure.
  GOAL_DESCRIPTION: "Increase FTP by 10W. Preparing for a hill climb race.",

  // Target Event Date (YYYY-MM-DD)
  // The AI calculates the training phase (Base/Build/Peak) based on this date.
  // If undefined or far future, it defaults to Base/Maintenance.
  TARGET_DATE: "2026-06-01", 

  // System Configuration
  SPREADSHEET_ID: "YOUR_SPREADSHEET_ID", // ID of the Google Sheet for logging
  SHEET_NAME: "training_log",
  WORKOUT_FOLDER: "Aixle_Workouts",      // Google Drive folder name
  EMAIL_TO: "your_email@example.com" 
};

// =========================================================
// 2. API KEYS & AUTHENTICATION
// * IMPORTANT: Do not commit your actual keys to public repositories.
// * Use Google Apps Script Properties Service if possible.
// =========================================================
const API_KEYS = {
  // Intervals.icu API Key (Settings -> Developer)
  ICU_TOKEN: "YOUR_INTERVALS_ICU_API_KEY", 
  
  // Google Gemini API Key (aistudio.google.com)
  GEMINI_API_KEY: "YOUR_GEMINI_API_KEY"
};

// =========================================================
// 3. SYSTEM SETTINGS (Advanced)
// =========================================================
const SYSTEM_SETTINGS = {
  // Model ID (Ensure you use a model that supports JSON mode and high reasoning)
  GEMINI_MODEL: "gemini-3-pro-preview", 
  
  TIMEZONE: Session.getScriptTimeZone(),
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 5000,
  
  GENERATION_CONFIG: {
    temperature: 0.3, // Slight creativity for workout variety
    maxOutputTokens: 8192,
    responseMimeType: "application/json"
  }
};

// =========================================================
// 4. LOCALIZATION (Email Content)
// =========================================================
const TRANSLATIONS = {
  en: {
    subject_prefix: "[Aixle] Today's Pick: ",
    greeting: "Here is your Aixle training plan for today.",
    phase_title: "Current Phase",
    weeks_to_goal: "Weeks to Goal",
    weeks_unit: "", // English usually doesn't need unit here or " weeks"
    focus: "Focus",
    goal_section: "Current Goal",
    status: "Athlete Status",
    recovery_title: "Recovery & Wellness",
    recovery_status: "Recovery Status",
    sleep: "Sleep",
    hrv: "HRV",
    resting_hr: "Resting HR",
    recommendation_title: "★ BEST RECOMMENDATION ★",
    why_title: "【Why / Reason】",
    strategy_title: "【Strategy / Explanation】",
    other_options: "Other Options",
    footer: "*Saved to Google Drive (Aixle_Workouts). Please wait for sync."
  },
  ja: {
    subject_prefix: "[Aixle] 本日の推奨: ",
    greeting: "お疲れ様です。Aixleが分析した本日の推奨メニューです。",
    phase_title: "現在のフェーズ",
    weeks_to_goal: "目標まで",
    weeks_unit: "週", // Added unit for Japanese
    focus: "注力ポイント",
    goal_section: "【設定目標】",
    status: "コンディション",
    recovery_title: "リカバリー＆ウェルネス",
    recovery_status: "回復状態",
    sleep: "睡眠",
    hrv: "HRV",
    resting_hr: "安静時心拍",
    recommendation_title: "★ 本日の推奨メニュー ★",
    why_title: "【選定理由】",
    strategy_title: "【内容・攻略法】",
    other_options: "その他の選択肢",
    footer: "※Googleドライブ(Aixle_Workouts)に保存されました。Zwiftへの同期をお待ちください。"
  },
  es: {
    subject_prefix: "[Aixle] Selección de hoy: ",
    greeting: "Aquí tienes tu plan de entrenamiento de Aixle para hoy.",
    phase_title: "Fase Actual",
    weeks_to_goal: "Semanas para el objetivo",
    weeks_unit: "",
    focus: "Enfoque",
    goal_section: "Objetivo Actual",
    status: "Estado del Atleta",
    recovery_title: "Recuperación y Bienestar",
    recovery_status: "Estado de Recuperación",
    sleep: "Sueño",
    hrv: "VFC",
    resting_hr: "FC en Reposo",
    recommendation_title: "★ MEJOR RECOMENDACIÓN ★",
    why_title: "【Razón】",
    strategy_title: "【Estrategia】",
    other_options: "Otras opciones",
    footer: "*Guardado en Google Drive. Espera la sincronización."
  },
  fr: {
    subject_prefix: "[Aixle] Choix du jour: ",
    greeting: "Voici votre plan d'entraînement Aixle pour aujourd'hui.",
    phase_title: "Phase Actuelle",
    weeks_to_goal: "Semaines avant l'objectif",
    weeks_unit: "",
    focus: "Focus",
    goal_section: "Objectif Actuel",
    status: "Statut de l'athlète",
    recovery_title: "Récupération et Bien-être",
    recovery_status: "État de Récupération",
    sleep: "Sommeil",
    hrv: "VFC",
    resting_hr: "FC au Repos",
    recommendation_title: "★ MEILLEURE RECOMMANDATION ★",
    why_title: "【Raison】",
    strategy_title: "【Stratégie】",
    other_options: "Autres options",
    footer: "*Enregistré sur Google Drive. Veuillez attendre la synchronisation."
  }
};

// =========================================================
// 5. GLOBAL CONSTANTS & HEADERS
// =========================================================
const ICU_AUTH_HEADER = "Basic " + Utilities.base64Encode("API_KEY:" + API_KEYS.ICU_TOKEN);

const HEADERS_FIXED = [
  "start_date_local","name","type","moving_time","distance",
  "icu_ftp","icu_training_load","icu_ctl","icu_atl",
  "icu_intensity","icu_joules_above_ftp",
  "SS_secs_manual_fix",
  "Z1_secs","Z2_secs","Z3_secs","Z4_secs","Z5_secs","Z6_secs","Z7_secs","SS_secs_data", 
  "SS_zone_secs_manual_fix",
  "HR_Z1","HR_Z2","HR_Z3","HR_Z4","HR_Z5","HR_Z6","HR_Z7",
  "power_zones","hr_zones","icu_weighted_avg_watts","icu_average_watts",
  "icu_variability_index","icu_efficiency_factor","decoupling","icu_max_wbal_depletion","trimp","CTL-ATL"
];

// =========================================================
// 6. WELLNESS DATA: Fetch from Intervals.icu (Whoop/Garmin/Oura)
// =========================================================
function fetchWellnessData(daysBack = 7) {
  const today = new Date();
  const oldest = new Date(today);
  oldest.setDate(today.getDate() - daysBack);

  const todayStr = formatDateISO(today);
  const oldestStr = formatDateISO(oldest);

  // Use date range endpoint (more reliable, returns fresh data)
  const url = "https://intervals.icu/api/v1/athlete/0/wellness?oldest=" + oldestStr + "&newest=" + todayStr;

  try {
    const response = UrlFetchApp.fetch(url, {
      headers: { "Authorization": ICU_AUTH_HEADER },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() === 200) {
      const dataArray = JSON.parse(response.getContentText());

      // Map and sort by date descending (newest first)
      const wellnessRecords = dataArray.map(function(data) {
        // Convert sleepSecs to hours (API returns seconds)
        const sleepHours = data.sleepSecs ? data.sleepSecs / 3600 : 0;

        return {
          date: data.id,                             // Date is stored as "id"
          sleep: sleepHours,                         // Converted to hours
          sleepQuality: data.sleepQuality || null,   // 1-5 scale
          sleepScore: data.sleepScore || null,       // Whoop sleep score (0-100)
          restingHR: data.restingHR || null,         // Resting heart rate
          hrv: data.hrv || null,                     // HRV rMSSD
          hrvSDNN: data.hrvSDNN || null,             // HRV SDNN (if available)
          recovery: data.readiness || null,          // Whoop recovery score is stored as "readiness"
          spO2: data.spO2 || null,                   // Blood oxygen
          respiration: data.respiration || null,     // Breathing rate
          soreness: data.soreness || null,           // 1-5 scale
          fatigue: data.fatigue || null,             // 1-5 scale
          stress: data.stress || null,               // 1-5 scale
          mood: data.mood || null                    // 1-5 scale
        };
      });

      // Sort by date descending (newest first)
      wellnessRecords.sort(function(a, b) {
        return b.date.localeCompare(a.date);
      });

      return wellnessRecords;
    }
  } catch (e) {
    Logger.log("Failed to fetch wellness data: " + e.toString());
  }

  return [];
}

function createWellnessSummary(wellnessRecords) {
  if (!wellnessRecords || wellnessRecords.length === 0) {
    return {
      available: false,
      message: "No wellness data available"
    };
  }

  // Find the most recent record with actual wellness data (sleep/HRV/recovery)
  // Today's data might be empty if Whoop hasn't synced yet
  const latestWithData = wellnessRecords.find(r => r.sleep > 0 || r.hrv || r.recovery) || wellnessRecords[0];
  const last7Days = wellnessRecords.slice(0, 7);

  // Calculate averages for trend analysis
  const avgSleep = average(last7Days.map(w => w.sleep).filter(v => v > 0));
  const avgHRV = average(last7Days.map(w => w.hrv).filter(v => v != null));
  const avgRestingHR = average(last7Days.map(w => w.restingHR).filter(v => v != null));
  const avgRecovery = average(last7Days.map(w => w.recovery).filter(v => v != null));

  // Determine recovery status based on latest data with values
  let recoveryStatus = "Unknown";
  let intensityModifier = 1.0; // Multiplier for workout intensity

  if (latestWithData.recovery != null) {
    if (latestWithData.recovery >= 67) {
      recoveryStatus = "Green (Primed)";
      intensityModifier = 1.0; // Full intensity OK
    } else if (latestWithData.recovery >= 34) {
      recoveryStatus = "Yellow (Recovering)";
      intensityModifier = 0.85; // Reduce intensity
    } else {
      recoveryStatus = "Red (Strained)";
      intensityModifier = 0.7; // Significantly reduce
    }
  } else if (latestWithData.hrv != null && avgHRV > 0) {
    // Fallback: Use HRV trend if no recovery score
    const hrvDeviation = (latestWithData.hrv - avgHRV) / avgHRV;
    if (hrvDeviation >= 0.05) {
      recoveryStatus = "Above Baseline (Well Recovered)";
      intensityModifier = 1.0;
    } else if (hrvDeviation >= -0.1) {
      recoveryStatus = "Normal";
      intensityModifier = 0.9;
    } else {
      recoveryStatus = "Below Baseline (Fatigued)";
      intensityModifier = 0.75;
    }
  }

  // Sleep quality assessment
  let sleepStatus = "Unknown";
  if (latestWithData.sleep > 0) {
    if (latestWithData.sleep >= 7.5) sleepStatus = "Excellent";
    else if (latestWithData.sleep >= 6.5) sleepStatus = "Adequate";
    else if (latestWithData.sleep >= 5) sleepStatus = "Poor";
    else sleepStatus = "Insufficient";
  }

  return {
    available: true,
    today: {
      date: latestWithData.date,
      sleep: latestWithData.sleep,
      sleepQuality: latestWithData.sleepQuality,
      sleepScore: latestWithData.sleepScore,
      restingHR: latestWithData.restingHR,
      hrv: latestWithData.hrv,
      recovery: latestWithData.recovery,
      soreness: latestWithData.soreness,
      fatigue: latestWithData.fatigue,
      stress: latestWithData.stress,
      mood: latestWithData.mood
    },
    averages: {
      sleep: avgSleep,
      hrv: avgHRV,
      restingHR: avgRestingHR,
      recovery: avgRecovery
    },
    recoveryStatus: recoveryStatus,
    sleepStatus: sleepStatus,
    intensityModifier: intensityModifier
  };
}

// =========================================================
// 7. MAIN FUNCTION: Fetch Activity Data
// =========================================================
function fetchAndLogActivities() {
  const sheet = SpreadsheetApp.openById(USER_SETTINGS.SPREADSHEET_ID).getSheetByName(USER_SETTINGS.SHEET_NAME);
  
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 90);

  const url = `https://intervals.icu/api/v1/athlete/0/activities?oldest=${formatDateISO(from)}&newest=${formatDateISO(to)}`;

  try {
    const response = UrlFetchApp.fetch(url, { 
      headers: { "Authorization": ICU_AUTH_HEADER },
      muteHttpExceptions: true
    });
    
    if (response.getResponseCode() !== 200) {
      Logger.log("Error fetching activities: " + response.getContentText());
      return;
    }

    const activities = JSON.parse(response.getContentText());
    if (!activities || activities.length === 0) {
      Logger.log("No activities to write");
      return;
    }

    const rows = activities.map(a => mapActivityToRow(a));
    sheet.clear();
    sheet.getRange(1, 1, 1, HEADERS_FIXED.length).setValues([HEADERS_FIXED]);
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    Logger.log(`${rows.length} rows added to spreadsheet.`);
  } catch (e) {
    Logger.log("Exception in fetchAndLogActivities: " + e.toString());
  }
}

// =========================================================
// 8. MAIN FUNCTION: Generate Workouts
// =========================================================
function generateOptimalZwiftWorkoutsAutoByGemini() {
  const folder = getOrCreateFolder(USER_SETTINGS.WORKOUT_FOLDER);
  const sheet = SpreadsheetApp.openById(USER_SETTINGS.SPREADSHEET_ID).getSheetByName(USER_SETTINGS.SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  data.shift(); // Remove header

  // Create Athlete Summary
  const summary = createAthleteSummary(data);

  // Fetch Wellness Data (Sleep, Recovery, HRV from Whoop/Garmin/Oura)
  const wellnessRecords = fetchWellnessData(7);
  const wellness = createWellnessSummary(wellnessRecords);

  // Calculate Periodization Phase
  const phaseInfo = calculateTrainingPhase(USER_SETTINGS.TARGET_DATE);

  Logger.log("Athlete Summary: TSB=" + summary.tsb_current.toFixed(1));
  Logger.log("Current Phase: " + phaseInfo.phaseName + " (" + phaseInfo.weeksOut + " weeks out)");
  if (wellness && wellness.available) {
    Logger.log("Recovery Status: " + wellness.recoveryStatus + " | Sleep: " + wellness.today.sleep.toFixed(1) + "h (" + wellness.sleepStatus + ")");
    Logger.log("HRV: " + (wellness.today.hrv || 'N/A') + " | Resting HR: " + (wellness.today.restingHR || 'N/A'));
  } else {
    Logger.log("Wellness data: Not available");
  }

  // Workout Types to Generate
  const types = ["FTP_Threshold", "VO2max_HighIntensity", "Endurance_Tempo"];
  
  const today = new Date();
  const dateStr = Utilities.formatDate(today, SYSTEM_SETTINGS.TIMEZONE, "MMdd");
  const fileDateStr = Utilities.formatDate(today, SYSTEM_SETTINGS.TIMEZONE, "yyyyMMdd");
  
  let generatedResults = [];

  for (const type of types) {
    Logger.log(`Generating workout for: ${type}...`);

    // Create Prompt (now includes wellness data)
    const prompt = createPrompt(type, summary, phaseInfo, dateStr, wellness);

    // Call Gemini API
    const result = callGeminiAPI(prompt);

    if (result.success) {
      const safeType = type.replace(/[^a-zA-Z0-9]/g, ""); 
      // File name uses "Aixle_" prefix for Drive organization
      const fileName = `Aixle_${safeType}_${fileDateStr}.zwo`;
      
      const blob = Utilities.newBlob(result.xml, "text/xml", fileName);
      folder.createFile(blob);

      generatedResults.push({
        type: type,
        explanation: result.explanation,
        recommendationScore: result.recommendationScore,
        recommendationReason: result.recommendationReason,
        blob: blob,
        fileName: fileName
      });
      Logger.log(` -> Success: ${fileName} (Score: ${result.recommendationScore})`);
    } else {
      Logger.log(` -> Failed to generate ${type}: ${result.error}`);
    }
  }

  // Sort by Recommendation Score (Descending)
  generatedResults.sort((a, b) => b.recommendationScore - a.recommendationScore);

  // Send Email
  if (generatedResults.length > 0) {
    sendSmartSummaryEmail(summary, phaseInfo, generatedResults, wellness);
  }
}

// =========================================================
// 9. LOGIC: Periodization Phase Calculation
// =========================================================
function calculateTrainingPhase(targetDateStr) {
  const today = new Date();
  const target = new Date(targetDateStr);
  
  // Calculate weeks until target
  const diffTime = target.getTime() - today.getTime();
  const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));

  let phaseName = "";
  let focus = "";

  if (diffWeeks < 0) {
    phaseName = "Transition / Off-Season";
    focus = "Recover, fun rides, cross-training.";
  } else if (diffWeeks <= 1) {
    phaseName = "Race Week / Taper";
    focus = "Sharpness, freshness, minimal fatigue. Short high intensity openers.";
  } else if (diffWeeks <= 3) {
    phaseName = "Peak / Taper";
    focus = "Reduce volume, maintain intensity. Shed fatigue (increase TSB).";
  } else if (diffWeeks <= 8) {
    phaseName = "Specialty / High Build";
    focus = "Race specificity. VO2max, Anaerobic capacity. Hard intervals.";
  } else if (diffWeeks <= 16) {
    phaseName = "Build Phase";
    focus = "FTP development (Threshold), SST. Increasing training load (CTL).";
  } else {
    phaseName = "Base Phase";
    focus = "Aerobic endurance (Z2), Tempo (Z3), SweetSpot. Building foundation.";
  }

  return {
    weeksOut: diffWeeks,
    phaseName: phaseName,
    focus: focus
  };
}

// =========================================================
// 9. HELPER: Gemini API Call
// =========================================================
function callGeminiAPI(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${SYSTEM_SETTINGS.GEMINI_MODEL}:generateContent?key=${API_KEYS.GEMINI_API_KEY}`;
  
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: SYSTEM_SETTINGS.GENERATION_CONFIG
  };

  const options = {
    method: "post",
    headers: { "Content-Type": "application/json" },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  for (let attempt = 1; attempt <= SYSTEM_SETTINGS.MAX_RETRIES; attempt++) {
    try {
      const response = UrlFetchApp.fetch(url, options);
      const code = response.getResponseCode();

      if (code === 200) {
        const jsonResponse = JSON.parse(response.getContentText());
        const contentText = jsonResponse.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!contentText) throw new Error("API returned empty content");

        let result;
        try {
          const cleanedText = contentText.replace(/^```json/gm, "").replace(/^```/gm, "").trim();
          result = JSON.parse(cleanedText);
        } catch (e) {
          throw new Error("JSON Parse Error: " + e.message);
        }
        
        if (!result.xml || !result.explanation) throw new Error("Incomplete JSON fields");

        let xml = result.xml.replace(/^```xml\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
        if (!xml.includes("<workout_file>")) throw new Error("Invalid XML: missing root tag");

        return { 
          success: true, 
          xml: xml, 
          explanation: result.explanation,
          recommendationScore: result.recommendation_score || 5, 
          recommendationReason: result.recommendation_reason || ""
        };
      } 
      
      if (code === 503 || code === 429) {
        Logger.log(` -> Retry (${attempt}): Server busy.`);
        Utilities.sleep(SYSTEM_SETTINGS.RETRY_DELAY_MS);
        continue;
      }
      return { success: false, error: `API Error Code: ${code}` };

    } catch (e) {
      Logger.log(` -> Retry (${attempt}): ${e.toString()}`);
      if (attempt < SYSTEM_SETTINGS.MAX_RETRIES) Utilities.sleep(SYSTEM_SETTINGS.RETRY_DELAY_MS);
      else return { success: false, error: e.toString() };
    }
  }
  return { success: false, error: "Max retries exceeded" };
}

// =========================================================
// 11. HELPER: Prompt Construction
// =========================================================
function createPrompt(type, summary, phaseInfo, dateStr, wellness) {
  const langMap = { "ja": "Japanese", "en": "English", "es": "Spanish", "fr": "French" };
  const analysisLang = langMap[USER_SETTINGS.LANGUAGE] || "English";

  // Zwift Display Name (Clean, short name without "Aixle_" prefix)
  const safeType = type.replace(/[^a-zA-Z0-9]/g,"");
  const zwiftDisplayName = `${safeType}_${dateStr}`;

  // Build wellness context string
  let wellnessContext = "";
  if (wellness && wellness.available) {
    const w = wellness.today;
    const avg = wellness.averages;

    wellnessContext = `
**1b. Recovery & Wellness Data (from Whoop/wearable):**
- **Recovery Status:** ${wellness.recoveryStatus}
- **Recommended Intensity Modifier:** ${(wellness.intensityModifier * 100).toFixed(0)}%
- **Sleep:** ${w.sleep ? w.sleep.toFixed(1) + 'h' : 'N/A'} (${wellness.sleepStatus}) | 7-day avg: ${avg.sleep ? avg.sleep.toFixed(1) + 'h' : 'N/A'}
- **HRV (rMSSD):** ${w.hrv || 'N/A'} ms | 7-day avg: ${avg.hrv ? avg.hrv.toFixed(0) : 'N/A'} ms
- **Resting HR:** ${w.restingHR || 'N/A'} bpm | 7-day avg: ${avg.restingHR ? avg.restingHR.toFixed(0) : 'N/A'} bpm
- **Whoop Recovery Score:** ${w.recovery != null ? w.recovery + '%' : 'N/A'}
${w.soreness ? `- **Soreness:** ${w.soreness}/5` : ''}
${w.fatigue ? `- **Fatigue:** ${w.fatigue}/5` : ''}
${w.stress ? `- **Stress:** ${w.stress}/5` : ''}
${w.mood ? `- **Mood:** ${w.mood}/5` : ''}

**CRITICAL RECOVERY RULES:**
- If Recovery Status is "Red (Strained)" or HRV is significantly below baseline: STRONGLY favor Endurance/Recovery workouts. VO2max/Threshold should score very low (1-3).
- If Recovery Status is "Yellow (Recovering)": Reduce interval intensity by 5-10%. Favor Tempo/SST over VO2max.
- If Recovery Status is "Green (Primed)": Full intensity is appropriate. High-intensity workouts can score higher.
- Poor sleep (<6h) should reduce recommendation scores for high-intensity work.
`;
  }

  return `
You are an expert cycling coach using the logic of Coggan, Friel, and Seiler.
Generate a Zwift workout (.zwo) and evaluate its suitability.

**1a. Athlete Training Context:**
- **Goal:** ${USER_SETTINGS.GOAL_DESCRIPTION}
- **Target Race:** In ${phaseInfo.weeksOut} weeks.
- **Current Phase:** "${phaseInfo.phaseName}"
- **Phase Focus:** ${phaseInfo.focus}
- **Current TSB:** ${summary.tsb_current.toFixed(1)}
- **Recent Load (Z5+):** ${summary.z5_recent_total > 1500 ? "High" : "Normal"}
${wellnessContext}
**2. Assignment: Design a "${type}" Workout**
- **Duration:** 60 min (+/- 5min).
- **Structure:** Engaging (Pyramids, Over-Unders). NO boring steady states.
- **Intensity:** Adjust based on TSB AND Recovery Status.
  - If TSB < -20 OR Recovery is Red/Yellow, reduce intensity significantly.
  - Apply the Intensity Modifier (${wellness && wellness.available ? (wellness.intensityModifier * 100).toFixed(0) + '%' : '100%'}) to target power zones.

**3. REQUIRED ZWO FEATURES (Critical):**
- **Cadence:** You MUST specify target cadence for every interval using \`Cadence="85"\`.
- **Text Events (Messages):** 
  - You MUST include motivational or instructional text messages.
  - **LANGUAGE: Messages MUST be in ENGLISH.** (Even if the user's language is different, Zwift works best with English text).
  - Nest them: \`<SteadyState ... ><TextEvent timeoffset="10" message="Keep pushing!"/></SteadyState>\`
  - **Workout Name:** The <name> tag MUST be exactly: "${zwiftDisplayName}" (Do NOT add "Aixle_" prefix here).

**4. Evaluate Recommendation (1-10):**
- Logic: Based on **Current Phase**, **TSB**, AND **Recovery/Wellness Status**, is "${type}" the right choice today?
- A well-recovered athlete in Build phase doing Threshold = high score.
- A poorly-recovered athlete (Red status, low HRV) doing VO2max = very low score (1-3).
- Example: If Phase is "Base", VO2max should score low (unless maintenance). If Phase is "Peak", high volume SST should score low.

**Output Format (JSON Only):**
{
  "explanation": "Strategy explanation in **${analysisLang}**. Include how recovery status influenced the workout design.",
  "recommendation_score": (integer 1-10),
  "recommendation_reason": "Reason based on Phase(${phaseInfo.phaseName}), TSB, AND Recovery Status in **${analysisLang}**.",
  "xml": "<workout_file>...<author>Aixle AI Coach</author><name>${zwiftDisplayName}</name>...valid xml...</workout_file>"
}
`;
}

// =========================================================
// 12. HELPER: Send Email (Dynamic Language)
// =========================================================
function sendSmartSummaryEmail(summary, phaseInfo, generatedResults, wellness) {
  const t = TRANSLATIONS[USER_SETTINGS.LANGUAGE] || TRANSLATIONS.en;
  
  const bestWorkout = generatedResults[0]; 
  const attachments = generatedResults.map(r => r.blob);

  // Add recovery indicator to subject based on status
  let recoveryTag = "";
  if (wellness && wellness.available) {
    if (wellness.recoveryStatus.includes("Green") || wellness.recoveryStatus.includes("Primed") || wellness.recoveryStatus.includes("Well Recovered")) {
      recoveryTag = "[GREEN] ";
    } else if (wellness.recoveryStatus.includes("Yellow") || wellness.recoveryStatus.includes("Normal")) {
      recoveryTag = "[YELLOW] ";
    } else if (wellness.recoveryStatus.includes("Red") || wellness.recoveryStatus.includes("Fatigued")) {
      recoveryTag = "[RED] ";
    }
  }

  const subject = t.subject_prefix + recoveryTag + bestWorkout.type + " (" + Utilities.formatDate(new Date(), SYSTEM_SETTINGS.TIMEZONE, "MM/dd") + ")";

  let body = `${t.greeting}\n\n`;

  // Phase & Goal Info
  body += `
===================================
${t.phase_title}: ${phaseInfo.phaseName}
(${t.weeks_to_goal}: ${phaseInfo.weeksOut}${t.weeks_unit})
${t.focus}: ${phaseInfo.focus}
===================================
${t.goal_section}
${USER_SETTINGS.GOAL_DESCRIPTION}
(Target: ${USER_SETTINGS.TARGET_DATE})

${t.status}:
CTL: ${summary.ctl_90.toFixed(1)} / TSB: ${summary.tsb_current.toFixed(1)}
`;

  // Add Wellness/Recovery Section
  if (wellness && wellness.available) {
    const w = wellness.today;
    body += `
-----------------------------------
${t.recovery_title}
-----------------------------------
${t.recovery_status}: ${wellness.recoveryStatus}
${t.sleep}: ${w.sleep ? w.sleep.toFixed(1) + 'h' : 'N/A'} (${wellness.sleepStatus})
${t.hrv}: ${w.hrv || 'N/A'} ms (avg: ${wellness.averages.hrv ? wellness.averages.hrv.toFixed(0) : 'N/A'} ms)
${t.resting_hr}: ${w.restingHR || 'N/A'} bpm
${w.recovery != null ? `Whoop Recovery: ${w.recovery}%` : ''}
`;
  }

  body += `
${t.recommendation_title}
Menu: ${bestWorkout.type}
Score: ${bestWorkout.recommendationScore}/10

${t.why_title}
${bestWorkout.recommendationReason}

${t.strategy_title}
${bestWorkout.explanation}

-----------------------------------
${t.other_options}
-----------------------------------
`;

  for (let i = 1; i < generatedResults.length; i++) {
    const wr = generatedResults[i];
    body += `
■ Option ${i+1}: ${wr.type} (Score: ${wr.recommendationScore}/10)
${wr.recommendationReason}
(See attachment: ${wr.fileName})
`;
  }

  body += `\n${t.footer}`;

  GmailApp.sendEmail(USER_SETTINGS.EMAIL_TO, subject, body, { attachments: attachments });
  Logger.log("Smart Email sent successfully.");
}

// =========================================================
// 13. DATA PROCESSING & UTILITIES
// =========================================================
function createAthleteSummary(data) {
  const today = new Date();
  const threeWeeksAgo = new Date();
  threeWeeksAgo.setDate(today.getDate() - 21);

  const recent3Weeks = data.filter(r => new Date(r[0]) >= threeWeeksAgo)
    .map(r => HEADERS_FIXED.reduce((obj, h, i) => ({ ...obj, [h]: r[i] ?? 0 }), {}));

  const newestRow = data[0];
  const lastRowObj = newestRow ? HEADERS_FIXED.reduce((obj, h, i) => ({ ...obj, [h]: newestRow[i] ?? 0 }), {}) : null;

  return {
    ctl_90: average(data.map(r => r[HEADERS_FIXED.indexOf("icu_ctl")])),
    tsb_current: lastRowObj ? (lastRowObj.icu_ctl - lastRowObj.icu_atl) : 0,
    last_activity: lastRowObj ? {
      date: Utilities.formatDate(new Date(lastRowObj.start_date_local), SYSTEM_SETTINGS.TIMEZONE, "MM/dd"),
      name: lastRowObj.name,
      load: lastRowObj.icu_training_load
    } : null,
    z5_recent_total: sum(recent3Weeks.map(r => r["Z5_secs"] || 0))
  };
}

function mapActivityToRow(a) {
  const zoneIds = ["Z1","Z2","Z3","Z4","Z5","Z6","Z7","SS"];
  const powerZoneTimes = zoneIds.map(id => {
    const zone = a.icu_zone_times ? a.icu_zone_times.find(z => z.id === id) : null;
    return zone ? zone.secs : 0;
  });
  const hrZoneTimes = a.icu_hr_zone_times ? a.icu_hr_zone_times.slice(0,7) : Array(7).fill(0);
  while(hrZoneTimes.length < 7) hrZoneTimes.push(0);

  return [
    a.start_date_local, a.name, a.type, a.moving_time, a.distance, 
    a.icu_ftp, a.icu_training_load, a.icu_ctl, a.icu_atl, a.icu_intensity, 
    a.icu_joules_above_ftp, 0, ...powerZoneTimes.slice(0,7), powerZoneTimes[7], 0, 
    ...hrZoneTimes, a.icu_power_zones?.join(",") || "", a.icu_hr_zones?.join(",") || "", 
    a.icu_weighted_avg_watts || 0, a.icu_average_watts || 0, a.icu_variability_index || 0, 
    a.icu_efficiency_factor || 0, a.decoupling || 0, a.icu_max_wbal_depletion || 0, 
    a.trimp || 0, (a.icu_ctl - a.icu_atl)
  ];
}

function formatDateISO(date) { return Utilities.formatDate(date, SYSTEM_SETTINGS.TIMEZONE, "yyyy-MM-dd"); }
function average(arr) { return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0; }
function sum(arr) { return arr.reduce((a,b)=>a+b,0); }
function getOrCreateFolder(name) {
  const folders = DriveApp.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(name);
}