// Fictional demo characters (Chloe, Liam, Isabella, Owen, Emma, Ava) used to
// showcase the app's features in Explore — these are NOT real user accounts.
// They are seeded here so the directory always has something to display, and
// are merged with real Firestore search results at runtime.
// Each entry matches the shape ProfileScreen expects so it can be passed
// straight through navigation and rendered without a network round-trip.

function frequency(values) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];
  return months.map((month, i) => ({ month, value: values[i] }));
}

export const SAMPLE_USERS = [
  {
    username: 'ava_patel',
    name: 'Ava Patel',
    profilePhotoUrl: 'https://i.pravatar.cc/150?img=47',
    joinedDate: '2021',
    kitchen_personality: {
      primary_trait: 'Adventurous and Comforting',
      secondary_traits: ['Bold Flavors', 'Classic Dishes'],
      top_cuisines: ['Italian', 'Mexican', 'Indian', 'Thai', 'Mediterranean'],
      favorite_ingredients: ['Garlic', 'Tomatoes', 'Basil', 'Olive Oil', 'Chili Peppers'],
      cooking_stats: { total_recipes: 125, avg_rating: 4.7 },
    },
    followers: 350,
    cookingFrequency: frequency([8, 18, 15, 12, 10, 17, 9]),
  },
  {
    username: 'chloe',
    name: 'Chloe Martin',
    profilePhotoUrl: 'https://i.pravatar.cc/150?img=5',
    joinedDate: '2022',
    kitchen_personality: {
      primary_trait: 'Fresh and Wholesome',
      secondary_traits: ['Seasonal Produce', 'Light Dishes'],
      top_cuisines: ['Mediterranean', 'Japanese', 'Greek', 'Californian'],
      favorite_ingredients: ['Avocado', 'Lemon', 'Quinoa', 'Spinach'],
      cooking_stats: { total_recipes: 64, avg_rating: 4.5 },
    },
    followers: 128,
    cookingFrequency: frequency([4, 7, 9, 11, 8, 12, 10]),
  },
  {
    username: 'liam',
    name: 'Liam Carter',
    profilePhotoUrl: 'https://i.pravatar.cc/150?img=12',
    joinedDate: '2020',
    kitchen_personality: {
      primary_trait: 'Bold and Spicy',
      secondary_traits: ['Big Flavors', 'Global Street Food'],
      top_cuisines: ['Indian', 'Thai', 'Korean', 'Mexican'],
      favorite_ingredients: ['Chili', 'Ginger', 'Garlic', 'Lime', 'Coriander'],
      cooking_stats: { total_recipes: 210, avg_rating: 4.4 },
    },
    followers: 540,
    cookingFrequency: frequency([12, 15, 14, 18, 16, 20, 17]),
  },
  {
    username: 'isabella',
    name: 'Isabella Rossi',
    profilePhotoUrl: 'https://i.pravatar.cc/150?img=9',
    joinedDate: '2019',
    kitchen_personality: {
      primary_trait: 'Classic and Refined',
      secondary_traits: ['Italian Tradition', 'Slow Cooking'],
      top_cuisines: ['Italian', 'French', 'Mediterranean'],
      favorite_ingredients: ['Parmesan', 'Basil', 'Olive Oil', 'Tomatoes'],
      cooking_stats: { total_recipes: 318, avg_rating: 4.9 },
    },
    followers: 890,
    cookingFrequency: frequency([14, 20, 18, 16, 19, 22, 21]),
  },
  {
    username: 'owen',
    name: 'Owen Brooks',
    profilePhotoUrl: 'https://i.pravatar.cc/150?img=13',
    joinedDate: '2023',
    kitchen_personality: {
      primary_trait: 'Hearty and Casual',
      secondary_traits: ['Comfort Food', 'Weekend Grilling'],
      top_cuisines: ['American', 'Mexican', 'BBQ'],
      favorite_ingredients: ['Beef', 'Cheddar', 'Onion', 'Smoked Paprika'],
      cooking_stats: { total_recipes: 47, avg_rating: 4.1 },
    },
    followers: 73,
    cookingFrequency: frequency([3, 5, 6, 8, 7, 9, 6]),
  },
  {
    username: 'emma',
    name: 'Emma Nguyen',
    profilePhotoUrl: 'https://i.pravatar.cc/150?img=1',
    joinedDate: '2022',
    kitchen_personality: {
      primary_trait: 'Vibrant and Aromatic',
      secondary_traits: ['Southeast Asian Flavors', 'Fresh Herbs'],
      top_cuisines: ['Vietnamese', 'Thai', 'Japanese', 'Fusion'],
      favorite_ingredients: ['Lemongrass', 'Fish Sauce', 'Mint', 'Rice Noodles'],
      cooking_stats: { total_recipes: 156, avg_rating: 4.6 },
    },
    followers: 264,
    cookingFrequency: frequency([9, 11, 13, 12, 14, 15, 13]),
  },
];

export function searchUsers(query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [];
  return SAMPLE_USERS.filter(
    (u) =>
      u.username.toLowerCase().includes(q) ||
      u.name.toLowerCase().includes(q)
  );
}

export function findUser(username) {
  if (!username) return null;
  const q = username.toLowerCase();
  return SAMPLE_USERS.find((u) => u.username.toLowerCase() === q) || null;
}

export default SAMPLE_USERS;
