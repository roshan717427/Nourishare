import React from 'react';
import { Alert, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/theme';
import { reportContent, blockUser } from '../utils/moderationApi';
import { friendlyError } from '../utils/errorMessages';

/**
 * Opens a simple action sheet via Alert for Report / Block.
 */
export function openSafetyActions({
  viewerUsername,
  targetUsername,
  targetType = 'post',
  targetId = null,
  onBlocked,
}) {
  if (!viewerUsername || !targetUsername) return;
  if (viewerUsername === targetUsername) return;

  Alert.alert('Safety', 'Report or block this user?', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Report',
      onPress: () => {
        Alert.alert('Report', 'Why are you reporting this?', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Inappropriate',
            onPress: () =>
              submitReport(viewerUsername, targetType, targetId, targetUsername, 'Inappropriate content'),
          },
          {
            text: 'Harassment',
            onPress: () =>
              submitReport(viewerUsername, targetType, targetId, targetUsername, 'Harassment or bullying'),
          },
          {
            text: 'Spam',
            onPress: () =>
              submitReport(viewerUsername, targetType, targetId, targetUsername, 'Spam'),
          },
        ]);
      },
    },
    {
      text: 'Block',
      style: 'destructive',
      onPress: () => {
        Alert.alert(
          'Block user?',
          `You will no longer see content from @${targetUsername}.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Block',
              style: 'destructive',
              onPress: async () => {
                try {
                  await blockUser(viewerUsername, targetUsername);
                  Alert.alert('Blocked', `@${targetUsername} has been blocked.`);
                  if (typeof onBlocked === 'function') onBlocked(targetUsername);
                } catch (err) {
                  Alert.alert('Could not block', friendlyError(err));
                }
              },
            },
          ]
        );
      },
    },
  ]);
}

async function submitReport(viewerUsername, targetType, targetId, targetUsername, reason) {
  try {
    await reportContent({
      username: viewerUsername,
      targetType,
      targetId,
      targetUsername,
      reason,
    });
    Alert.alert('Thanks', 'Your report was submitted. Our team reviews reports within 24 hours.');
  } catch (err) {
    Alert.alert('Could not report', friendlyError(err));
  }
}

export function SafetyMenuButton({
  viewerUsername,
  targetUsername,
  targetType,
  targetId,
  onBlocked,
  color = colors.textMuted,
  size = 20,
}) {
  if (!viewerUsername || !targetUsername || viewerUsername === targetUsername) {
    return null;
  }

  return (
    <TouchableOpacity
      onPress={() =>
        openSafetyActions({
          viewerUsername,
          targetUsername,
          targetType,
          targetId,
          onBlocked,
        })
      }
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel="Report or block"
    >
      <Ionicons name="ellipsis-horizontal" size={size} color={color} />
    </TouchableOpacity>
  );
}
