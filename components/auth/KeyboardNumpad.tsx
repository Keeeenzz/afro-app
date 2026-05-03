import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';

interface KeyboardNumpadProps {
  onPress: (key: string) => void;
  onDelete: () => void;
}

export function KeyboardNumpad({ onPress, onDelete }: KeyboardNumpadProps) {
  const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫'];
  return (
    <View style={styles.grid}>
      {keys.map((key, i) => (
        key === ''
          ? <View key={i} style={styles.key} />
          : key === '⌫'
          ? (
            <TouchableOpacity key={i} style={styles.key} onPress={onDelete} activeOpacity={0.6}>
              <Ionicons name="backspace-outline" size={22} color={Colors.text.primary} />
            </TouchableOpacity>
          )
          : (
            <TouchableOpacity key={i} style={styles.key} onPress={() => onPress(key)} activeOpacity={0.6}>
              <Text style={styles.keyText}>{key}</Text>
            </TouchableOpacity>
          )
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: Spacing.lg },
  key: { width: '33.33%', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md },
  keyText: { fontSize: FontSize.xl, fontWeight: '500', color: Colors.text.primary },
});