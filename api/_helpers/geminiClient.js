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
const GEMINI_TIMEOUT_MS = 12000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') {
      const timeoutErr = new Error('Gemini request timed out');
      timeoutErr.code = 'gemini_unavailable';
      timeoutErr.status = 504;
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
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
  const response = await fetchWithTimeout(
    `${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.85,
        },
      }),
    },
    GEMINI_TIMEOUT_MS
  );

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

      if (response && response.candidates && response.candidates[0]?.content?.parts) {
        const parts = response.candidates[0].content.parts;
        const textPart = parts.find(p => p.text) || parts[0];
        raw = textPart?.text || '';
      } else if (typeof response?.text === 'function') {
        raw = response.text();
      }

      // ==========================================
      // THE FIX: Return the FULL root payload object instantly!
      // ==========================================
      if (raw && typeof raw === 'object') {
        console.log("Response is already an object. Returning parent structure.");
        return raw; 
      }

      if (typeof raw === 'string') {
        raw = raw.trim();
        
        if (raw.includes('```')) {
          const markdownRegex = /```(?:json)?([\s\S]*?)```/i;
          const match = raw.match(markdownRegex);
          if (match && match[1]) {
            raw = match[1].trim();
          }
        }

        // Return the clean parsed object directly
        let parsed = JSON.parse(raw);
        return parsed;
      }

      throw new Error("Unsupported data profile format");
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
