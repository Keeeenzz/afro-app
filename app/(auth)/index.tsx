import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { Colors, FontSize, Spacing } from '@/constants/theme';

export default function SignInPage() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.logoContainer}>
        <View style={styles.logoTile}>
          <Image source={require('../../assets/afro-logo-black.png')} style={styles.logoImage} resizeMode="contain" />
        </View>
        <View style={styles.brandTextWrap}>
          <Text style={styles.brand}>A'FRO</Text>
          <Text style={styles.tagline}>Dry Goods</Text>
          <Text style={styles.sub}>THRIFT - STYLE - COMMUNITY</Text>
        </View>
      </View>

      <View style={styles.bottom}>
        <View style={styles.actions}>
          <Button
            label="Log in"
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
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  logoTile: {
    width: 210,
    height: 210,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  brandTextWrap: {
    alignItems: 'center',
    marginBottom: 0,
  },
  brand: {
    fontSize: FontSize['3xl'],
    fontWeight: '900',
    color: Colors.text.primary,
    textAlign: 'center',
  },
  tagline: {
    fontSize: FontSize['2xl'],
    fontWeight: '900',
    color: Colors.text.primary,
    marginTop: -4,
    textAlign: 'center',
  },
  sub: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    letterSpacing: 2,
    marginTop: Spacing.sm,
  },
  logoImage: {
    height: 200,
    width: 200,
  },
  bottom: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing['2xl'],
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  btnHalf: {
    flex: 1,
  },
});
