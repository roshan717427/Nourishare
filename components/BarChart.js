import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function BarChart({ data }) {
  if (!data || data.length === 0) {
    return null;
  }

  // Find the maximum value for scaling
  const maxValue = Math.max(...data.map(item => item.value || 0));

  return (
    <View style={styles.container}>
      <View style={styles.chartContainer}>
        {data.map((item, index) => {
          const height = maxValue > 0 ? (item.value / maxValue) * 150 : 0;
          return (
            <View key={index} style={styles.barWrapper}>
              <View style={styles.barContainer}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: Math.max(height, 8), // Minimum height for visibility
                    },
                  ]}
                />
              </View>
              <Text style={styles.label}>{item.month}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 180,
    paddingHorizontal: 4,
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barContainer: {
    width: '80%',
    height: 150,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: {
    width: '100%',
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    minHeight: 8,
  },
  label: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
});

