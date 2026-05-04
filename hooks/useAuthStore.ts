import { create } from 'zustand';

export interface AuthUser {
  user_id: string;
  email: string;
  full_name: string;
  phone?: string;
  is_admin: boolean;
  profile_photo_url?: string;
  idNumber?: string | null;
  id_number?: string | null;
  fashion_style?: string | null;
  preferred_size?: string | null;
  skin_tone_detected?: boolean;
  skin_hex?: string | null;
  body_chest_cm?: number | null;
  body_waist_cm?: number | null;
  body_hip_cm?: number | null;
  body_height_cm?: number | null;
}

type Draft = Partial<{
  email: string;
  password: string;
  full_name: string;
  first_name: string;
  last_name: string;
  alias: string;
  phone: string;
  id_type: string;
  // To this: // id_type_id: number; // id_type_label: string; // keep for display purposes
  id_number: string;
  front_id_url: string;
  back_id_url: string;
  shipping_address: string;
  fashion_style: string;
  preferred_size: string;
  skin_hex: string | null;
  body_chest_cm: number | null;
  body_waist_cm: number | null;
  body_hip_cm: number | null;
  body_height_cm: number | null;
}>;

interface AuthStore {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  draft: Draft;
  setDraft: (data: Draft) => void;
  clearDraft: () => void;
  setUser: (user: AuthUser, token: string) => void;
  logout: () => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: null,
  isLoading: false,
  error: null,
  draft: {},
  setDraft: (data) => set((state) => ({ draft: { ...state.draft, ...data } })),
  clearDraft: () => set({ draft: {} }),
  setUser: (user, token) => set({ user, token, error: null }),
  logout: () => set({ user: null, token: null, draft: {} }),
  setError: (error) => set({ error }),
  setLoading: (isLoading) => set({ isLoading }),
}));
