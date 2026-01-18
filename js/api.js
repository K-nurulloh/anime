import { readStorage } from './storage.js';
import { t } from './i18n.js';

export const fetchProducts = async () => {
  try {
    const response = await fetch('products.json');
    if (!response.ok) {
      throw new Error(`Network error: ${response.status}`);
    }
    const products = await response.json();
    const sellerProducts = readStorage('sellerProducts', []);
    const adminProducts = readStorage('adminProducts', []);
    return { products: [...products, ...sellerProducts, ...adminProducts], error: null };
  } catch (error) {
    console.error('Fetch error', error);
    return { products: [], error: t('fetch_error') };
  }
};
