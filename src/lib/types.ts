export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  imageUrl: string;
  imageHint: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Transaction {
  id: string;
  items: CartItem[];
  total: number;
  tax: number;
  subtotal: number;
  cashReceived: number;
  change: number;
  date: string;
}
