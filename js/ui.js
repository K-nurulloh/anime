import { getCart, getSettings, getWishlist, saveSettings } from './storage.js';

export const formatPrice = (value) => {
  const number = Number(value) || 0;
  return number.toLocaleString('uz-UZ');
};

export const renderProductCard = (product) => {
  const wishlist = getWishlist();
  const isSaved = wishlist.some((item) => item.id === product.id);
  return `
    <article class="group rounded-2xl border border-slate-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">
      <div class="relative overflow-hidden rounded-t-2xl bg-slate-50">
        <img src="${product.img}" alt="${product.title}" class="h-48 w-full object-cover transition duration-300 group-hover:scale-105" loading="lazy" />
        <span class="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700">-${Math.round(
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
          <p class="text-xs text-slate-500">${product.category}</p>
          <h3 class="line-clamp-2 text-sm font-semibold text-slate-800 dark:text-slate-100">${
            product.title
          }</h3>
        </div>
        <div class="flex items-center gap-2 text-xs text-amber-500">
          <span>★ ${product.rating}</span>
          <span class="text-slate-400">(120+)</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-lg font-bold text-slate-900 dark:text-white">${formatPrice(
            product.price
          )} so'm</span>
          <span class="text-xs text-slate-400 line-through">${formatPrice(
            product.oldPrice
          )} so'm</span>
        </div>
        <div class="flex gap-2">
          <button class="add-cart-btn flex-1 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800" data-id="${
            product.id
          }">Savatga</button>
          <a href="detail.html?id=${product.id}" class="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:text-slate-200">Batafsil</a>
        </div>
      </div>
    </article>
  `;
};

export const renderSkeleton = (count = 8) =>
  Array.from({ length: count })
    .map(
      () => `
      <div class="animate-pulse rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div class="h-40 rounded-xl bg-slate-200 dark:bg-slate-800"></div>
        <div class="mt-4 h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-800"></div>
        <div class="mt-2 h-3 w-1/2 rounded bg-slate-200 dark:bg-slate-800"></div>
        <div class="mt-4 h-8 rounded-xl bg-slate-200 dark:bg-slate-800"></div>
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

export const initThemeToggle = () => {
  const toggle = document.querySelector('[data-theme-toggle]');
  const settings = getSettings();
  document.documentElement.classList.toggle('dark', settings.darkMode);
  if (toggle) {
    toggle.checked = settings.darkMode;
    toggle.addEventListener('change', () => {
      const updated = { ...settings, darkMode: toggle.checked };
      saveSettings(updated);
      document.documentElement.classList.toggle('dark', updated.darkMode);
    });
  }
};