import type { Product, ProductVariant, ModifierGroup, Category } from '@/lib/types';
import { PlaceHolderImages } from '@/lib/placeholder-images';

const getImageData = (id: string) => {
    const imageData = PlaceHolderImages.find(img => img.id === id);
    if (!imageData) {
        return { imageUrl: 'https://placehold.co/400x400', imageHint: 'placeholder' };
    }
    return { imageUrl: imageData.imageUrl, imageHint: imageData.imageHint };
}

export const initialCategories: Category[] = [
  { id: 'cat-1', name: 'Minuman', is_active: true },
  { id: 'cat-2', name: 'Makanan Ringan', is_active: true },
  { id: 'cat-3', name: 'Kebutuhan Pokok', is_active: true },
  { id: 'cat-4', name: 'Kopi & Teh', is_active: true },
];

export const initialProducts: Product[] = [
  { id: '1', name: 'Mie Instan', price: 3000, cost_price: 2500, stock: 100, ...getImageData('product-1'), track_stock: true, has_variant: false, has_modifier: false, is_active: true, product_type: 'retail', category_id: 'cat-2', low_stock_alert: 20 },
  { id: '2', name: 'Air Mineral', price: 2500, cost_price: 1800, stock: 150, ...getImageData('product-2'), track_stock: true, has_variant: false, has_modifier: false, is_active: true, product_type: 'retail', category_id: 'cat-1' },
  { id: '3', name: 'Cokelat Batang', price: 8000, cost_price: 6000, stock: 50, ...getImageData('product-3'), track_stock: true, has_variant: false, has_modifier: false, is_active: true, product_type: 'retail', category_id: 'cat-2', low_stock_alert: 10 },
  { id: '4', name: 'Keripik Kentang', price: 6000, cost_price: 4500, stock: 75, ...getImageData('product-4'), track_stock: true, has_variant: false, has_modifier: false, is_active: true, product_type: 'retail', category_id: 'cat-2', low_stock_alert: 15 },
  { id: '5', name: 'Minuman Soda', price: 5000, cost_price: 3500, stock: 80, ...getImageData('product-5'), track_stock: true, has_variant: false, has_modifier: false, is_active: true, product_type: 'retail', category_id: 'cat-1' },
  { id: '6', name: 'Roti Tawar', price: 12000, cost_price: 9000, stock: 40, ...getImageData('product-6'), track_stock: true, has_variant: false, has_modifier: false, is_active: true, product_type: 'retail', category_id: 'cat-3' },
  { id: '7', name: 'Susu UHT', price: 7000, cost_price: 5500, stock: 60, ...getImageData('product-7'), track_stock: true, has_variant: false, has_modifier: false, is_active: true, product_type: 'retail', category_id: 'cat-3' },
  { id: '8', name: 'Telur (10 butir)', price: 25000, cost_price: 22000, stock: 30, ...getImageData('product-8'), track_stock: true, has_variant: false, has_modifier: false, is_active: true, product_type: 'retail', category_id: 'cat-3' },
  { id: '9', name: 'Kopi Seduh', price: 15000, cost_price: 8000, stock: 50, ...getImageData('product-9'), track_stock: false, has_variant: true, has_modifier: true, is_active: true, product_type: 'food_and_beverage', category_id: 'cat-4' },
  { id: '10', name: 'Teh Celup Kotak', price: 10000, cost_price: 7000, stock: 65, ...getImageData('product-10'), track_stock: true, has_variant: false, has_modifier: false, is_active: true, product_type: 'retail', category_id: 'cat-4' },
  { id: '11', name: 'Biskuit', price: 9000, cost_price: 6500, stock: 90, ...getImageData('product-11'), track_stock: true, has_variant: false, has_modifier: false, is_active: true, product_type: 'retail', category_id: 'cat-2' },
  { id: '12', name: 'Minyak Goreng', price: 32000, cost_price: 28000, stock: 25, ...getImageData('product-12'), track_stock: true, has_variant: false, has_modifier: false, is_active: true, product_type: 'retail', category_id: 'cat-3', low_stock_alert: 5 },
];

export const initialVariants: ProductVariant[] = [
    { id: 'pv1', product_id: '9', name: 'Biji Utuh', additional_price: 0, stock: 20, sku: 'COFFEE-BEAN' },
    { id: 'pv2', product_id: '9', name: 'Giling Halus', additional_price: 1000, stock: 15, sku: 'COFFEE-FINE' },
    { id: 'pv3', product_id: '9', name: 'Giling Kasar', additional_price: 1000, stock: 15, sku: 'COFFEE-COARSE' }
];

export const initialModifierGroups: ModifierGroup[] = [
    { 
        id: 'mg1', 
        product_id: '9',
        name: 'Tingkat Kemanisan', 
        min_select: 1, 
        max_select: 1, 
        required: true,
        items: [
            { id: 'mi1', name: 'Normal', additional_price: 0 },
            { id: 'mi2', name: 'Less Sugar', additional_price: 0 },
            { id: 'mi3', name: 'No Sugar', additional_price: 0 },
        ]
    },
    { 
        id: 'mg2', 
        product_id: '9',
        name: 'Tambahan', 
        min_select: 0, 
        max_select: 2, 
        required: false,
        items: [
            { id: 'mi4', name: 'Extra Shot', additional_price: 5000 },
            { id: 'mi5', name: 'Sirup Karamel', additional_price: 3000 },
        ]
    }
];
