import { fetchProducts } from './api.js';
import { ensureSeedData, getCart, saveCart, getWishlist, saveWishlist } from './storage.js';
import { renderProductCard, showToast, updateCartBadge, initThemeToggle } from './ui.js';

ensureSeedData();
initThemeToggle();
updateCartBadge();

const detailWrapper = document.querySelector('#detail-wrapper');
const similarList = document.querySelector('#similar-list');
const moreList = document.querySelector('#more-list');
const errorBox = document.querySelector('#error-box');

const params = new URLSearchParams(window.location.search);
const productId = Number(params.get('id'));

const renderGallery = (images, title) => {
  const unique = images.length ? images : ['https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=800&q=80'];
  return `
    <div class="grid gap-3">
      ${unique
        .map(
          (image) => `
        <div class="overflow-hidden rounded-2xl bg-slate-100">
          <img src="${image}" alt="${title}" class="h-72 w-full object-cover" />
        </div>`
        )
        .join('')}
    </div>
  `;
};

const handleWishlist = (productId) => {
  const wishlist = getWishlist();
  const index = wishlist.findIndex((item) => item.id === productId);
  if (index >= 0) {
    wishlist.splice(index, 1);
    showToast('Wishlistdan olib tashlandi');
  } else {
    wishlist.push({ id: productId });
    showToast('Saqlangan');
  }
  saveWishlist(wishlist);
  document.querySelectorAll(`[data-id="${productId}"]`).forEach((button) => {
    button.textContent = index >= 0 ? '🤍' : '❤️';
  });
};

const addToCart = (productId) => {
  const cart = getCart();
  const existing = cart.find((item) => item.id === productId);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id: productId, qty: 1 });
  }
  saveCart(cart);
  updateCartBadge();
  showToast('Savatga qo\'shildi');
};

const initCardActions = (container) => {
  container.addEventListener('click', (event) => {
    const cartBtn = event.target.closest('.add-cart-btn');
    const wishlistBtn = event.target.closest('.wishlist-btn');
    if (cartBtn) {
      addToCart(Number(cartBtn.dataset.id));
    }
    if (wishlistBtn) {
      handleWishlist(Number(wishlistBtn.dataset.id));
    }
  });
};

const init = async () => {
  const { products, error } = await fetchProducts();
  if (error) {
    errorBox.textContent = error;
    errorBox.classList.remove('hidden');
    return;
  }
  const product = products.find((item) => item.id === productId);
  if (!product) {
    errorBox.textContent = 'Mahsulot topilmadi.';
    errorBox.classList.remove('hidden');
    return;
  }

  detailWrapper.innerHTML = `
    <div class="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
      ${renderGallery([product.img], product.title)}
      <div class="flex flex-col gap-4">
        <div>
          <p class="text-sm text-slate-500">${product.category}</p>
          <h1 class="text-3xl font-bold text-slate-900 dark:text-white">${product.title}</h1>
        </div>
        <div class="flex items-center gap-2 text-amber-500">
          <span>★ ${product.rating}</span>
          <span class="text-slate-400">(stock: ${Math.floor(5 + Math.random() * 30)})</span>
        </div>
        <p class="text-slate-600 dark:text-slate-300">${product.desc}</p>
        <div class="flex items-center gap-3">
          <span class="text-2xl font-bold text-slate-900 dark:text-white">${product.price.toLocaleString(
            'uz-UZ'
          )} so'm</span>
          <span class="text-sm text-slate-400 line-through">${product.oldPrice.toLocaleString(
            'uz-UZ'
          )} so'm</span>
        </div>
        <div class="flex flex-wrap gap-3">
          <button class="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800" data-cart-add>Savatga</button>
          <button class="rounded-xl border border-slate-200 px-5 py-3 text-sm text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:text-slate-200" data-wishlist-toggle>🤍 Wishlist</button>
        </div>
        <div class="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
          <p>Yetkazish: 1-3 kun, demo xizmat.</p>
          <p>Kafolat: 12 oy.</p>
        </div>
      </div>
    </div>
  `;

  const isSaved = getWishlist().some((item) => item.id === product.id);
  const wishlistBtn = document.querySelector('[data-wishlist-toggle]');
  wishlistBtn.textContent = isSaved ? '❤️ Wishlist' : '🤍 Wishlist';

  document.querySelector('[data-cart-add]').addEventListener('click', () => addToCart(product.id));
  wishlistBtn.addEventListener('click', () => handleWishlist(product.id));

  const similar = products.filter(
    (item) => item.category === product.category && item.id !== product.id
  );
  similarList.innerHTML = similar.slice(0, 8).map(renderProductCard).join('');
  moreList.innerHTML = products.sort(() => Math.random() - 0.5).slice(0, 8).map(renderProductCard).join('');

  initCardActions(similarList);
  initCardActions(moreList);
};

init();