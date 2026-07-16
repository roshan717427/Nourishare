/**
 * Gemini Flash client for recipe generation.
 *
 * GEMINI_API_KEY must be set server-side (Vercel env). Restrict the key in
 * Google AI Studio by IP / HTTP referrer — never expose it to the client.
 */
const GEMINI_MODEL = 'gemini-3.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function classifyGemini429(message = '') {
  const lower = `${message}`.toLowerCase();
  if (
    lower.includes('perday') ||
    lower.includes('per day') ||
    lower.includes('daily') ||
    lower.includes('requestsperday') ||
    lower.includes('quota exceeded for metric')
  ) {
    return 'gemini_rate_limit_rpd';
  }
  return 'gemini_rate_limit_rpm';
}

function parseGeminiError(status, body) {
  const message = body?.error?.message || body?.message || `Gemini request failed (${status})`;
  if (status === 429) {
    return {
      code: classifyGemini429(message),
      message,
      status: 429,
    };
  }
  if (status >= 500) {
    return { code: 'gemini_unavailable', message, status };
  }
  return { code: 'gemini_error', message, status: status || 500 };
}

async function callGeminiOnce(apiKey, prompt) {
  const response = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.85,
      },
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = parseGeminiError(response.status, body);
    const error = new Error(err.message);
    error.code = err.code;
    error.status = err.status;
    throw error;
  }

  const text =
    body?.candidates?.[0]?.content?.parts?.[0]?.text ||
    body?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ||
    '';

  if (!text) {
    const error = new Error('Gemini returned an empty response');
    error.code = 'gemini_empty';
    throw error;
  }

  return text;
}

async function generateRecipesWithGemini(apiKey, prompt) {
  let lastError;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      const response = await callGeminiOnce(apiKey, prompt);
      
      let raw = response;

      // 1. Traverse through Gemini's response object if nested
      if (response && response.candidates && response.candidates[0]?.content?.parts) {
        const parts = response.candidates[0].content.parts;
        const textPart = parts.find(p => p.text) || parts[0];
        raw = textPart?.text || '';
      } else if (typeof response?.text === 'function') {
        raw = response.text();
      }

      console.log("Raw object type check:", typeof raw);

      // ==========================================
      // CRUCIAL BACKEND FIX: Return immediately if it's already an object!
      // This prevents JSON.parse from choking on an already parsed array structure.
      // ==========================================
      if (raw && typeof raw === 'object') {
        console.log("Data is already a JavaScript object. Skipping string sanitization.");
        let objectExtract = raw.recipes ? raw.recipes : raw;
        return Array.isArray(objectExtract) ? objectExtract : (objectExtract.recipes || objectExtract.suggestions || []);
      }

      // 2. Fallback processing ONLY if it arrives as a true text string
      if (typeof raw === 'string') {
        raw = raw.trim();
        
        if (raw.includes('```')) {
          const markdownRegex = /```(?:json)?([\s\S]*?)```/i;
          const match = raw.match(markdownRegex);
          if (match && match[1]) {
            raw = match[1].trim();
          }
        }
        
        // Clean up string variations safely
        raw = raw.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");
        raw = raw.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, (match, p1, p2) => {
          if (p1.trim().endsWith('"')) return match;
          return `${p1}"${p2}":`;
        });
        raw = raw.replace(/:\s*'([\s\S]*?)'(\s*[,}])/g, ': "$1"$2');
        raw = raw.replace(/,\s*([\]}])/g, '$1');

        console.log("Strictly Sanitized JSON String for Parsing:", raw);
        
        let parsed = JSON.parse(raw);
        let finalRecipes = parsed.recipes ? parsed.recipes : parsed;
        return Array.isArray(finalRecipes) ? finalRecipes : (finalRecipes.recipes || finalRecipes.suggestions || []);
      }

      throw new Error("Unsupported recipe response data profile format");
    } catch (err) {
      lastError = err;
      const isRpm429 = err.code === 'gemini_rate_limit_rpm';
      const isRetryable =
        isRpm429 || err.code === 'gemini_unavailable' || (err.status && err.status >= 500) || err instanceof SyntaxError;

      if (!isRetryable || attempt >= MAX_RETRIES - 1) {
        throw err;
      }

      const delay = BASE_DELAY_MS * 2 ** attempt;
      await sleep(delay);
    }
  }

  throw lastError;
}

module.exports = {
  GEMINI_MODEL,
  generateRecipesWithGemini,
  classifyGemini429,
};
