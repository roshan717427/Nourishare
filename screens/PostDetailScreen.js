import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useNextUp } from '../context/NextUpContext';
import { API_URL } from '../config/api';
import { colors, radii, shadows } from '../constants/theme';
import { toIngredientList } from '../utils/recipeParsing';

function postToNextUpRecipe(post, collection, postId) {
  const difficulty = post.difficulty
    ? `${post.difficulty}`.charAt(0).toUpperCase() + `${post.difficulty}`.slice(1)
    : null;
  const time = post.time || null;
  const subtitle = [difficulty, time].filter(Boolean).join(' · ') || 'From your feed';

  return {
    id: `${collection}:${postId}`,
    name: post.title || 'Recipe',
    subtitle,
    image: post.photoUrl || null,
    difficulty_level: post.difficulty || null,
    cooking_time: post.time || null,
    rating: post.rating ?? null,
    ingredients: post.ingredients || null,
    cooking_notes: post.description || null,
    steps: post.steps || null,
  };
}

export default function PostDetailScreen({ navigation, route }) {
  const { user } = useAuth();
  const { addToNextUp, isInNextUp } = useNextUp();
  const username = user?.username;

  const initialPost = route?.params?.post || {};
  const postId = route?.params?.postId || initialPost.id;
  const collection = route?.params?.collection || initialPost.postSource || 'logs';
  const fromFeed = !!route?.params?.fromFeed;

  const [post, setPost] = useState(initialPost);
  const [comments, setComments] = useState([]);
  const [likes, setLikes] = useState([]);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(initialPost.likes_count || 0);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!postId) {
      setLoading(false);
      return;
    }
    try {
      const url =
        `${API_URL}/social?action=postDetail&postId=${encodeURIComponent(postId)}` +
        `&collection=${encodeURIComponent(collection)}` +
        (username ? `&username=${encodeURIComponent(username)}` : '');
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.post) setPost(data.post);
        setComments(Array.isArray(data.comments) ? data.comments : []);
        setLikes(Array.isArray(data.likes) ? data.likes : []);
        setLiked(!!data.likedByMe);
        setLikesCount(
          typeof data.post?.likes_count === 'number'
            ? data.post.likes_count
            : (data.likes || []).length
        );
      }
    } catch (err) {
      console.log('Could not load post detail:', err.message);
    } finally {
      setLoading(false);
    }
  }, [postId, collection, username]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const toggleLike = async () => {
    if (!username || !postId) return;
    const willLike = !liked;
    setLiked(willLike);
    setLikesCount((c) => Math.max(0, c + (willLike ? 1 : -1)));
    setLikes((prev) =>
      willLike
        ? [...prev, { username, name: user?.name }]
        : prev.filter((l) => l.username !== username)
    );

    try {
      const res = await fetch(`${API_URL}/social?action=${willLike ? 'like' : 'unlike'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, postId, collection }),
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.likes_count === 'number') setLikesCount(data.likes_count);
      }
    } catch (err) {
      console.log('Like request failed:', err.message);
    }
  };

  const submitComment = async () => {
    const text = commentText.trim();
    if (!text) return;
    if (!username || !postId) {
      Alert.alert('Sign in required', 'You need to be logged in to comment.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/social?action=addComment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, postId, collection, text }),
      });
      if (res.ok) {
        const data = await res.json();
        const newComment =
          data.comment || { id: `${Date.now()}`, username, name: user?.name, text };
        setComments((prev) => [...prev, newComment]);
        setCommentText('');
      } else {
        throw new Error('Failed to add comment');
      }
    } catch (err) {
      Alert.alert('Could not post comment', 'Please try again in a moment.');
      console.log('Add comment failed:', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const authorUsername = post.user?.username || post.username || null;
  const authorName = post.user?.name || post.username || 'Someone';
  const isOwnPost = !!username && authorUsername === username && collection === 'logs';
  const ratingText =
    post.rating != null && post.rating !== '' ? `${post.rating}/5` : null;

  const metaChips = [
    post.difficulty ? { icon: 'speedometer-outline', text: post.difficulty, tint: colors.chipTeal, textColor: colors.chipTealText } : null,
    post.time ? { icon: 'time-outline', text: post.time, tint: colors.chipAmber, textColor: colors.chipAmberText } : null,
    ratingText ? { icon: 'star', text: ratingText, tint: colors.chipCoral, textColor: colors.chipCoralText } : null,
  ].filter(Boolean);

  const ingredients = toIngredientList(post.ingredients);

  const nextUpRecipe = postToNextUpRecipe(post, collection, postId);
  const inNextUp = fromFeed && username ? isInNextUp(nextUpRecipe.id) : false;
  const showRecook = fromFeed && !!username;

  const handleRecook = () => {
    if (isInNextUp(nextUpRecipe.id)) {
      Alert.alert('Already in Next Up', `"${nextUpRecipe.name}" is already on your list.`);
      return;
    }
    const added = addToNextUp(nextUpRecipe);
    if (added) {
      Alert.alert('Saved to Next Up', `"${nextUpRecipe.name}" is on your private cooking queue.`);
    }
  };

  const handleDeletePost = () => {
    if (!isOwnPost || !username || !postId) return;

    Alert.alert(
      'Delete dish?',
      `Remove "${post.title || 'this dish'}" from your logged meals? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${API_URL}/deleteRecipeLog`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, logId: postId }),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                throw new Error(data.error || 'Failed to delete');
              }
              navigation.goBack();
            } catch (err) {
              Alert.alert('Could not delete dish', err.message);
            }
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {post.title || 'Post'}
        </Text>
        {isOwnPost ? (
          <TouchableOpacity
            onPress={handleDeletePost}
            style={styles.backButton}
            accessibilityLabel="Delete dish"
          >
            <Ionicons name="trash-outline" size={22} color={colors.error} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backButton} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {post.photoUrl ? (
          <Image source={{ uri: post.photoUrl }} style={styles.photo} />
        ) : (
          <View style={[styles.photo, styles.photoPlaceholder]}>
            <Ionicons name="restaurant-outline" size={48} color={colors.textMuted} />
          </View>
        )}

        <View style={styles.body}>
          <Text style={styles.title}>{post.title}</Text>
          <Text style={styles.byline}>
            by{' '}
            {authorUsername ? (
              <Text
                style={styles.bylineLink}
                onPress={() => navigation.navigate('Profile', { username: authorUsername })}
              >
                {authorName}
              </Text>
            ) : (
              authorName
            )}
          </Text>

          {metaChips.length > 0 ? (
            <View style={styles.metaRow}>
              {metaChips.map((chip) => (
                <View key={chip.text} style={[styles.metaChip, { backgroundColor: chip.tint }]}>
                  <Ionicons name={chip.icon} size={14} color={chip.textColor} />
                  <Text style={[styles.metaChipText, { color: chip.textColor }]}>{chip.text}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {post.description ? (
            <Text style={styles.description}>{post.description}</Text>
          ) : null}

          {showRecook ? (
            <TouchableOpacity
              style={[styles.recookButton, inNextUp && styles.recookButtonActive, shadows.cardSoft]}
              onPress={handleRecook}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={inNextUp ? 'Already in Next Up' : 'Re-cook, add to Next Up'}
            >
              <Ionicons
                name={inNextUp ? 'checkmark-circle' : 'flame-outline'}
                size={22}
                color={inNextUp ? colors.primary : '#fff'}
              />
              <View style={styles.recookButtonTextWrap}>
                <Text style={[styles.recookButtonLabel, inNextUp && styles.recookButtonLabelActive]}>
                  {inNextUp ? 'In Next Up' : 'Re-cook'}
                </Text>
                {!inNextUp ? (
                  <Text style={styles.recookButtonHint}>Add to your private cooking queue</Text>
                ) : null}
              </View>
            </TouchableOpacity>
          ) : null}

          {ingredients.length > 0 ? (
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>Ingredients</Text>
              {ingredients.map((item, idx) => (
                <View key={`ing-${idx}`} style={styles.bulletRow}>
                  <View style={styles.bullet} />
                  <Text style={styles.bulletText}>{item}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.likeButton} onPress={toggleLike} activeOpacity={0.7}>
              <Ionicons
                name={liked ? 'heart' : 'heart-outline'}
                size={24}
                color={liked ? colors.like : colors.text}
              />
              <Text style={styles.likeCount}>{likesCount}</Text>
            </TouchableOpacity>
            <View style={styles.likeButton}>
              <Ionicons name="chatbubble" size={22} color={colors.accent} />
              <Text style={styles.likeCount}>{comments.length}</Text>
            </View>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
          ) : null}

          <Text style={styles.sectionTitle}>Liked by</Text>
          {likes.length === 0 ? (
            <Text style={styles.emptyText}>No likes yet. Be the first!</Text>
          ) : (
            <View style={styles.likedByWrap}>
              {likes.map((l) => (
                <View key={l.username} style={styles.likedChip}>
                  <View style={styles.likedAvatar}>
                    <Text style={styles.likedAvatarText}>
                      {(l.name || l.username || '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.likedName}>{l.name || l.username}</Text>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.sectionTitle}>Comments</Text>
          {comments.length === 0 ? (
            <Text style={styles.emptyText}>No comments yet. Start the conversation!</Text>
          ) : (
            comments.map((c) => (
              <View key={c.id} style={styles.comment}>
                <View style={styles.commentAvatar}>
                  <Text style={styles.commentAvatarText}>
                    {(c.name || c.username || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.commentBubble}>
                  <Text style={styles.commentAuthor}>{c.name || c.username}</Text>
                  <Text style={styles.commentText}>{c.text}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <View style={styles.commentBar}>
        <TextInput
          style={styles.commentInput}
          placeholder="Add a comment..."
          placeholderTextColor={colors.textMuted}
          value={commentText}
          onChangeText={setCommentText}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, (!commentText.trim() || submitting) && styles.sendButtonDisabled]}
          onPress={submitComment}
          disabled={!commentText.trim() || submitting}
          activeOpacity={0.7}
        >
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 14,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginHorizontal: 8,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  photo: {
    width: '100%',
    height: 260,
    backgroundColor: colors.borderLight,
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  byline: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 10,
  },
  bylineLink: {
    color: colors.primary,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.pill,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginRight: 8,
    marginBottom: 6,
  },
  metaChipText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 5,
  },
  description: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 23,
    marginBottom: 12,
  },
  recookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  recookButtonActive: {
    backgroundColor: colors.chipCoral,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  recookButtonTextWrap: {
    flex: 1,
  },
  recookButtonLabel: {
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.2,
  },
  recookButtonLabelActive: {
    color: colors.primary,
  },
  recookButtonHint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.88)',
    marginTop: 2,
    fontWeight: '500',
  },
  detailBlock: {
    marginTop: 4,
    marginBottom: 12,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bullet: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 7,
    marginRight: 10,
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 8,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
  },
  likeCount: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginLeft: 6,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginTop: 20,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textMuted,
  },
  likedByWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  likedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.chipCoral,
    borderRadius: radii.pill,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginRight: 8,
    marginBottom: 8,
  },
  likedAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  likedAvatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  likedName: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  comment: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.chipTeal,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  commentAvatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.chipTealText,
  },
  commentBubble: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  commentText: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 21,
  },
  commentBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  commentInput: {
    flex: 1,
    backgroundColor: colors.inputBg,
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    color: colors.text,
    maxHeight: 100,
    marginRight: 10,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
