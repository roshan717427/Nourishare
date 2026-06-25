import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import BottomNavigation from '../components/BottomNavigation';
import StatsCard from '../components/StatsCard';
import BarChart from '../components/BarChart';
import { useAuth } from '../context/AuthContext';
import { clearOnboardingStorage } from '../context/OnboardingContext';
import { useNextUp } from '../context/NextUpContext';
import PortfolioGalleryModal from '../components/PortfolioGalleryModal';
import { API_URL } from '../config/api';
import { authFetch, withAuthHeaders, normalizeUsername } from '../utils/apiAuth';
import { colors, radii, spacing } from '../constants/theme';
import { buildPersonalityDescription, getTraitCompoundLabel } from '../utils/personalityCopy';
import { capitalizeList } from '../utils/titleCase';

const PORTFOLIO_FAVORITES_MAX = 2;
const TOP_CUISINES_MAX = 3;
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function computeCookingFrequencyFromLogs(logs, year = new Date().getFullYear()) {
  const counts = {};
  for (const log of logs) {
    const ms = log.created_at_ms || 0;
    if (!ms) continue;
    const d = new Date(ms);
    if (d.getFullYear() !== year) continue;
    const month = d.getMonth();
    counts[month] = (counts[month] || 0) + 1;
  }

  const result = [];
  for (let month = 0; month < 12; month++) {
    result.push({
      month: MONTH_LABELS[month],
      value: counts[month] || 0,
    });
  }
  return result;
}

