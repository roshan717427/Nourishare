# Nourishare Frontend

React Native mobile app built with **Expo SDK 54**, React Navigation, and Firebase Auth.
Talks to the Vercel API at `https://nourishare.vercel.app/api` (see `config/api.js`).

## Getting Started

### Prerequisites

- Node.js 18+ (20+ recommended)
- npm
- Expo Go for light UI work, **or** iOS Simulator / Android Emulator
- For push notifications and production-parity testing: an **EAS development build** or **TestFlight** install

```bash
npm install
npm start                 # Metro bundler
npm run ios               # native iOS (requires Xcode / ios/ project)
npm run android           # native Android
npm run start:tunnel      # Expo tunnel (helpful across networks)
```

Prefer `npx expo …` / project scripts over a global `expo-cli` install.

### Project Structure

```
/
├── App.js                 # Auth gate + stack navigation + push deep links
├── app.json               # Expo / iOS / Android config
├── screens/               # UI screens (auth, home, explore, AI, profile, etc.)
├── components/            # Shared UI (bottom nav, safety menu, onboarding, …)
├── context/               # AuthContext, OnboardingContext, NextUpContext
├── config/                # api.js, firebase.js, legal.js
├── utils/                 # auth helpers, push, errors, feed helpers
├── constants/             # theme tokens
├── assets/                # images / icons
└── ios/                   # native iOS (EAS)
```

### Screens (current)

Auth: `Login`, `SignUp`, `ForgotPassword`, `FinishProfile`  
Main: `Home`, `Explore`, `LogMeal`, `AISuggestions`, `MealPlan`, `Profile`, `Notifications`  
Detail: `PostDetail`, `RecipeDetail`, `FollowList`

Bottom navigation is implemented in `components/BottomNavigation.js`.

## Features (high level)

- Email/password auth (Firebase) and username profiles
- Social feed, follow request/accept, likes, comments, Report/Block
- Meal logging with camera/library photos (stored as data URLs on log docs — not Firebase Storage)
- Meal plans (“Cook Next”) via `/api/mealPlan?action=…` and portfolio favorites
- AI suggestions via `/api/aiSuggestions?action=loadCached|generate|hide` (Gemini + daily limits)
- Push notifications (Expo Push) on a real device / store build
- Account deletion via API

## API Integration

```js
// config/api.js
export const API_URL = 'https://nourishare.vercel.app/api';
// For local API: uncomment localhost override in that file
```

Protected calls send `Authorization: Bearer <Firebase ID token>` (`utils/apiAuth.js`).
Helpers: `utils/aiSuggestionsApi.js`, `utils/mealPlanApi.js`.

## Authentication

Handled by `context/AuthContext.js` (Firebase Auth + profile readiness / Finish Profile flow).
Username login resolves email via `social?action=signInEmail` before Firebase
`signInWithEmailAndPassword`. There is **no** hardcoded `current_user` username.

## Photos

`expo-image-picker` captures a local image and sends a **base64 data URL** as `photoUrl` on create/update log.
Uploads are safety-checked on the server (Gemini) when configured.

## Navigation

- React Navigation **stack** for auth vs main flows and detail screens
- Custom **bottom tab** bar (`BottomNavigation`) for Home / Explore / AI / Post / Profile

## Troubleshooting

- Camera / library permissions: declared in `app.json` `ios.infoPlist` and the image-picker plugin
- API issues: confirm `config/api.js`, device can reach Vercel, and the Firebase token is valid
- Metro / EMFILE: [metro-troubleshooting.md](./metro-troubleshooting.md)
- Device connection: [expo-guide.md](./expo-guide.md)

## Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/)
- [React Native Documentation](https://reactnative.dev/)
- [Firebase Auth](https://firebase.google.com/docs/auth)
