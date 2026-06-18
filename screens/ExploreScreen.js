import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  Platform,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import BottomNavigation from '../components/BottomNavigation';
import { colors, spacing, radii } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { hasProfileData } from '../utils/recommendFollows';
import { API_URL } from '../config/api';
import { withAuthHeaders } from '../utils/apiAuth';

function UserRow({ user, onPress }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.6}>
      {user.profilePhotoUrl ? (
        <Image source={{ uri: user.profilePhotoUrl }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarPlaceholderText}>
            {user.name?.charAt(0)?.toUpperCase() || 'U'}
          </Text>
        </View>
      )}
      <View style={styles.rowText}>
        <Text style={styles.rowName}>{user.name || user.username}</Text>
        <Text style={styles.rowUsername}>@{user.username}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.navInactive} />
    </TouchableOpacity>
  );
}

function RecommendCard({ user, following, onPressProfile, onToggleFollow }) {
  return (
    <View style={styles.recCard}>
      <TouchableOpacity
        style={styles.recCardMain}
        onPress={onPressProfile}
        activeOpacity={0.6}
      >
        {user.profilePhotoUrl ? (
          <Image source={{ uri: user.profilePhotoUrl }} style={styles.recAvatar} />
        ) : (
          <View style={styles.recAvatarPlaceholder}>
            <Text style={styles.recAvatarText}>
              {user.name?.charAt(0)?.toUpperCase() || 'U'}
            </Text>
          </View>
        )}
        <View style={styles.recText}>
          <Text style={styles.recName} numberOfLines={1}>
            {user.name || user.username}
          </Text>
          <Text style={styles.recUsername} numberOfLines={1}>
            @{user.username}
          </Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.recFollowBtn, following && styles.recFollowingBtn]}
        onPress={onToggleFollow}
        activeOpacity={0.7}
      >
        <Text style={[styles.recFollowText, following && styles.recFollowingText]}>
          {following ? 'Following' : 'Follow'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}


