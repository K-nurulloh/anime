import { db, collection, getDocs, query, orderBy, limit } from './firebase.js';
import { ensureSeedData, getWishlist, saveWishlist, getCachedProducts, setCachedProducts } from './storage.js';
import { initAdminEditDelegation, isAdminUser, renderCarouselSkeleton, renderSkeleton, showToast, updateCartBadge } from './ui.js';
import { applyTranslations, initLangSwitcher, t } from './i18n.js';
import { initAutoCarousel } from './slider.js';

// ====== INIT ======
ensureSeedData();
applyTranslations();
initLangSwitcher();
updateCartBadge();

const productList = document.querySelector('#product-list');
const loader = document.querySelector('#loader');
const sentinel = document.querySelector('#sentinel');
const searchInput = document.querySelector('#searchInputIndex') || document.querySelector('#searchInput');
const categoryFilter = document.querySelector('#categoryFilter');
const priceSort = document.querySelector('#priceSort');
const recommendedList = document.querySelector('#recommended-list');
const errorBox = document.querySelector('#error-box');
const categoryChips = document.querySelectorAll('.category-chip');
const newDropsRow = document.querySelector('#new-drops-row');
const newDropsDots = document.querySelector('#new-drops-dots');
const homeSliderTrack = document.querySelector('#homeSliderTrack');
const homeSliderDots = document.querySelector('#homeSliderDots');



function getCurrentUserStrict() {
  const keys = ['currentUser', 'CURRENT_USER', 'user', 'USER', 'authUser', 'AUTH_USER'];
  for (const k of keys) {
    const raw = localStorage.getItem(k);
    if (!raw) continue;
    try {
      const u = JSON.parse(raw);
      if (u && typeof u === 'object' && (u.id || u.uid || u.phone || u.email)) {
        if (k !== 'currentUser') {
          localStorage.setItem('currentUser', JSON.stringify(u));
        }
        return u;
      }
    } catch (_) {}
  }
  return null;
}

function getUserId(u) {
  return String(u?.id || u?.uid || u?.phone || u?.email || '');
}

function getCartKey() {
  const u = getCurrentUserStrict();
  if (!u) return null;
  return `CART_${getUserId(u)}`;
}

function readUserCart() {
  const key = getCartKey();
  if (!key) return [];
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch (_) {
    return [];
  }
}

function writeUserCart(items) {
  const key = getCartKey();
  if (!key) return;
  localStorage.setItem(key, JSON.stringify(items || []));
}

function requireAuthOrRedirect() {
  const u = getCurrentUserStrict();
  if (!u) {
    alert('Avval accountga kiring');
    window.location.href = 'account.html';
    return null;
  }
  return u;
}

let allProducts = [];
let filteredProducts = [];
let currentIndex = 0;
const batchSize = 12;


const HOME_SLIDES = [
  { img: 'assets/slide1.jpg', href: 'catalog.html?filter=discount', title: 'Yangi chegirma' },
  { img: 'assets/slide2.jpg', href: 'catalog.html?filter=top', title: 'Top to‘plamlar' },
  { img: 'assets/slide3.jpg', href: 'catalog.html?filter=limited', title: 'Cheklangan taklif' },
];

const initHomeSlider = () => {
  if (!homeSliderTrack || !homeSliderDots) return;

  homeSliderTrack.innerHTML = HOME_SLIDES.map((slide) => `
    <a href="${slide.href}" class="min-w-full">
      <img src="${slide.img}" alt="${slide.title}" class="h-44 w-full rounded-xl object-cover md:h-56" loading="lazy" />
    </a>
  `).join('');

  homeSliderDots.innerHTML = HOME_SLIDES.map((_, idx) => `<button type="button" class="dot h-2 w-2 rounded-full ${idx===0?'bg-white':'bg-white/30'}" data-dot="${idx}"></button>`).join('');

  let current = 0;
  let timer = null;
  let startX = 0;

  const setSlide = (index) => {
    current = (index + HOME_SLIDES.length) % HOME_SLIDES.length;
    homeSliderTrack.style.transform = `translateX(-${current * 100}%)`;
    homeSliderDots.querySelectorAll('[data-dot]').forEach((dot, i) => {
      dot.classList.toggle('bg-white', i === current);
      dot.classList.toggle('bg-white/30', i !== current);
    });
  };

  const startAuto = () => {
    clearInterval(timer);
    timer = setInterval(() => setSlide(current + 1), 4000);
  };

  homeSliderDots.addEventListener('click', (event) => {
    const dot = event.target.closest('[data-dot]');
    if (!dot) return;
    setSlide(Number(dot.dataset.dot));
    startAuto();
  });

  homeSliderTrack.addEventListener('touchstart', (event) => {
    startX = event.touches[0].clientX;
  }, { passive: true });

  homeSliderTrack.addEventListener('touchend', (event) => {
    const diff = event.changedTouches[0].clientX - startX;
    if (Math.abs(diff) > 40) {
      setSlide(current + (diff < 0 ? 1 : -1));
      startAuto();
    }
  });

  setSlide(0);
  startAuto();
};

