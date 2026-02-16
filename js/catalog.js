import { fetchProducts } from './api.js';
import { ensureSeedData, getCart, saveCart, getWishlist, saveWishlist } from './storage.js';
import { initAdminEditDelegation, isAdminUser, renderSkeleton, showToast, updateCartBadge } from './ui.js';
import { applyTranslations, initLangSwitcher, t } from './i18n.js';

// ====== INIT ======
ensureSeedData();
applyTranslations();
initLangSwitcher();
updateCartBadge();

const productList = document.querySelector('#product-list');
const loader = document.querySelector('#loader');
const sentinel = document.querySelector('#sentinel');
const searchInput = document.querySelector('#searchInputCatalog');
const searchClearBtn = document.querySelector('#searchClearCatalog');
const errorBox = document.querySelector('#error-box');
const categoryChips = document.querySelectorAll('.category-chip');

let ALL_PRODUCTS = [];
let filteredProducts = [];
let currentIndex = 0;
let activeCategory = 'all';
const batchSize = 12;

const productCardHTML = (product) => {
  const image =
    product.images?.[0] ||
    product.img ||
    'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=800&q=80';
  const isSaved = getWishlist().some((item) => String(item.id) === String(product.id));
  const oldPrice = product.oldPrice && product.oldPrice > product.price ? product.oldPrice : null;
  const adminMode = isAdminUser();
  const actionMarkup = adminMode
    ? `<button type="button" class="pc-btn edit-btn" data-edit-id="${product.id}">✏️ Edit</button>`
    : `
        <button class="add-cart-btn pc-btn primary" data-id="${product.id}">${t('add_to_cart')}</button>
        <a href="detail.html?id=${encodeURIComponent(String(product.id))}" class="pc-btn">${t('details')}</a>
      `;

  return `
    <article class="product-card">
      <a href="detail.html?id=${encodeURIComponent(String(product.id))}" class="pc-media">
        <div class="pc-badges">
          <span class="pc-pill">⭐ ${product.rating ?? 4.8}</span>
          <button class="wishlist-btn pc-pill" data-id="${product.id}" aria-label="Wishlist">
            ${isSaved ? '❤️' : '🤍'}
          </button>
        </div>
        <img src="${image}" alt="${product.title}" loading="lazy" />
      </a>
      <div class="pc-body">
        <p class="pc-cat">${product.category || ''}</p>
        <h3 class="pc-title">${product.title || ''}</h3>
        <div class="pc-priceRow">
          <span class="pc-price">${Number(product.price || 0).toLocaleString('ru-RU')} so'm</span>
          ${oldPrice ? `<span class="pc-old">${Number(oldPrice || 0).toLocaleString('ru-RU')} so'm</span>` : ''}
        </div>
        <div class="pc-actions">${actionMarkup}</div>
      </div>
    </article>
  `;
};

const setActiveChip = (category) => {
  categoryChips.forEach((chip) => {
    const isActive = chip.dataset.category === category;
    chip.classList.toggle('is-active', isActive);
    chip.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
};

const renderNextBatch = () => {
  const nextItems = filteredProducts.slice(currentIndex, currentIndex + batchSize);
  if (!nextItems.length) {
    loader?.classList.add('hidden');
    return;
  }
  loader?.classList.remove('hidden');
  productList.insertAdjacentHTML('beforeend', nextItems.map(productCardHTML).join(''));
  currentIndex += batchSize;
};

const resetList = () => {
  currentIndex = 0;
  productList.innerHTML = '';
  renderNextBatch();
};

const applyFilters = () => {
  const queryText = (searchInput?.value || '').trim().toLowerCase();

  filteredProducts = ALL_PRODUCTS.filter((product) => {
    const titleText = String(product.title || '').toLowerCase();
    const matchesQuery = titleText.includes(queryText);
    const matchesCategory = activeCategory === 'all' || product.category === activeCategory;
    return matchesQuery && matchesCategory;
  });

  if (!filteredProducts.length) {
    errorBox.textContent = 'No products found';
    errorBox.classList.remove('hidden');
    productList.innerHTML = '';
    loader?.classList.add('hidden');
    return;
  }

  errorBox.classList.add('hidden');
  resetList();
};

const clearSearch = () => {
  searchInput.value = '';
  applyFilters();
};

const initFilters = () => {
  searchInput?.addEventListener('input', applyFilters);
  searchClearBtn?.addEventListener('click', clearSearch);
};

const initCategoryChips = () => {
  categoryChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const clicked = chip.dataset.category;
      activeCategory = clicked === activeCategory ? 'all' : clicked;
      setActiveChip(activeCategory === 'all' ? null : activeCategory);
      applyFilters();
    });
  });
};

const handleAddToCart = (productId) => {
  const cart = getCart();
  const existing = cart.find((item) => String(item.id) === String(productId));
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id: String(productId), qty: 1 });
  }
  saveCart(cart);
  updateCartBadge();
  showToast(t('cart_added'));
};

const handleWishlist = (productId) => {
  const wishlist = getWishlist();
  const index = wishlist.findIndex((item) => String(item.id) === String(productId));
  if (index >= 0) {
    wishlist.splice(index, 1);
    showToast(t('wishlist_removed'));
  } else {
    wishlist.push({ id: String(productId) });
    showToast(t('wishlist_added'));
  }
  saveWishlist(wishlist);
  document.querySelectorAll(`[data-id="${CSS.escape(String(productId))}"]`).forEach((button) => {
    if (button.classList.contains('wishlist-btn')) {
      button.textContent = index >= 0 ? '🤍' : '❤️';
    }
  });
};

const initListActions = () => {
  productList.addEventListener('click', (event) => {
    const cartBtn = event.target.closest('.add-cart-btn');
    const wishlistBtn = event.target.closest('.wishlist-btn');
    if (cartBtn) handleAddToCart(cartBtn.dataset.id);
    if (wishlistBtn) handleWishlist(wishlistBtn.dataset.id);
  });
};

const initInfiniteScroll = () => {
  if (!sentinel) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) renderNextBatch();
    });
  });
  observer.observe(sentinel);
};

const dedupeProducts = (products = []) => {
  const map = new Map();
  products.forEach((product) => {
    const key = String(product.id ?? product.docId ?? '').trim();
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, {
        ...product,
        id: key,
      });
    }
  });
  return [...map.values()];
};

const init = async () => {
  if (!productList) return;

  productList.innerHTML = renderSkeleton(4);

  const { products, error } = await fetchProducts();
  if (error) {
    errorBox.textContent = error;
    errorBox.classList.remove('hidden');
    productList.innerHTML = '';
    return;
  }

  ALL_PRODUCTS = dedupeProducts(products);
  filteredProducts = [...ALL_PRODUCTS];

  productList.innerHTML = '';
  setActiveChip(null);
  applyFilters();
  initFilters();
  initCategoryChips();
  initListActions();
  initAdminEditDelegation();
  initInfiniteScroll();
};

init();

window.addEventListener('langChanged', () => {
  applyFilters();
});
