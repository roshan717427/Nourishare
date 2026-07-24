import React, { useState, useCallback, useMemo, useRef } from 'react';
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
  Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useNextUp } from '../context/NextUpContext';
import { API_URL } from '../config/api';
import { withAuthHeaders } from '../utils/apiAuth';
import { friendlyError, friendlyErrorForResponse, httpError } from '../utils/errorMessages';
import { colors, radii, shadows } from '../constants/theme';
import { toIngredientList } from '../utils/recipeParsing';
import RecipeSection, { hasRecipeContent } from '../components/RecipeSection';
import CookedWithTags from '../components/CookedWithTags';
import { SafetyMenuButton } from '../components/SafetyMenuButton';
import { emitFeedPostUpdated } from '../utils/feedEvents';

function generateClientId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
}

function likerName(l) {
  return l.name || l.username || 'Someone';
}

// Instagram-style summary: shows up to three names then "and N others".
function buildLikedBySummary(likes) {
  const names = likes.map(likerName);
  if (names.length === 1) return `Liked by ${names[0]}`;
  if (names.length === 2) return `Liked by ${names[0]} and ${names[1]}`;
  if (names.length === 3) return `Liked by ${names[0]}, ${names[1]} and ${names[2]}`;
  const shown = names.slice(0, 3).join(', ');
  const others = names.length - 3;
  return `Liked by ${shown} and ${others} ${others === 1 ? 'other' : 'others'}`;
}

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
    recipe_link: post.recipeLink || null,
    recipe_instructions: post.recipeInstructions || null,
  };
}

