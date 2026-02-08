import { db, collection, getDocs, query, orderBy } from './firebase.js';
import { ensureSeedData, getCart, saveCart, getWishlist, saveWishlist, getCachedProducts, setCachedProducts } from './storage.js';
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
const searchInput = document.querySelector('#searchInput');
const categoryFilter = document.querySelector('#categoryFilter');
const priceSort = document.querySelector('#priceSort');
const errorBox = document.querySelector('#error-box');
const categoryChips = document.querySelectorAll('.category-chip');

let allProducts = [];
let filteredProducts = [];
let currentIndex = 0;
const batchSize = 12;

// ====== HELPERS ======
const productCardHTML = (product) => {
  const image =
    product.images?.[0] ||
    product.img ||
    'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=800&q=80';
  const isSaved = getWishlist().some((item) => item.id === product.id);
  const oldPrice = product.oldPrice && product.oldPrice > product.price ? product.oldPrice : null;
  const adminMode = isAdminUser();
  const actionMarkup = adminMode
    ? `<button type="button" class="pc-btn edit-btn" data-edit-id="${product.id}">✏️ Edit</button>`
    : `
        <button class="add-cart-btn pc-btn primary" data-id="${product.id}">${t('add_to_cart')}</button>
        <a href="detail.html?id=${product.id}" class="pc-btn">${t('details')}</a>
      `;
  const stripImages = (product.images?.length ? product.images : product.img ? [product.img] : []).slice(0, 10);
  return `
    <article class="product-card">
      <a href="detail.html?id=${product.id}" class="pc-media">
        <div class="pc-badges">
          <span class="pc-pill">⭐ ${product.rating ?? 4.8}</span>
          <button class="wishlist-btn pc-pill" data-id="${product.id}" aria-label="Wishlist">
            ${isSaved ? '❤️' : '🤍'}
          </button>
        </div>
        <img src="${image}" alt="${product.title}" loading="lazy" />
      </a>
      ${
        stripImages.length > 1
          ? `<div class="pc-strip">${stripImages
              .map((img, idx) => `<img src="${img}" alt="${product.title} ${idx + 1}" loading="lazy" />`)
              .join('')}</div>`
          : ''
      }
      <div class="pc-body">
        <p class="pc-cat">${product.category}</p>
        <h3 class="pc-title">${product.title}</h3>
        <div class="pc-priceRow">
          <span class="pc-price">${Number(product.price || 0).toLocaleString('ru-RU')} so'm</span>
          ${
            oldPrice
              ? `<span class="pc-old">${Number(oldPrice || 0).toLocaleString('ru-RU')} so'm</span>`
              : ''
          }
        </div>
        <div class="pc-actions">
          ${actionMarkup}
        </div>
      </div>
    </article>
  `;
};


const fetchProductsFromFirestore = async () => {
  const cached = getCachedProducts();
  if (cached?.length) {
    return { products: cached, error: null };
  }

  try {
    let snapshot;
    try {
      snapshot = await getDocs(query(collection(db, 'products'), orderBy('createdAt', 'desc')));
      if (!snapshot.docs.length) {
        snapshot = await getDocs(collection(db, 'products'));
      }
    } catch (orderError) {
      snapshot = await getDocs(collection(db, 'products'));
    }
    const products = snapshot.docs.map((docSnap) => {
      const data = docSnap.data() || {};
      const images = Array.isArray(data.images)
        ? data.images
        : data.img
          ? [data.img]
          : [];
      return {
        docId: docSnap.id,
        id: docSnap.id,
        title: data.title || '',
        category: data.category || '',
        price: Number(data.price || 0),
        oldPrice: Number(data.oldPrice || 0) || null,
        rating: data.rating ?? null,
        desc: data.desc || '',
        images,
        img: images[0] || '',
        createdAt: data.createdAt || null,
      };
    });
    setCachedProducts(products);
    return { products, error: null };
  } catch (error) {
    console.error('Failed to load Firestore products:', error);
    return {
      products: [],
      error: 'Mahsulotlarni yuklashda xatolik yuz berdi. Keyinroq qayta urinib ko‘ring.',
    };
  }
};

// ====== INFINITE SCROLL ======
const renderNextBatch = () => {
  if (!productList) return;
  const nextItems = filteredProducts.slice(currentIndex, currentIndex + batchSize);
  if (!nextItems.length) {
    loader?.classList.add('hidden');
    return;
  }
  productList.insertAdjacentHTML('beforeend', nextItems.map(productCardHTML).join(''));
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
    const titleText = (product.title || '').toLowerCase();
    const descText = (product.desc || '').toLowerCase();
    const matchesQuery = titleText.includes(query) || descText.includes(query);
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

const setActiveChip = (category) => {
  if (!categoryChips.length) return;
  categoryChips.forEach((chip) => {
    const isActive = chip.dataset.category === category;
    chip.classList.toggle('is-active', isActive);
    chip.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
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
      setActiveChip(category);
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
      handleAddToCart(cartBtn.dataset.id);
    }
    if (wishlistBtn) {
      handleWishlist(wishlistBtn.dataset.id);
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

// ====== DATA BOOTSTRAP ======
const init = async () => {
  if (!productList) return;
  productList.innerHTML = renderSkeleton(4);
  const { products, error } = await fetchProductsFromFirestore();
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
  if (categoryFilter) {
    setActiveChip(categoryFilter.value === 'all' ? null : categoryFilter.value);
  }
  applyFilters();
  initFilters();
  initCategoryChips();
  initListActions(productList);
  initAdminEditDelegation();
  initInfiniteScroll();
};

init();

window.addEventListener('langChanged', () => {
  applyFilters();
});
