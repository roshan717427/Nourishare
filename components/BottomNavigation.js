import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/theme';

const TABS = [
  { id: 'Home', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
  { id: 'Explore', label: 'Explore', icon: 'search-outline', activeIcon: 'search' },
  { id: 'AI', label: 'AI', icon: 'sparkles-outline', activeIcon: 'sparkles' },
  { id: 'Post', label: 'Post', icon: 'add-circle-outline', activeIcon: 'add-circle' },
  { id: 'Profile', label: 'Profile', icon: 'person-outline', activeIcon: 'person' },
];

export default function BottomNavigation({ navigation, activeTab = 'Home' }) {
  const handleTabPress = (tabId) => {
    if (tabId === activeTab) return;
    switch (tabId) {
      case 'Home':
        navigation.navigate('Home');
        break;
      case 'AI':
        navigation.navigate('AISuggestions');
        break;
      case 'Post':
        navigation.navigate('LogMeal');
        break;
      case 'Profile':
        navigation.navigate('Profile', { username: undefined, profile: undefined });
        break;
      case 'Explore':
        navigation.navigate('Explore');
        break;
      default:
        break;
    }
  };

  return (
    <View style={styles.container}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            style={styles.tab}
            onPress={() => handleTabPress(tab.id)}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
          >
            <Ionicons
              name={isActive ? tab.activeIcon : tab.icon}
              size={26}
              color={isActive ? colors.navActive : colors.navInactive}
            />
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
              {tab.label}
            </Text>
            {isActive ? <View style={styles.activeDot} /> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 76,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: 12,
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 11,
    color: colors.navInactive,
    marginTop: 4,
  },
  tabLabelActive: {
    color: colors.navActive,
    fontWeight: '700',
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.navActive,
    marginTop: 3,
  },
});
