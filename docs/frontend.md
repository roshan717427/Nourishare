# Nourishare Frontend

React Native mobile app built with Expo and React Navigation.

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- npm or yarn
- Expo CLI: `npm install -g expo-cli`
- Expo Go app on your iOS/Android device, or iOS Simulator / Android Emulator

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the Expo development server:
```bash
npm start
```

3. Run on specific platform:
```bash
# iOS
npm run ios

# Android
npm run android

# Web
npm run web
```

### Project Structure

```
/
├── App.js                    # Main app entry point with navigation
├── app.json                  # Expo configuration
├── screens/                  # Screen components
│   ├── HomeScreen.js        # Home screen
│   └── LogMealScreen.js     # Log a meal form screen
├── components/               # Reusable components
│   └── BottomNavigation.js  # Bottom tab navigation
├── config/                   # Configuration files
│   └── api.js               # API endpoint configuration
└── assets/                   # Images, fonts, etc.
```

## Features

### Log Meal Screen

The Log Meal screen allows users to:
- Enter meal name
- Add a photo (from camera or photo library)
- Add ingredients
- Add notes
- Rate the meal (1-5)
- Select difficulty (Easy, Medium, Hard)
- Enter cooking time
- Enter recipe source
- Submit the meal log to the backend API

### API Integration

The app connects to the backend API at:
- Production: `https://nourishare.vercel.app/api`
- Development: `http://localhost:3000/api` (when using local backend)

Update the API URL in `config/api.js` if needed.

## Environment Variables

Create a `.env` file in the root directory for environment-specific variables:

```
API_URL=https://nourishare.vercel.app/api
```

Note: For Expo, you may need to use `expo-constants` or `react-native-config` to access environment variables.

## Authentication

Currently, the app uses a hardcoded username (`'current_user'`). You'll need to:
1. Implement authentication (Firebase Auth, Auth0, etc.)
2. Store the authenticated user's information
3. Pass the username from the auth context to the LogMealScreen

## Photo Upload

The photo picker currently stores the image URI locally. To fully implement photo upload:
1. Upload images to Firebase Storage or similar service
2. Get the public URL of the uploaded image
3. Pass the URL (not the local URI) to the API

## Navigation

The app uses React Navigation:
- Stack Navigator for main navigation
- Bottom Tab Navigator for bottom navigation (to be fully implemented)

## Next Steps

- [ ] Implement user authentication
- [ ] Add photo upload to Firebase Storage
- [ ] Create remaining screens (Search, Suggestions, Profile)
- [ ] Implement social feed screen
- [ ] Add recipe viewing and editing screens
- [ ] Add pull-to-refresh functionality
- [ ] Implement offline support

## Troubleshooting

### Image Picker Issues
- Make sure camera/photo library permissions are granted
- On iOS, add camera usage description to `app.json`:
```json
"ios": {
  "infoPlist": {
    "NSCameraUsageDescription": "We need access to your camera to take photos of meals.",
    "NSPhotoLibraryUsageDescription": "We need access to your photo library to select meal photos."
  }
}
```

### API Connection Issues
- Check that the API URL in `config/api.js` is correct
- Verify your device/simulator can reach the API endpoint
- Check backend logs for errors

## Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/)
- [React Native Documentation](https://reactnative.dev/)