export default function ExploreScreen({ navigation }) {
  const { user, following, follow, unfollow, isFollowing } = useAuth();
  const followingRef = useRef(following);
  followingRef.current = following;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [hasProfile, setHasProfile] = useState(false);
  const [recsLoading, setRecsLoading] = useState(false);

  const runSearch = async (text) => {
    const trimmed = text.trim();
    setSearched(true);

    if (!trimmed) {
      setResults([]);
      return;
    }

    const merged = [];

    try {
      const response = await fetch(
        `${API_URL}/social?action=searchUsers&q=${encodeURIComponent(trimmed)}`,
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );
      if (response.ok) {
        const data = await response.json();
        const remoteUsers = Array.isArray(data?.users) ? data.users : [];
        remoteUsers.forEach((u) => {
          if (u && u.username) {
            merged.push(u);
          }
        });
      }
    } catch (err) {
      console.log('User search API unavailable:', err.message);
    }

    setResults(merged);
  };

  const handleChange = (text) => {
    setQuery(text);
    runSearch(text);
  };

  const openProfile = (result) => {
    Keyboard.dismiss();
    navigation.navigate('Profile', { username: result.username, profile: result });
  };

  const loadRecommendations = useCallback(async () => {
    const username = user?.username;
    if (!username) {
      setRecommendations([]);
      setHasProfile(false);
      setRecsLoading(false);
      return;
    }

    setRecsLoading(true);
    let remoteRecs = [];
    let userProfile = null;
    let profileReady = false;

    try {
      const recResponse = await fetch(
        `${API_URL}/social?action=recommendedFollows&username=${encodeURIComponent(username)}`,
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );
      if (recResponse.ok) {
        const data = await recResponse.json();
        if (data?.hasProfile === false) {
          setHasProfile(false);
          setRecommendations([]);
          setRecsLoading(false);
          return;
        }
        profileReady = true;
        remoteRecs = Array.isArray(data?.recommendations) ? data.recommendations : [];
      }
    } catch (err) {
      console.log('Recommended follows API unavailable:', err.message);
    }

    try {
      const profileResponse = await fetch(
        `${API_URL}/getUserProfile?username=${encodeURIComponent(username)}`,
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );
      if (profileResponse.ok) {
        userProfile = await profileResponse.json();
        if (!profileReady) {
          profileReady = hasProfileData(userProfile);
        }
      }
    } catch (err) {
      console.log('Profile fetch unavailable for recommendations:', err.message);
    }

    setHasProfile(profileReady);

    if (!profileReady) {
      setRecommendations([]);
      setRecsLoading(false);
      return;
    }

    setRecommendations(remoteRecs);
    setRecsLoading(false);
  }, [user?.username]);

  useFocusEffect(
    useCallback(() => {
      loadRecommendations();
    }, [loadRecommendations])
  );

  const handleToggleFollow = (targetUsername) => {
    const follower = user?.username;
    if (!follower || !targetUsername) return;

    const alreadyFollowing = isFollowing(targetUsername);
    if (alreadyFollowing) {
      unfollow(targetUsername);
    } else {
      follow(targetUsername);
    }

    const action = alreadyFollowing ? 'unfollow' : 'follow';
    withAuthHeaders().then((headers) =>
      fetch(`${API_URL}/social?action=${action}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ username: follower, targetUsername }),
      })
    ).catch((err) => {
      console.log(`${action} request error:`, err.message);
    });
  };

  const showRecommendations = query.trim().length === 0;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Explore</Text>
        {user?.username ? (
          <Text style={styles.myHandle}>@{user.username}</Text>
        ) : null}
      </View>

      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search people by username"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={handleChange}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 ? (
            <TouchableOpacity onPress={() => handleChange('')} activeOpacity={0.6}>
              <Ionicons name="close-circle" size={18} color={colors.navInactive} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {showRecommendations ? (
          <View style={styles.recommendSection}>
            <Text style={styles.sectionTitle}>Recommended Follows</Text>

            {recsLoading ? (
              <ActivityIndicator
                size="small"
                color={colors.primary}
                style={styles.recsLoader}
              />
            ) : null}

            {!recsLoading && user?.username && !hasProfile ? (
              <Text style={styles.recommendEmpty}>
                Log meals and build your profile to get recommendations
              </Text>
            ) : null}

            {!recsLoading && user?.username && hasProfile && recommendations.length === 0 ? (
              <Text style={styles.recommendEmpty}>
                No recommendations yet. Try searching by username
              </Text>
            ) : null}

            {!recsLoading
              ? recommendations.map((rec) => (
                  <RecommendCard
                    key={rec.username}
                    user={rec}
                    following={isFollowing(rec.username)}
                    onPressProfile={() => openProfile(rec)}
                    onToggleFollow={() => handleToggleFollow(rec.username)}
                  />
                ))
              : null}
          </View>
        ) : null}

        {results.map((u) => (
          <UserRow key={u.username} user={u} onPress={() => openProfile(u)} />
        ))}

        {searched && query.trim().length > 0 && results.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="person-outline" size={36} color={colors.navInactive} />
            <Text style={styles.emptyText}>No one found matching "{query.trim()}"</Text>
          </View>
        ) : null}

        {showRecommendations && !recsLoading && recommendations.length === 0 ? (
          <View style={styles.hint}>
            <Ionicons name="search-outline" size={36} color={colors.navInactive} />
            <Text style={styles.hintText}>
              Find friends by username to see what they cook, explore their kitchen
              personality, and follow along.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <BottomNavigation navigation={navigation} activeTab="Explore" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md + 4,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: spacing.sm,
    backgroundColor: colors.card,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  myHandle: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '600',
  },
  searchSection: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md + 4,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    marginLeft: spacing.sm,
  },
  scrollContent: {
    paddingBottom: spacing.lg,
  },
  recommendSection: {
    paddingHorizontal: spacing.md + 4,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.md,
  },
  recsLoader: {
    marginVertical: spacing.md,
  },
  recommendEmpty: {
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  recCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm + 4,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  recCardMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  recAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.inputBg,
  },
  recAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.chipCoral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recAvatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.chipCoralText,
  },
  recText: {
    flex: 1,
    marginLeft: spacing.sm + 4,
  },
  recName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  recUsername: {
    fontSize: 13,
    color: colors.textMuted,
  },
  recFollowBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    minWidth: 88,
    alignItems: 'center',
  },
  recFollowingBtn: {
    backgroundColor: colors.cardWarm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recFollowText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  recFollowingText: {
    color: colors.textSecondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md + 4,
    paddingVertical: spacing.sm + 4,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.inputBg,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textMuted,
  },
  rowText: {
    flex: 1,
    marginLeft: 14,
  },
  rowName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  rowUsername: {
    fontSize: 14,
    color: colors.textMuted,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: spacing.xl + spacing.md,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textMuted,
    marginTop: spacing.sm + 4,
    textAlign: 'center',
  },
  hint: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingHorizontal: 48,
  },
  hintText: {
    fontSize: 15,
    color: colors.textMuted,
    marginTop: spacing.sm + 4,
    textAlign: 'center',
    lineHeight: 22,
  },
});
