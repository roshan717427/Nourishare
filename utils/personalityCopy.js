/**
 * Natural-language kitchen personality descriptions for profile UI.
 * Second person on own profile; third person with first name for others.
 */

import { formatIngredientList, formatList } from './formatList';
import { toTitleCase } from './titleCase';

const TRAIT_COPY = {
  'Kitchen Enthusiast': {
    compoundLabel: 'curious recipe explorer',
    verbPhrase: 'loves trying new recipes',
  },
  'Global Explorer': {
    compoundLabel: 'globe-trotting experimentalist',
    verbPhrase: 'loves exploring cuisines from around the world',
  },
  'Adventurous Chef': {
    compoundLabel: 'bold-flavored experimentalist',
    verbPhrase: 'loves to experiment',
  },
  'Quality Focused': {
    compoundLabel: 'detail-minded perfectionist',
    verbPhrase: 'takes pride in getting the details right',
  },
  'Experienced Cook': {
    compoundLabel: 'seasoned home chef',
    verbPhrase: 'cooks with real confidence',
  },
  'Kitchen Newcomer': {
    compoundLabel: 'kitchen newcomer',
    verbPhrase: 'is still finding your footing',
  },
  'Adventurous and Comforting': {
    compoundLabel: 'comfort-minded experimentalist',
    verbPhrase: 'likes mixing bold experiments with cozy favorites',
  },
  'Fresh and Wholesome': {
    compoundLabel: 'fresh-forward wholesome cook',
    verbPhrase: 'leans toward bright, nourishing plates',
  },
  'Bold and Spicy': {
    compoundLabel: 'bold-spiced flavor seeker',
    verbPhrase: 'chases heat and big flavor',
  },
  'Classic and Refined': {
    compoundLabel: 'classic-minded refined cook',
    verbPhrase: 'favors timeless techniques and polished results',
  },
  'Hearty and Casual': {
    compoundLabel: 'comfort-driven home cook',
    verbPhrase: 'leans toward familiar, satisfying dishes',
  },
  'Vibrant and Aromatic': {
    compoundLabel: 'aromatic flavor enthusiast',
    verbPhrase: 'builds dishes around fragrant herbs and spices',
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

function resolveCompoundLabelFromKeywords(lowered) {
  if (lowered.includes('sweet')) return 'sweet-toothed experimentalist';
  if (lowered.includes('adventur') && (lowered.includes('comfort') || lowered.includes('cozy'))) {
    return 'comfort-minded experimentalist';
  }
  if (lowered.includes('adventur')) return 'bold-flavored experimentalist';
  if (lowered.includes('comfort') || lowered.includes('cozy') || lowered.includes('hearty')) {
    return 'comfort-driven home cook';
  }
  if (lowered.includes('global') || (lowered.includes('explor') && lowered.includes('cuisine'))) {
    return 'globe-trotting experimentalist';
  }
  if (lowered.includes('bold') || lowered.includes('spicy')) return 'bold-spiced flavor seeker';
  if (lowered.includes('fresh') || lowered.includes('wholesome')) return 'fresh-forward wholesome cook';
  if (lowered.includes('classic') || lowered.includes('refined')) return 'classic-minded refined cook';
  if (lowered.includes('vibrant') || lowered.includes('aromatic')) return 'aromatic flavor enthusiast';
  if (lowered.includes('quality') || lowered.includes('meticulous') || lowered.includes('focused')) {
    return 'detail-minded perfectionist';
  }
  if (lowered.includes('experienced') || lowered.includes('seasoned')) return 'seasoned home chef';
  if (lowered.includes('newcomer') || lowered.includes('learning') || lowered.includes('beginner')) {
    return 'kitchen newcomer';
  }
  if (lowered.includes('enthusiast') || lowered.includes('curious')) return 'curious recipe explorer';
  return '';
}

function resolveTraitCopy(primary) {
  if (TRAIT_COPY[primary]) return TRAIT_COPY[primary];

  const lowered = String(primary || '').trim().toLowerCase();
  if (!lowered) return null;

  const compoundLabel = resolveCompoundLabelFromKeywords(lowered);
  if (compoundLabel) {
    if (compoundLabel === 'comfort-driven home cook') {
      return {
        compoundLabel,
        verbPhrase: 'leans toward familiar, satisfying dishes',
      };
    }
    if (compoundLabel === 'bold-flavored experimentalist') {
      return TRAIT_COPY['Adventurous Chef'];
    }
    if (compoundLabel === 'globe-trotting experimentalist') {
      return TRAIT_COPY['Global Explorer'];
    }
    if (compoundLabel === 'kitchen newcomer') {
      return TRAIT_COPY['Kitchen Newcomer'];
    }
    if (compoundLabel === 'sweet-toothed experimentalist') {
      return {
        compoundLabel,
        verbPhrase: 'loves desserts and playful sweet-savory twists',
      };
    }
    return {
      compoundLabel,
      verbPhrase: 'has a distinct style in the kitchen',
    };
  }

  if (lowered.includes(' and ')) {
    return {
      compoundLabel: 'flavor-forward home cook',
      verbPhrase: 'likes bringing that mix to the stove',
    };
  }

  return {
    compoundLabel: 'flavor-forward home cook',
    verbPhrase: 'has a distinct style in the kitchen',
  };
}

/**
 * Vivid hyphenated compound label for profile badges and copy.
 * @param {string} primary
 * @returns {string}
 */
export function getTraitCompoundLabel(primary) {
  const trait = resolveTraitCopy(primary);
  if (trait?.compoundLabel) return trait.compoundLabel;
  const trimmed = String(primary || '').trim();
  return trimmed || 'kitchen newcomer';
}

function hasMeaningfulPrimary(primary) {
  const trimmed = String(primary || '').trim();
  return Boolean(trimmed) && trimmed !== 'Kitchen Newcomer';
}

function formatCuisineNames(cuisines) {
  return formatList(
    (cuisines || []).filter(Boolean).slice(0, 3).map(formatCuisineName)
  );
}

function formatIngredientNames(ingredients) {
  return formatIngredientList((ingredients || []).filter(Boolean).slice(0, 3));
}

function buildCuisinePhrase(cuisines) {
  const formatted = formatCuisineNames(cuisines);
  if (!formatted) return '';
  return `enjoys ${formatted} cooking`;
}

function buildIngredientPhrase(ingredients) {
  const formatted = formatIngredientNames(ingredients);
  if (!formatted) return '';
  return `often reaches for ${formatted}`;
}

function joinDetailPhrases(phrases) {
  if (!phrases.length) return '';
  if (phrases.length === 1) return ` and ${phrases[0]}`;
  return `, ${phrases.slice(0, -1).join(', ')}, and ${phrases[phrases.length - 1]}`;
}

function buildDetailClauses(cuisines, ingredients) {
  return joinDetailPhrases(
    [buildCuisinePhrase(cuisines), buildIngredientPhrase(ingredients)].filter(Boolean)
  );
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
    return "You're a kitchen newcomer still finding your footing.";
  }
  const who = firstName || 'This cook';
  return `${who} is a kitchen newcomer still finding their footing.`;
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
  const parts = [
    buildCuisinePhrase(personality.top_cuisines),
    buildIngredientPhrase(personality.favorite_ingredients),
  ].filter(Boolean);
  if (!parts.length) {
    return buildNewcomerSentence(isOwnProfile, firstName);
  }

  const compoundLabel = 'flavor-forward home cook';
  const article = articleBefore(compoundLabel);
  const who = isOwnProfile ? "You're" : `${firstName || 'This cook'} is`;
  return `${who} ${article} ${compoundLabel} who ${formatList(parts)}.`;
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
  const article = articleBefore(trait.compoundLabel);
  const detailClauses = buildDetailClauses(
    personality.top_cuisines,
    personality.favorite_ingredients
  );

  let main;
  if (isOwnProfile) {
    main = `You're ${article} ${trait.compoundLabel} who ${verb}${detailClauses}.`;
  } else {
    const who = firstName || 'This cook';
    main = `${who} is ${article} ${trait.compoundLabel} who ${verb}${detailClauses}.`;
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
