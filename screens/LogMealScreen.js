import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import BottomNavigation from '../components/BottomNavigation';
import { colors } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';

export default function LogMealScreen({ navigation }) {
  const { user } = useAuth();
  const [mealName, setMealName] = useState('');
  const [photo, setPhoto] = useState(null);
  const [ingredients, setIngredients] = useState('');
  const [notes, setNotes] = useState('');
  const [rating, setRating] = useState(null);
  const [difficulty, setDifficulty] = useState(null);
  const [time, setTime] = useState('');
  const [source, setSource] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pickImage = async () => {
    // Request permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to add a photo.');
      return;
    }

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhoto(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    // Request permissions
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to snap a photo.');
      return;
    }

    // Launch camera
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhoto(result.assets[0].uri);
    }
  };

  const showImageOptions = () => {
    Alert.alert(
      'Add a photo',
      'Choose an option',
      [
        { text: 'Camera', onPress: takePhoto },
        { text: 'Photo Library', onPress: pickImage },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleSubmit = async () => {
    // Basic validation
    if (!mealName.trim()) {
      Alert.alert('Name your dish', 'Give your meal a name before logging it.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Convert photo to base64 if present
      let photoBase64 = null;
      if (photo) {
        // In a real app, you'd upload to Firebase Storage or similar
        // For now, we'll skip photo upload and handle it separately
        photoBase64 = photo; // This should be converted to base64 or uploaded separately
      }

      // Prepare log data - matching API expectations
      const logData = {
        username: user?.username || 'current_user',
        title: mealName.trim(),
        ingredients: ingredients.trim() || undefined,
        notes: notes.trim() || undefined,
        rating: rating || undefined,
        difficulty: difficulty?.toLowerCase() || undefined,
        time: time.trim() || undefined,
        source: source.trim() || undefined,
        photoUrl: photo || undefined, // API expects photoUrl
        recipeLink: undefined, // Not in form, but API accepts it
      };

      // Remove undefined values
      Object.keys(logData).forEach(key => {
        if (logData[key] === undefined) {
          delete logData[key];
        }
      });

      // Call API
      const response = await fetch(`${API_URL}/createRecipeLog`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(logData),
      });

      const result = await response.json();

      if (response.ok && result.message) {
        Alert.alert('Logged!', 'Your meal is on your profile.', [
          {
            text: 'OK',
            onPress: () => {
              // Reset form
              setMealName('');
              setPhoto(null);
              setIngredients('');
              setNotes('');
              setRating(null);
              setDifficulty(null);
              setTime('');
              setSource('');
              // Navigate back
              navigation.goBack();
            },
          },
        ]);
      } else {
        throw new Error(result.error || 'Failed to log meal');
      }
    } catch (error) {
      console.error('Error logging meal:', error);
      Alert.alert('Error', error.message || 'Failed to log meal. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Log a meal</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Meal Name */}
        <View style={styles.section}>
          <Text style={styles.label}>What did you make?</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter meal name"
            value={mealName}
            onChangeText={setMealName}
            placeholderTextColor="#999"
          />
        </View>

        {/* Add Photo */}
        <View style={styles.section}>
          <Text style={styles.label}>Add a photo</Text>
          <TouchableOpacity
            style={styles.photoContainer}
            onPress={showImageOptions}
            activeOpacity={0.8}
          >
            {photo ? (
              <Image source={{ uri: photo }} style={styles.photo} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Text style={styles.photoPlaceholderText}>+ Add Photo</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Ingredients */}
        <View style={styles.section}>
          <Text style={styles.label}>Ingredients</Text>
          <TextInput
            style={styles.input}
            placeholder="Add ingredients"
            value={ingredients}
            onChangeText={setIngredients}
            placeholderTextColor="#999"
            multiline
          />
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Add notes"
            value={notes}
            onChangeText={setNotes}
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Rating */}
        <View style={styles.section}>
          <Text style={styles.label}>Rating</Text>
          <View style={styles.buttonRow}>
            {[1, 2, 3, 4, 5].map((num, index) => (
              <TouchableOpacity
                key={num}
                style={[
                  styles.ratingButton,
                  rating === num && styles.ratingButtonSelected,
                  index === 4 && { marginRight: 0 },
                ]}
                onPress={() => setRating(num)}
              >
                <Text
                  style={[
                    styles.ratingButtonText,
                    rating === num && styles.ratingButtonTextSelected,
                  ]}
                >
                  {num}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Difficulty */}
        <View style={styles.section}>
          <Text style={styles.label}>Difficulty</Text>
          <View style={styles.buttonRow}>
            {['Easy', 'Medium', 'Hard'].map((level, index) => (
              <TouchableOpacity
                key={level}
                style={[
                  styles.difficultyButton,
                  difficulty === level && styles.difficultyButtonSelected,
                  index === 2 && { marginRight: 0 },
                ]}
                onPress={() => setDifficulty(level)}
              >
                <Text
                  style={[
                    styles.difficultyButtonText,
                    difficulty === level && styles.difficultyButtonTextSelected,
                  ]}
                >
                  {level}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Time */}
        <View style={styles.section}>
          <Text style={styles.label}>Time</Text>
          <TextInput
            style={styles.input}
            placeholder="Add time"
            value={time}
            onChangeText={setTime}
            placeholderTextColor="#999"
          />
        </View>

        {/* Source */}
        <View style={styles.section}>
          <Text style={styles.label}>Source</Text>
          <TextInput
            style={styles.input}
            placeholder="Add source"
            value={source}
            onChangeText={setSource}
            placeholderTextColor="#999"
          />
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <Text style={styles.submitButtonText}>
            {isSubmitting ? 'Logging...' : 'Log meal'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Bottom Navigation */}
      <BottomNavigation navigation={navigation} activeTab="Post" />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.card,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  placeholder: {
    width: 32,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000',
    backgroundColor: '#fff',
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  photoContainer: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
  },
  photo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
  photoPlaceholderText: {
    fontSize: 16,
    color: '#999',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ratingButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  ratingButtonSelected: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  ratingButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  ratingButtonTextSelected: {
    color: '#fff',
  },
  difficultyButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  difficultyButtonSelected: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  difficultyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  difficultyButtonTextSelected: {
    color: '#fff',
  },
  submitButton: {
    backgroundColor: '#000',
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginTop: 32,
    marginBottom: 20,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

