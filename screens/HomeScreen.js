import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import BottomNavigation from '../components/BottomNavigation';
import MunchableHeader from '../components/MunchableHeader';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import CookedWithTags from '../components/CookedWithTags';
import { colors, radii } from '../constants/theme';

const CARD_ACCENTS = [colors.primary, colors.accent, colors.secondary, colors.chipAmberText];

function timeAgo(ms) {
  if (!ms) return '';
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w`;
}

function StoryAvatar({ name, avatar, index, selected, hasSelection, onPress }) {
  const accent = CARD_ACCENTS[index % CARD_ACCENTS.length];
  const ringColor = selected
    ? colors.primary
    : hasSelection
      ? colors.textMuted
      : accent;
  const ringWidth = selected ? 3 : 2.5;

  return (
    <TouchableOpacity style={styles.story} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.storyRing, { borderColor: ringColor, borderWidth: ringWidth }]}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.storyAvatar} />
        ) : (
          <View style={[styles.storyAvatar, styles.storyAvatarPlaceholder]}>
            <Text style={styles.storyAvatarText}>
              {(name || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>
      <Text
        style={[styles.storyName, selected && styles.storyNameSelected]}
        numberOfLines={1}
      >
        {name}
      </Text>
    </TouchableOpacity>
  );
}

function FeedCard({ item, onPress, onPressUser, accentColor }) {
  const authorName = item.user?.name || item.user?.username || item.username || 'Someone';
  const ratingText =
    item.rating != null && item.rating !== '' ? ` · rated ${item.rating}/5` : '';
  const description =
    item.description || `${authorName} cooked ${item.title}${ratingText}`;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.cardAccent, { backgroundColor: accentColor }]} />
      <View style={styles.cardText}>
        <Text style={styles.cardTime}>{timeAgo(item.created_at_ms)}</Text>
        <Text style={styles.cardTitle}>
          {authorName} cooked {item.title}
        </Text>
        <CookedWithTags
          usernames={item.cookedWith}
          onPressUser={onPressUser}
          compact
        />
        <Text style={styles.cardDescription} numberOfLines={3}>
          {description}
        </Text>

        <View style={styles.cardActions}>
          <View style={styles.actionItem}>
            <Ionicons name="heart" size={18} color={colors.like} />
            <Text style={styles.actionCount}>{item.likes_count || 0}</Text>
          </View>
          <View style={styles.actionItem}>
            <Ionicons name="chatbubble" size={16} color={colors.accent} />
            <Text style={styles.actionCount}>{item.comments_count || 0}</Text>
          </View>
        </View>
      </View>
      {item.photoUrl ? (
        <Image source={{ uri: item.photoUrl }} style={styles.cardImage} />
      ) : (
        <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
          <Ionicons name="restaurant-outline" size={28} color={colors.textMuted} />
        </View>
      )}
    </TouchableOpacity>
  );
}

function EmptyFeed() {
  return (
    <View style={styles.emptyState}>
      <LinearGradient
        colors={[colors.chipCoral, colors.chipAmber]}
        style={styles.emptyIconCircle}
      >
        <Ionicons name="people" size={40} color={colors.primary} />
      </LinearGradient>
      <Text style={styles.emptyTitle}>Your feed is empty</Text>
      <Text style={styles.emptySubtitle}>
        Follow friends to see the recipes they're cooking. Their latest dishes
        will show up right here.
      </Text>
    </View>
  );
}

export default function HomeScreen({ navigation }) {
  const { user, following } = useAuth();
  const username = user?.username;

  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStoryUsername, setSelectedStoryUsername] = useState(null);

  const feedScrollRef = useRef(null);
  const postOffsetsRef = useRef({});

  const hasFollowing = following.length > 0;

  const loadFeed = useCallback(
    async (isRefresh = false) => {
      if (!username || following.length === 0) {
        setFeed([]);
        return;
      }
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const res = await fetch(
          `${API_URL}/social?action=feed&username=${encodeURIComponent(username)}`,
          { method: 'GET', headers: { 'Content-Type': 'application/json' } }
        );
        let apiPosts = [];
        if (res.ok) {
          const data = await res.json();
          apiPosts = Array.isArray(data.recipe_posts) ? data.recipe_posts : [];
        }
        setFeed(apiPosts);
      } catch (err) {
        console.log('Feed unavailable:', err.message);
        setFeed([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [username, following]
  );

  useFocusEffect(
    useCallback(() => {
      loadFeed();
    }, [loadFeed])
  );

  const openPost = (item) => {
    navigation.navigate('PostDetail', {
      postId: item.id,
      collection: item.postSource || 'logs',
      post: item,
      fromFeed: true,
    });
  };

  const storyByUser = new Map();
  following.forEach((u) => {
    storyByUser.set(u, {
      username: u,
      name: u,
      avatar: null,
      latestPostMs: 0,
    });
  });
  feed.forEach((item) => {
    const u = item.user?.username || item.username;
    if (!u) return;
    const postMs = item.created_at_ms || 0;
    const existing = storyByUser.get(u) || {
      username: u,
      name: u,
      avatar: null,
      latestPostMs: 0,
    };
    if (postMs >= existing.latestPostMs) {
      storyByUser.set(u, {
        username: u,
        name: item.user?.name || existing.name || u,
        avatar: item.user?.profilePhotoUrl || existing.avatar,
        latestPostMs: postMs,
      });
    }
  });
  const stories = Array.from(storyByUser.values()).sort(
    (a, b) => b.latestPostMs - a.latestPostMs
  );

  const mostRecentPostKeyByUser = useMemo(() => {
    const map = new Map();
    feed.forEach((item) => {
      const u = item.user?.username || item.username;
      if (!u) return;
      const postMs = item.created_at_ms || 0;
      const key = `${item.postSource}:${item.id}`;
      const existing = map.get(u);
      if (!existing || postMs > existing.ms) {
        map.set(u, { key, ms: postMs });
      }
    });
    return map;
  }, [feed]);

  const handleStoryPress = (story) => {
    if (selectedStoryUsername === story.username) {
      setSelectedStoryUsername(null);
      return;
    }

    const postInfo = mostRecentPostKeyByUser.get(story.username);
    if (!postInfo) {
      Alert.alert('No posts yet', `No posts yet from ${story.name}`);
      return;
    }

    const scrollToPost = () => {
      const y = postOffsetsRef.current[postInfo.key];
      if (y == null) {
        Alert.alert('No posts yet', `No posts yet from ${story.name}`);
        return;
      }
      setSelectedStoryUsername(story.username);
      feedScrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
    };

    if (postOffsetsRef.current[postInfo.key] == null) {
      requestAnimationFrame(scrollToPost);
    } else {
      scrollToPost();
    }
  };

  const showEmpty = !hasFollowing || (!loading && feed.length === 0);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <MunchableHeader
        rightAction={
          <TouchableOpacity
            onPress={() => navigation.navigate('LogMeal')}
            activeOpacity={0.7}
          >
            <View style={styles.addButton}>
              <Ionicons name="add" size={24} color={colors.primary} />
            </View>
          </TouchableOpacity>
        }
      />

      {showEmpty ? (
        <EmptyFeed />
      ) : (
        <View style={styles.feedContainer}>
          {stories.length > 0 ? (
            <View style={styles.storiesBar}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.storiesRow}
              >
                {stories.map((s, i) => (
                  <StoryAvatar
                    key={s.username}
                    name={s.name}
                    avatar={s.avatar}
                    index={i}
                    selected={selectedStoryUsername === s.username}
                    hasSelection={selectedStoryUsername != null}
                    onPress={() => handleStoryPress(s)}
                  />
                ))}
              </ScrollView>
            </View>
          ) : null}

          <ScrollView
            ref={feedScrollRef}
            style={styles.feedScroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => loadFeed(true)} tintColor={colors.primary} />
            }
          >
            {loading && feed.length === 0 ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
            ) : null}

            {feed.map((item, index) => {
            const postKey = `${item.postSource}:${item.id}`;
            return (
              <View
                key={postKey}
                onLayout={(e) => {
                  postOffsetsRef.current[postKey] = e.nativeEvent.layout.y;
                }}
              >
                <FeedCard
                  item={item}
                  accentColor={CARD_ACCENTS[index % CARD_ACCENTS.length]}
                  onPress={() => openPost(item)}
                  onPressUser={(targetUsername) =>
                    navigation.navigate('Profile', { username: targetUsername })
                  }
                />
              </View>
            );
            })}
          </ScrollView>
        </View>
      )}

      <BottomNavigation navigation={navigation} activeTab="Home" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedContainer: {
    flex: 1,
  },
  storiesBar: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    zIndex: 2,
  },
  feedScroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  storiesRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  story: {
    alignItems: 'center',
    width: 72,
    marginRight: 8,
  },
  storyRing: {
    borderWidth: 2.5,
    borderRadius: 36,
    padding: 2,
    marginBottom: 6,
  },
  storyAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.borderLight,
  },
  storyAvatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.chipCoral,
  },
  storyAvatarText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary,
  },
  storyName: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '500',
  },
  storyNameSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  card: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardAccent: {
    width: 4,
  },
  cardText: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  cardTime: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
    fontWeight: '500',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  actionCount: {
    fontSize: 14,
    color: colors.text,
    marginLeft: 5,
    fontWeight: '600',
  },
  cardImage: {
    width: 100,
    height: '100%',
    minHeight: 110,
    backgroundColor: colors.borderLight,
  },
  cardImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
