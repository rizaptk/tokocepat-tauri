"use client";

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ListMode = 'list' | 'card' | 'thumbnail';

interface ToastList {
    saveCart: boolean,
    noModifier: boolean,
}

interface ModeLocation {
    cart: ListMode,
    product: ListMode,
    inventory: ListMode
}

interface SettingsState {
    showToast: ToastList,
    setShowToast: (showToast: Partial<ToastList>) => void,

    showMode: ModeLocation,
    setShowMode: (showMode: Partial<ModeLocation>) => void,
}

export const useSettingsStore = create<SettingsState>()(
    persist((set) => ({
        showMode: {
            cart: 'card',
            product: 'thumbnail',
            inventory: 'list',
        },
        setShowMode: (showMode: Partial<ModeLocation>) => set((state) => ({showMode: { ...state.showMode, ...showMode }})),
        showToast: {
            saveCart: false,
            noModifier: false,
        },
        setShowToast: (showToast: Partial<ToastList>) => set((state) => ({showToast: { ...state.showToast, ...showToast }})),
        }),
        {
            name: 'tokoc-settings',
        }
    )
)