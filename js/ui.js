import { getCart, getWishlist } from './storage.js';
import { t, getLang } from './i18n.js';

const ADMIN_EMAIL = 'nurullohkomilov163@gmail.com';

const parseCurrentUser = () => {
  const raw = localStorage.getItem('currentUser');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
};

export const syncAdminState = (user = null) => {
  const currentUser = user || parseCurrentUser();
  const email = (currentUser?.email || '').trim().toLowerCase();
  const isAdmin = email === ADMIN_EMAIL;
  localStorage.setItem('isAdmin', isAdmin ? 'true' : 'false');

  if (currentUser) {
    const nextUser = { ...currentUser, isAdmin, role: isAdmin ? 'admin' : currentUser.role || 'user' };
    localStorage.setItem('currentUser', JSON.stringify(nextUser));
    return nextUser;
  }
  return null;
};

export const isAdminUser = (user = null) => {
  const currentUser = user || parseCurrentUser();
  const email = (currentUser?.email || '').trim().toLowerCase();
  if (email) {
    const isAdmin = email === ADMIN_EMAIL;
    localStorage.setItem('isAdmin', isAdmin ? 'true' : 'false');
    return isAdmin;
  }
  return localStorage.getItem('isAdmin') === 'true';
};

// ====== FORMATTERS ======
export const formatPrice = (value) => {
  const number = Number(value) || 0;
  return number.toLocaleString(getLang() === 'ru' ? 'ru-RU' : 'uz-UZ');
};

