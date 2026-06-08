import React, { useState } from 'react';
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
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../config/firebase';
import { API_URL } from '../config/api';
import { colors, radii } from '../constants/theme';

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleReset = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      Alert.alert('Missing information', 'Please enter your email.');
      return;
    }
    if (!trimmed.includes('@')) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      let isRegistered = false;
      try {
        const res = await fetch(
          `${API_URL}/social?action=checkEmail&email=${encodeURIComponent(trimmed)}`,
          { method: 'GET', headers: { 'Content-Type': 'application/json' } }
        );
        if (res.ok) {
          const data = await res.json();
          isRegistered = !!data.exists;
        } else {
          isRegistered = true;
        }
      } catch (lookupErr) {
        console.log('Email lookup failed, attempting reset anyway:', lookupErr.message);
        isRegistered = true;
      }

      if (!isRegistered) {
        Alert.alert(
          'No account found',
          "We couldn't find an account with that email. Let's create one.",
          [
            {
              text: 'Sign up',
              onPress: () => navigation.navigate('SignUp', { email: trimmed }),
            },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
        return;
      }

      await sendPasswordResetEmail(auth, trimmed);
      Alert.alert(
        'Check your email',
        `We've sent a password reset link to ${trimmed}. Follow the link to set a new password, then come back and log in.`,
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
      );
    } catch (err) {
      const code = err?.code || '';
      let message = 'Something went wrong. Please try again.';
      if (code === 'auth/invalid-email') {
        message = 'That email address is not valid.';
      } else if (code === 'auth/user-not-found') {
        Alert.alert(
          'No account found',
          "We couldn't find an account with that email. Let's create one.",
          [
            { text: 'Sign up', onPress: () => navigation.navigate('SignUp', { email: trimmed }) },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
        return;
      } else if (code === 'auth/too-many-requests') {
        message = 'Too many attempts. Please try again later.';
      }
      Alert.alert('Reset failed', message);
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
          <View style={styles.iconCircle}>
            <Ionicons name="key" size={32} color={colors.primary} />
          </View>
          <Text style={styles.title}>Reset password</Text>
          <Text style={styles.subtitle}>
            Enter the email linked to your account and we'll send you a link to
            reset your password.
          </Text>

          <View style={styles.formCard}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />

            <TouchableOpacity
              style={[styles.primaryButton, isSubmitting && styles.primaryButtonDisabled]}
              onPress={handleReset}
              activeOpacity={0.85}
              disabled={isSubmitting}
            >
              <Text style={styles.primaryButtonText}>
                {isSubmitting ? 'Sending...' : 'Send reset link'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.backRow}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.backText}>
              Remembered it? <Text style={styles.backLink}>Log in</Text>
            </Text>
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
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 23,
    marginBottom: 28,
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
    paddingVertical: 16,
    fontSize: 17,
    color: colors.text,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  backRow: {
    marginTop: 28,
    alignItems: 'center',
  },
  backText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  backLink: {
    color: '#fff',
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
});
