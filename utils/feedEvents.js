import { DeviceEventEmitter } from 'react-native';

export const FEED_POST_UPDATED = 'feedPostUpdated';
export const HOME_TAB_PRESS = 'homeTabPress';

export function emitFeedPostUpdated(payload) {
  DeviceEventEmitter.emit(FEED_POST_UPDATED, payload);
}

export function emitHomeTabPress() {
  DeviceEventEmitter.emit(HOME_TAB_PRESS);
}
