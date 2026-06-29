import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

// Show notifications while the app is foregrounded. SDK 54 uses the
// banner/list flags (the older shouldShowAlert is deprecated).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const ANDROID_CHANNEL_ID = 'default';

function getProjectId() {
  return (
    Constants?.expoConfig?.extra?.eas?.projectId ||
    Constants?.easConfig?.projectId ||
    null
  );
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF6B6B',
  });
}

/**
 * Request permission and resolve the device's Expo push token.
 * Returns null (without throwing) when running on a simulator, when permission
 * is denied, in Expo Go on SDK 53+, or on any other failure — callers treat a
 * null token as "no push for this device" and carry on.
 */
export async function registerForPushNotificationsAsync() {
  try {
    await ensureAndroidChannel();

    if (!Device.isDevice) {
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      return null;
    }

    const projectId = getProjectId();
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return tokenResponse?.data || null;
  } catch (err) {
    console.log('Could not register for push notifications:', err.message);
    return null;
  }
}

export function addPushTokenListener(listener) {
  return Notifications.addPushTokenListener((event) => {
    listener(event?.data || null);
  });
}

export function addNotificationResponseListener(listener) {
  return Notifications.addNotificationResponseReceivedListener(listener);
}

export async function getLastNotificationResponse() {
  try {
    return await Notifications.getLastNotificationResponseAsync();
  } catch {
    return null;
  }
}
