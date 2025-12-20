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
// 6. MAIN FUNCTION: Fetch Data
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
// 7. HELPER: Upload Workout to Intervals.icu Calendar
// =========================================================
function uploadWorkoutToIntervals(name, zwoContent, dateStr) {
  const athleteId = "0"; // "0" works for the API key owner
  const url = "https://intervals.icu/api/v1/athlete/" + athleteId + "/events";

  const payload = {
    category: "WORKOUT",
    type: "Ride",
    name: name,
    description: "Generated by Aixle AI Coach",
    start_date_local: dateStr + "T10:00:00", // Schedule for 10:00 AM
    file_contents: zwoContent,
    file_extension: "zwo"
  };

  const options = {
    method: "post",
    headers: {
      "Authorization": ICU_AUTH_HEADER,
      "Content-Type": "application/json"
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();
    if (code === 200 || code === 201) {
      Logger.log(" -> Uploaded to Intervals.icu: " + name);
    } else {
      Logger.log(" -> Failed to upload to Intervals.icu: " + response.getContentText());
    }
  } catch (e) {
    Logger.log(" -> Error uploading to Intervals.icu: " + e.toString());
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
  
  // Calculate Periodization Phase
  const phaseInfo = calculateTrainingPhase(USER_SETTINGS.TARGET_DATE);
  Logger.log(`Athlete Summary: TSB=${summary.tsb_current.toFixed(1)}`);
  Logger.log(`Current Phase: ${phaseInfo.phaseName} (${phaseInfo.weeksOut} weeks out)`);

  // Workout Types to Generate
  const types = ["FTP_Threshold", "VO2max_HighIntensity", "Endurance_Tempo"];
  
  const today = new Date();
  const dateStr = Utilities.formatDate(today, SYSTEM_SETTINGS.TIMEZONE, "MMdd");
  const fileDateStr = Utilities.formatDate(today, SYSTEM_SETTINGS.TIMEZONE, "yyyyMMdd");
  
  let generatedResults = [];

  for (const type of types) {
    Logger.log(`Generating workout for: ${type}...`);
    
    // Create Prompt
    const prompt = createPrompt(type, summary, phaseInfo, dateStr);

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
        fileName: fileName,
        xml: result.xml  // Store XML for Intervals.icu upload
      });
      Logger.log(` -> Success: ${fileName} (Score: ${result.recommendationScore})`);
    } else {
      Logger.log(` -> Failed to generate ${type}: ${result.error}`);
    }
  }

  // Sort by Recommendation Score (Descending)
  generatedResults.sort((a, b) => b.recommendationScore - a.recommendationScore);

  // Upload best workout to Intervals.icu calendar
  if (generatedResults.length > 0) {
    const best = generatedResults[0];
    const isoDateStr = formatDateISO(today); // yyyy-MM-dd format for API
    uploadWorkoutToIntervals(best.fileName.replace('.zwo', ''), best.xml, isoDateStr);
  }

  // Send Email
  if (generatedResults.length > 0) {
    sendSmartSummaryEmail(summary, phaseInfo, generatedResults);
  }
}

// =========================================================
// 8. LOGIC: Periodization Phase Calculation
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
// 10. HELPER: Prompt Construction
// =========================================================
function createPrompt(type, summary, phaseInfo, dateStr) {
  const langMap = { "ja": "Japanese", "en": "English", "es": "Spanish", "fr": "French" };
  const analysisLang = langMap[USER_SETTINGS.LANGUAGE] || "English";

  // Zwift Display Name (Clean, short name without "Aixle_" prefix)
  const safeType = type.replace(/[^a-zA-Z0-9]/g,"");
  const zwiftDisplayName = `${safeType}_${dateStr}`; 

  return `
You are an expert cycling coach using the logic of Coggan, Friel, and Seiler.
Generate a Zwift workout (.zwo) and evaluate its suitability.

**1. Athlete Context:**
- **Goal:** ${USER_SETTINGS.GOAL_DESCRIPTION}
- **Target Race:** In ${phaseInfo.weeksOut} weeks.
- **Current Phase:** "${phaseInfo.phaseName}"
- **Phase Focus:** ${phaseInfo.focus}
- **Current TSB:** ${summary.tsb_current.toFixed(1)}
- **Recent Load (Z5+):** ${summary.z5_recent_total > 1500 ? "High" : "Normal"}

**2. Assignment: Design a "${type}" Workout**
- **Duration:** 60 min (+/- 5min).
- **Structure:** Engaging (Pyramids, Over-Unders). NO boring steady states.
- **Intensity:** Adjust based on TSB. If TSB < -20, reduce intensity significantly.

**3. REQUIRED ZWO FEATURES (Critical):**
- **Cadence:** You MUST specify target cadence for every interval using \`Cadence="85"\`.
- **Text Events (Messages):** 
  - You MUST include motivational or instructional text messages.
  - **LANGUAGE: Messages MUST be in ENGLISH.** (Even if the user's language is different, Zwift works best with English text).
  - Nest them: \`<SteadyState ... ><TextEvent timeoffset="10" message="Keep pushing!"/></SteadyState>\`
  - **Workout Name:** The <name> tag MUST be exactly: "${zwiftDisplayName}" (Do NOT add "Aixle_" prefix here).

**4. Evaluate Recommendation (1-10):**
- Logic: Based on the **Current Phase** and **TSB**, is "${type}" correct?
- Example: If Phase is "Base", VO2max should score low (unless maintenance). If Phase is "Peak", high volume SST should score low.

**Output Format (JSON Only):**
{
  "explanation": "Strategy explanation in **${analysisLang}**.",
  "recommendation_score": (integer 1-10),
  "recommendation_reason": "Reason based on Phase(${phaseInfo.phaseName}) and TSB in **${analysisLang}**.",
  "xml": "<workout_file>...<author>Aixle AI Coach</author><name>${zwiftDisplayName}</name>...valid xml...</workout_file>"
}
`;
}

// =========================================================
// 11. HELPER: Send Email (Dynamic Language)
// =========================================================
function sendSmartSummaryEmail(summary, phaseInfo, generatedResults) {
  const t = TRANSLATIONS[USER_SETTINGS.LANGUAGE] || TRANSLATIONS.en;
  
  const bestWorkout = generatedResults[0]; 
  const attachments = generatedResults.map(r => r.blob);
  
  const subject = `${t.subject_prefix}${bestWorkout.type} (${Utilities.formatDate(new Date(), SYSTEM_SETTINGS.TIMEZONE, "MM/dd")})`;

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
    const w = generatedResults[i];
    body += `
■ Option ${i+1}: ${w.type} (Score: ${w.recommendationScore}/10)
${w.recommendationReason}
(See attachment: ${w.fileName})
`;
  }

  body += `\n${t.footer}`;

  GmailApp.sendEmail(USER_SETTINGS.EMAIL_TO, subject, body, { attachments: attachments });
  Logger.log("Smart Email sent successfully.");
}

// =========================================================
// 12. DATA PROCESSING & UTILITIES
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
