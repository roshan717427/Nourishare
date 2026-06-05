import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function StatsCard({ label, value }) {
  return (
    <View style={styles.container}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
    marginHorizontal: 6,
  },
  value: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});

