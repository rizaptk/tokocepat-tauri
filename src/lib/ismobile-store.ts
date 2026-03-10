"use client";

import { create } from 'zustand';

interface isMobileState {
  isMobile: boolean;
  setIsMobile: (isMobile: boolean) => void;
}

export const useIsMobile = create<isMobileState>((set) => ({
  isMobile: false,
  setIsMobile: (isMobile: boolean) => set({ isMobile }),
}));

