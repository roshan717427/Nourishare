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
import Tag from '../components/Tag';
import { useAuth } from '../context/AuthContext';
import { useNextUp } from '../context/NextUpContext';
import PortfolioGalleryModal from '../components/PortfolioGalleryModal';
import { API_URL } from '../config/api';
import { colors, radii } from '../constants/theme';

const PORTFOLIO_FAVORITES_MAX = 2;

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

function NextUpCard({ recipe, onPress, onRemove }) {
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
      </View>
      {onRemove ? (
        <TouchableOpacity
          style={styles.nextUpRemove}
          onPress={(e) => {
            e.stopPropagation?.();
            onRemove();
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Remove from Next Up"
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
  const { user, isFollowing, follow, unfollow, signOut } = useAuth();
  const { items: nextUpItems, loading: nextUpLoading, removeFromNextUp } = useNextUp();
  const [profile, setProfile] = useState(null);
  const [dishes, setDishes] = useState([]);
  const [dishesLoading, setDishesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [personalityModalVisible, setPersonalityModalVisible] = useState(false);
  const [savingPersonality, setSavingPersonality] = useState(false);
  const [editPrimaryTrait, setEditPrimaryTrait] = useState('');
  const [editSecondaryTraits, setEditSecondaryTraits] = useState('');
  const [editTopCuisines, setEditTopCuisines] = useState('');
  const [editFavoriteIngredients, setEditFavoriteIngredients] = useState('');

  const username = route?.params?.username || user?.username || 'current_user';
  const passedProfile = route?.params?.profile;
  const isOwnProfile = !route?.params?.username || route.params.username === user?.username;
  const following = isFollowing(username);

  const fetchDishes = useCallback(async () => {
    setDishesLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/social?action=userLogs&username=${encodeURIComponent(username)}`,
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
      if (passedProfile) {
        setProfile(passedProfile);
        setFavoriteIds(passedProfile.portfolio_favorites || passedProfile.portfolioFavorites || []);
        setError(null);
        setLoading(false);
      } else {
        fetchProfile();
      }
      fetchDishes();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [username, passedProfile, fetchDishes])
  );

  const handleToggleFollow = () => {
    const follower = user?.username;
    const target = profile?.username || username;
    const willFollow = !following;

    if (willFollow) {
      follow(username);
    } else {
      unfollow(username);
    }

    if (!follower || !target) return;

    const action = willFollow ? 'follow' : 'unfollow';
    fetch(`${API_URL}/social?action=${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: follower, targetUsername: target }),
    }).catch((err) => {
      console.log(`${action} request error:`, err.message);
    });
  };

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_URL}/getUserProfile?username=${username}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        setProfile(getMockProfile());
        setError(null);
        return;
      }

      const data = await response.json();
      if (!data || (!data.name && !data.username)) {
        setProfile(getMockProfile());
        return;
      }

      setProfile(data);
      setFavoriteIds(data.portfolio_favorites || data.portfolioFavorites || []);
    } catch (err) {
      console.log('Error fetching profile, using mock data:', err.message);
      setProfile(getMockProfile());
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  const getMockProfile = () => ({
    name: 'Ava Patel',
    username: 'ava_patel',
    profilePhotoUrl: null,
    joinedDate: '2021',
    kitchen_personality: {
      primary_trait: 'Adventurous and Comforting',
      secondary_traits: ['Bold Flavors', 'Classic Dishes'],
      top_cuisines: ['Italian', 'Mexican', 'Indian', 'Thai', 'Mediterranean'],
      favorite_ingredients: ['Garlic', 'Tomatoes', 'Basil', 'Olive Oil', 'Chili Peppers'],
      cooking_stats: {
        total_recipes: 125,
        avg_rating: 4.7,
      },
    },
    followers: 350,
    cookingFrequency: [
      { month: 'Jan', value: 8 },
      { month: 'Feb', value: 18 },
      { month: 'Mar', value: 15 },
      { month: 'Apr', value: 12 },
      { month: 'May', value: 10 },
      { month: 'Jun', value: 17 },
      { month: 'Jul', value: 9 },
    ],
  });

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

  const togglePortfolioFavorite = async (dishId) => {
    if (!isOwnProfile || !user?.username) return;

    try {
      const response = await fetch(`${API_URL}/social?action=portfolioFavorites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  const parseCommaList = (text) =>
    text
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

  const openPersonalityEditor = () => {
    const p = profile?.kitchen_personality || {};
    setEditPrimaryTrait(p.primary_trait || '');
    setEditSecondaryTraits((p.secondary_traits || []).join(', '));
    setEditTopCuisines((p.top_cuisines || []).join(', '));
    setEditFavoriteIngredients((p.favorite_ingredients || []).join(', '));
    setPersonalityModalVisible(true);
  };

  const handleSavePersonality = async () => {
    if (!user?.username) return;
    setSavingPersonality(true);
    try {
      const kitchen_personality = {
        primary_trait: editPrimaryTrait.trim(),
        secondary_traits: parseCommaList(editSecondaryTraits),
        top_cuisines: parseCommaList(editTopCuisines),
        favorite_ingredients: parseCommaList(editFavoriteIngredients),
      };
      const response = await fetch(`${API_URL}/updateUserProfile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username,
          kitchen_personality,
          personality_edited_by_user: true,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save');
      }
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              kitchen_personality: {
                ...(prev.kitchen_personality || {}),
                ...kitchen_personality,
              },
              personality_edited_by_user: true,
            }
          : prev
      );
      setPersonalityModalVisible(false);
    } catch (err) {
      Alert.alert('Could not save personality', err.message);
    } finally {
      setSavingPersonality(false);
    }
  };

  const handleEditPhoto = async () => {
    if (!isOwnProfile || !user?.username) return;

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

    setUploadingPhoto(true);
    try {
      const response = await fetch(`${API_URL}/updateUserProfile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username,
          profilePhotoUrl: dataUri,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update photo');
      }
      setProfile((prev) => (prev ? { ...prev, profilePhotoUrl: dataUri } : prev));
    } catch (err) {
      Alert.alert('Could not update photo', err.message);
    } finally {
      setUploadingPhoto(false);
    }
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
                headers: { 'Content-Type': 'application/json' },
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
    if (!profile) {
      setProfile(getMockProfile());
      return null;
    }

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
  const topCuisines = personality?.top_cuisines || [];
  const favoriteIngredients = personality?.favorite_ingredients || [];
  const followers = profile?.followers || 0;
  const followingCount = profile?.following || 0;

  const personalityDescription = personality.primary_trait
    ? `${profile?.name || 'This user'}'s kitchen personality is a blend of ${personality.primary_trait.toLowerCase()}. ${
        personality.secondary_traits && personality.secondary_traits.length > 0
          ? `They love experimenting with ${personality.secondary_traits[0]?.toLowerCase() || 'bold flavors'} while also cherishing ${personality.secondary_traits[1]?.toLowerCase() || 'classic, heartwarming dishes'}.`
          : 'They enjoy experimenting with new flavors while also cherishing classic, heartwarming dishes.'
      }`
    : 'No personality data available yet.';

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
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
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={isOwnProfile ? handleEditPhoto : undefined}
            disabled={!isOwnProfile || uploadingPhoto}
            activeOpacity={isOwnProfile ? 0.8 : 1}
          >
            {uploadingPhoto ? (
              <View style={styles.avatarPlaceholder}>
                <ActivityIndicator color="#fff" size="large" />
              </View>
            ) : profile?.profilePhotoUrl ? (
              <Image source={{ uri: profile.profilePhotoUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarPlaceholderText}>
                  {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
                </Text>
              </View>
            )}
            {isOwnProfile && !uploadingPhoto ? (
              <View style={styles.avatarEditBadge}>
                <Ionicons name="camera" size={16} color="#fff" />
              </View>
            ) : null}
          </TouchableOpacity>
          {isOwnProfile ? (
            <TouchableOpacity onPress={handleEditPhoto} disabled={uploadingPhoto} activeOpacity={0.7}>
              <Text style={styles.editPhotoText}>
                {uploadingPhoto ? 'Uploading…' : 'Edit photo'}
              </Text>
            </TouchableOpacity>
          ) : null}
          <Text style={styles.userName}>{profile?.name || 'User'}</Text>
          <Text style={styles.username}>@{profile?.username || 'username'}</Text>
          <Text style={styles.joinedDate}>Joined {profile?.joinedDate || '2024'}</Text>

          {!isOwnProfile && (
            <TouchableOpacity
              style={[styles.followButton, following && styles.followingButton]}
              onPress={handleToggleFollow}
              activeOpacity={0.85}
            >
              <Text style={[styles.followButtonText, following && styles.followingButtonText]}>
                {following ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
          )}
        </LinearGradient>

        {isOwnProfile && (
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="bookmark" size={20} color={colors.accent} />
              <Text style={styles.sectionTitle}>Next Up</Text>
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
              <Text style={styles.portfolioHint}>Favorite up to 2</Text>
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
                  ? 'Tap Post to log your first meal — then favorite up to 2 for your portfolio!'
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
              {isOwnProfile ? (
                <View style={styles.allDishesSection}>
                  <Text style={styles.allDishesTitle}>All your dishes</Text>
                  <Text style={styles.allDishesHint}>
                    Tap the heart to showcase a dish on your portfolio (max {PORTFOLIO_FAVORITES_MAX}).
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.dishesRow}
                  >
                    {dishes.map((dish) => (
                      <DishCard
                        key={dish.id}
                        dish={dish}
                        onPress={() => openDish(dish)}
                        showFavorite
                        showDelete
                        isFavorited={favoriteIds.includes(dish.id)}
                        onToggleFavorite={() => togglePortfolioFavorite(dish.id)}
                        onDelete={() => handleDeleteDish(dish)}
                      />
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            </>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="flame" size={20} color={colors.secondary} />
            <Text style={styles.sectionTitle}>Kitchen Personality</Text>
            {isOwnProfile ? (
              <TouchableOpacity
                style={styles.editPersonalityButton}
                onPress={openPersonalityEditor}
                activeOpacity={0.7}
              >
                <Ionicons name="create-outline" size={16} color={colors.primary} />
                <Text style={styles.editPersonalityText}>Edit</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={styles.personalityCard}>
            <Text style={styles.personalityDescription}>{personalityDescription}</Text>
          </View>
        </View>

        {topCuisines.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top Cuisines</Text>
            <View style={styles.tagsContainer}>
              {topCuisines.map((cuisine, index) => (
                <Tag key={index} text={cuisine} variant="coral" />
              ))}
            </View>
          </View>
        )}

        {favoriteIngredients.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Favorite Ingredients</Text>
            <View style={styles.tagsContainer}>
              {favoriteIngredients.map((ingredient, index) => (
                <Tag key={index} text={ingredient} variant="teal" />
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cooking Stats</Text>
          <View style={styles.statsContainer}>
            <StatsCard label="Recipes Cooked" value={stats.total_recipes || 0} color={colors.primary} />
            <StatsCard
              label="Average Rating"
              value={stats.avg_rating ? Number(stats.avg_rating).toFixed(1) : '0.0'}
              color={colors.accent}
            />
          </View>
          <View style={[styles.statsContainer, styles.statsRowSpacing]}>
            <StatsCard label="Followers" value={followers} color={colors.secondary} />
            <StatsCard label="Following" value={followingCount} color={colors.chipAmberText} />
          </View>
        </View>

        {profile?.cookingFrequency && profile.cookingFrequency.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cooking Frequency</Text>
            <Text style={styles.subtitle}>Recipes Cooked Per Month</Text>
            <BarChart data={profile.cookingFrequency} />
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

      <BottomNavigation navigation={navigation} activeTab="Profile" />

      <PortfolioGalleryModal
        visible={galleryVisible}
        dishes={dishes}
        ownerName={profile?.name}
        onClose={() => setGalleryVisible(false)}
        onDishPress={(dish) => {
          setGalleryVisible(false);
          openDish(dish);
        }}
      />

      <Modal
        visible={personalityModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setPersonalityModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Kitchen Personality</Text>
              <TouchableOpacity
                onPress={() => setPersonalityModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalLabel}>Primary trait</Text>
              <TextInput
                style={styles.modalInput}
                value={editPrimaryTrait}
                onChangeText={setEditPrimaryTrait}
                placeholder="e.g. Adventurous Chef"
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

              <Text style={styles.modalLabel}>Top cuisines (comma-separated)</Text>
              <TextInput
                style={styles.modalInput}
                value={editTopCuisines}
                onChangeText={setEditTopCuisines}
                placeholder="Italian, Mexican, Thai"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.modalLabel}>Favorite ingredients (comma-separated)</Text>
              <TextInput
                style={styles.modalInput}
                value={editFavoriteIngredients}
                onChangeText={setEditFavoriteIngredients}
                placeholder="Garlic, Tomatoes, Basil"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.modalHint}>
                Auto-updates still refresh your cooking stats. Your custom traits and tags are preserved.
              </Text>
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalSaveButton, savingPersonality && styles.modalSaveButtonDisabled]}
              onPress={handleSavePersonality}
              disabled={savingPersonality}
              activeOpacity={0.85}
            >
              {savingPersonality ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.modalSaveButtonText}>Save personality</Text>
              )}
            </TouchableOpacity>
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
  avatarEditBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  editPhotoText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
    marginBottom: 10,
    textDecorationLine: 'underline',
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
    flexWrap: 'wrap',
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
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  personalityDescription: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
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
  editPersonalityButton: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  editPersonalityText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '85%',
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
  modalSaveButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  modalSaveButtonDisabled: {
    opacity: 0.7,
  },
  modalSaveButtonText: {
    color: '#fff',
    fontSize: 16,
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
