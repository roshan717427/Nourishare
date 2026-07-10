/**
 * Format AI suggestion reason for display under "Why was this suggested?"
 */
export function formatSuggestionReasonBody(raw) {
    if (!raw) return null;
    let text = `${raw}`.trim().replace(/[.!]+$/, '');
    if (!text) return null;
  
    // Drop legacy prefixes meant for old "Suggested because …" copy
    text = text.replace(/^(it is |it was |it )/i, '');
  
    return `${text.charAt(0).toUpperCase() + text.slice(1)}!`;
  }