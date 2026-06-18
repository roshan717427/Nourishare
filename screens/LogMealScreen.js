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
  Modal,
  FlatList,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import BottomNavigation from '../components/BottomNavigation';
import { colors } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';

const HOUR_OPTIONS = Array.from({ length: 13 }, (_, i) => i);
const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, i) => i * 5);

function formatCookTime(hours, minutes) {
  if (hours > 0 && minutes > 0) return `${hours} hr ${minutes} min`;
  if (hours > 0) return `${hours} hr`;
  return `${minutes} min`;
}

function TimePickerModal({ visible, title, options, selected, onSelect, onClose, formatLabel }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.pickerOverlay}>
        <TouchableOpacity style={styles.pickerBackdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.pickerSheet}>
          <Text style={styles.pickerTitle}>{title}</Text>
          <FlatList
            data={options}
            keyExtractor={(item) => String(item)}
            showsVerticalScrollIndicator={false}
            style={styles.pickerList}
            renderItem={({ item }) => {
              const isSelected = item === selected;
              return (
                <TouchableOpacity
                  style={[styles.pickerOption, isSelected && styles.pickerOptionSelected]}
                  onPress={() => {
                    onSelect(item);
                    onClose();
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pickerOptionText, isSelected && styles.pickerOptionTextSelected]}>
                    {formatLabel(item)}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

export default function LogMealScreen({ navigation }) {
  const { user } = useAuth();
  const [mealName, setMealName] = useState('');
  const [photo, setPhoto] = useState(null);
  const [ingredients, setIngredients] = useState('');
  const [rating, setRating] = useState(null);
  const [difficulty, setDifficulty] = useState(null);
  const [cookHours, setCookHours] = useState(0);
  const [cookMinutes, setCookMinutes] = useState(30);
  const [hoursPickerVisible, setHoursPickerVisible] = useState(false);
  const [minutesPickerVisible, setMinutesPickerVisible] = useState(false);
  const [recipeLink, setRecipeLink] = useState('');
  const [recipeInstructions, setRecipeInstructions] = useState('');
  const [cookedWith, setCookedWith] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const parseCookedWith = (text) =>
    String(text || '')
      .split(',')
      .map((entry) => entry.trim().replace(/^@/, ''))
      .filter(Boolean);

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
    const missing = [];
    if (!mealName.trim()) missing.push('Meal name');
    if (!ingredients.trim()) missing.push('Ingredients');
    if (!recipeInstructions.trim() && !recipeLink.trim()) {
      missing.push('Recipe steps or link');
    }
    if (!rating) missing.push('Rating');
    if (!difficulty) missing.push('Difficulty');
    if (cookHours === 0 && cookMinutes === 0) missing.push('Time');

    if (missing.length > 0) {
      Alert.alert(
        'Missing information',
        `Please fill in: ${missing.join(', ')}. Photo is optional.`
      );
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
        ingredients: ingredients.trim(),
        rating,
        difficulty: difficulty.toLowerCase(),
        time: formatCookTime(cookHours, cookMinutes),
        photoUrl: photo || undefined,
        recipeLink: recipeLink.trim() || undefined,
        recipeInstructions: recipeInstructions.trim() || undefined,
      };

      const cookedWithList = parseCookedWith(cookedWith);
      if (cookedWithList.length > 0) {
        logData.cookedWith = cookedWithList;
      }

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
              setRating(null);
              setDifficulty(null);
              setCookHours(0);
              setCookMinutes(30);
              setRecipeLink('');
              setRecipeInstructions('');
              setCookedWith('');
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
          <Text style={styles.label}>Add a photo (optional)</Text>
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
          <View style={styles.timePickerRow}>
            <TouchableOpacity
              style={styles.timePickerButton}
              onPress={() => setHoursPickerVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.timePickerValue}>{cookHours}</Text>
              <Text style={styles.timePickerUnit}>hr</Text>
              <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.timePickerButton}
              onPress={() => setMinutesPickerVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.timePickerValue}>{cookMinutes}</Text>
              <Text style={styles.timePickerUnit}>min</Text>
              <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        <TimePickerModal
          visible={hoursPickerVisible}
          title="Hours"
          options={HOUR_OPTIONS}
          selected={cookHours}
          onSelect={setCookHours}
          onClose={() => setHoursPickerVisible(false)}
          formatLabel={(h) => `${h} hr`}
        />
        <TimePickerModal
          visible={minutesPickerVisible}
          title="Minutes"
          options={MINUTE_OPTIONS}
          selected={cookMinutes}
          onSelect={setCookMinutes}
          onClose={() => setMinutesPickerVisible(false)}
          formatLabel={(m) => `${m} min`}
        />

        {/* Recipe */}
        <View style={styles.section}>
          <Text style={styles.label}>Recipe</Text>
          <Text style={styles.fieldHint}>
            Write steps so you can re-cook easily if you wish. Or, include a link to the recipe source.
          </Text>
          <TextInput
            style={[styles.input, styles.textArea, styles.recipeInstructionsInput]}
            placeholder="Recipe steps"
            value={recipeInstructions}
            onChangeText={setRecipeInstructions}
            placeholderTextColor="#999"
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
          <TextInput
            style={styles.input}
            placeholder="Recipe link or source URL"
            value={recipeLink}
            onChangeText={setRecipeLink}
            placeholderTextColor="#999"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </View>

        {/* Cooked with */}
        <View style={styles.section}>
          <Text style={styles.label}>Cooked with (optional)</Text>
          <Text style={styles.fieldHint}>
            Tag friends who helped. Separate usernames with commas, e.g. @alex, @sam
          </Text>
          <TextInput
            style={styles.input}
            placeholder="@username1, @username2"
            value={cookedWith}
            onChangeText={setCookedWith}
            placeholderTextColor="#999"
            autoCapitalize="none"
            autoCorrect={false}
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
  fieldHint: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  recipeInstructionsInput: {
    height: 120,
    marginBottom: 12,
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
  timePickerRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timePickerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    gap: 6,
  },
  timePickerValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  timePickerUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginRight: 4,
  },
  pickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  pickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  pickerSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    maxHeight: '50%',
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    marginBottom: 8,
  },
  pickerList: {
    paddingHorizontal: 16,
  },
  pickerOption: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 8,
  },
  pickerOptionSelected: {
    backgroundColor: '#f0f0f0',
  },
  pickerOptionText: {
    fontSize: 18,
    color: '#333',
  },
  pickerOptionTextSelected: {
    fontWeight: '700',
    color: '#000',
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

