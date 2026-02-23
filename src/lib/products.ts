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
  { id: '1', name: 'Mie Instan', price: 3000, stock: 100, ...getImageData('product-1') },
  { id: '2', name: 'Air Mineral', price: 2500, stock: 150, ...getImageData('product-2') },
  { id: '3', name: 'Cokelat Batang', price: 8000, stock: 50, ...getImageData('product-3') },
  { id: '4', name: 'Keripik Kentang', price: 6000, stock: 75, ...getImageData('product-4') },
  { id: '5', name: 'Minuman Soda', price: 5000, stock: 80, ...getImageData('product-5') },
  { id: '6', name: 'Roti Tawar', price: 12000, stock: 40, ...getImageData('product-6') },
  { id: '7', name: 'Susu UHT', price: 7000, stock: 60, ...getImageData('product-7') },
  { id: '8', name: 'Telur (10 butir)', price: 25000, stock: 30, ...getImageData('product-8') },
  { id: '9', name: 'Kopi Bubuk', price: 15000, stock: 50, ...getImageData('product-9') },
  { id: '10', name: 'Teh Celup', price: 10000, stock: 65, ...getImageData('product-10') },
  { id: '11', name: 'Biskuit', price: 9000, stock: 90, ...getImageData('product-11') },
  { id: '12', name: 'Minyak Goreng', price: 32000, stock: 25, ...getImageData('product-12') },
];
