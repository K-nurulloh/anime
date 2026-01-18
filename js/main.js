import { fetchProducts } from './api.js';
import { ensureSeedData, getCart, saveCart, getWishlist, saveWishlist } from './storage.js';
import { renderProductCard, renderSkeleton, showToast, updateCartBadge, initThemeToggle } from './ui.js';

ensureSeedData();
initThemeToggle();
updateCartBadge();

const productList = document.querySelector('#product-list');
const loader = document.querySelector('#loader');
const sentinel = document.querySelector('#sentinel');
const searchInput = document.querySelector('#searchInput');
const categoryFilter = document.querySelector('#categoryFilter');
const priceSort = document.querySelector('#priceSort');
const recommendedList = document.querySelector('#recommended-list');
const errorBox = document.querySelector('#error-box');

let allProducts = [];
let filteredProducts = [];
let currentIndex = 0;
const batchSize = 12;

const shuffle = (items) => [...items].sort(() => Math.random() - 0.5);

const renderNextBatch = () => {
  if (!productList) return;
  const nextItems = filteredProducts.slice(currentIndex, currentIndex + batchSize);
  if (!nextItems.length) {
    loader.classList.add('hidden');
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

const applyFilters = () => {
  const query = searchInput.value.trim().toLowerCase();
  const category = categoryFilter.value;
  const sort = priceSort.value;
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
    element.addEventListener('input', applyFilters);
    element.addEventListener('change', applyFilters);
  });
};

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
  showToast('Savatga qo\'shildi');
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

const initListActions = (container) => {
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

const renderRecommended = () => {
  if (!recommendedList) return;
  const items = shuffle(allProducts).slice(0, 8);
  recommendedList.innerHTML = items.map(renderProductCard).join('');
  initListActions(recommendedList);
};

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
  renderNextBatch();
  initFilters();
  initListActions(productList);
  initInfiniteScroll();
  renderRecommended();
};

init();