
"use client";

import { create } from 'zustand';
import { Transaction } from './types';

interface PrintState {
  printQueue: Transaction[];
  addToQueue: (transaction: Transaction) => void;
  getAndRemoveFirstFromQueue: () => Transaction | undefined;
}

export const usePrintStore = create<PrintState>((set, get) => ({
  printQueue: [],
  addToQueue: (transaction) => {
    set((state) => ({
      printQueue: [...state.printQueue, transaction],
    }));
  },
  getAndRemoveFirstFromQueue: () => {
    const queue = get().printQueue;
    if (queue.length === 0) {
      return undefined;
    }
    const firstItem = queue[0];
    set({ printQueue: queue.slice(1) });
    return firstItem;
  },
}));
