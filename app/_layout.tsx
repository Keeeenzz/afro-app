import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export default function RootLayout() {
  usePushNotifications();
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
