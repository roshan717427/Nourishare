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
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import { colors, radii } from '../constants/theme';

export default function LoginScreen({ navigation }) {
  const { signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resolveEmail = async (identifier) => {
    if (identifier.includes('@')) return identifier;
    try {
      const res = await fetch(
        `${API_URL}/getUserProfile?username=${encodeURIComponent(identifier)}`
      );
      if (res.ok) {
        const profile = await res.json();
        if (profile && profile.email) return profile.email;
      }
    } catch (err) {
      console.log('Username -> email lookup failed:', err.message);
    }
    return null;
  };

  const handleLogin = async () => {
    const identifier = username.trim();
    if (!identifier) {
      Alert.alert('Missing information', 'Please enter your username or email.');
      return;
    }
    if (!password) {
      Alert.alert('Missing information', 'Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const email = await resolveEmail(identifier);
      if (!email) {
        Alert.alert(
          'User not found',
          'We could not find an account for that username. Try logging in with your email instead.'
        );
        return;
      }
      await signIn(email, password);
    } catch (err) {
      const code = err?.code || '';
      let message = 'Something went wrong. Please try again.';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        message = 'Incorrect username/email or password.';
      } else if (code === 'auth/user-not-found') {
        message = 'No account found for those credentials.';
      } else if (code === 'auth/invalid-email') {
        message = 'That email address is not valid.';
      } else if (code === 'auth/too-many-requests') {
        message = 'Too many attempts. Please try again later.';
      }
      Alert.alert('Login failed', message);
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
            <Ionicons name="restaurant" size={32} color="#fff" />
            <Text style={styles.brand}>Munchable</Text>
          </View>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to see what your friends are cooking</Text>

          <View style={styles.formCard}>
            <TextInput
              style={styles.input}
              placeholder="Username or email"
              placeholderTextColor={colors.textMuted}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.forgotWrapper}
              onPress={() => navigation.navigate('ForgotPassword')}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.loginButton, isSubmitting && styles.loginButtonDisabled]}
              onPress={handleLogin}
              activeOpacity={0.85}
              disabled={isSubmitting}
            >
              <Text style={styles.loginButtonText}>
                {isSubmitting ? 'Logging in...' : 'Log in'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.signUpRow}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('SignUp')}
          >
            <Text style={styles.signUpText}>
              New user? <Text style={styles.signUpLink}>Sign Up</Text>
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
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 10,
  },
  brand: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginBottom: 28,
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
    paddingVertical: 16,
    fontSize: 17,
    color: colors.text,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  forgotWrapper: {
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  forgotText: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '600',
  },
  loginButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  signUpRow: {
    marginTop: 28,
    alignItems: 'center',
  },
  signUpText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  signUpLink: {
    color: '#fff',
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
});
