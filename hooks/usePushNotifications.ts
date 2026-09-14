import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { apiPost } from '@/lib/api';
import { getNotificationsModule } from '@/lib/notificationRuntime';
import { useAuthStore } from './useAuthStore';

const Notifications = getNotificationsModule();

Notifications?.setNotificationHandler({ handleNotification: async () => ({ shouldShowAlert: true, shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });

export function usePushNotifications() {
  const router = useRouter();
  const { user, token } = useAuthStore();

  useEffect(() => {
    if (!user?.user_id || !Device.isDevice || !Notifications) return;
    let responseSubscription: ReturnType<typeof Notifications.addNotificationResponseReceivedListener> | undefined;
    let receivedSubscription: ReturnType<typeof Notifications.addNotificationReceivedListener> | undefined;

    const register = async () => {
      const existing = await Notifications.getPermissionsAsync();
      const permissions = existing.status === 'granted' ? existing : await Notifications.requestPermissionsAsync();
      if (permissions.status !== 'granted') return;
      if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('default', { name: 'Default', importance: Notifications.AndroidImportance.MAX });
      const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) return; // A development build needs an EAS project ID before Expo can issue a token.
      const expoPushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      await apiPost(`/notifications/users/${user.user_id}/push-token`, { token: expoPushToken }, token);
    };

    void register().catch(() => undefined);
    receivedSubscription = Notifications.addNotificationReceivedListener(() => undefined);
    responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { type?: string; orderId?: string };
      if (data.type === 'order' && data.orderId) router.push({ pathname: '/(tabs)/orders', params: { orderId: data.orderId } });
      if (data.type === 'chat') router.push('/(tabs)/messages');
    });
    return () => { receivedSubscription?.remove(); responseSubscription?.remove(); };
  }, [router, token, user?.user_id]);
}
