/**
 * Gemini Flash client for recipe generation.
 *
 * GEMINI_API_KEY must be set server-side (Vercel env). Restrict the key in
 * Google AI Studio by IP / HTTP referrer — never expose it to the client.
 */
const GEMINI_MODEL = 'gemini-2.5-flash';
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
      const raw = await callGeminiOnce(apiKey, prompt);
      const parsed = JSON.parse(raw);
      return parsed;
    } catch (err) {
      lastError = err;
      const isRpm429 = err.code === 'gemini_rate_limit_rpm';
      const isRetryable =
        isRpm429 || err.code === 'gemini_unavailable' || (err.status && err.status >= 500);

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
