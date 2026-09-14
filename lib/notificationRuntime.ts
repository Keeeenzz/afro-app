import Constants from 'expo-constants';
import type * as ExpoNotifications from 'expo-notifications';

type NotificationsModule = typeof ExpoNotifications;

/**
 * Remote push notifications require a development or production build on the
 * current Expo SDK. Importing the native module in Expo Go throws before a
 * route can load, so load it only where the native runtime is available.
 */
export function getNotificationsModule(): NotificationsModule | null {
  const isExpoGo =
    Constants.executionEnvironment === 'storeClient' ||
    Constants.appOwnership === 'expo';

  if (isExpoGo) return null;

  try {
    return require('expo-notifications') as NotificationsModule;
  } catch {
    return null;
  }
}

export function isExpoGoRuntime(): boolean {
  return (
    Constants.executionEnvironment === 'storeClient' ||
    Constants.appOwnership === 'expo'
  );
}
