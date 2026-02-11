import { db, collection, getDocs, query, orderBy } from './firebase.js';
import {
  ensureSeedData,
  getCart,
  saveCart,
  addToCart,
  getCachedProducts,
  setCachedProducts,
} from './storage.js';
import { formatPrice, showToast, updateCartBadge } from './ui.js';
import { applyTranslations, initLangSwitcher, t } from './i18n.js';

// ====== INIT ======
ensureSeedData();
applyTranslations();
initLangSwitcher();
updateCartBadge();

const cartList = document.querySelector('#cart-list') || document.querySelector('#cart-items');
const summaryBox = document.querySelector('#summary-box');
const emptyState = document.querySelector('#empty-state');
const promoInput = document.querySelector('#promo-code');
const promoButton = document.querySelector('#apply-promo');

let productsMap = new Map();
let discountPercent = 0;

const fetchProductsFromFirestore = async () => {
  const cached = getCachedProducts();
  if (cached?.length) return cached;
  try {
    let snapshot;
    try {
      snapshot = await getDocs(query(collection(db, 'products'), orderBy('createdAt', 'desc')));
      if (!snapshot.docs.length) snapshot = await getDocs(collection(db, 'products'));
    } catch (error) {
      snapshot = await getDocs(collection(db, 'products'));
    }

    const products = snapshot.docs.map((docSnap) => {
      const data = docSnap.data() || {};
      const images = Array.isArray(data.images) ? data.images : data.img ? [data.img] : [];
      return {
        id: docSnap.id,
        ...data,
        images,
        img: data.img || images[0] || '',
      };
    });
    setCachedProducts(products);
    return products;
  } catch (error) {
    console.error('Failed to fetch products for cart:', error);
    return [];
  }
};

const calculateTotals = () => {
  const cart = JSON.parse(localStorage.getItem('cart')) || [];
  const subtotal = cart.reduce((sum, item) => {
    const product = productsMap.get(String(item.id));
    const unitPrice = Number(product?.price ?? item.price ?? 0);
    return sum + unitPrice * (Number(item.qty) || 1);
  }, 0);
  const discount = (subtotal * discountPercent) / 100;
  const delivery = subtotal > 0 ? 25000 : 0;
  const total = subtotal - discount + delivery;

  summaryBox.innerHTML = `
    <div class="space-y-2 text-sm text-slate-300">
      <div class="flex justify-between"><span>${t('subtotal')}</span><span>${formatPrice(subtotal)} so'm</span></div>
      <div class="flex justify-between"><span>${t('discount')}</span><span>-${formatPrice(discount)} so'm</span></div>
      <div class="flex justify-between"><span>${t('delivery')}</span><span>${formatPrice(delivery)} so'm</span></div>
    </div>
    <div class="mt-4 flex justify-between text-lg font-bold text-white">
      <span>${t('total')}</span><span>${formatPrice(total)} so'm</span>
    </div>
    <a href="checkout.html" class="mt-4 block rounded-xl bg-white px-4 py-3 text-center text-sm font-semibold text-slate-900 hover:bg-slate-100">${t(
      'checkout'
    )}</a>
  `;
};

const renderCart = () => {
  const cart = JSON.parse(localStorage.getItem('cart')) || [];
  if (!cart.length) {
    emptyState?.classList.remove('hidden');
    if (cartList) cartList.innerHTML = '<p class="text-sm text-slate-300">Savat bo‘sh</p>';
    if (summaryBox) summaryBox.innerHTML = '';
    return;
  }

  emptyState?.classList.add('hidden');
  cartList.innerHTML = cart
    .map((item) => {
      const product = productsMap.get(String(item.id));
      const title = product?.title || item.title || 'Mahsulot';
      const category = product?.category || item.category || '';
      const price = Number(product?.price ?? item.price ?? 0);
      const image = product?.images?.[0] || product?.img || item.image || item.img || '';
      if (!product && item.id == null) return '';
      return `
        <div class="flex flex-col gap-4 rounded-2xl glass p-4 shadow-sm md:flex-row md:items-center cart-item">
          <img src="${image}" alt="${title}" class="h-24 w-24 rounded-xl object-cover" width="60" />
          <div class="flex-1">
            <h3 class="text-sm font-semibold text-white">${title}</h3>
            <p class="text-xs text-slate-300">${category}</p>
          </div>
          <div class="text-sm font-semibold text-white">${formatPrice(price)} so'm</div>
          <div class="flex items-center gap-2">
            <button class="qty-btn h-8 w-8 rounded-lg border border-slate-700 text-slate-200" data-action="dec" data-id="${item.id}">-</button>
            <span class="min-w-[24px] text-center">${item.qty || 1}</span>
            <button class="qty-btn h-8 w-8 rounded-lg border border-slate-700 text-slate-200" data-action="inc" data-id="${item.id}">+</button>
          </div>
          <button class="remove-btn text-sm text-rose-400" data-id="${item.id}">${t('delete')}</button>
        </div>
      `;
    })
    .join('');

  calculateTotals();
};

const updateQuantity = (id, action) => {
  if (action === 'inc') {
    addToCart(id, 1);
  } else {
    const cart = getCart();
    const item = cart.find((entry) => String(entry.id) === String(id));
    if (!item) return;
    item.qty = Math.max(1, item.qty - 1);
    saveCart(cart);
  }
  renderCart();
  updateCartBadge();
};

const removeItem = (id) => {
  const cart = getCart().filter((item) => String(item.id) !== String(id));
  saveCart(cart);
  renderCart();
  updateCartBadge();
  showToast(t('removed'));
};

const init = async () => {
  const products = await fetchProductsFromFirestore();
  productsMap = new Map(products.map((product) => [String(product.id), product]));
  renderCart();
};

cartList?.addEventListener('click', (event) => {
  const qtyBtn = event.target.closest('.qty-btn');
  const removeBtn = event.target.closest('.remove-btn');
  if (qtyBtn) {
    updateQuantity(qtyBtn.dataset.id, qtyBtn.dataset.action);
  }
  if (removeBtn) {
    removeItem(removeBtn.dataset.id);
  }
});

promoButton?.addEventListener('click', () => {
  const code = promoInput.value.trim().toUpperCase();
  if (code === 'UZUM10') {
    discountPercent = 10;
    showToast(t('promo_success'));
  } else {
    discountPercent = 0;
    showToast(t('promo_error'), 'error');
  }
  calculateTotals();
});

init();

window.addEventListener('langChanged', () => {
  renderCart();
});
