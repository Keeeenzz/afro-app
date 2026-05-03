import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Image,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { Colors, FontSize, Spacing } from '@/constants/theme';

export default function SignInPage() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      {/* Logo / Brand area */}
      <View style={styles.logoContainer}>
        <View style={styles.logoCircle}>
          {/* Replace with actual logo image if available */}
          <Text style={styles.logoIcon}>🦁</Text>
        </View>
        <Text style={styles.brand}>A'FRO</Text>
        <Text style={styles.tagline}>Dry Goods</Text>
        <Text style={styles.sub}>THRIFT · STYLE · COMMUNITY</Text>
      </View>

      {/* Bottom CTA */}
      <View style={styles.bottom}>
        <View style={styles.actions}>
          <Button
            label="Login"
            onPress={() => router.push('/(auth)/login')}
            variant="outline"
            style={styles.btnHalf}
          />
          <Button
            label="Sign up"
            onPress={() => router.push('/(auth)/signup')}
            variant="primary"
            style={styles.btnHalf}
          />
        </View>

        <Text style={styles.terms}>
          By signing up, you agree to our{' '}
          <Text style={styles.termsLink}>Terms</Text>.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  logoContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.bg.card,
    borderWidth: 2,
    borderColor: Colors.border.active,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    shadowColor: Colors.brand.blue,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  logoIcon: {
    fontSize: 48,
  },
  brand: {
    fontSize: FontSize['3xl'],
    fontWeight: '900',
    color: Colors.white,
    letterSpacing: 4,
  },
  tagline: {
    fontSize: FontSize.lg,
    fontWeight: '300',
    color: Colors.text.secondary,
    letterSpacing: 2,
    marginTop: 2,
  },
  sub: {
    fontSize: FontSize.xs,
    color: Colors.text.muted,
    letterSpacing: 3,
    marginTop: 8,
  },
  bottom: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing['2xl'],
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: Spacing.md,
  },
  btnHalf: {
    flex: 1,
  },
  terms: {
    textAlign: 'center',
    fontSize: FontSize.xs,
    color: Colors.text.muted,
  },
  termsLink: {
    color: Colors.text.link,
    textDecorationLine: 'underline',
  },
});