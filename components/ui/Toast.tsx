import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';

type ToastTone = 'success' | 'error' | 'info';
type ToastAction = { label: string; onPress: () => void };
type ToastApi = { showToast: (message: string, tone?: ToastTone, action?: ToastAction, duration?: number) => void };
const ToastContext = createContext<ToastApi>({ showToast: () => undefined });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; tone: ToastTone; action?: ToastAction } | null>(null);
  const showToast = useCallback((message: string, tone: ToastTone = 'info', action?: ToastAction, duration = 3200) => {
    setToast({ message, tone, action });
    setTimeout(() => setToast(null), duration);
  }, []);
  const value = useMemo(() => ({ showToast }), [showToast]);
  const color = toast?.tone === 'error' ? Colors.status.error : toast?.tone === 'success' ? Colors.status.success : Colors.brand.blue;
  return <ToastContext.Provider value={value}>{children}{toast ? <MotiView from={{ opacity: 0, translateY: -18 }} animate={{ opacity: 1, translateY: 0 }} exit={{ opacity: 0, translateY: -18 }} style={styles.wrap}><View accessibilityRole="alert" accessibilityLiveRegion="assertive" style={[styles.toast, { borderLeftColor: color }]}><Ionicons name={toast.tone === 'error' ? 'alert-circle-outline' : 'checkmark-circle-outline'} size={20} color={color} /><Text style={styles.text}>{toast.message}</Text>{toast.action ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={toast.action.label} style={styles.action} onPress={() => { toast.action?.onPress(); setToast(null); }}><Text style={[styles.actionText, { color }]}>{toast.action.label}</Text></TouchableOpacity> : null}</View></MotiView> : null}</ToastContext.Provider>;
}

export const useToast = () => useContext(ToastContext);
const styles = StyleSheet.create({ wrap: { position: 'absolute', top: 58, left: Spacing.md, right: Spacing.md, zIndex: 200 }, toast: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.white, borderRadius: Radius.md, borderLeftWidth: 4, padding: Spacing.md, shadowColor: Colors.black, shadowOpacity: 0.16, shadowRadius: 12, elevation: 8 }, text: { flex: 1, color: Colors.text.primary, fontSize: FontSize.sm, fontWeight: '700' }, action: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.sm }, actionText: { fontSize: FontSize.sm, fontWeight: '900' } });
