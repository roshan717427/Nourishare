# Firebase Authentication Setup

This app uses **Firebase Authentication (email/password)** via the Firebase JS
(web) SDK, which runs in **Expo Go** without a native rebuild.

## 1. Enable Email/Password sign-in

1. Open the [Firebase console](https://console.firebase.google.com/) and select
   your project.
2. Go to **Build → Authentication → Sign-in method**.
3. Click **Email/Password**, toggle **Enable**, and **Save**.

Without this step, login and sign-up will fail with
`auth/operation-not-allowed`.

## 2. Get your Firebase web app config

1. In the Firebase console go to **Project settings** (gear icon) → **General**.
2. Under **Your apps**, add a **Web app** (`</>`) if you don't already have one.
3. Copy the `firebaseConfig` object shown under **SDK setup and configuration →
   Config**. It looks like:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abc123",
};
```

> The Firebase web `apiKey` is a **public client identifier**, not a secret.
> Access is controlled by your enabled auth providers and Firestore rules.

## 3. Paste the config

You can supply the config in **either** location:

### Option A — directly in `config/firebase.js`

Set the `firebaseConfig` defaults in `config/firebase.js` (or leave them and
override via Option B).

### Option B — via `app.json` (keeps it out of `config/firebase.js`)

Add an `extra.firebase` block to `app.json`; `config/firebase.js` reads it
through `expo-constants` and these values take precedence over the placeholders:

```json
{
  "expo": {
    "extra": {
      "firebase": {
        "apiKey": "AIza...",
        "authDomain": "your-project.firebaseapp.com",
        "projectId": "your-project",
        "storageBucket": "your-project.appspot.com",
        "messagingSenderId": "1234567890",
        "appId": "1:1234567890:web:abc123"
      }
    }
  }
}
```

## 4. Restart the dev server

After editing config, fully restart Expo (stop and re-run `expo start`) so the
new values are picked up.

---

## How auth works in this app

- **Packages:** `firebase` (JS SDK) and
  `@react-native-async-storage/async-storage` (session persistence), both
  installed via `npx expo install`.
- **Client config:** `config/firebase.js` initializes the app and exports
  `auth`. It uses `initializeAuth` with `getReactNativePersistence(AsyncStorage)`
  so sessions survive app restarts, falling back to `getAuth` if needed.
- **Auth state:** `context/AuthContext.js` subscribes to `onAuthStateChanged`
  and maps the Firebase user to `{ uid, email, username, name }`. Social graph
  mutations go through `/api/social?action=…` with a Bearer token.

### Username vs email

Firebase auth keys off **email**, but the app's social features key off a
public **username**. We reconcile them as follows:

- **Sign up:** the account is created with email + password, then the public
  profile is created via `POST /api/createUserProfile` (username, first/last
  name, email, terms acceptance).
- **Log in:** the identifier field accepts a username **or** an email. If it's a
  username, the app looks up the stored email via
  `GET /api/social?action=signInEmail&username=` and then signs in with email +
  password. If you type an email directly (contains `@`), it's used as-is.

Auth errors (wrong password, user not found, email already in use, weak
password, etc.) are surfaced to the user via `Alert`.
