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

export const reasonMapping = new Map<string, string>([
  ['restock', 'masuk'],
  ['initial_balance', 'penyesuaian'],
  ['correction', 'koreksi'],
  ['damaged', 'rusak'],
  ['lost', 'hilang'],
  ['sale', 'penjualan']
])

export const typeConfig = {
  product: {
    icon: Package,
    badge: 'success',
    class: 'border-indigo-500 bg-primary/5 text-primary'
  },
  ingredient: {
    icon: Beaker,
    badge: 'warning',
    class: 'border-warning bg-warning/5 text-warning'
  },
  variant: {
    icon: Layers2,
    badge: 'info',
    class: 'border-green-500 bg-success/5 text-success-foreground'
  }
}