export default function PostDetailScreen({ navigation, route }) {
  const { user, isFollowing } = useAuth();
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
  const [likesModalVisible, setLikesModalVisible] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const commentInputRef = useRef(null);
  // Stable per-draft key so retrying a failed submit (without editing the
  // text) reuses the same request instead of risking a duplicate comment.
  const pendingCommentIdRef = useRef(null);

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
      const res = await fetch(url, { headers: await withAuthHeaders() });
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
        setLoadError(null);
      } else {
        setLoadError(
          friendlyErrorForResponse(res, {
            overrides: {
              403: 'You need to follow this user to view this post.',
              404: 'This post is no longer available.',
            },
            fallback: 'We couldn\u2019t load this post. Please try again.',
          })
        );
      }
    } catch (err) {
      console.log('Could not load post detail:', err.message);
      setLoadError(friendlyError(err, { fallback: 'We couldn\u2019t load this post. Please try again.' }));
    } finally {
      setLoading(false);
    }
  }, [postId, collection, username]);

  useFocusEffect(
    useCallback(() => {
      loadDetail();
    }, [loadDetail])
  );

  const toggleLike = async () => {
    if (!username || !postId || !canInteract) return;
    const willLike = !liked;
    const nextCount = Math.max(0, likesCount + (willLike ? 1 : -1));
    setLiked(willLike);
    setLikesCount(nextCount);
    setLikes((prev) =>
      willLike
        ? [...prev, { username, name: user?.name }]
        : prev.filter((l) => l.username !== username)
    );
    // Keep Home feed cards in sync when user navigates back.
    emitFeedPostUpdated({ postId, collection, likes_count: nextCount });

    try {
      const res = await fetch(`${API_URL}/social?action=${willLike ? 'like' : 'unlike'}`, {
        method: 'POST',
        headers: await withAuthHeaders(),
        body: JSON.stringify({ username, postId, collection }),
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.likes_count === 'number') {
          setLikesCount(data.likes_count);
          emitFeedPostUpdated({ postId, collection, likes_count: data.likes_count });
        }
      }
    } catch (err) {
      console.log('Like request failed:', err.message);
    }
  };

  const toggleCommentLike = async (commentId) => {
    if (!username || !postId || !commentId || !canInteract) return;

    let willLike = false;
    setComments((prev) =>
      prev.map((c) => {
        if (c.id !== commentId) return c;
        willLike = !c.likedByMe;
        return {
          ...c,
          likedByMe: willLike,
          likes_count: Math.max(0, (c.likes_count || 0) + (willLike ? 1 : -1)),
        };
      })
    );

    try {
      const res = await fetch(
        `${API_URL}/social?action=${willLike ? 'likeComment' : 'unlikeComment'}`,
        {
          method: 'POST',
          headers: await withAuthHeaders(),
          body: JSON.stringify({ username, postId, commentId }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (typeof data.likes_count === 'number') {
          setComments((prev) =>
            prev.map((c) =>
              c.id === commentId
                ? { ...c, likes_count: data.likes_count, likedByMe: !!data.likedByMe }
                : c
            )
          );
        }
      }
    } catch (err) {
      console.log('Comment like request failed:', err.message);
    }
  };

  const startReply = (comment) => {
    if (!canInteract) return;
    pendingCommentIdRef.current = null;
    setReplyingTo({ id: comment.id, name: comment.name || comment.username });
    commentInputRef.current?.focus();
  };

  const cancelReply = () => {
    pendingCommentIdRef.current = null;
    setReplyingTo(null);
  };

  const submitComment = async () => {
    const text = commentText.trim();
    if (!text) return;
    if (!username || !postId) {
      Alert.alert('Sign in required', 'You need to be logged in to comment.');
      return;
    }
    if (!canInteract) return;
    const parentId = replyingTo?.id || null;
    if (!pendingCommentIdRef.current) {
      pendingCommentIdRef.current = generateClientId();
    }
    const clientId = pendingCommentIdRef.current;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/social?action=addComment`, {
        method: 'POST',
        headers: await withAuthHeaders(),
        body: JSON.stringify({ username, postId, collection, text, parentId, clientId }),
      });
      if (res.ok) {
        const data = await res.json();
        const newComment =
          data.comment || {
            id: `${Date.now()}`,
            username,
            name: user?.name,
            text,
            parentId,
            likes_count: 0,
            likedByMe: false,
          };
        setComments((prev) => [...prev, newComment]);
        setCommentText('');
        setReplyingTo(null);
        pendingCommentIdRef.current = null;
      } else {
        const data = await res.json().catch(() => ({}));
        throw httpError(res, data);
      }
    } catch (err) {
      Alert.alert(
        'Could not post comment',
        friendlyError(err, {
          overrides: { 403: 'You need to follow this user to comment on their posts.' },
          fallback: 'Please try again in a moment.',
        })
      );
      console.log('Add comment failed:', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = (commentId) => {
    if (!username || !postId || !commentId) return;

    Alert.alert(
      'Delete comment?',
      'Remove this comment? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${API_URL}/social?action=deleteComment`, {
                method: 'POST',
                headers: await withAuthHeaders(),
                body: JSON.stringify({ username, postId, commentId, collection }),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                throw httpError(res, data);
              }
              setComments((prev) => prev.filter((c) => c.id !== commentId));
            } catch (err) {
              Alert.alert(
                'Could not delete comment',
                friendlyError(err, { fallback: 'We couldn\u2019t delete this comment. Please try again.' })
              );
            }
          },
        },
      ]
    );
  };

  const threadedComments = useMemo(() => {
    const repliesByParent = {};
    const topLevel = [];
    comments.forEach((c) => {
      if (c.parentId) {
        (repliesByParent[c.parentId] = repliesByParent[c.parentId] || []).push(c);
      } else {
        topLevel.push(c);
      }
    });
    const byTime = (a, b) => (a.timestamp || 0) - (b.timestamp || 0);
    topLevel.sort(byTime);
    return topLevel.map((c) => ({
      ...c,
      replies: (repliesByParent[c.id] || []).sort(byTime),
    }));
  }, [comments]);

  const authorUsername = post.user?.username || post.username || null;
  const authorName = post.user?.name || post.username || 'Someone';
  const isOwnPost = !!username && authorUsername === username && collection === 'logs';
  const canInteract =
    isOwnPost || (!!username && !!authorUsername && isFollowing(authorUsername));
  const ratingText =
    post.rating != null && post.rating !== '' ? `${post.rating}/5` : null;

  const metaChips = [
    post.dishType
      ? {
          icon: 'restaurant-outline',
          text: post.dishType.charAt(0).toUpperCase() + post.dishType.slice(1),
          tint: colors.chipBlue,
          textColor: colors.chipBlueText,
        }
      : null,
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
      Alert.alert('Already in Cook Next', `"${nextUpRecipe.name}" is already on your list.`);
      return;
    }
    const added = addToNextUp(nextUpRecipe);
    if (added) {
      Alert.alert('Saved to Cook Next', `"${nextUpRecipe.name}" is on your private cooking queue.`);
      // Best-effort: let the recipe's author know it was re-cooked. Never block
      // or fail the recook itself on this notification request.
      if (username && postId && !isOwnPost) {
        (async () => {
          try {
            await fetch(`${API_URL}/social?action=recook`, {
              method: 'POST',
              headers: await withAuthHeaders(),
              body: JSON.stringify({ username, postId, collection }),
            });
          } catch (err) {
            console.log('Recook notify failed:', err.message);
          }
        })();
      }
    }
  };

  const handleEditPost = () => {
    if (!isOwnPost || !postId) return;
    navigation.navigate('LogMeal', {
      editPostId: postId,
      editPost: post,
    });
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
              const res = await fetch(`${API_URL}/recipeLog?action=delete`, {
                method: 'POST',
                headers: await withAuthHeaders(),
                body: JSON.stringify({ username, logId: postId }),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                throw httpError(res, data);
              }
              navigation.goBack();
            } catch (err) {
              Alert.alert(
                'Could not delete dish',
                friendlyError(err, { fallback: 'We couldn\u2019t delete this dish. Please try again.' })
              );
            }
          },
        },
      ]
    );
  };

  const renderComment = (c, isReply = false) => (
    <View key={c.id} style={[styles.comment, isReply && styles.replyComment]}>
      <View style={[styles.commentAvatar, isReply && styles.replyAvatar]}>
        <Text style={[styles.commentAvatarText, isReply && styles.replyAvatarText]}>
          {(c.name || c.username || '?').charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.commentMain}>
        <View style={styles.commentBubble}>
          <View style={styles.commentHeader}>
            <Text style={styles.commentAuthor}>{c.name || c.username}</Text>
            {username && c.username === username ? (
              <TouchableOpacity
                onPress={() => handleDeleteComment(c.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Delete comment"
              >
                <Ionicons name="trash-outline" size={16} color={colors.error} />
              </TouchableOpacity>
            ) : (
              <SafetyMenuButton
                viewerUsername={username}
                targetUsername={c.username}
                targetType="comment"
                targetId={c.id}
                size={16}
              />
            )}
          </View>
          <Text style={styles.commentText}>{c.text}</Text>
        </View>
        {canInteract ? (
          <View style={styles.commentActions}>
            <TouchableOpacity
              style={styles.commentActionButton}
              onPress={() => toggleCommentLike(c.id)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              activeOpacity={0.7}
              accessibilityLabel={c.likedByMe ? 'Unlike comment' : 'Like comment'}
            >
              <Ionicons
                name={c.likedByMe ? 'heart' : 'heart-outline'}
                size={16}
                color={c.likedByMe ? colors.like : colors.textMuted}
              />
              {c.likes_count > 0 ? (
                <Text style={[styles.commentActionText, c.likedByMe && styles.commentActionTextActive]}>
                  {c.likes_count}
                </Text>
              ) : null}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.commentActionButton}
              onPress={() => startReply(c)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              activeOpacity={0.7}
              accessibilityLabel="Reply to comment"
            >
              <Ionicons name="arrow-undo-outline" size={15} color={colors.textMuted} />
              <Text style={styles.commentActionText}>Reply</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </View>
  );

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
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={handleEditPost}
              style={styles.backButton}
              accessibilityLabel="Edit dish"
            >
              <Ionicons name="pencil-outline" size={22} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleDeletePost}
              style={styles.backButton}
              accessibilityLabel="Delete dish"
            >
              <Ionicons name="trash-outline" size={22} color={colors.error} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.headerActions}>
            <SafetyMenuButton
              viewerUsername={username}
              targetUsername={authorUsername}
              targetType="post"
              targetId={postId}
              size={22}
              color={colors.text}
            />
          </View>
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
          {loadError ? (
            <View style={styles.loadErrorBanner}>
              <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.loadErrorText}>{loadError}</Text>
            </View>
          ) : null}
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

          <CookedWithTags
            usernames={post.cookedWith}
            onPressUser={(targetUsername) =>
              navigation.navigate('Profile', { username: targetUsername })
            }
          />

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
              accessibilityLabel={inNextUp ? 'Already in Cook Next' : 'Re-cook, add to Cook Next'}
            >
              <Ionicons
                name={inNextUp ? 'checkmark-circle' : 'flame-outline'}
                size={18}
                color={inNextUp ? colors.primary : '#fff'}
              />
              <View style={styles.recookButtonTextWrap}>
                <Text style={[styles.recookButtonLabel, inNextUp && styles.recookButtonLabelActive]}>
                  {inNextUp ? 'In Cook Next' : 'Re-cook'}
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

          {hasRecipeContent(post) ? <RecipeSection recipe={post} /> : null}

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.likeButton}
              onPress={toggleLike}
              activeOpacity={0.7}
              disabled={!canInteract}
            >
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

          {likes.length === 0 ? (
            <>
              <Text style={styles.sectionTitle}>Liked by</Text>
              <Text style={styles.emptyText}>No likes yet. Be the first!</Text>
            </>
          ) : (
            <TouchableOpacity
              style={styles.likedSummaryRow}
              onPress={() => setLikesModalVisible(true)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="See everyone who liked this"
            >
              <Text style={styles.likedSummaryText}>{buildLikedBySummary(likes)}</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.sectionTitle}>Comments</Text>
          {threadedComments.length === 0 ? (
            <Text style={styles.emptyText}>No comments yet. Start the conversation!</Text>
          ) : (
            threadedComments.map((c) => (
              <View key={c.id}>
                {renderComment(c, false)}
                {c.replies.length > 0 ? (
                  <View style={styles.replyThread}>
                    {c.replies.map((r) => renderComment(r, true))}
                  </View>
                ) : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {replyingTo ? (
        <View style={styles.replyingBanner}>
          <Ionicons name="arrow-undo-outline" size={15} color={colors.primary} />
          <Text style={styles.replyingText} numberOfLines={1}>
            Replying to <Text style={styles.replyingName}>{replyingTo.name}</Text>
          </Text>
          <TouchableOpacity
            onPress={cancelReply}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Cancel reply"
          >
            <Ionicons name="close" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      ) : null}

      {canInteract ? (
        <View style={styles.commentBar}>
          <TextInput
            ref={commentInputRef}
            style={styles.commentInput}
            placeholder={replyingTo ? `Reply to ${replyingTo.name}...` : 'Add a comment...'}
            placeholderTextColor={colors.textMuted}
            value={commentText}
            onChangeText={(value) => {
              pendingCommentIdRef.current = null;
              setCommentText(value);
            }}
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
      ) : (
        <View style={styles.lockedCommentBar}>
          <Ionicons name="lock-closed" size={16} color={colors.textMuted} />
          <Text style={styles.lockedCommentText} numberOfLines={1}>
            Follow {authorName} to like and comment.
          </Text>
        </View>
      )}

      <Modal
        visible={likesModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLikesModalVisible(false)}
      >
        <View style={styles.likesModalOverlay}>
          <View style={styles.likesModalCard}>
            <View style={styles.likesModalHeader}>
              <Text style={styles.likesModalTitle}>Likes</Text>
              <TouchableOpacity
                onPress={() => setLikesModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Close likes list"
              >
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {likes.map((l) => (
                <TouchableOpacity
                  key={l.username}
                  style={styles.likesModalRow}
                  activeOpacity={0.7}
                  onPress={() => {
                    setLikesModalVisible(false);
                    navigation.navigate('Profile', { username: l.username });
                  }}
                >
                  <View style={styles.likedAvatar}>
                    <Text style={styles.likedAvatarText}>
                      {(l.name || l.username || '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.likesModalName}>{l.name || l.username}</Text>
                    {l.name ? (
                      <Text style={styles.likesModalUsername}>@{l.username}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
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
    borderRadius: radii.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
    gap: 8,
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
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.2,
  },
  recookButtonLabelActive: {
    color: colors.primary,
  },
  recookButtonHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.88)',
    marginTop: 1,
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
  loadErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.inputBg,
    borderRadius: radii.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  loadErrorText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
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
  likedSummaryRow: {
    paddingVertical: 4,
  },
  likedSummaryText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  likesModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  likesModalCard: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    maxHeight: '70%',
  },
  likesModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  likesModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  likesModalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  likesModalName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  likesModalUsername: {
    fontSize: 13,
    color: colors.textMuted,
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
  commentMain: {
    flex: 1,
  },
  commentBubble: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginLeft: 4,
    gap: 18,
  },
  commentActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commentActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  commentActionTextActive: {
    color: colors.like,
  },
  replyThread: {
    marginLeft: 30,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
  },
  replyComment: {
    marginBottom: 12,
  },
  replyAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  replyAvatarText: {
    fontSize: 13,
  },
  replyingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.inputBg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  replyingText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
  },
  replyingName: {
    fontWeight: '700',
    color: colors.text,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
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
  lockedCommentBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  lockedCommentText: {
    flex: 1,
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '500',
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
