import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({ label, onPress, variant = 'primary', loading = false, disabled = false, style, textStyle }: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
      style={[styles.base, variant === 'primary' && styles.primary, variant === 'outline' && styles.outline, variant === 'ghost' && styles.ghost, isDisabled && styles.disabled, style]}
    >
      {loading
        ? <ActivityIndicator color={variant === 'primary' ? Colors.white : Colors.brand.blue} size="small" />
        : <Text style={[styles.label, variant === 'outline' && styles.labelOutline, variant === 'ghost' && styles.labelGhost, textStyle]}>{label}</Text>
      }
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: { height: 52, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg },
  primary: { backgroundColor: Colors.brand.blue },
  outline: { backgroundColor: Colors.transparent, borderWidth: 1.5, borderColor: Colors.brand.blue },
  ghost: { backgroundColor: Colors.transparent },
  disabled: { opacity: 0.45 },
  label: { fontSize: FontSize.base, fontWeight: '600', color: Colors.white, letterSpacing: 0.3 },
  labelOutline: { color: Colors.brand.blue },
  labelGhost: { color: Colors.text.secondary },
});