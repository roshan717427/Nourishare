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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomNavigation from '../components/BottomNavigation';
import { colors } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import { authFetch, AuthError, normalizeUsername } from '../utils/apiAuth';
import { friendlyError, httpError } from '../utils/errorMessages';

const HOUR_OPTIONS = Array.from({ length: 13 }, (_, i) => i);
const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, i) => i * 5);

const DISH_TYPES = [
  'breakfast',
  'brunch',
  'lunch',
  'dinner',
  'appetizer',
  'snack',
  'side',
  'pastry',
  'dessert',
  'beverage',
];

const DIFFICULTY_LEVELS = ['Easy', 'Medium', 'Hard'];

function formatCookTime(hours, minutes) {
  if (hours > 0 && minutes > 0) return `${hours} hr ${minutes} min`;
  if (hours > 0) return `${hours} hr`;
  return `${minutes} min`;
}

function parseCookTime(text) {
  const str = String(text || '');
  const hrMatch = str.match(/(\d+)\s*hr/i);
  const minMatch = str.match(/(\d+)\s*min/i);
  return {
    hours: hrMatch ? parseInt(hrMatch[1], 10) : 0,
    minutes: minMatch ? parseInt(minMatch[1], 10) : 0,
  };
}

function capitalize(value) {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function matchDifficulty(value) {
  if (!value) return null;
  const lower = String(value).toLowerCase();
  return DIFFICULTY_LEVELS.find((level) => level.toLowerCase() === lower) || null;
}

function ingredientsToText(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join('\n');
  return value ? String(value) : '';
}

function cookedWithToText(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map((u) => `@${u}`).join(', ');
  return value ? String(value) : '';
}

function assetToPhotoUri(asset) {
  const mime = asset.mimeType || 'image/jpeg';
  if (asset.base64) {
    return `data:${mime};base64,${asset.base64}`;
  }
  return asset.uri;
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

export default function LogMealScreen({ navigation, route }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const editPost = route?.params?.editPost || null;
  const editPostId = route?.params?.editPostId || editPost?.id || null;
  const isEditing = !!editPostId;
  const initialTime = parseCookTime(editPost?.time);

  const [mealName, setMealName] = useState(editPost?.title || '');
  const [photo, setPhoto] = useState(editPost?.photoUrl || null);
  const [ingredients, setIngredients] = useState(ingredientsToText(editPost?.ingredients));
  const [rating, setRating] = useState(editPost?.rating != null ? editPost.rating : null);
  const [difficulty, setDifficulty] = useState(matchDifficulty(editPost?.difficulty));
  const [dishType, setDishType] = useState(editPost?.dishType || null);
  const [cookHours, setCookHours] = useState(isEditing ? initialTime.hours : 0);
  const [cookMinutes, setCookMinutes] = useState(isEditing ? initialTime.minutes : 30);
  const [hoursPickerVisible, setHoursPickerVisible] = useState(false);
  const [minutesPickerVisible, setMinutesPickerVisible] = useState(false);
  const [recipeLink, setRecipeLink] = useState(editPost?.recipeLink || '');
  const [recipeInstructions, setRecipeInstructions] = useState(
    editPost?.recipeInstructions || ''
  );
  const [cookedWith, setCookedWith] = useState(cookedWithToText(editPost?.cookedWith));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const parseCookedWith = (text) =>
    String(text || '')
      .split(',')
      .map((entry) => entry.trim().replace(/^@/, ''))
      .filter(Boolean);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to add a photo.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        setPhoto(assetToPhotoUri(result.assets[0]));
      }
    } catch (err) {
      console.error('Photo library error:', err);
      Alert.alert('Could not open photos', 'Something went wrong opening your photo library. Please try again.');
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to snap a photo.');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        setPhoto(assetToPhotoUri(result.assets[0]));
      }
    } catch (err) {
      console.error('Camera error:', err);
      Alert.alert('Could not open camera', 'Something went wrong opening the camera. Please try again.');
    }
  };

  // launchCameraAsync / launchImageLibraryAsync present a native modal, which can
  // fail to appear if invoked while an Alert is still dismissing. Defer the launch
  // until after the action sheet has fully closed.
  const showImageOptions = () => {
    Alert.alert(
      'Add a photo',
      'Choose an option',
      [
        { text: 'Camera', onPress: () => setTimeout(takePhoto, 300) },
        { text: 'Photo Library', onPress: () => setTimeout(pickImage, 300) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleSubmit = async () => {
    const missing = [];
    if (!mealName.trim()) missing.push('Meal name');
    if (!ingredients.trim()) missing.push('Ingredients');
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

    const effectiveUsername = normalizeUsername(user?.username);
    if (!effectiveUsername) {
      Alert.alert(
        'Session error',
        'We could not verify your username. Please sign out and sign in again.'
      );
      setIsSubmitting(false);
      return;
    }

    const cookedWithList = parseCookedWith(cookedWith);

    try {
      if (isEditing) {
        const updates = {
          title: mealName.trim(),
          ingredients: ingredients.trim(),
          rating,
          difficulty: difficulty.toLowerCase(),
          time: formatCookTime(cookHours, cookMinutes),
          recipeLink: recipeLink.trim(),
          recipeInstructions: recipeInstructions.trim(),
          dishType: dishType,
          cookedWith: cookedWithList,
        };
        if (photo) updates.photoUrl = photo;

        const response = await authFetch(`${API_URL}/updateRecipeLog`, {
          method: 'POST',
          body: JSON.stringify({
            username: effectiveUsername,
            logId: editPostId,
            updates,
          }),
        });

        const result = await response.json();

        if (response.ok && result.message) {
          Alert.alert('Updated!', 'Your changes have been saved.', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        } else {
          throw httpError(response, result);
        }
        return;
      }

      const logData = {
        username: effectiveUsername,
        title: mealName.trim(),
        ingredients: ingredients.trim(),
        rating,
        difficulty: difficulty.toLowerCase(),
        time: formatCookTime(cookHours, cookMinutes),
        dishType: dishType || undefined,
        photoUrl: photo || undefined,
        recipeLink: recipeLink.trim() || undefined,
        recipeInstructions: recipeInstructions.trim() || undefined,
      };

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
      const response = await authFetch(`${API_URL}/createRecipeLog`, {
        method: 'POST',
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
              setDishType(null);
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
        throw httpError(response, result);
      }
    } catch (error) {
      console.error('Error logging meal:', error);
      if (error instanceof AuthError) {
        Alert.alert('Please sign in again', 'Your session expired. Please sign in again to continue.');
      } else {
        Alert.alert(
          isEditing ? 'Could not save changes' : 'Could not log meal',
          friendlyError(error, {
            fallback: isEditing
              ? 'We couldn\u2019t save your changes. Please try again.'
              : 'We couldn\u2019t log your meal. Please try again.',
          })
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEditing ? 'Edit meal' : 'Log a meal'}</Text>
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

        {/* Dish Type */}
        <View style={styles.section}>
          <Text style={styles.label}>Dish type (optional)</Text>
          <View style={styles.dishTypeWrap}>
            {DISH_TYPES.map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.dishTypeChip,
                  dishType === type && styles.dishTypeChipSelected,
                ]}
                onPress={() => setDishType(dishType === type ? null : type)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.dishTypeChipText,
                    dishType === type && styles.dishTypeChipTextSelected,
                  ]}
                >
                  {capitalize(type)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
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
          <Text style={styles.label}>Recipe (optional)</Text>
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
            {isSubmitting
              ? isEditing
                ? 'Saving...'
                : 'Logging...'
              : isEditing
                ? 'Save changes'
                : 'Log meal'}
          </Text>
        </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <BottomNavigation navigation={navigation} activeTab="Post" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.card,
  },
  flex: {
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
  dishTypeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dishTypeChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  dishTypeChipSelected: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  dishTypeChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  dishTypeChipTextSelected: {
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

