import React, { useMemo, useState } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { colors, radii } from '../constants/theme';
import { USERNAME_HINT, validatePersonName, validateUsername } from '../utils/signupValidation';

function splitDisplayName(displayName) {
  const raw = String(displayName || '').trim();
  if (!raw) return { firstName: '', lastName: '' };
  const parts = raw.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export default function FinishProfileScreen() {
  const { user, completeProfileSetup, signOut } = useAuth();
  const initialNames = useMemo(() => splitDisplayName(user?.name), [user?.name]);

  const [firstName, setFirstName] = useState(initialNames.firstName);
  const [lastName, setLastName] = useState(initialNames.lastName);
  const [username, setUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFinish = async () => {
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedUsername = username.trim().toLowerCase();

    const firstNameError = validatePersonName(trimmedFirstName, 'First name');
    if (firstNameError) {
      Alert.alert('Invalid first name', firstNameError);
      return;
    }
    const lastNameError = validatePersonName(trimmedLastName, 'Last name');
    if (lastNameError) {
      Alert.alert('Invalid last name', lastNameError);
      return;
    }
    const usernameError = validateUsername(trimmedUsername);
    if (usernameError) {
      Alert.alert('Invalid username', usernameError);
      return;
    }

    setIsSubmitting(true);
    try {
      await completeProfileSetup({
        username: trimmedUsername,
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
      });
    } catch (err) {
      const code = err?.code || '';
      let message = err.message || 'Could not finish setting up your profile. Please try again.';
      if (code === 'auth/username-already-exists') {
        message = 'That username is already taken.';
      } else if (code === 'auth/invalid-username') {
        message = `Username is not valid. ${USERNAME_HINT}`;
      }
      Alert.alert('Profile setup failed', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="light" />
      <LinearGradient
        colors={[colors.gradientAuthStart, colors.gradientAuthEnd]}
        style={styles.gradientBg}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoRow}>
            <Ionicons name="restaurant" size={48} color="#fff" />
            <Text style={styles.brand}>Munchable</Text>
          </View>
          <Text style={styles.title}>Almost there</Text>
          <Text style={styles.subtitle}>
            Your account exists, but we need to finish your profile. Enter the username you chose
            when you signed up.
          </Text>

          <View style={styles.formCard}>
            <TextInput
              style={[styles.input, styles.inputReadOnly]}
              placeholder="Email"
              placeholderTextColor={colors.textMuted}
              value={user?.email || ''}
              editable={false}
            />

            <TextInput
              style={styles.input}
              placeholder="First name"
              placeholderTextColor={colors.textMuted}
              value={firstName}
              onChangeText={setFirstName}
            />

            <TextInput
              style={styles.input}
              placeholder="Last name"
              placeholderTextColor={colors.textMuted}
              value={lastName}
              onChangeText={setLastName}
            />

            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor={colors.textMuted}
              value={username}
              onChangeText={(text) => setUsername(text.toLowerCase())}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.helperText}>{USERNAME_HINT}</Text>

            <TouchableOpacity
              style={[styles.finishButton, isSubmitting && styles.finishButtonDisabled]}
              onPress={handleFinish}
              activeOpacity={0.85}
              disabled={isSubmitting}
            >
              <Text style={styles.finishButtonText}>
                {isSubmitting ? 'Setting up...' : 'Finish setup'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.signOutRow} activeOpacity={0.7} onPress={signOut}>
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientBg: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 12,
  },
  brand: {
    fontSize: 42,
    fontWeight: '800',
    color: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  formCard: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  input: {
    backgroundColor: colors.inputBg,
    borderRadius: radii.md,
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputReadOnly: {
    opacity: 0.85,
  },
  helperText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: -6,
    marginBottom: 16,
    marginLeft: 4,
  },
  finishButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishButtonDisabled: {
    opacity: 0.6,
  },
  finishButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  signOutRow: {
    marginTop: 24,
    alignItems: 'center',
  },
  signOutText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
