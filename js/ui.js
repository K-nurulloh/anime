import { getCart, getWishlist } from './storage.js';
import { t, getLang } from './i18n.js';

export const formatPrice = (value) => {
  const number = Number(value) || 0;
  return number.toLocaleString(getLang() === 'ru' ? 'ru-RU' : 'uz-UZ');
};

export const renderProductCard = (product) => {
  const wishlist = getWishlist();
  const isSaved = wishlist.some((item) => item.id === product.id);
  return `
    <article class="group rounded-2xl border border-slate-800 bg-slate-900 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <div class="relative overflow-hidden rounded-t-2xl bg-slate-950">
        <img src="${product.img}" alt="${product.title}" class="h-48 w-full object-cover transition duration-300 group-hover:scale-105" loading="lazy" />
        <span class="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-900">-${Math.round(
          ((product.oldPrice - product.price) / product.oldPrice) * 100
        )}%</span>
        <button class="wishlist-btn absolute right-3 top-3 rounded-full bg-white/90 p-2 text-lg" data-id="${
          product.id
        }" aria-label="Wishlist">
          ${isSaved ? '❤️' : '🤍'}
        </button>
      </div>
      <div class="flex flex-col gap-3 p-4">
        <div>
          <p class="text-xs text-slate-300">${product.category}</p>
          <h3 class="line-clamp-2 text-sm font-semibold text-white">${
            product.title
          }</h3>
        </div>
        <div class="flex items-center gap-2 text-xs text-amber-500">
          <span>★ ${product.rating}</span>
          <span class="text-slate-400">(120+)</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-lg font-bold text-white">${formatPrice(
            product.price
          )} so'm</span>
          <span class="text-xs text-slate-400 line-through">${formatPrice(
            product.oldPrice
          )} so'm</span>
        </div>
        <div class="flex gap-2">
          <button class="add-cart-btn flex-1 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100" data-id="${
            product.id
          }">${t('add_to_cart')}</button>
          <a href="detail.html?id=${product.id}" class="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500">${t(
            'details'
          )}</a>
        </div>
      </div>
    </article>
  `;
};

export const renderSkeleton = (count = 8) =>
  Array.from({ length: count })
    .map(
      () => `
      <div class="animate-pulse rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
        <div class="h-40 rounded-xl bg-slate-800"></div>
        <div class="mt-4 h-4 w-3/4 rounded bg-slate-800"></div>
        <div class="mt-2 h-3 w-1/2 rounded bg-slate-800"></div>
        <div class="mt-4 h-8 rounded-xl bg-slate-800"></div>
      </div>
    `
    )
    .join('');

export const showToast = (message, tone = 'success') => {
  const toast = document.createElement('div');
  toast.className = `fixed right-6 top-6 z-50 rounded-xl px-4 py-3 text-sm font-semibold shadow-lg transition ${
    tone === 'error' ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'
  }`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('opacity-0');
    setTimeout(() => toast.remove(), 400);
  }, 2000);
};

export const updateCartBadge = () => {
  const badge = document.querySelectorAll('[data-cart-count]');
  const cart = getCart();
  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  badge.forEach((node) => {
    node.textContent = count;
  });
};