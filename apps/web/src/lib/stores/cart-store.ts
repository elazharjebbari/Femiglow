'use client';

import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CartItem } from '@/lib/schemas';

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  isMiniCartOpen: boolean;
  hydrated: boolean;
  shippingCity?: string;
  addItem: (item: CartItem) => void;
  addItemAndOpen: (item: CartItem) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clear: () => void;
  open: () => void;
  close: () => void;
  toggle: () => void;
  openMiniCart: () => void;
  closeMiniCart: () => void;
  setHydrated: () => void;
  setShippingCity: (city: string | undefined) => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      isOpen: false,
      isMiniCartOpen: false,
      hydrated: false,

      addItem: (item) =>
        set((state) => {
          const existing = state.items.find((i) => i.productId === item.productId);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.productId === item.productId
                  ? { ...i, quantity: i.quantity + item.quantity }
                  : i,
              ),
            };
          }
          return { items: [...state.items, item] };
        }),

      addItemAndOpen: (item) =>
        set((state) => {
          const existing = state.items.find((i) => i.productId === item.productId);
          const items = existing
            ? state.items.map((i) =>
                i.productId === item.productId
                  ? { ...i, quantity: i.quantity + item.quantity }
                  : i,
              )
            : [...state.items, item];
          return { items, isMiniCartOpen: true };
        }),

      removeItem: (productId) =>
        set((state) => ({
          items: state.items.filter((i) => i.productId !== productId),
        })),

      updateQuantity: (productId, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((i) => i.productId !== productId)
              : state.items.map((i) =>
                  i.productId === productId ? { ...i, quantity } : i,
                ),
        })),

      clear: () => set({ items: [] }),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      toggle: () => set((state) => ({ isOpen: !state.isOpen })),
      openMiniCart: () => set({ isMiniCartOpen: true }),
      closeMiniCart: () => set({ isMiniCartOpen: false }),
      setHydrated: () => set({ hydrated: true }),
      setShippingCity: (city) => set({ shippingCity: city }),
    }),
    {
      name: 'femiglow-cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        items: state.items,
        shippingCity: state.shippingCity,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Migration silencieuse : les paniers persistés avant le passage
          // SVG→PNG des assets kit gardent en cache `kit-principale.svg`
          // (placeholder). On réécrit au vol pour ne pas afficher le SVG
          // sur `/panier` après update sans forcer l'utilisateur à vider
          // son panier.
          state.items = state.items.map((item) =>
            item.imageSrc?.endsWith('.svg')
              ? { ...item, imageSrc: item.imageSrc.replace(/\.svg$/, '.png') }
              : item,
          );
        }
        state?.setHydrated();
      },
    },
  ),
);

export function useCartHydrated(): boolean {
  const hydrated = useCartStore((s) => s.hydrated);
  const [ready, setReady] = useState(hydrated);

  useEffect(() => {
    if (ready) return;
    if (useCartStore.persist.hasHydrated()) {
      useCartStore.setState({ hydrated: true });
      setReady(true);
      return;
    }
    const unsub = useCartStore.persist.onFinishHydration(() => {
      useCartStore.setState({ hydrated: true });
      setReady(true);
    });
    return () => {
      unsub();
    };
  }, [ready]);

  return ready || hydrated;
}

export const selectCartCount = (state: CartState): number =>
  state.items.reduce((sum, item) => sum + item.quantity, 0);

export const selectSubtotalCents = (state: CartState): number =>
  state.items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);

export const selectEstimatedShippingCents = (state: CartState): number => {
  if (state.items.length === 0) return 0;
  const city = state.shippingCity?.toLowerCase().trim();
  if (city === 'casablanca' || city === 'casa') return 4000;
  return 6000;
};

export const selectTotalCents = (state: CartState): number =>
  selectSubtotalCents(state) + selectEstimatedShippingCents(state);
