function parseIngredientLines(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .flatMap((item) => parseIngredientLines(item))
      .filter(Boolean);
  }
  return String(raw)
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeIngredientKey(name) {
  return String(name).trim().toLowerCase().replace(/\s+/g, ' ');
}

function aggregateIngredients(entries) {
  const map = new Map();

  for (const entry of entries || []) {
    const recipeName = entry.recipeName || entry.name || 'Recipe';
    const lines = parseIngredientLines(entry.ingredients);
    for (const line of lines) {
      const key = normalizeIngredientKey(line);
      if (!key) continue;
      if (!map.has(key)) {
        map.set(key, {
          ingredient: line,
          recipes: [],
        });
      }
      const bucket = map.get(key);
      if (!bucket.recipes.includes(recipeName)) {
        bucket.recipes.push(recipeName);
      }
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.ingredient.localeCompare(b.ingredient, undefined, { sensitivity: 'base' })
  );
}

module.exports = {
  parseIngredientLines,
  normalizeIngredientKey,
  aggregateIngredients,
};
