/**
 * Natural-language kitchen personality descriptions for profile UI.
 * Second person on own profile; third person with first name for others.
 */

import { formatList } from './formatList';
import { toTitleCase } from './titleCase';

const TRAIT_COPY = {
  'Kitchen Enthusiast': {
    adjective: 'curious',
    verbPhrase: 'loves trying new recipes',
  },
  'Global Explorer': {
    adjective: 'worldly',
    verbPhrase: 'loves exploring cuisines from around the world',
  },
  'Adventurous Chef': {
    adjective: 'adventurous',
    verbPhrase: 'loves to experiment',
  },
  'Quality Focused': {
    adjective: 'meticulous',
    verbPhrase: 'takes pride in getting the details right',
  },
  'Experienced Cook': {
    adjective: 'seasoned',
    verbPhrase: 'cooks with real confidence',
  },
  'Kitchen Newcomer': {
    adjective: 'budding',
    verbPhrase: 'is still getting comfortable in the kitchen',
  },
};

const SECONDARY_HINT = {
  'Ingredient Adventurer': {
    third: 'often reaches for ingredients most people skip',
    own: 'often reach for ingredients most people skip',
  },
  'Ingredient Discovery': {
    third: 'likes discovering something new at the market',
    own: 'like discovering something new at the market',
  },
  'Curious Cook': {
    third: 'keeps an open mind about what lands on the plate',
    own: 'keep an open mind about what lands on the plate',
  },
  'Learning Chef': {
    third: 'builds skills one dish at a time',
    own: 'build skills one dish at a time',
  },
  'Eager Learner': {
    third: 'picks up new techniques whenever possible',
    own: 'pick up new techniques whenever possible',
  },
  'Comfort & Adventure': {
    third: 'mixes cozy favorites with the occasional wild card',
    own: 'mix cozy favorites with the occasional wild card',
  },
  'Balanced Cook': {
    third: 'balances comfort food with more adventurous nights',
    own: 'balance comfort food with more adventurous nights',
  },
  'Cuisine Explorer': {
    third: 'likes to roam across different cuisines',
    own: 'like to roam across different cuisines',
  },
  'Varied Cuisines': {
    third: 'likes to keep the menu varied',
    own: 'like to keep the menu varied',
  },
  'Open-Minded Palate': {
    third: 'stays open to new flavors',
    own: 'stay open to new flavors',
  },
};

function articleBefore(word) {
  return /^[aeiou]/i.test(String(word || '').trim()) ? 'an' : 'a';
}

/**
 * @param {string} displayName
 * @returns {string}
 */
