import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { API_URL } from '../config/api';
import { normalizeUsername } from '../utils/apiAuth';
import { colors, radii, spacing } from '../constants/theme';

function UserRow({ user, onPress }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.6}>
      {user.profilePhotoUrl ? (
        <Image source={{ uri: user.profilePhotoUrl }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarPlaceholderText}>
            {user.name?.charAt(0)?.toUpperCase() || user.username?.charAt(0)?.toUpperCase() || 'U'}
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

export default function FollowListScreen({ navigation, route }) {
  const mode = route?.params?.mode === 'following' ? 'following' : 'followers';
  const ownerName = route?.params?.name;
  const username = normalizeUsername(route?.params?.username) || route?.params?.username;

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const title = mode === 'following' ? 'Following' : 'Followers';

  const loadList = useCallback(
    async (isRefresh = false) => {
      if (!username) {
        setUsers([]);
        setLoading(false);
        return;
      }
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const res = await fetch(
          `${API_URL}/social?action=${mode}&username=${encodeURIComponent(username)}`,
          { method: 'GET', headers: { 'Content-Type': 'application/json' } }
        );
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data[mode]) ? data[mode] : [];
          setUsers(list.filter((u) => u && u.username));
        } else {
          setUsers([]);
        }
      } catch (err) {
        console.log(`Could not load ${mode}:`, err.message);
        setUsers([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [username, mode]
  );

  useFocusEffect(
    useCallback(() => {
      loadList();
    }, [loadList])
  );

  const openProfile = (user) => {
    navigation.navigate('Profile', { username: user.username, profile: user });
  };

  const emptyText =
    mode === 'following'
      ? `${ownerName || 'This user'} isn't following anyone yet.`
      : `${ownerName || 'This user'} doesn't have any followers yet.`;

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
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : users.length === 0 ? (
        <View style={styles.centered}>
          <View style={styles.emptyIcon}>
            <Ionicons name="people-outline" size={40} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Nothing here yet</Text>
          <Text style={styles.emptyText}>{emptyText}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadList(true)}
              tintColor={colors.primary}
            />
          }
        >
          {users.map((u) => (
            <UserRow key={u.username} user={u} onPress={() => openProfile(u)} />
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
    paddingVertical: spacing.sm,
    paddingBottom: spacing.xl,
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
});
