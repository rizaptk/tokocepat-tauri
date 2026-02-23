import type { Product } from '@/lib/types';
import { PlaceHolderImages } from '@/lib/placeholder-images';

const getImageData = (id: string) => {
    const imageData = PlaceHolderImages.find(img => img.id === id);
    if (!imageData) {
        return { imageUrl: 'https://placehold.co/400x400', imageHint: 'placeholder' };
    }
    return { imageUrl: imageData.imageUrl, imageHint: imageData.imageHint };
}

export const initialProducts: Product[] = [
  { id: '1', name: 'Mie Instan', price: 3000, stock: 100, ...getImageData('product-1'), track_stock: true, has_variant: false, has_modifier: false, is_active: true },
  { id: '2', name: 'Air Mineral', price: 2500, stock: 150, ...getImageData('product-2'), track_stock: true, has_variant: false, has_modifier: false, is_active: true },
  { id: '3', name: 'Cokelat Batang', price: 8000, stock: 50, ...getImageData('product-3'), track_stock: true, has_variant: false, has_modifier: false, is_active: true },
  { id: '4', name: 'Keripik Kentang', price: 6000, stock: 75, ...getImageData('product-4'), track_stock: true, has_variant: false, has_modifier: false, is_active: true },
  { id: '5', name: 'Minuman Soda', price: 5000, stock: 80, ...getImageData('product-5'), track_stock: true, has_variant: false, has_modifier: false, is_active: true },
  { id: '6', name: 'Roti Tawar', price: 12000, stock: 40, ...getImageData('product-6'), track_stock: true, has_variant: false, has_modifier: false, is_active: true },
  { id: '7', name: 'Susu UHT', price: 7000, stock: 60, ...getImageData('product-7'), track_stock: true, has_variant: false, has_modifier: false, is_active: true },
  { id: '8', name: 'Telur (10 butir)', price: 25000, stock: 30, ...getImageData('product-8'), track_stock: true, has_variant: false, has_modifier: false, is_active: true },
  { id: '9', name: 'Kopi Bubuk', price: 15000, stock: 50, ...getImageData('product-9'), track_stock: true, has_variant: true, has_modifier: true, is_active: true },
  { id: '10', name: 'Teh Celup', price: 10000, stock: 65, ...getImageData('product-10'), track_stock: true, has_variant: false, has_modifier: false, is_active: true },
  { id: '11', name: 'Biskuit', price: 9000, stock: 90, ...getImageData('product-11'), track_stock: true, has_variant: false, has_modifier: false, is_active: true },
  { id: '12', name: 'Minyak Goreng', price: 32000, stock: 25, ...getImageData('product-12'), track_stock: true, has_variant: false, has_modifier: false, is_active: true },
];
