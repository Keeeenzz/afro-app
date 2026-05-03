import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, FontSize, Spacing } from '@/constants/theme';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  showBack?: boolean;
}

export function ScreenHeader({ title, subtitle, icon, showBack = true }: ScreenHeaderProps) {
  const router = useRouter();
  return (
    <View style={styles.container}>
      {showBack && (
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color={Colors.text.primary} />
        </TouchableOpacity>
      )}
      <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>
        {icon && <Ionicons name={icon} size={26} color={Colors.brand.blue} style={styles.icon} />}
      </View>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.xl },
  backBtn: { marginBottom: Spacing.md, alignSelf: 'flex-start' },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: FontSize['2xl'], fontWeight: '800', color: Colors.text.primary, letterSpacing: -0.5, flexShrink: 1 },
  icon: { marginLeft: 10 },
  subtitle: { fontSize: FontSize.base, color: Colors.text.secondary, marginTop: 8, lineHeight: 22 },
});