export function extractFirstName(displayName) {
  const raw = String(displayName || '').trim();
  if (!raw) return '';
  const token = raw.split(/\s+/)[0];
  if (!token) return '';
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

function formatCuisineName(cuisine) {
  return toTitleCase(cuisine);
}

function resolveTraitCopy(primary) {
  if (TRAIT_COPY[primary]) return TRAIT_COPY[primary];

  const lowered = String(primary || '').trim().toLowerCase();
  if (!lowered) return null;

  if (lowered.includes('adventur')) {
    return TRAIT_COPY['Adventurous Chef'];
  }
  if (lowered.includes('comfort') || lowered.includes('cozy')) {
    return {
      adjective: lowered.includes(' and ') ? lowered : 'comfort-driven',
      verbPhrase: 'leans toward familiar, satisfying dishes',
    };
  }
  if (lowered.includes(' and ')) {
    return {
      adjective: lowered,
      verbPhrase: 'likes bringing that mix to the stove',
    };
  }

  return {
    adjective: lowered,
    verbPhrase: 'has a distinct style in the kitchen',
  };
}

function hasMeaningfulPrimary(primary) {
  const trimmed = String(primary || '').trim();
  return Boolean(trimmed) && trimmed !== 'Kitchen Newcomer';
}

function formatCuisineClause(cuisines) {
  const formatted = formatList(
    (cuisines || []).filter(Boolean).slice(0, 3).map(formatCuisineName)
  );
  if (!formatted) return '';
  return ` and enjoys ${formatted} cooking`;
}

function formatIngredientClause(ingredients) {
  const formatted = formatList(
    (ingredients || [])
      .filter(Boolean)
      .slice(0, 3)
      .map((item) => toTitleCase(item))
      .filter(Boolean)
  );
  if (!formatted) return '';
  return ` and often reaches for ${formatted}`;
}

function formatStandaloneCuisinePhrase(cuisines) {
  const formatted = formatList(
    (cuisines || []).filter(Boolean).slice(0, 3).map(formatCuisineName)
  );
  if (!formatted) return '';
  return `enjoys ${formatted} cooking`;
}

function formatStandaloneIngredientPhrase(ingredients) {
  const formatted = formatList(
    (ingredients || [])
      .filter(Boolean)
      .slice(0, 3)
      .map((item) => toTitleCase(item))
      .filter(Boolean)
  );
  if (!formatted) return '';
  return `often reaches for ${formatted}`;
}

function pickSecondaryHint(traits, isOwnProfile) {
  for (const trait of traits || []) {
    const hint = SECONDARY_HINT[trait];
    if (hint) return isOwnProfile ? hint.own : hint.third;
  }
  return '';
}

function buildNewcomerSentence(isOwnProfile, firstName) {
  if (isOwnProfile) {
    return "You're a budding cook who's still getting comfortable in the kitchen.";
  }
  const who = firstName || 'This cook';
  return `${who} is a budding cook who's still getting comfortable in the kitchen.`;
}

function buildFollowUpSentence(hint, isOwnProfile, firstName) {
  if (isOwnProfile) {
    return `You ${hint}.`;
  }
  const who = firstName || 'This cook';
  return `${who} ${hint}.`;
}

function hasPersonalitySelections(personality = {}) {
  const cuisines = (personality.top_cuisines || []).filter(Boolean);
  const ingredients = (personality.favorite_ingredients || []).filter(Boolean);
  return hasMeaningfulPrimary(personality.primary_trait) || cuisines.length > 0 || ingredients.length > 0;
}

function buildSelectionOnlySentence(personality, isOwnProfile, firstName) {
  const cuisinePhrase = formatStandaloneCuisinePhrase(personality.top_cuisines);
  const ingredientPhrase = formatStandaloneIngredientPhrase(personality.favorite_ingredients);

  const parts = [cuisinePhrase, ingredientPhrase].filter(Boolean);
  if (!parts.length) {
    return buildNewcomerSentence(isOwnProfile, firstName);
  }

  const who = isOwnProfile ? "You're" : `${firstName || 'This cook'} is`;
  return `${who} a cook who ${formatList(parts)}.`;
}

/**
 * @param {string} name - Display name or full name; first token is used in copy
 * @param {object} personality - kitchen_personality object
 * @param {{ isOwnProfile?: boolean, displayName?: string }} [options]
 * @returns {string}
 */
export function buildPersonalityDescription(name, personality = {}, options = {}) {
  const { lead, followUp } = buildPersonalityDescriptionParts(name, personality, options);
  return followUp ? `${lead} ${followUp}` : lead;
}

/**
 * @param {string} name
 * @param {object} personality
 * @param {{ isOwnProfile?: boolean, displayName?: string }} [options]
 * @returns {{ lead: string, followUp: string }}
 */
export function buildPersonalityDescriptionParts(name, personality = {}, options = {}) {
  const { isOwnProfile = false, displayName } = options;
  const firstName = extractFirstName(name || displayName);

  if (!hasPersonalitySelections(personality)) {
    const sentence = buildNewcomerSentence(isOwnProfile, firstName);
    return { lead: sentence, followUp: '' };
  }

  const primary = personality.primary_trait;
  if (!hasMeaningfulPrimary(primary)) {
    return { lead: buildSelectionOnlySentence(personality, isOwnProfile, firstName), followUp: '' };
  }

  const trait = resolveTraitCopy(primary);
  if (!trait) {
    return { lead: buildSelectionOnlySentence(personality, isOwnProfile, firstName), followUp: '' };
  }

  return buildTraitDescriptionParts(personality, trait, isOwnProfile, firstName);
}

function buildTraitDescriptionParts(personality, trait, isOwnProfile, firstName) {
  const verb = trait.verbPhrase;
  const article = articleBefore(trait.adjective);
  const cuisineClause = formatCuisineClause(personality.top_cuisines);
  const ingredientClause = formatIngredientClause(personality.favorite_ingredients);
  const detailClauses = `${cuisineClause}${ingredientClause}`;

  let main;
  if (isOwnProfile) {
    main = `You're ${article} ${trait.adjective} cook who ${verb}${detailClauses}.`;
  } else {
    const who = firstName || 'This cook';
    main = `${who} is ${article} ${trait.adjective} cook who ${verb}${detailClauses}.`;
  }

  const secondaryHint = pickSecondaryHint(personality.secondary_traits, isOwnProfile);
  if (secondaryHint && !detailClauses) {
    return {
      lead: main,
      followUp: buildFollowUpSentence(secondaryHint, isOwnProfile, firstName),
    };
  }

  return { lead: main, followUp: '' };
}

export default buildPersonalityDescription;
