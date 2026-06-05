import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function Tag({ text }) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: 4,
    marginBottom: 8,
  },
  text: {
    fontSize: 14,
    color: '#000',
    fontWeight: '500',
  },
});

