import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

const STORAGE_PREFIX = '@munchable/next_up_';

function getStorageKey(username) {
  return `${STORAGE_PREFIX}${username}`;
}

const NextUpContext = createContext({
  items: [],
  loading: true,
  addToNextUp: () => false,
  removeFromNextUp: () => {},
  isInNextUp: () => false,
});

export function NextUpProvider({ children }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.username) {
      setItems([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(getStorageKey(user.username));
        if (cancelled) return;
        const parsed = raw ? JSON.parse(raw) : [];
        setItems(Array.isArray(parsed) ? parsed : []);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.username]);

  const persist = useCallback(
    async (nextItems) => {
      if (!user?.username) return;
      try {
        await AsyncStorage.setItem(getStorageKey(user.username), JSON.stringify(nextItems));
      } catch {
        // UI already updated; ignore storage failures.
      }
    },
    [user?.username]
  );

  const isInNextUp = useCallback(
    (recipeId) => items.some((item) => item.id === recipeId),
    [items]
  );

  const addToNextUp = useCallback(
    (recipe) => {
      if (!recipe?.id || isInNextUp(recipe.id)) {
        return false;
      }
      const entry = {
        id: recipe.id,
        name: recipe.name || recipe.recipe_name || 'Recipe',
        subtitle: recipe.subtitle || '',
        image: recipe.image || null,
        difficulty_level: recipe.difficulty_level || null,
        cooking_time: recipe.cooking_time || null,
        rating: recipe.rating || null,
        ingredients: recipe.ingredients || null,
        cooking_notes: recipe.cooking_notes || null,
        steps: recipe.steps || null,
        recipe_link: recipe.recipe_link || recipe.recipeLink || null,
        recipe_instructions: recipe.recipe_instructions || recipe.recipeInstructions || null,
        addedAt: Date.now(),
      };
      setItems((prev) => {
        const next = [entry, ...prev];
        persist(next);
        return next;
      });
      return true;
    },
    [isInNextUp, persist]
  );

  const removeFromNextUp = useCallback(
    (recipeId) => {
      setItems((prev) => {
        const next = prev.filter((item) => item.id !== recipeId);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  return (
    <NextUpContext.Provider
      value={{ items, loading, addToNextUp, removeFromNextUp, isInNextUp }}
    >
      {children}
    </NextUpContext.Provider>
  );
}

export function useNextUp() {
  return useContext(NextUpContext);
}

export default NextUpContext;
