import React, { useState } from 'react';
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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import BottomNavigation from '../components/BottomNavigation';
import { useAuth } from '../context/AuthContext';
import { searchUsers, findUser } from '../data/sampleUsers';
import { API_URL } from '../config/api';

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
      <Ionicons name="chevron-forward" size={20} color="#c4c9cf" />
    </TouchableOpacity>
  );
}

export default function ExploreScreen({ navigation }) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);

  const runSearch = async (text) => {
    const trimmed = text.trim();
    setSearched(true);

    if (!trimmed) {
      setResults([]);
      return;
    }

    // Local demo characters (supports partial username / name matches). These
    // are seeded fictional users and always appear alongside real results.
    const local = searchUsers(trimmed);
    const seen = new Set(local.map((u) => u.username.toLowerCase()));
    const merged = [...local];

    // Best-effort live prefix search against real Firestore users. Real
    // results are merged in (deduped by username); demo characters stay.
    try {
      const response = await fetch(
        `${API_URL}/social?action=searchUsers&q=${encodeURIComponent(trimmed)}`,
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );
      if (response.ok) {
        const data = await response.json();
        const remoteUsers = Array.isArray(data?.users) ? data.users : [];
        remoteUsers.forEach((u) => {
          if (u && u.username && !seen.has(u.username.toLowerCase())) {
            seen.add(u.username.toLowerCase());
            merged.push(u);
          }
        });
      }
    } catch (err) {
      // Offline / no backend: fall back to local demo results only
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
    // Prefer the rich sample profile when we have one so the profile page
    // renders kitchen personality, cuisines, etc. without a round-trip.
    const profile = findUser(result.username) || result;
    navigation.navigate('Profile', { username: result.username, profile });
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Explore</Text>
        {user?.username ? (
          <Text style={styles.myHandle}>@{user.username}</Text>
        ) : null}
      </View>

      {/* Search bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color="#9aa0a6" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search people by username"
          placeholderTextColor="#9aa0a6"
          value={query}
          onChangeText={handleChange}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 ? (
          <TouchableOpacity onPress={() => handleChange('')} activeOpacity={0.6}>
            <Ionicons name="close-circle" size={18} color="#c4c9cf" />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {results.map((u) => (
          <UserRow key={u.username} user={u} onPress={() => openProfile(u)} />
        ))}

        {searched && query.trim().length > 0 && results.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="person-outline" size={36} color="#c4c9cf" />
            <Text style={styles.emptyText}>No users found for "{query.trim()}"</Text>
          </View>
        ) : null}

        {!searched || query.trim().length === 0 ? (
          <View style={styles.hint}>
            <Ionicons name="search-outline" size={36} color="#c4c9cf" />
            <Text style={styles.hintText}>
              Search for friends by their username to view their kitchen
              personality and follow them.
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
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0c1117',
  },
  myHandle: {
    fontSize: 14,
    color: '#9aa0a6',
    fontWeight: '600',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f3f5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 4,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#0c1117',
    marginLeft: 8,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#f0f0f0',
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#9aa0a6',
  },
  rowText: {
    flex: 1,
    marginLeft: 14,
  },
  rowName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0c1117',
    marginBottom: 2,
  },
  rowUsername: {
    fontSize: 14,
    color: '#9aa0a6',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 15,
    color: '#9aa0a6',
    marginTop: 12,
    textAlign: 'center',
  },
  hint: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 48,
  },
  hintText: {
    fontSize: 15,
    color: '#9aa0a6',
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 22,
  },
});
