/**
 * Image safety for base64 / data-URI uploads without Cloud Vision (Spark-friendly).
 *
 * Uses the existing GEMINI_API_KEY (Google AI Studio) for a lightweight NSFW check.
 * Does NOT require Firebase Blaze or the Cloud Vision API.
 *
 * If Gemini is unset/unavailable, fails open (allows upload) and logs a warning.
 * Community Report/Block + Terms remain the primary UGC controls.
 *
 * Set SKIP_IMAGE_SAFETY=1 to bypass entirely.
 */

const { GEMINI_MODEL } = require('./geminiClient');
const GEMINI_TIMEOUT_MS = 8000;

function extractBase64(photoUrl) {
  const value = String(photoUrl || '').trim();
  if (!value) return null;
  const dataMatch = value.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (dataMatch) {
    return { mime: `image/${dataMatch[1]}`, base64: dataMatch[2] };
  }
  if (/^https?:\/\//i.test(value)) return null;
  return null;
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function assertImageSafe(photoUrl) {
  if (process.env.SKIP_IMAGE_SAFETY === '1') return;

  const parsed = extractBase64(photoUrl);
  if (!parsed) return;

  if (parsed.base64.length > 4_500_000) {
    const err = new Error('That image is too large. Please choose a smaller photo.');
    err.code = 'image_too_large';
    err.status = 400;
    throw err;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('imageSafety: GEMINI_API_KEY unset; allowing upload (Spark / no Vision).');
    return;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const prompt =
    'You moderate food-app photo uploads. Reply with ONLY one word: SAFE or UNSAFE. ' +
    'Mark UNSAFE only for pornography, explicit sexual content, graphic gore, or clear real-world violence. ' +
    'Normal food, kitchens, people cooking, and non-explicit selfies are SAFE.';

  let body;
  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: parsed.mime || 'image/jpeg',
                    data: parsed.base64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 8,
          },
        }),
      },
      GEMINI_TIMEOUT_MS
    );
    body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body?.error?.message || `Gemini safety HTTP ${response.status}`);
    }
  } catch (err) {
    console.warn('imageSafety: Gemini check skipped:', err.message);
    return; // fail open on Spark / quota / timeout
  }

  const text = String(
    body?.candidates?.[0]?.content?.parts?.[0]?.text || ''
  )
    .trim()
    .toUpperCase();

  if (text.includes('UNSAFE')) {
    const err = new Error(
      'That photo cannot be uploaded because it may contain sensitive or inappropriate content.'
    );
    err.code = 'image_blocked';
    err.status = 400;
    throw err;
  }
}

module.exports = {
  assertImageSafe,
  extractBase64,
};
