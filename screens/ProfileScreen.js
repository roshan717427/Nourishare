import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import BottomNavigation from '../components/BottomNavigation';
import StatsCard from '../components/StatsCard';
import BarChart from '../components/BarChart';
import Tag from '../components/Tag';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import { colors, radii } from '../constants/theme';

function DishCard({ dish, onPress }) {
  return (
    <TouchableOpacity style={styles.dishCard} onPress={onPress} activeOpacity={0.85}>
      {dish.photoUrl ? (
        <Image source={{ uri: dish.photoUrl }} style={styles.dishImage} />
      ) : (
        <View style={[styles.dishImage, styles.dishImagePlaceholder]}>
          <Ionicons name="restaurant-outline" size={24} color={colors.textMuted} />
        </View>
      )}
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
  const { user, isFollowing, follow, unfollow } = useAuth();
  const [profile, setProfile] = useState(null);
  const [dishes, setDishes] = useState([]);
  const [dishesLoading, setDishesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  const dishesSectionTitle = isOwnProfile ? 'My Dishes' : 'Recipes Cooked';

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

        {/* My Dishes / Recipes Cooked */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="restaurant" size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>{dishesSectionTitle}</Text>
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
                  ? 'Tap Post to log your first meal — it will appear here!'
                  : `${profile?.name || 'This user'} hasn't logged any meals yet.`}
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dishesRow}
            >
              {dishes.map((dish) => (
                <DishCard key={dish.id} dish={dish} onPress={() => openDish(dish)} />
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="flame" size={20} color={colors.secondary} />
            <Text style={styles.sectionTitle}>Kitchen Personality</Text>
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
      </ScrollView>

      <BottomNavigation navigation={navigation} activeTab="Profile" />
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
    marginBottom: 14,
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
});
