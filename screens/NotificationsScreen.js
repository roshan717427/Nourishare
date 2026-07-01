import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  RefreshControl,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import { withAuthHeaders } from '../utils/apiAuth';
import { friendlyError, friendlyErrorForResponse } from '../utils/errorMessages';
import { colors, radii, spacing } from '../constants/theme';

function FollowRequestRow({
  item,
  isFollowing,
  isPending,
  onAccept,
  onDecline,
  onFollowBack,
  onPressProfile,
  acting,
}) {
  const isPendingRequest = item.status === 'pending';
  const wasAccepted = item.status === 'accepted';

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.cardMain} onPress={onPressProfile} activeOpacity={0.7}>
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>
            {(item.fromName || item.fromUsername || '?').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.cardText}>
          <Text style={styles.cardName}>{item.fromName || item.fromUsername}</Text>
          <Text style={styles.cardMeta}>
            {isPendingRequest
              ? 'wants to follow you'
              : wasAccepted
                ? 'is now following you'
                : 'follow request'}
          </Text>
        </View>
      </TouchableOpacity>

      {isPendingRequest ? (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.declineBtn, acting && styles.btnDisabled]}
            onPress={onDecline}
            disabled={acting}
            activeOpacity={0.85}
          >
            <Text style={styles.declineBtnText}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.acceptBtn, acting && styles.btnDisabled]}
            onPress={onAccept}
            disabled={acting}
            activeOpacity={0.85}
          >
            {acting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.acceptBtnText}>Accept</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : wasAccepted && isFollowing ? (
        <View style={styles.followingBadge}>
          <Text style={styles.followingBadgeText}>Following</Text>
        </View>
      ) : wasAccepted && isPending ? (
        <View style={styles.followingBadge}>
          <Text style={styles.followingBadgeText}>Requested</Text>
        </View>
      ) : wasAccepted && !isFollowing && !isPending ? (
        <TouchableOpacity
          style={styles.followBackBtn}
          onPress={onFollowBack}
          activeOpacity={0.85}
        >
          <Text style={styles.followBackBtnText}>Follow back</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default function NotificationsScreen({ navigation }) {
  const {
    user,
    isFollowing,
    isPendingRequest,
    requestFollow,
    refreshSocialState,
  } = useAuth();
  const username = user?.username;

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingOn, setActingOn] = useState(null);

  const loadNotifications = useCallback(
    async (isRefresh = false) => {
      if (!username) {
        setNotifications([]);
        setLoading(false);
        return;
      }
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const headers = await withAuthHeaders();
        const res = await fetch(
          `${API_URL}/social?action=notifications&username=${encodeURIComponent(username)}`,
          { method: 'GET', headers }
        );
        if (res.ok) {
          const data = await res.json();
          const items = Array.isArray(data.notifications) ? data.notifications : [];
          setNotifications(items.filter((n) => n.type === 'follow_request'));
        }
      } catch (err) {
        console.log('Could not load notifications:', err.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [username]
  );

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
      refreshSocialState();
    }, [loadNotifications, refreshSocialState])
  );

  const handleAccept = async (fromUsername) => {
    if (!username || actingOn) return;
    setActingOn(fromUsername);
    try {
      const headers = await withAuthHeaders();
      const res = await fetch(`${API_URL}/social?action=acceptFollowRequest`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ username, fromUsername }),
      });
      if (!res.ok) {
        Alert.alert(
          'Could not accept',
          friendlyErrorForResponse(res, { fallback: 'We couldn\u2019t accept that request. Please try again.' })
        );
        return;
      }
      setNotifications((prev) =>
        prev.map((n) =>
          n.fromUsername === fromUsername ? { ...n, status: 'accepted', read: true } : n
        )
      );
      await refreshSocialState();
    } catch (err) {
      Alert.alert(
        'Could not accept',
        friendlyError(err, { fallback: 'We couldn\u2019t accept that request. Please try again.' })
      );
    } finally {
      setActingOn(null);
    }
  };

  const handleDecline = async (fromUsername) => {
    if (!username || actingOn) return;
    setActingOn(fromUsername);
    try {
      const headers = await withAuthHeaders();
      const res = await fetch(`${API_URL}/social?action=declineFollowRequest`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ username, fromUsername }),
      });
      if (!res.ok) {
        Alert.alert(
          'Could not decline',
          friendlyErrorForResponse(res, { fallback: 'We couldn\u2019t decline that request. Please try again.' })
        );
        return;
      }
      setNotifications((prev) =>
        prev.map((n) =>
          n.fromUsername === fromUsername ? { ...n, status: 'declined', read: true } : n
        )
      );
    } catch (err) {
      Alert.alert(
        'Could not decline',
        friendlyError(err, { fallback: 'We couldn\u2019t decline that request. Please try again.' })
      );
    } finally {
      setActingOn(null);
    }
  };

  const handleFollowBack = async (targetUsername) => {
    if (!username) return;
    requestFollow(targetUsername);
    try {
      const headers = await withAuthHeaders();
      await fetch(`${API_URL}/social?action=follow`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ username, targetUsername }),
      });
    } catch (err) {
      console.log('Follow back request error:', err.message);
    }
  };

  const openProfile = (fromUsername) => {
    navigation.navigate('Profile', { username: fromUsername });
  };

  const pendingCount = notifications.filter((n) => n.status === 'pending').length;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.centered}>
          <View style={styles.emptyIcon}>
            <Ionicons name="notifications-outline" size={40} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>All caught up</Text>
          <Text style={styles.emptyText}>
            When someone asks to follow you, their request will show up here.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadNotifications(true)}
              tintColor={colors.primary}
            />
          }
        >
          {pendingCount > 0 ? (
            <Text style={styles.sectionLabel}>
              {pendingCount} pending request{pendingCount === 1 ? '' : 's'}
            </Text>
          ) : null}

          {notifications.map((item) => (
            <FollowRequestRow
              key={item.id || item.fromUsername}
              item={item}
              isFollowing={isFollowing(item.fromUsername)}
              isPending={isPendingRequest(item.fromUsername)}
              onAccept={() => handleAccept(item.fromUsername)}
              onDecline={() => handleDecline(item.fromUsername)}
              onFollowBack={() => handleFollowBack(item.fromUsername)}
              onPressProfile={() => openProfile(item.fromUsername)}
              acting={actingOn === item.fromUsername}
            />
          ))}
        </ScrollView>
      )}
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
    paddingBottom: spacing.sm + 4,
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
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  headerSpacer: {
    width: 32,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.chipCoral,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  scrollContent: {
    padding: spacing.md + 4,
    paddingBottom: spacing.xl,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm + 4,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm + 4,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  cardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm + 4,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.chipCoral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.chipCoralText,
  },
  cardText: {
    flex: 1,
    marginLeft: spacing.sm + 4,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  cardMeta: {
    fontSize: 14,
    color: colors.textMuted,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  declineBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.cardWarm,
  },
  declineBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  acceptBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radii.pill,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  acceptBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  followBackBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md + 4,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  followBackBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  followingBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.cardWarm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  followingBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
});
