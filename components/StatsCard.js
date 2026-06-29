import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, radii } from '../constants/theme';

export default function StatsCard({ label, value, color = colors.primary, onPress }) {
  if (onPress) {
    return (
      <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.85}>
        <Text style={[styles.value, { color }]}>{value}</Text>
        <Text style={styles.label}>{label}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.value, { color }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
    marginHorizontal: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  value: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    fontWeight: '500',
  },
});
