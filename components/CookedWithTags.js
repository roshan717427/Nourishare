import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../constants/theme';

export default function CookedWithTags({ usernames, onPressUser, style, compact }) {
  if (!usernames?.length) return null;

  return (
    <View style={[styles.row, compact && styles.rowCompact, style]}>
      <Text style={[styles.label, compact && styles.labelCompact]}>Cooked with </Text>
      {usernames.map((username, index) => (
        <Text key={username} style={[styles.inline, compact && styles.labelCompact]}>
          {index > 0 ? ', ' : ''}
          <Text style={styles.link} onPress={() => onPressUser?.(username)}>
            @{username}
          </Text>
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 8,
  },
  rowCompact: {
    marginBottom: 4,
  },
  label: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  labelCompact: {
    fontSize: 12,
  },
  inline: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  link: {
    color: colors.primary,
    fontWeight: '600',
  },
});
