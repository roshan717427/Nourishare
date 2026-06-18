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
import { withAuthHeaders } from '../utils/apiAuth';
import {
  PASSWORD_HINT,
  validatePassword,
  validatePersonName,
} from '../utils/signupValidation';

export default function SignUpScreen({ navigation, route }) {
  const { signUp } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState(route?.params?.email || '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignUp = async () => {
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();

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
    if (!trimmedEmail) {
      Alert.alert('Missing information', 'Please enter your email.');
      return;
    }
    if (!trimmedUsername) {
      Alert.alert('Missing information', 'Please choose a username.');
      return;
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      Alert.alert('Invalid password', passwordError);
      return;
    }

    setIsSubmitting(true);

    const fullName = `${trimmedFirstName} ${trimmedLastName}`;
    const profile = {
      username: trimmedUsername,
      name: fullName,
      firstName: trimmedFirstName,
      lastName: trimmedLastName,
      email: trimmedEmail,
    };

    try {
      await signUp({
        email: trimmedEmail,
        password,
        username: trimmedUsername,
      });

      try {
        const headers = await withAuthHeaders();
        await fetch(`${API_URL}/createUserProfile`, {
          method: 'POST',
          headers,
          body: JSON.stringify(profile),
        });
      } catch (apiErr) {
        console.log('Profile API call failed, continuing:', apiErr.message);
      }
    } catch (err) {
      const code = err?.code || '';
      let message = 'Could not create your account. Please try again.';
      if (code === 'auth/email-already-in-use') {
        message = 'An account already exists for that email.';
      } else if (code === 'auth/invalid-email') {
        message = 'That email address is not valid.';
      } else if (code === 'auth/weak-password') {
        message = `Password does not meet requirements. ${PASSWORD_HINT}`;
      }
      Alert.alert('Sign up failed', message);
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
            <Ionicons name="restaurant" size={28} color="#fff" />
            <Text style={styles.brand}>Munchable</Text>
          </View>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Join the community and start logging your meals</Text>

          <View style={styles.formCard}>
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
              placeholder="Email"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />

            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor={colors.textMuted}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Password"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.passwordToggle}
                onPress={() => setShowPassword((prev) => !prev)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            </View>
            <Text style={styles.helperText}>{PASSWORD_HINT}</Text>

            <TouchableOpacity
              style={[styles.signUpButton, isSubmitting && styles.signUpButtonDisabled]}
              onPress={handleSignUp}
              activeOpacity={0.85}
              disabled={isSubmitting}
            >
              <Text style={styles.signUpButtonText}>
                {isSubmitting ? 'Creating...' : 'Sign up'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.loginRow}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.loginText}>
              Already have an account? <Text style={styles.loginLink}>Log in</Text>
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
    paddingVertical: 32,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 10,
  },
  brand: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#fff',
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
  passwordRow: {
    position: 'relative',
    marginBottom: 12,
  },
  passwordInput: {
    backgroundColor: colors.inputBg,
    borderRadius: radii.md,
    paddingHorizontal: 18,
    paddingRight: 48,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  passwordToggle: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  helperText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: -6,
    marginBottom: 16,
    marginLeft: 4,
  },
  signUpButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signUpButtonDisabled: {
    opacity: 0.6,
  },
  signUpButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  loginRow: {
    marginTop: 24,
    alignItems: 'center',
  },
  loginText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  loginLink: {
    color: '#fff',
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
});
