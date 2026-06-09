import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../constants/theme';

const BAR_AREA_HEIGHT = 72;
const MIN_BAR_HEIGHT = 10;
const MAX_BAR_HEIGHT = 72;
const SQRT_SCALE = 14;

/** Gentle scaling: sqrt curve so +1 recipe adds a small height bump, capped at max. */
export function barHeightForValue(value) {
  if (!value || value <= 0) return 0;
  const scaled = MIN_BAR_HEIGHT + Math.sqrt(value) * SQRT_SCALE;
  return Math.min(Math.round(scaled), MAX_BAR_HEIGHT);
}

function Bar({ item }) {
  const value = item.value || 0;
  const height = barHeightForValue(value);

  return (
    <View style={styles.barWrapper}>
      <View style={styles.barColumn}>
        {value > 0 ? (
          <Text style={styles.valueLabel}>{value}</Text>
        ) : (
          <View style={styles.valueLabelSpacer} />
        )}
        <View style={styles.barContainer}>
          {value > 0 ? (
            <View style={[styles.bar, { height }]} />
          ) : null}
        </View>
      </View>
      <Text style={styles.label}>{item.month}</Text>
    </View>
  );
}

function ChartRow({ items }) {
  return (
    <View style={styles.row}>
      {items.map((item, index) => (
        <Bar key={`${item.month}-${index}`} item={item} />
      ))}
    </View>
  );
}

export default function BarChart({ data }) {
  if (!data || data.length === 0) {
    return null;
  }

  const row1 = data.slice(0, 6);
  const row2 = data.slice(6, 12);

  return (
    <View style={styles.container}>
      <ChartRow items={row1} />
      <ChartRow items={row2} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    gap: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  barColumn: {
    alignItems: 'center',
    width: '100%',
  },
  valueLabel: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '700',
    color: colors.chipCoralText,
    marginBottom: 0,
    textAlign: 'center',
  },
  valueLabelSpacer: {
    height: 13,
  },
  barContainer: {
    width: '72%',
    height: BAR_AREA_HEIGHT,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
    opacity: 0.85,
  },
  label: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 6,
    textAlign: 'center',
  },
});