function toLocalDateKey(ms) {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Consecutive calendar days with at least one log, ending today or yesterday. */
function computeCookingStreakFromLogs(logs) {
  const activeDays = new Set();
  for (const log of logs) {
    const ms = log.created_at_ms || 0;
    if (!ms) continue;
    activeDays.add(toLocalDateKey(ms));
  }
  if (activeDays.size === 0) return 0;

  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!activeDays.has(toLocalDateKey(cursor.getTime()))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!activeDays.has(toLocalDateKey(cursor.getTime()))) return 0;
  }

  let streak = 0;
  while (activeDays.has(toLocalDateKey(cursor.getTime()))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function parseCommaList(text) {
  return String(text || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseTopCuisines(text) {
  const all = parseCommaList(text);
  return {
    items: all.slice(0, TOP_CUISINES_MAX),
    truncated: all.length > TOP_CUISINES_MAX,
  };
}

function resolvePortfolioDishes(dishes, favoriteIds) {
  if (!Array.isArray(favoriteIds)) return [];
  return favoriteIds
    .map((id) => dishes.find((dish) => dish.id === id))
    .filter(Boolean)
    .slice(0, PORTFOLIO_FAVORITES_MAX);
}

function PortfolioPreview({ favoriteDishes, totalCount, onDishPress, onViewAll }) {
  return (
    <View style={styles.portfolioPreview}>
      <View style={styles.portfolioPreviewImages}>
        {favoriteDishes.length > 0 ? (
          favoriteDishes.map((dish, index) => (
            <TouchableOpacity
              key={dish.id}
              style={[styles.portfolioThumb, index > 0 && styles.portfolioThumbOverlap]}
              onPress={() => onDishPress(dish)}
              activeOpacity={0.85}
            >
              {dish.photoUrl ? (
                <Image source={{ uri: dish.photoUrl }} style={styles.portfolioThumbImage} />
              ) : (
                <View style={[styles.portfolioThumbImage, styles.dishImagePlaceholder]}>
                  <Ionicons name="restaurant-outline" size={22} color={colors.textMuted} />
                </View>
              )}
              <View style={styles.portfolioFavoriteBadge}>
                <Ionicons name="heart" size={10} color={colors.card} />
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={[styles.portfolioThumb, styles.portfolioThumbGhost]}>
            <Ionicons name="heart-outline" size={22} color={colors.textMuted} />
          </View>
        )}
      </View>

      <View style={styles.portfolioPreviewMeta}>
        <Text style={styles.portfolioPreviewTitle}>Featured dishes</Text>
        <Text style={styles.portfolioPreviewCount}>
          {favoriteDishes.length} of {PORTFOLIO_FAVORITES_MAX} showcased · {totalCount} total
        </Text>
        <TouchableOpacity
          style={styles.portfolioOpenButton}
          onPress={onViewAll}
          activeOpacity={0.85}
        >
          <Ionicons name="grid" size={18} color={colors.card} />
          <Text style={styles.portfolioOpenButtonText}>View full portfolio</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function NextUpCard({ recipe, onPress, onRemove }) { /* fix name later - not urgent */
  const hasPantry =
    (Array.isArray(recipe.ingredientsHave) && recipe.ingredientsHave.length > 0) ||
    (Array.isArray(recipe.ingredientsNeed) && recipe.ingredientsNeed.length > 0);

  return (
    <TouchableOpacity style={styles.nextUpCard} onPress={onPress} activeOpacity={0.85}>
      {recipe.image ? (
        <Image source={{ uri: recipe.image }} style={styles.nextUpImage} />
      ) : (
        <View style={[styles.nextUpImage, styles.dishImagePlaceholder]}>
          <Ionicons name="sparkles-outline" size={24} color={colors.textMuted} />
        </View>
      )}
      <View style={styles.nextUpInfo}>
        <Text style={styles.dishTitle} numberOfLines={2}>
          {recipe.name}
        </Text>
        {recipe.subtitle ? (
          <Text style={styles.nextUpSubtitle} numberOfLines={1}>
            {recipe.subtitle}
          </Text>
        ) : null}
        {hasPantry ? (
          <View style={styles.nextUpPantry}>
            {recipe.ingredientsNeed?.length > 0 ? (
              <Text style={styles.nextUpNeed} numberOfLines={2}>
                Need: {recipe.ingredientsNeed.join(', ')}
              </Text>
            ) : (
              <Text style={styles.nextUpHave} numberOfLines={1}>
                You have everything!
              </Text>
            )}
          </View>
        ) : null}
      </View>
      {onRemove ? (
        <TouchableOpacity
          style={styles.nextUpRemove}
          onPress={(e) => {
            e.stopPropagation?.();
            onRemove();
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Remove from Cook Next"
        >
          <Ionicons name="close-circle" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
}

function DishCard({ dish, onPress, isFavorited, onToggleFavorite, showFavorite, showDelete, onDelete }) {
  return (
    <TouchableOpacity style={styles.dishCard} onPress={onPress} activeOpacity={0.85}>
      {dish.photoUrl ? (
        <Image source={{ uri: dish.photoUrl }} style={styles.dishImage} />
      ) : (
        <View style={[styles.dishImage, styles.dishImagePlaceholder]}>
          <Ionicons name="restaurant-outline" size={24} color={colors.textMuted} />
        </View>
      )}
      {showDelete ? (
        <TouchableOpacity
          style={styles.dishDeleteButton}
          onPress={(e) => {
            e.stopPropagation?.();
            onDelete?.();
          }}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessibilityLabel="Delete logged dish"
        >
          <Ionicons name="trash-outline" size={15} color={colors.error} />
        </TouchableOpacity>
      ) : null}
      {showFavorite ? (
        <TouchableOpacity
          style={[
            styles.dishFavoriteButton,
            isFavorited && styles.dishFavoriteButtonActive,
            showDelete && styles.dishFavoriteButtonWithDelete,
          ]}
          onPress={(e) => {
            e.stopPropagation?.();
            onToggleFavorite?.();
          }}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessibilityLabel={isFavorited ? 'Remove from portfolio favorites' : 'Add to portfolio favorites'}
        >
          <Ionicons
            name={isFavorited ? 'heart' : 'heart-outline'}
            size={16}
            color={isFavorited ? colors.card : colors.primary}
          />
        </TouchableOpacity>
      ) : null}
      <View style={styles.dishInfo}>
        <Text style={styles.dishTitle} numberOfLines={2}>
          {dish.title}
        </Text>
        {dish.rating != null && dish.rating !== '' ? (
          <View style={styles.dishRating}>
            <Ionicons name="star" size={12} color={colors.star} />
            <Text style={styles.dishRatingText}>{dish.rating}/5</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export default function ProfileScreen({ navigation, route }) {
  const {
    user,
    isFollowing,
    isPendingRequest,
    unfollow,
    requestFollow,
    cancelFollowRequest,
    signOut,
  } = useAuth();
  const { items: nextUpItems, loading: nextUpLoading, removeFromNextUp } = useNextUp();
  const [profile, setProfile] = useState(null);
  const [dishes, setDishes] = useState([]);
  const [dishesLoading, setDishesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [editProfileModalVisible, setEditProfileModalVisible] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhotoUri, setEditPhotoUri] = useState(null);
  const [editPrimaryTrait, setEditPrimaryTrait] = useState('');
  const [editSecondaryTraits, setEditSecondaryTraits] = useState('');
  const [editTopCuisines, setEditTopCuisines] = useState('');
  const [editFavoriteIngredients, setEditFavoriteIngredients] = useState('');

  const rawUsername = route?.params?.username || user?.username;
  const username = normalizeUsername(rawUsername) || rawUsername;
  const isOwnProfile =
    !route?.params?.username ||
    normalizeUsername(route.params.username) === normalizeUsername(user?.username);
  const followingUser = isFollowing(username);
  const pendingFollow = isPendingRequest(username);
  const followLabel = followingUser ? 'Following' : pendingFollow ? 'Requested' : 'Follow';

  const fetchDishes = useCallback(async () => {
    setDishesLoading(true);
    try {
      const profileUsername = normalizeUsername(username);
      if (!profileUsername) {
        setDishes([]);
        return;
      }
      const response = await fetch(
        `${API_URL}/social?action=userLogs&username=${encodeURIComponent(profileUsername)}`,
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );
      if (response.ok) {
        const data = await response.json();
        setDishes(Array.isArray(data.logs) ? data.logs : []);
      } else {
        setDishes([]);
      }
    } catch (err) {
      console.log('Could not load user dishes:', err.message);
      setDishes([]);
    } finally {
      setDishesLoading(false);
    }
  }, [username]);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
      fetchDishes();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [username, fetchDishes])
  );

  const handleToggleFollow = () => {
    const follower = user?.username;
    const target = profile?.username || username;

    if (followingUser) {
      unfollow(username);
    } else if (pendingFollow) {
      cancelFollowRequest(username);
    } else {
      requestFollow(username);
    }

    if (!follower || !target) return;

    const action = followingUser || pendingFollow ? 'unfollow' : 'follow';
    withAuthHeaders().then((headers) =>
      fetch(`${API_URL}/social?action=${action}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ username: follower, targetUsername: target }),
      })
    ).catch((err) => {
      console.log(`${action} request error:`, err.message);
    });
  };

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      let response;
      if (isOwnProfile) {
        response = await authFetch(`${API_URL}/getUserProfile?me=1`, {
          method: 'GET',
        });
      } else {
        const profileUsername = normalizeUsername(username);
        if (!profileUsername) {
          setProfile(null);
          setError('Invalid username. Please sign out and sign in again.');
          return;
        }

        response = await fetch(
          `${API_URL}/getUserProfile?username=${encodeURIComponent(profileUsername)}`,
          {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setProfile(null);
        const apiError = data.error || 'Could not load profile';
        const detail = data.details ? `: ${data.details}` : '';
        if (__DEV__) {
          console.warn('[Profile] fetch failed', response.status, data);
        }
        setError(__DEV__ ? `${apiError}${detail}` : apiError);
        return;
      }

      if (!data?.username) {
        setProfile(null);
        setError('Profile not found');
        return;
      }

      setProfile(data);
      setFavoriteIds(data.portfolio_favorites || data.portfolioFavorites || []);
    } catch (err) {
      console.log('Error fetching profile:', err.message);
      setProfile(null);
      setError(__DEV__ ? err.message : err.message || 'Could not load profile');
    } finally {
      setLoading(false);
    }
  };

  const openDish = (dish) => {
    navigation.navigate('PostDetail', {
      postId: dish.id,
      collection: dish.postSource || 'logs',
      post: dish,
    });
  };

  const openNextUpRecipe = (recipe) => {
    navigation.navigate('RecipeDetail', { recipe });
  };

  const portfolioDishes = useMemo(
    () => resolvePortfolioDishes(dishes, favoriteIds),
    [dishes, favoriteIds]
  );

  const cookingFrequencyYear =
    profile?.cookingFrequencyYear || new Date().getFullYear();

  const cookingFrequencyData = useMemo(() => {
    if (!isOwnProfile) return null;
    if (profile?.cookingFrequency?.length) return profile.cookingFrequency;
    return computeCookingFrequencyFromLogs(dishes, cookingFrequencyYear);
  }, [profile?.cookingFrequency, dishes, isOwnProfile, cookingFrequencyYear]);

  const showCookingFrequency = isOwnProfile && !!cookingFrequencyData;

  const cookingStreak = useMemo(() => {
    if (profile?.cookingStreak != null) return profile.cookingStreak;
    return computeCookingStreakFromLogs(dishes);
  }, [profile?.cookingStreak, dishes]);

  const joinedYear = useMemo(() => {
    if (profile?.joinedDate) return profile.joinedDate;
    const raw = profile?.createdAt ?? profile?.created_at;
    if (!raw) return null;
    const ms = typeof raw === 'number' ? raw : Date.parse(String(raw));
    if (Number.isNaN(ms) || !ms) return null;
    return String(new Date(ms).getFullYear());
  }, [profile?.joinedDate, profile?.createdAt, profile?.created_at]);

  const togglePortfolioFavorite = async (dishId) => {
    if (!isOwnProfile || !user?.username) return;

    try {
      const response = await fetch(`${API_URL}/social?action=portfolioFavorites`, {
        method: 'POST',
        headers: await withAuthHeaders(),
        body: JSON.stringify({ username: user.username, dishId }),
      });
      const data = await response.json();
      if (!response.ok) {
        Alert.alert('Cannot update favorites', data.error || 'Please try again.');
        return;
      }
      const nextFavorites = data.portfolio_favorites || [];
      setFavoriteIds(nextFavorites);
      setProfile((prev) => (prev ? { ...prev, portfolio_favorites: nextFavorites } : prev));
    } catch (err) {
      Alert.alert('Cannot update favorites', err.message);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const openEditProfile = () => {
    const p = profile?.kitchen_personality || {};
    setEditName(profile?.name || '');
    setEditPhotoUri(null);
    setEditPrimaryTrait(p.primary_trait || '');
    setEditSecondaryTraits((p.secondary_traits || []).join(', '));
    setEditTopCuisines(
      profile?.top_cuisines_user_set
        ? capitalizeList(p.top_cuisines || []).join(', ')
        : ''
    );
    setEditFavoriteIngredients(
      profile?.favorite_ingredients_user_set
        ? capitalizeList(p.favorite_ingredients || []).join(', ')
        : ''
    );
    setEditProfileModalVisible(true);
  };

  const closeEditProfile = () => {
    setEditProfileModalVisible(false);
    setEditPhotoUri(null);
  };

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to set your profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const mime = asset.mimeType || 'image/jpeg';
    const dataUri = asset.base64 ? `data:${mime};base64,${asset.base64}` : asset.uri;
    setEditPhotoUri(dataUri);
  };

  const handleSaveProfile = async () => {
    if (!user?.username) return;
    setSavingProfile(true);
    try {
      const { items: topCuisines, truncated: topCuisinesTruncated } = parseTopCuisines(editTopCuisines);
      const kitchen_personality = {
        primary_trait: editPrimaryTrait.trim(),
        secondary_traits: parseCommaList(editSecondaryTraits),
        top_cuisines: capitalizeList(topCuisines),
        favorite_ingredients: capitalizeList(parseCommaList(editFavoriteIngredients)),
      };
      const payload = {
        username: user.username,
        name: editName.trim(),
        kitchen_personality,
        personality_edited_by_user: true,
        top_cuisines_user_set: true,
        favorite_ingredients_user_set: true,
      };
      if (editPhotoUri) {
        payload.profilePhotoUrl = editPhotoUri;
      }

      const response = await fetch(`${API_URL}/updateUserProfile`, {
        method: 'PATCH',
        headers: await withAuthHeaders(),
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save');
      }
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              name: editName.trim(),
              ...(editPhotoUri ? { profilePhotoUrl: editPhotoUri } : {}),
              kitchen_personality: {
                ...(prev.kitchen_personality || {}),
                ...kitchen_personality,
              },
              personality_edited_by_user: true,
              top_cuisines_user_set: true,
              favorite_ingredients_user_set: true,
            }
          : prev
      );
      closeEditProfile();
      if (topCuisinesTruncated) {
        Alert.alert(
          'Top cuisines limited to 3',
          'Only your first 3 entries were saved, in the order you listed them.'
        );
      }
    } catch (err) {
      Alert.alert('Could not save profile', err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDeleteAccount = () => {
    if (!user?.username) return;

    Alert.alert(
      'Delete account?',
      'This permanently removes your profile and data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_URL}/deleteUserProfile`, {
                method: 'DELETE',
                headers: await withAuthHeaders(),
                body: JSON.stringify({ username: user.username }),
              });
              const data = await response.json().catch(() => ({}));
              if (!response.ok) {
                throw new Error(data.error || 'Failed to delete account');
              }
              await clearOnboardingStorage(user.username, user.uid);
              await signOut();
            } catch (err) {
              Alert.alert('Could not delete account', err.message);
            }
          },
        },
      ]
    );
  };

  const handleDeleteDish = (dish) => {
    if (!isOwnProfile || !user?.username) return;

    Alert.alert(
      'Delete dish?',
      `Remove "${dish.title}" from your logged meals? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_URL}/deleteRecipeLog`, {
                method: 'POST',
                headers: await withAuthHeaders(),
                body: JSON.stringify({ username: user.username, logId: dish.id }),
              });
              const data = await response.json().catch(() => ({}));
              if (!response.ok) {
                throw new Error(data.error || 'Failed to delete');
              }
              setDishes((prev) => prev.filter((d) => d.id !== dish.id));
              setFavoriteIds((prev) => prev.filter((id) => id !== dish.id));
              setProfile((prev) =>
                prev
                  ? {
                      ...prev,
                      portfolio_favorites: (prev.portfolio_favorites || []).filter(
                        (id) => id !== dish.id
                      ),
                    }
                  : prev
              );
              fetchProfile();
            } catch (err) {
              Alert.alert('Could not delete dish', err.message);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (error && !profile && !loading) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
          <TouchableOpacity onPress={fetchProfile} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const personality = profile?.kitchen_personality || {};
  const stats = personality?.cooking_stats || {};
  const topCuisines = profile?.top_cuisines_user_set
    ? capitalizeList(personality?.top_cuisines || [])
    : [];
  const favoriteIngredients = profile?.favorite_ingredients_user_set
    ? capitalizeList(personality?.favorite_ingredients || [])
    : [];
  const followers = profile?.followers || 0;
  const followingCount = profile?.following || 0;

  const personalityForCopy = {
    ...personality,
    top_cuisines: topCuisines,
    favorite_ingredients: favoriteIngredients,
  };

  const primaryTrait = personality?.primary_trait?.trim();
  const showTraitBadge = Boolean(primaryTrait) && primaryTrait !== 'Kitchen Newcomer';
  const primaryTraitLabel = getTraitCompoundLabel(primaryTrait);
  const personalityText = buildPersonalityDescription(
    profile?.displayName || profile?.name,
    personalityForCopy,
    { isOwnProfile, omitCompoundLabel: showTraitBadge }
  );

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate('Home');
              }
            }}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.placeholder} />
        </View>

        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.userBanner}
        >
          <View style={styles.avatarContainer}>
            {profile?.profilePhotoUrl ? (
              <Image source={{ uri: profile.profilePhotoUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarPlaceholderText}>
                  {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.userName}>{profile?.name || 'User'}</Text>
          <Text style={styles.username}>@{profile?.username || 'username'}</Text>
          {joinedYear ? (
            <Text style={styles.joinedDate}>Joined {joinedYear}</Text>
          ) : null}

          {!isOwnProfile && (
            <TouchableOpacity
              style={[
                styles.followButton,
                (followingUser || pendingFollow) && styles.followingButton,
              ]}
              onPress={handleToggleFollow}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.followButtonText,
                  (followingUser || pendingFollow) && styles.followingButtonText,
                ]}
              >
                {followLabel}
              </Text>
            </TouchableOpacity>
          )}
        </LinearGradient>

        {isOwnProfile && (
          <View style={styles.editProfileSection}>
            <TouchableOpacity
              style={styles.editProfileButton}
              onPress={openEditProfile}
              activeOpacity={0.85}
            >
              <Ionicons name="create-outline" size={17} color={colors.primary} />
              <Text style={styles.editProfileButtonText}>Account Settings</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {isOwnProfile && (
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="bookmark" size={20} color={colors.accent} />
              <Text style={styles.sectionTitle}>Cook Next</Text>
              <View style={styles.privateBadge}>
                <Ionicons name="lock-closed" size={11} color={colors.textMuted} />
                <Text style={styles.privateBadgeText}>Only you</Text>
              </View>
            </View>
            {nextUpLoading ? (
              <ActivityIndicator color={colors.accent} style={{ marginVertical: 16 }} />
            ) : nextUpItems.length === 0 ? (
              <View style={styles.emptyDishes}>
                <Ionicons name="add-circle-outline" size={36} color={colors.textMuted} />
                <Text style={styles.emptyDishesTitle}>Nothing queued yet</Text>
                <Text style={styles.emptyDishesText}>
                  Tap the + on any AI suggestion to save recipes you want to cook next.
                </Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.dishesRow}
              >
                {nextUpItems.map((recipe) => (
                  <NextUpCard
                    key={recipe.id}
                    recipe={recipe}
                    onPress={() => openNextUpRecipe(recipe)}
                    onRemove={() => removeFromNextUp(recipe.id)}
                  />
                ))}
              </ScrollView>
            )}
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="images" size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>Culinary Portfolio</Text>
            {isOwnProfile ? (
              <Text style={styles.portfolioHint}>Favorite up to 2 in gallery</Text>
            ) : null}
          </View>
          {dishesLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
          ) : dishes.length === 0 ? (
            <View style={styles.emptyDishes}>
              <Ionicons name="nutrition-outline" size={36} color={colors.textMuted} />
              <Text style={styles.emptyDishesTitle}>
                {isOwnProfile ? 'No dishes logged yet' : 'No dishes to show'}
              </Text>
              <Text style={styles.emptyDishesText}>
                {isOwnProfile
                  ? 'Tap Post to log your first meal, then favorite up to 2 in your gallery!'
                  : `${profile?.name || 'This user'} hasn't logged any meals yet.`}
              </Text>
            </View>
          ) : (
            <>
              <PortfolioPreview
                favoriteDishes={portfolioDishes}
                totalCount={dishes.length}
                onDishPress={openDish}
                onViewAll={() => setGalleryVisible(true)}
              />
            </>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="flame" size={20} color={colors.secondary} />
            <Text style={styles.sectionTitle}>Kitchen Personality</Text>
          </View>
          <View style={styles.personalityCard}>
            <View style={styles.personalityCardHeader}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.secondary} />
              <Text style={styles.personalityCardLabel}>
                {isOwnProfile ? 'Your kitchen vibe' : 'In their kitchen'}
              </Text>
            </View>
            {showTraitBadge ? (
              <View style={styles.personalityTraitBadge}>
                <Text style={styles.personalityTraitBadgeText}>{primaryTraitLabel}</Text>
              </View>
            ) : null}
            <Text style={styles.personalityDescription}>{personalityText}</Text>
          </View>
        </View>

        {(isOwnProfile || topCuisines.length > 0) && (
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="earth-outline" size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>Top Cuisines</Text>
            </View>
            {topCuisines.length > 0 ? (
              <View style={styles.bulletList}>
                {topCuisines.map((cuisine, index) => (
                  <View key={index} style={styles.bulletRow}>
                    <Text style={styles.rankMarker}>{index + 1}.</Text>
                    <Text style={styles.bulletText}>{cuisine}</Text>
                  </View>
                ))}
              </View>
            ) : isOwnProfile ? (
              <Text style={styles.sectionEditHint}>Go to account settings to select.</Text>
            ) : null}
          </View>
        )}

        {(isOwnProfile || favoriteIngredients.length > 0) && (
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="leaf-outline" size={20} color={colors.accent} />
              <Text style={styles.sectionTitle}>Favorite Ingredients</Text>
            </View>
            {favoriteIngredients.length > 0 ? (
              <View style={styles.bulletList}>
                {favoriteIngredients.map((ingredient, index) => (
                  <View key={index} style={styles.bulletRow}>
                    <Text style={styles.bulletMarker}>•</Text>
                    <Text style={styles.bulletText}>{ingredient}</Text>
                  </View>
                ))}
              </View>
            ) : isOwnProfile ? (
              <Text style={styles.sectionEditHint}>Go to account settings to select.</Text>
            ) : null}
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="stats-chart-outline" size={20} color={colors.chipAmberText} />
            <Text style={styles.sectionTitle}>Cooking Stats</Text>
          </View>
          <View style={styles.statsContainer}>
            <StatsCard label="Recipes Cooked" value={stats.total_recipes || 0} color={colors.primary} />
            <StatsCard
              label="Average Rating"
              value={stats.avg_rating ? Number(stats.avg_rating).toFixed(1) : '0.0'}
              color={colors.accent}
            />
            <StatsCard
              label="Day Streak"
              value={`🔥 ${cookingStreak}`}
              color={colors.chipAmberText}
            />
          </View>
          <View style={[styles.statsContainer, styles.statsRowSpacing]}>
            <StatsCard label="Followers" value={followers} color={colors.secondary} />
            <StatsCard label="Following" value={followingCount} color={colors.chipAmberText} />
          </View>
        </View>

        {showCookingFrequency && (
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="calendar-outline" size={20} color={colors.accentDark} />
              <Text style={styles.sectionTitle}>
                Cooking Frequency in {cookingFrequencyYear}
              </Text>
            </View>
            <BarChart data={cookingFrequencyData} />
          </View>
        )}

        {isOwnProfile && (
          <View style={styles.signOutSection}>
            <TouchableOpacity
              style={styles.signOutButton}
              onPress={handleSignOut}
              activeOpacity={0.85}
            >
              <Ionicons name="log-out-outline" size={20} color={colors.primary} />
              <Text style={styles.signOutButtonText}>Sign out</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <BottomNavigation navigation={navigation} activeTab={isOwnProfile ? 'Profile' : 'Explore'} />

      <PortfolioGalleryModal
        visible={galleryVisible}
        dishes={dishes}
        ownerName={profile?.name}
        onClose={() => setGalleryVisible(false)}
        onDishPress={(dish) => {
          setGalleryVisible(false);
          openDish(dish);
        }}
        showFavorite={isOwnProfile}
        favoriteIds={favoriteIds}
        onToggleFavorite={togglePortfolioFavorite}
        showDelete={isOwnProfile}
        onDelete={handleDeleteDish}
      />

      <Modal
        visible={editProfileModalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeEditProfile}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Account Settings</Text>
              <TouchableOpacity
                onPress={closeEditProfile}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={[styles.modalLabel, styles.modalLabelFirst]}>Profile photo</Text>
              <View style={styles.modalPhotoRow}>
                {editPhotoUri || profile?.profilePhotoUrl ? (
                  <Image
                    source={{ uri: editPhotoUri || profile?.profilePhotoUrl }}
                    style={styles.modalPhotoPreview}
                  />
                ) : (
                  <View style={styles.modalPhotoPlaceholder}>
                    <Text style={styles.modalPhotoPlaceholderText}>
                      {editName?.charAt(0)?.toUpperCase() || profile?.name?.charAt(0)?.toUpperCase() || 'U'}
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.modalChangePhotoButton}
                  onPress={handlePickPhoto}
                  activeOpacity={0.85}
                >
                  <Ionicons name="camera-outline" size={18} color={colors.primary} />
                  <Text style={styles.modalChangePhotoText}>Change photo</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.modalLabel}>Display name</Text>
              <TextInput
                style={styles.modalInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Your name"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
              />

              <Text style={styles.modalLabel}>Username</Text>
              <TextInput
                style={[styles.modalInput, styles.modalInputReadOnly]}
                value={`@${profile?.username || user?.username || ''}`}
                editable={false}
              />
              <Text style={styles.modalFieldHint}>Username cannot be changed.</Text>

              <Text style={styles.modalSectionHeading}>Kitchen personality</Text>

              <Text style={styles.modalLabel}>Primary trait</Text>
              <TextInput
                style={styles.modalInput}
                value={editPrimaryTrait}
                onChangeText={setEditPrimaryTrait}
                placeholder="e.g. bold and comforting"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.modalLabel}>Secondary traits (comma-separated)</Text>
              <TextInput
                style={styles.modalInput}
                value={editSecondaryTraits}
                onChangeText={setEditSecondaryTraits}
                placeholder="Bold Flavors, Classic Dishes"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.modalLabel}>Top 3 cuisines (comma-separated, ranked)</Text>
              <TextInput
                style={styles.modalInput}
                value={editTopCuisines}
                onChangeText={setEditTopCuisines}
                placeholder="Italian, Thai, Mexican"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={styles.modalFieldHint}>
                List up to 3 in rank order: 1st cuisine, 2nd cuisine, 3rd cuisine.
              </Text>

              <Text style={styles.modalLabel}>Favorite ingredients (comma-separated)</Text>
              <TextInput
                style={styles.modalInput}
                value={editFavoriteIngredients}
                onChangeText={setEditFavoriteIngredients}
                placeholder="garlic, basil, olive oil"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.modalHint}>
                Your cooking stats still update automatically. Custom traits and tags stay as you set them.
              </Text>

              <TouchableOpacity
                style={styles.deleteAccountButton}
                onPress={handleDeleteAccount}
                activeOpacity={0.85}
              >
                <Ionicons name="trash-outline" size={18} color={colors.error} />
                <Text style={styles.deleteAccountButtonText}>Delete account</Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={closeEditProfile}
                disabled={savingProfile}
                activeOpacity={0.85}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveButton, savingProfile && styles.modalSaveButtonDisabled]}
                onPress={handleSaveProfile}
                disabled={savingProfile}
                activeOpacity={0.85}
              >
                {savingProfile ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalSaveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: colors.error,
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: radii.md,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 12,
    backgroundColor: colors.card,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  placeholder: {
    width: 32,
  },
  userBanner: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 20,
  },
  avatarContainer: {
    marginBottom: 8,
    position: 'relative',
  },
  editProfileSection: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  editProfileButtonText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: '#fff',
  },
  avatarPlaceholder: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  avatarPlaceholderText: {
    fontSize: 44,
    fontWeight: '700',
    color: '#fff',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  username: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 4,
  },
  joinedDate: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  followButton: {
    marginTop: 16,
    backgroundColor: '#fff',
    borderRadius: radii.pill,
    paddingHorizontal: 40,
    paddingVertical: 12,
  },
  followingButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#fff',
  },
  followButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  followingButtonText: {
    color: '#fff',
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 28,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  privateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
    backgroundColor: colors.backgroundAlt,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  privateBadgeText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  sectionTitle: {
    flex: 1,
    flexShrink: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  personalityCard: {
    backgroundColor: colors.cardWarm,
    borderRadius: radii.lg,
    padding: spacing.md + 2,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.secondary,
    gap: 10,
  },
  personalityCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  personalityCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  personalityTraitBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.chipAmber,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  personalityTraitBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.chipAmberText,
    letterSpacing: 0.2,
  },
  personalityDescription: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 26,
    fontWeight: '500',
  },
  bulletList: {
    gap: 6,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletMarker: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    width: 12,
  },
  rankMarker: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    width: 18,
    fontWeight: '600',
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  sectionEditHint: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 8,
    lineHeight: 18,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: -6,
  },
  statsRowSpacing: {
    marginTop: 12,
  },
  dishesRow: {
    paddingRight: 8,
  },
  nextUpCard: {
    width: 150,
    marginRight: 12,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
  },
  nextUpImage: {
    width: 150,
    height: 100,
    backgroundColor: colors.borderLight,
  },
  nextUpInfo: {
    padding: 10,
    paddingRight: 28,
  },
  nextUpSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  nextUpPantry: {
    marginTop: 6,
  },
  nextUpHave: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.chipTealText,
  },
  nextUpNeed: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.chipCoralText,
    lineHeight: 15,
  },
  nextUpRemove: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.card,
    borderRadius: 12,
  },
  portfolioPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 16,
  },
  portfolioPreviewImages: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  portfolioThumb: {
    width: 72,
    height: 72,
    borderRadius: radii.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.card,
    backgroundColor: colors.borderLight,
  },
  portfolioThumbOverlap: {
    marginLeft: -20,
  },
  portfolioThumbGhost: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundAlt,
  },
  portfolioThumbImage: {
    width: '100%',
    height: '100%',
  },
  portfolioPreviewMeta: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  portfolioPreviewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  portfolioPreviewCount: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 12,
    lineHeight: 18,
  },
  portfolioOpenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  portfolioOpenButtonText: {
    color: colors.card,
    fontSize: 13,
    fontWeight: '700',
  },
  portfolioHint: {
    marginLeft: 'auto',
    flexShrink: 0,
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  portfolioFavoriteBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.like,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.card,
  },
  allDishesSection: {
    marginTop: 20,
  },
  allDishesTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  allDishesHint: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 12,
    lineHeight: 18,
  },
  dishDeleteButton: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 2,
  },
  dishFavoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 2,
  },
  dishFavoriteButtonActive: {
    backgroundColor: colors.like,
    borderColor: colors.like,
  },
  dishFavoriteButtonWithDelete: {
    top: 44,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingHorizontal: spacing.md + 4,
    paddingTop: spacing.md + 4,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: 12,
  },
  modalLabelFirst: {
    marginTop: 0,
  },
  modalPhotoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 4,
  },
  modalPhotoPreview: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: colors.border,
  },
  modalPhotoPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  modalPhotoPlaceholderText: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
  },
  modalChangePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  modalChangePhotoText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  modalInputReadOnly: {
    backgroundColor: colors.backgroundAlt,
    color: colors.textMuted,
  },
  modalFieldHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: 4,
  },
  modalSectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginTop: 20,
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: colors.inputBg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  modalHint: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: 14,
    marginBottom: 8,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalCancelButton: {
    flex: 1,
    borderRadius: radii.pill,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  modalCancelButtonText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '700',
  },
  modalSaveButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalSaveButtonDisabled: {
    opacity: 0.7,
  },
  modalSaveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 28,
    paddingVertical: 14,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.error,
    backgroundColor: colors.card,
  },
  deleteAccountButtonText: {
    color: colors.error,
    fontSize: 15,
    fontWeight: '700',
  },
  dishCard: {
    width: 140,
    marginRight: 12,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  dishImage: {
    width: 140,
    height: 100,
    backgroundColor: colors.borderLight,
  },
  dishImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dishInfo: {
    padding: 10,
  },
  dishTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  dishRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dishRatingText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  emptyDishes: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyDishesTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: 12,
    marginBottom: 6,
  },
  emptyDishesText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  signOutSection: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 8,
    alignItems: 'center',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: 32,
    paddingVertical: 14,
    backgroundColor: colors.card,
  },
  signOutButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
});
