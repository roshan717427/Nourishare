import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radii } from '../constants/theme';

const VARIANTS = {
  default: { bg: colors.borderLight, text: colors.text },
  coral: { bg: colors.chipCoral, text: colors.chipCoralText },
  teal: { bg: colors.chipTeal, text: colors.chipTealText },
  amber: { bg: colors.chipAmber, text: colors.chipAmberText },
};

export default function Tag({ text, variant = 'default' }) {
  const palette = VARIANTS[variant] || VARIANTS.default;
  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <Text style={[styles.text, { color: palette.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: 4,
    marginBottom: 8,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
  },
});
