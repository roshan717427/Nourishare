/**
 * Format an array as a natural English list.
 * 1 item: "A"
 * 2 items: "A and B"
 * 3+ items: "A, B, and C" (Oxford comma)
 */
export function formatList(items) {
  const list = (items || [])
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  if (!list.length) return '';
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(', ')}, and ${list[list.length - 1]}`;
}

module.exports = { formatList };
