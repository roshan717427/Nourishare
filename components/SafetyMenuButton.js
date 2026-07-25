import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../constants/theme';
import { reportContent, blockUser, unblockUser } from '../utils/moderationApi';
import { friendlyError } from '../utils/errorMessages';

const MAX_OTHER_REASON_LEN = 400;

/** Imperative bridge so Alert flows can open the Other-reason modal. */
let openOtherReasonPrompt = null;

/**
 * Promise-based prompt for a custom report reason.
 * Resolves to trimmed text, or null if cancelled.
 */
export function promptOtherReportReason() {
  return new Promise((resolve) => {
    if (typeof openOtherReasonPrompt !== 'function') {
      resolve(null);
      return;
    }
    openOtherReasonPrompt(resolve);
  });
}

/** Mount once near the app root so report flows can collect a custom reason. */
export function ReportOtherReasonModalHost() {
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const resolverRef = useRef(null);

  useEffect(() => {
    openOtherReasonPrompt = (resolve) => {
      resolverRef.current = resolve;
      setText('');
      setSubmitting(false);
      setVisible(true);
    };
    return () => {
      openOtherReasonPrompt = null;
    };
  }, []);

  const finish = (value) => {
    setVisible(false);
    setSubmitting(false);
    const resolve = resolverRef.current;
    resolverRef.current = null;
    if (typeof resolve === 'function') resolve(value);
  };

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      Alert.alert('Add a reason', 'Please describe why you are reporting this.');
      return;
    }
    setSubmitting(true);
    finish(trimmed.slice(0, MAX_OTHER_REASON_LEN));
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => finish(null)}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Other reason</Text>
          <Text style={styles.modalHint}>Tell us why you are reporting this.</Text>
          <TextInput
            style={styles.modalInput}
            value={text}
            onChangeText={setText}
            placeholder="Describe the issue…"
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={MAX_OTHER_REASON_LEN}
            autoFocus
            textAlignVertical="top"
          />
          <Text style={styles.modalCount}>
            {text.trim().length}/{MAX_OTHER_REASON_LEN}
          </Text>
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => finish(null)}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalSubmitBtn, submitting && styles.modalSubmitDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Submit report"
            >
              <Text style={styles.modalSubmitText}>Submit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
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

function handleOtherReason(viewerUsername, targetType, targetId, targetUsername) {
  // Defer so the reason Alert can dismiss before the modal presents.
  setTimeout(async () => {
    const custom = await promptOtherReportReason();
    if (!custom) return;
    await submitReport(
      viewerUsername,
      targetType,
      targetId,
      targetUsername,
      `Other: ${custom}`
    );
  }, 350);
}

/** Report-only reason sheet (used on profiles where Block is a separate control). */
export function openReportReasons({
  viewerUsername,
  targetUsername,
  targetType = 'post',
  targetId = null,
}) {
  if (!viewerUsername || !targetUsername) return;
  if (viewerUsername === targetUsername) return;

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
        submitReport(
          viewerUsername,
          targetType,
          targetId,
          targetUsername,
          'Harassment or bullying'
        ),
    },
    {
      text: 'Spam',
      onPress: () =>
        submitReport(viewerUsername, targetType, targetId, targetUsername, 'Spam'),
    },
    {
      text: 'Other',
      onPress: () => handleOtherReason(viewerUsername, targetType, targetId, targetUsername),
    },
  ]);
}

/**
 * Opens a simple action sheet via Alert for Report / Block (or Unblock).
 */
export function openSafetyActions({
  viewerUsername,
  targetUsername,
  targetType = 'post',
  targetId = null,
  isBlocked = false,
  onBlocked,
  onUnblocked,
}) {
  if (!viewerUsername || !targetUsername) return;
  if (viewerUsername === targetUsername) return;

  const blockOrUnblock = isBlocked
    ? {
        text: 'Unblock',
        onPress: async () => {
          try {
            await unblockUser(viewerUsername, targetUsername);
            Alert.alert('Unblocked', `@${targetUsername} has been unblocked.`);
            if (typeof onUnblocked === 'function') onUnblocked(targetUsername);
          } catch (err) {
            Alert.alert('Could not unblock', friendlyError(err));
          }
        },
      }
    : {
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
      };

  Alert.alert('Safety', 'Report or block this user?', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Report',
      onPress: () =>
        openReportReasons({
          viewerUsername,
          targetUsername,
          targetType,
          targetId,
        }),
    },
    blockOrUnblock,
  ]);
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
    return <View style={{ width: size, height: size }} />;
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

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  modalHint: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  modalInput: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.background,
  },
  modalCount: {
    alignSelf: 'flex-end',
    marginTop: 6,
    fontSize: 12,
    color: colors.textMuted,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  modalSubmitBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  modalSubmitDisabled: {
    opacity: 0.6,
  },
  modalSubmitText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
