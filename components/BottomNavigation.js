import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';

export default function BottomNavigation({ navigation, activeTab = 'Home' }) {
  const tabs = [
    { id: 'Home', icon: '●', label: 'Home' },
    { id: 'Search', icon: '○', label: 'Search' },
    { id: 'Add', icon: '+', label: 'Add' },
    { id: 'Suggestions', icon: '★', label: 'Suggestions' },
    { id: 'Profile', icon: '○', label: 'Profile' },
  ];

  const handleTabPress = (tabId) => {
    if (tabId === 'Add') {
      navigation.navigate('LogMeal');
    } else if (tabId === 'Home') {
      navigation.navigate('Home');
    } else if (tabId === 'Profile') {
      navigation.navigate('Profile');
    }
    // TODO: Navigate to Search and Suggestions tabs when screens are created
  };

  return (
    <View style={styles.container}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.id}
          style={styles.tab}
          onPress={() => handleTabPress(tab.id)}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabIcon,
              activeTab === tab.id && styles.tabIconActive,
            ]}
          >
            {tab.icon}
          </Text>
          <Text
            style={[
              styles.tabLabel,
              activeTab === tab.id && styles.tabLabelActive,
            ]}
          >
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 70,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingBottom: 10,
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  tabIconActive: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 12,
    color: '#999',
  },
  tabLabelActive: {
    color: '#000',
    fontWeight: '600',
  },
});