// ====== HELPERS ======
const shuffle = (items) => [...items].sort(() => Math.random() - 0.5);

const mapDocToProduct = (docSnap) => {
  const data = docSnap.data() || {};
  const images = Array.isArray(data.images)
    ? data.images.slice(0, 10)
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
    const products = snapshot.docs.map(mapDocToProduct);
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

const fetchNewestProducts = async (count = 8) => {
  try {
    const snap = await getDocs(query(collection(db, 'products'), orderBy('createdAt', 'desc'), limit(count)));
    if (!snap.docs.length) return [];
    return snap.docs.map(mapDocToProduct);
  } catch (error) {
    return [];
  }
};

const fetchPopularProducts = async (count = 48) => {
  try {
    const snap = await getDocs(query(collection(db, 'products'), orderBy('rating', 'desc'), limit(count)));
    if (!snap.docs.length) return [];
    return snap.docs.map(mapDocToProduct);
  } catch (error) {
    return [];
  }
};

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

const offlineBlockHTML = (title, desc) => `
  <div class="section text-center">
    <div class="text-3xl">📡</div>
    <h3 class="mt-2 text-lg font-bold">${title}</h3>
    <p class="mt-1 text-sm text-white/70">${desc}</p>
    <button onclick="location.reload()" class="mt-4 pill-btn text-sm">Qayta yuklash</button>
  </div>
`;

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
  const user = requireAuthOrRedirect();
  if (!user) return;

  const cart = readUserCart();
  const existing = cart.find((item) => String(item.id) === String(productId));
  if (existing) {
    existing.qty += 1;
  } else {
    const source = allProducts.find((item) => String(item.id) === String(productId)) || {};
    cart.push({
      id: String(productId),
      title: source.title || '',
      price: Number(source.price || 0),
      img: source.images?.[0] || source.img || '',
      qty: 1,
    });
  }
  writeUserCart(cart);
  updateCartBadge();
  showToast('Savatga qo‘shildi');
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

// ====== RECOMMENDED ======
const renderRecommended = () => {
  if (!recommendedList) return;
  const items = shuffle(allProducts).slice(0, 8);
  recommendedList.innerHTML = items.map(productCardHTML).join('');
  initListActions(recommendedList);
};

const renderNewDropsRow = (items) => {
  if (!newDropsRow) return;
  newDropsRow.innerHTML = items.map((item) => `<div class="slide">${productCardHTML(item)}</div>`).join('');
  initListActions(newDropsRow);
  if (newDropsDots) initAutoCarousel(newDropsRow, newDropsDots, 14);
};

// ====== DATA BOOTSTRAP ======
const init = async () => {
  if (!productList) return;
  productList.innerHTML = renderSkeleton(4);
  if (newDropsRow) {
    newDropsRow.innerHTML = renderCarouselSkeleton(4);
  }
  const [{ products, error }, newestProducts, popularProducts] = await Promise.all([
    fetchProductsFromFirestore(),
    fetchNewestProducts(8),
    fetchPopularProducts(48),
  ]);
  if (error) {
    errorBox.textContent = error;
    errorBox.classList.remove('hidden');
    productList.innerHTML = '';
    if (newDropsRow) {
      newDropsRow.innerHTML = offlineBlockHTML('Internet yo‘q', 'Yangi mahsulotlar yuklanmadi.');
    }
    return;
  }
  allProducts = popularProducts.length ? popularProducts : products;
  filteredProducts = [...allProducts];
  productList.innerHTML = '';
  syncCategoryFromQuery();
  applyFilters();
  initFilters();
  initCategoryChips();
  initListActions(productList);
  initAdminEditDelegation();
  initInfiniteScroll();
  renderRecommended();
  renderNewDropsRow((newestProducts.length ? newestProducts : shuffle(products).slice(0, 8)));
  initHomeSlider();
};

init();

window.addEventListener('langChanged', () => {
  applyFilters();
  renderRecommended();
  renderNewDropsRow(shuffle(allProducts).slice(0, 8));
  initHomeSlider();
});
