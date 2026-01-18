import { readStorage } from './storage.js';

export const fetchProducts = async () => {
  try {
    const response = await fetch('products.json');
    if (!response.ok) {
      throw new Error(`Network error: ${response.status}`);
    }
    const products = await response.json();
    const sellerProducts = readStorage('sellerProducts', []);
    return { products: [...products, ...sellerProducts], error: null };
  } catch (error) {
    console.error('Fetch error', error);
    return { products: [], error: 'Mahsulotlarni yuklashda xatolik yuz berdi.' };
  }
};