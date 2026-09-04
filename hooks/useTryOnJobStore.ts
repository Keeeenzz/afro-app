import { create } from 'zustand';
import type { TryOnResult } from '@/lib/tryOn';

type StoredProduct = {
  id: string;
  name: string;
  imageUrl?: string | null;
  [key: string]: unknown;
};

type TryOnJobStatus = 'idle' | 'generating' | 'result' | 'error';

type TryOnJobStore = {
  status: TryOnJobStatus;
  progress: number;
  personUri: string;
  selectedProducts: StoredProduct[];
  result: TryOnResult | null;
  displayResultUri: string;
  error: string;
  startedAt: number | null;
  start: (payload: {
    personUri: string;
    selectedProducts: StoredProduct[];
  }) => void;
  setProgress: (progress: number) => void;
  complete: (payload: { result: TryOnResult | null; displayResultUri: string }) => void;
  fail: (error: string) => void;
  clear: () => void;
};

export const useTryOnJobStore = create<TryOnJobStore>((set) => ({
  status: 'idle',
  progress: 0,
  personUri: '',
  selectedProducts: [],
  result: null,
  displayResultUri: '',
  error: '',
  startedAt: null,
  start: ({ personUri, selectedProducts }) =>
    set({
      status: 'generating',
      progress: 0,
      personUri,
      selectedProducts,
      result: null,
      displayResultUri: '',
      error: '',
      startedAt: Date.now(),
    }),
  setProgress: (progress) =>
    set({
      progress: Math.min(100, Math.max(0, Math.round(progress))),
    }),
  complete: ({ result, displayResultUri }) =>
    set({
      status: 'result',
      progress: 100,
      result,
      displayResultUri,
      error: '',
    }),
  fail: (error) =>
    set({
      status: 'error',
      progress: 0,
      error,
    }),
  clear: () =>
    set({
      status: 'idle',
      progress: 0,
      personUri: '',
      selectedProducts: [],
      result: null,
      displayResultUri: '',
      error: '',
      startedAt: null,
    }),
}));