// ====== PRODUCT CARDS ======
export const renderProductCard = (product) => {
  const wishlist = getWishlist();
  const isSaved = wishlist.some((item) => item.id === product.id);
  const image = product.images?.[0] || product.img || 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=800&q=80';
  const rating = product.rating ?? 4.8;
  const oldPrice = product.oldPrice && product.oldPrice > product.price ? product.oldPrice : null;
  const discountPercent = oldPrice
    ? Math.round(((oldPrice - product.price) / oldPrice) * 100)
    : null;
  const adminMode = isAdminUser();
  const actionButton = adminMode
    ? `<button type="button" class="pc-btn edit-btn" data-edit-id="${product.id}">✏️ Edit</button>`
    : `<a href="detail.html?id=${product.id}" class="pc-btn">${t('details')}</a>`;
  return `
    <article class="product-card">
      <a href="detail.html?id=${product.id}" class="pc-media">
        <div class="pc-badges">
          <span class="pc-pill">★ ${rating}</span>
          ${
            discountPercent
              ? `<span class="pc-pill">-${discountPercent}%</span>`
              : ''
          }
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
          <span class="pc-price">${formatPrice(product.price)} so'm</span>
          ${oldPrice ? `<span class="pc-old">${formatPrice(oldPrice)} so'm</span>` : ''}
        </div>
        <div class="pc-actions">
          <button class="add-cart-btn pc-btn primary" data-id="${product.id}">${t('add_to_cart')}</button>
          ${actionButton}
        </div>
      </div>
    </article>
  `;
};

// ====== SKELETONS ======
export const renderSkeleton = (count = 8) =>
  Array.from({ length: count })
    .map(
      () => `
      <div class="product-card skeleton">
        <div class="product-media skeleton"></div>
        <div class="mt-3 h-4 w-3/4 rounded bg-white/10"></div>
        <div class="mt-2 h-3 w-1/2 rounded bg-white/10"></div>
        <div class="mt-3 h-8 rounded bg-white/10"></div>
      </div>
    `
    )
    .join('');

export const renderCarouselSkeleton = (count = 6) =>
  Array.from({ length: count })
    .map(
      () => `
      <div class="slide">
        <div class="product-card skeleton">
          <div class="product-media skeleton"></div>
          <div class="mt-3 h-4 w-3/4 rounded bg-white/10"></div>
          <div class="mt-2 h-3 w-1/2 rounded bg-white/10"></div>
          <div class="mt-3 h-8 rounded bg-white/10"></div>
        </div>
      </div>
    `
    )
    .join('');

// ====== TOASTS ======
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

// ====== BADGES ======
export const updateCartBadge = () => {
  const badge = document.querySelectorAll('[data-cart-count]');
  const cart = getCart();
  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  badge.forEach((node) => {
    node.textContent = count;
  });
};

// ====== THEME HELPERS ======
export const statusLabel = (status) => {
  if (status === 'pending_verification' || status === 'pending')
    return { text: "Ko'rib chiqilyapti", cls: 'status-badge badge-pending' };
  if (status === 'approved' || status === 'accepted') return { text: 'Qabul qilindi', cls: 'status-badge badge-approved' };
  if (status === 'rejected') return { text: 'Rad etildi', cls: 'status-badge badge-rejected' };
  if (status === 'processing') return { text: 'Jarayonda', cls: 'status-badge badge-pending' };
  return { text: status || "Noma'lum", cls: 'status-badge' };
};

export const productCardHTML = (p) => {
  const badge = p.isNew ? `<span class="pc-pill">NEW</span>` : ``;
  const rating = p.rating ? `<span class="pc-pill">⭐ ${p.rating}</span>` : `<span class="pc-pill">⭐ 4.8</span>`;
  const image = p.images?.[0] || p.img;
  const adminMode = isAdminUser();
  const actionButton = adminMode
    ? `<button type="button" class="pc-btn edit-btn" data-edit-id="${p.id}">✏️ Edit</button>`
    : `<a href="detail.html?id=${p.id}" class="pc-btn">Batafsil</a>`;
  return `
  <article class="slide">
    <div class="product-card">
      <a href="detail.html?id=${p.id}" class="pc-media">
        <div class="pc-badges">${badge}${rating}</div>
        <img src="${image}" alt="${p.name || p.title}" loading="lazy" />
      </a>
      <div class="pc-body">
        <p class="pc-cat">${p.category || 'Anime toy'}</p>
        <h3 class="pc-title">${p.name || p.title}</h3>
        <div class="pc-priceRow">
          <span class="pc-price">${Number(p.price || 0).toLocaleString('ru-RU')} so'm</span>
        </div>
        <div class="pc-actions">
          <button data-add-to-cart="${p.id}" class="pc-btn primary">
            Savat
          </button>
          ${actionButton}
        </div>
      </div>
    </div>
  </article>`;
};

export const productCardSkeletonHTML = () => `
  <div class="skeleton rounded-2xl p-3 w-[165px] sm:w-[210px]">
    <div class="skeleton rounded-xl h-36 sm:h-44 w-full"></div>
    <div class="mt-3 skeleton rounded-lg h-4 w-4/5"></div>
    <div class="mt-2 skeleton rounded-lg h-3 w-2/3"></div>
    <div class="mt-3 flex justify-between gap-2">
      <div class="skeleton rounded-lg h-4 w-2/5"></div>
      <div class="skeleton rounded-xl h-9 w-1/3"></div>
    </div>
  </div>
`;

export const offlineBlockHTML = (
  title = "Internet yo‘q",
  desc = 'Ulanishni tekshirib qayta urinib ko‘ring.'
) => `
  <div class="glass rounded-2xl p-6 text-center">
    <div class="text-3xl">📡</div>
    <h3 class="mt-2 text-lg font-bold">${title}</h3>
    <p class="mt-1 text-sm text-white/70">${desc}</p>
    <button onclick="location.reload()" class="mt-4 neon-btn rounded-xl px-4 py-2 text-sm font-bold">Qayta yuklash</button>
  </div>
`;

export const ordersSkeletonListHTML = (count = 3) =>
  Array.from({ length: count })
    .map(
      () => `
    <div class="glass rounded-2xl p-4">
      <div class="flex justify-between">
        <div class="skeleton rounded-lg h-4 w-1/3"></div>
        <div class="skeleton rounded-lg h-4 w-1/4"></div>
      </div>
      <div class="mt-3 skeleton rounded-lg h-8 w-1/2"></div>
      <div class="mt-4 flex justify-between">
        <div class="skeleton rounded-lg h-4 w-1/4"></div>
        <div class="skeleton rounded-xl h-9 w-24"></div>
      </div>
    </div>
  `
    )
    .join('');

export const initAdminEditDelegation = (root = document) => {
  root.addEventListener('click', (event) => {
    const editBtn = event.target.closest('.edit-btn');
    if (!editBtn) return;
    if (!isAdminUser()) return;
    event.preventDefault();
    event.stopPropagation();
    const editId = editBtn.dataset.editId;
    if (editId) {
      window.location.href = `admin.html?editId=${editId}`;
    }
  });
};
