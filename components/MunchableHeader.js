import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../constants/theme';

const SIDE_WIDTH = 40;

export default function NourishareHeader({ leftAction, rightAction }) {
  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.header}
    >
      <View style={styles.side}>
        {leftAction ?? <View style={styles.spacer} />}
      </View>
      <Text style={styles.title}>Nourishare</Text>
      <View style={[styles.side, styles.sideRight]}>
        {rightAction ?? <View style={styles.spacer} />}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 14,
  },
  side: {
    width: SIDE_WIDTH,
    minHeight: 36,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  spacer: {
    width: SIDE_WIDTH,
    height: 36,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.3,
  },
});
