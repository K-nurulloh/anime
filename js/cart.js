import { fetchProducts } from './api.js';
import { ensureSeedData, getCart, saveCart } from './storage.js';
import { formatPrice, showToast, updateCartBadge } from './ui.js';
import { applyTranslations, initLangSwitcher, t } from './i18n.js';

// ====== INIT ======
ensureSeedData();
applyTranslations();
initLangSwitcher();
updateCartBadge();

const cartList = document.querySelector('#cart-list');
const summaryBox = document.querySelector('#summary-box');
const emptyState = document.querySelector('#empty-state');
const promoInput = document.querySelector('#promo-code');
const promoButton = document.querySelector('#apply-promo');

// ====== STATE ======
let productsMap = new Map();
let discountPercent = 0;

// ====== TOTALS ======
const calculateTotals = () => {
  const cart = getCart();
  const subtotal = cart.reduce((sum, item) => {
    const product = productsMap.get(item.id);
    if (!product) return sum;
    return sum + product.price * item.qty;
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

// ====== RENDER ======
const renderCart = () => {
  const cart = getCart();
  if (!cart.length) {
    emptyState.classList.remove('hidden');
    cartList.innerHTML = '';
    summaryBox.innerHTML = '';
    return;
  }
  emptyState.classList.add('hidden');
  cartList.innerHTML = cart
    .map((item) => {
      const product = productsMap.get(item.id);
      if (!product) return '';
      return `
        <div class="flex flex-col gap-4 rounded-2xl glass p-4 shadow-sm md:flex-row md:items-center">
          <img src="${product.img}" alt="${product.title}" class="h-24 w-24 rounded-xl object-cover" />
          <div class="flex-1">
            <h3 class="text-sm font-semibold text-white">${product.title}</h3>
            <p class="text-xs text-slate-300">${product.category}</p>
          </div>
          <div class="text-sm font-semibold text-white">${formatPrice(product.price)} so'm</div>
          <div class="flex items-center gap-2">
            <button class="qty-btn h-8 w-8 rounded-lg border border-slate-700 text-slate-200" data-action="dec" data-id="${
              item.id
            }">-</button>
            <span class="min-w-[24px] text-center">${item.qty}</span>
            <button class="qty-btn h-8 w-8 rounded-lg border border-slate-700 text-slate-200" data-action="inc" data-id="${
              item.id
            }">+</button>
          </div>
          <button class="remove-btn text-sm text-rose-400" data-id="${item.id}">${t('delete')}</button>
        </div>
      `;
    })
    .join('');
  calculateTotals();
};

// ====== CART ACTIONS ======
const updateQuantity = (id, action) => {
  const cart = getCart();
  const item = cart.find((entry) => entry.id === id);
  if (!item) return;
  if (action === 'inc') item.qty += 1;
  if (action === 'dec') item.qty = Math.max(1, item.qty - 1);
  saveCart(cart);
  renderCart();
  updateCartBadge();
};

const removeItem = (id) => {
  const cart = getCart().filter((item) => item.id !== id);
  saveCart(cart);
  renderCart();
  updateCartBadge();
  showToast(t('removed'));
};

// ====== DATA BOOTSTRAP ======
const init = async () => {
  const { products } = await fetchProducts();
  productsMap = new Map(products.map((product) => [product.id, product]));
  renderCart();
};

cartList.addEventListener('click', (event) => {
  const qtyBtn = event.target.closest('.qty-btn');
  const removeBtn = event.target.closest('.remove-btn');
  if (qtyBtn) {
    updateQuantity(Number(qtyBtn.dataset.id), qtyBtn.dataset.action);
  }
  if (removeBtn) {
    removeItem(Number(removeBtn.dataset.id));
  }
});

promoButton.addEventListener('click', () => {
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
