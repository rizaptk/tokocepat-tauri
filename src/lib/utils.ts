import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatDistance, formatDistanceToNow } from 'date-fns'
import { id } from 'date-fns/locale'
import { Beaker, Layers2, Package } from "lucide-react"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


function normalizeIndoShort(text: string): string {
  return text
    // hapus kata tidak perlu
    .replace('sekitar ', '')

    // ubah satuan ke short
    .replace(' detik', ' dtk')
    .replace(' menit', ' mnt')
    .replace(' jam', ' jam')
    .replace(' bulan', ' bln')
    .replace(' tahun', ' thn')
    .replace('waktu', '')

    // rapihin suffix
    // .replace(' yang lalu', ' lalu')
    .replace('dalam ', '') // opsional: kalau mau future → "5 mnt"
}

export function formatDistanceShort(start: Date, end: Date) {
  const raw = formatDistance(start, end, {
    addSuffix: true,
    locale: id
  })

  return normalizeIndoShort(raw)
}

export function formatDistanceToNowShort(date: Date | number) {
  const raw = formatDistanceToNow(date, {
    addSuffix: true,
    locale: id
  })

  return normalizeIndoShort(raw)
}

export const itemMapping = new Map<string, string>([
  ['product', 'produk'],
  ['PRODUCT', 'PRODUK'],
  ['Product', 'Produk'],
  ['ingredient', 'bahan'],
  ['INGREDIENT', 'BAHAN'],
  ['Ingredient', 'Bahan'],
  ['variant', 'varian'],
  ['VARIANT', 'VARIAN'],
  ['Variant', 'Varian']
])

export const typeConfig = {
  product: {
    icon: Package,
    badge: 'success',
    class: 'border-blue-300 bg-blue-50 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-700'
  },
  ingredient: {
    icon: Beaker,
    badge: 'warning',
    class: 'border-purple-300 bg-purple-50 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200 dark:border-purple-700'
  },
  variant: {
    icon: Layers2,
    badge: 'info',
    class: 'border-green-300 bg-green-50 text-green-800 dark:bg-green-900/40 dark:text-green-200 dark:border-green-700'
  }
}
