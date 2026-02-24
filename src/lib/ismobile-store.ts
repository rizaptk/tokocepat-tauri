"use client";

import { create } from 'zustand';
import { useEffect } from 'react';

interface isMobileState {
  isMobile: boolean;
  setIsMobile: (isMobile: boolean) => void;
}

export const useIsMobile = create<isMobileState>((set) => ({
  isMobile: false,
  setIsMobile: (isMobile: boolean) => set({ isMobile }),
}));

