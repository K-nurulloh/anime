import { fetchProducts } from './api.js';
import { ensureSeedData, getCart, saveCart, getWishlist, saveWishlist } from './storage.js';
import { renderProductCard, renderSkeleton, showToast, updateCartBadge } from './ui.js';
import { applyTranslations, initLangSwitcher, t } from './i18n.js';

// ====== INIT ======
ensureSeedData();
applyTranslations();
initLangSwitcher();
updateCartBadge();

const productList = document.querySelector('#product-list');
const loader = document.querySelector('#loader');
const sentinel = document.querySelector('#sentinel');
const searchInput = document.querySelector('#searchInput');
const categoryFilter = document.querySelector('#categoryFilter');
const priceSort = document.querySelector('#priceSort');
const recommendedList = document.querySelector('#recommended-list');
const errorBox = document.querySelector('#error-box');
const categoryChips = document.querySelectorAll('.category-chip');

let allProducts = [];
let filteredProducts = [];
let currentIndex = 0;
const batchSize = 12;

// ====== HELPERS ======
const shuffle = (items) => [...items].sort(() => Math.random() - 0.5);

// ====== INFINITE SCROLL ======
const renderNextBatch = () => {
  if (!productList) return;
  const nextItems = filteredProducts.slice(currentIndex, currentIndex + batchSize);
  if (!nextItems.length) {
    loader?.classList.add('hidden');
    return;
  }
  productList.insertAdjacentHTML('beforeend', nextItems.map(renderProductCard).join(''));
  currentIndex += batchSize;
};

const resetList = () => {
  currentIndex = 0;
  productList.innerHTML = '';
  renderNextBatch();
};

// ====== FILTERS ======
const applyFilters = () => {
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
  const category = categoryFilter ? categoryFilter.value : 'all';
  const sort = priceSort ? priceSort.value : 'default';
  filteredProducts = allProducts.filter((product) => {
    const matchesQuery =
      product.title.toLowerCase().includes(query) || product.desc.toLowerCase().includes(query);
    const matchesCategory = category === 'all' || product.category === category;
    return matchesQuery && matchesCategory;
  });

  if (sort === 'asc') {
    filteredProducts.sort((a, b) => a.price - b.price);
  }
  if (sort === 'desc') {
    filteredProducts.sort((a, b) => b.price - a.price);
  }

  resetList();
};

const initFilters = () => {
  [searchInput, categoryFilter, priceSort].forEach((element) => {
    if (!element) return;
    element.addEventListener('input', applyFilters);
    element.addEventListener('change', applyFilters);
  });
  if (categoryFilter) {
    categoryFilter.addEventListener('change', () => updateQueryCategory(categoryFilter.value));
  }
};

const syncCategoryFromQuery = () => {
  const params = new URLSearchParams(window.location.search);
  const category = params.get('category');
  if (category && categoryFilter) {
    categoryFilter.value = category;
  }
};

const updateQueryCategory = (category) => {
  const params = new URLSearchParams(window.location.search);
  if (category === 'all') {
    params.delete('category');
  } else {
    params.set('category', category);
  }
  const newUrl = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
  window.history.replaceState({}, '', newUrl);
};

const initCategoryChips = () => {
  if (!categoryChips.length) return;
  categoryChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const category = chip.dataset.category;
      if (categoryFilter) {
        categoryFilter.value = category;
      }
      updateQueryCategory(category);
      applyFilters();
    });
  });
};

// ====== CART ACTIONS ======
const handleAddToCart = (productId) => {
  const cart = getCart();
  const existing = cart.find((item) => item.id === productId);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id: productId, qty: 1 });
  }
  saveCart(cart);
  updateCartBadge();
  showToast(t('cart_added'));
};

const handleWishlist = (productId) => {
  const wishlist = getWishlist();
  const index = wishlist.findIndex((item) => item.id === productId);
  if (index >= 0) {
    wishlist.splice(index, 1);
    showToast(t('wishlist_removed'));
  } else {
    wishlist.push({ id: productId });
    showToast(t('wishlist_added'));
  }
  saveWishlist(wishlist);
  document.querySelectorAll(`[data-id="${productId}"]`).forEach((button) => {
    button.textContent = index >= 0 ? '🤍' : '❤️';
  });
};

const initListActions = (container) => {
  if (!container) return;
  container.addEventListener('click', (event) => {
    const cartBtn = event.target.closest('.add-cart-btn');
    const wishlistBtn = event.target.closest('.wishlist-btn');
    if (cartBtn) {
      handleAddToCart(Number(cartBtn.dataset.id));
    }
    if (wishlistBtn) {
      handleWishlist(Number(wishlistBtn.dataset.id));
    }
  });
};

const initInfiniteScroll = () => {
  if (!sentinel) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        renderNextBatch();
      }
    });
  });
  observer.observe(sentinel);
};

// ====== RECOMMENDED ======
const renderRecommended = () => {
  if (!recommendedList) return;
  const items = shuffle(allProducts).slice(0, 8);
  recommendedList.innerHTML = items.map(renderProductCard).join('');
  initListActions(recommendedList);
};

// ====== DATA BOOTSTRAP ======
const init = async () => {
  if (!productList) return;
  productList.innerHTML = renderSkeleton(batchSize);
  const { products, error } = await fetchProducts();
  if (error) {
    errorBox.textContent = error;
    errorBox.classList.remove('hidden');
    productList.innerHTML = '';
    return;
  }
  allProducts = products;
  filteredProducts = [...products];
  productList.innerHTML = '';
  syncCategoryFromQuery();
  applyFilters();
  initFilters();
  initCategoryChips();
  initListActions(productList);
  initInfiniteScroll();
  renderRecommended();
};

init();

window.addEventListener('langChanged', () => {
  applyFilters();
  renderRecommended();
});
