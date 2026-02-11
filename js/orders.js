import { ensureSeedData, getCurrentUser } from './storage.js';
import { formatPrice, updateCartBadge, statusLabel, ordersSkeletonListHTML, offlineBlockHTML } from './ui.js';
import { applyTranslations, initLangSwitcher, t, getLang } from './i18n.js';
import { fetchProducts } from './api.js';
import { db, collection, query, where, getDocs, orderBy, limit } from './firebase.js';

// ====== INIT ======
ensureSeedData();
applyTranslations();
initLangSwitcher();
updateCartBadge();

const ordersList = document.querySelector('#orders-list');
const emptyState = document.querySelector('#orders-empty');
const offlineNotice = document.querySelector('#orders-offline');
const modal = document.querySelector('#order-modal');
const modalContent = document.querySelector('#modal-content');
const modalClose = document.querySelector('#modal-close');

let productsMap = new Map();

// ====== HELPERS ======
const CACHE_KEY = 'orders_cache_v1';
const LS_FALLBACK_KEY = 'orders';

const formatStatus = (status) => {
  if (status === 'pending' || status === 'pending_verification') return "Ko'rib chiqilyapti";
  if (status === 'approved' || status === 'accepted') return 'Buyurtma qabul qilindi';
  if (status === 'rejected') return 'Rad etildi';
  return statusLabel(status).text;
};

const normalizeCreatedAt = (value) => {
  if (!value) return null;
  if (value.toDate) return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  return new Date(value).toISOString();
};

const toDisplayDate = (value) => {
  const dateValue = value?.toDate ? value.toDate() : value;
  if (!dateValue) return '';
  return new Date(dateValue).toLocaleDateString(getLang() === 'ru' ? 'ru-RU' : 'uz-UZ');
};

const getCache = () => {
  const raw = localStorage.getItem(CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
};

const saveCache = (items) => {
  const payload = {
    ts: Date.now(),
    items: items.map((item) => ({
      ...item,
      createdAt: normalizeCreatedAt(item.createdAt),
    })),
  };
  localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
};

const renderSkeleton = (count = 6) => {
  ordersList.innerHTML = ordersSkeletonListHTML(count);
};

const renderReceiptThumb = (order, size = 'h-8 w-8') =>
  order.receiptUrl
    ? `<a href="${order.receiptUrl}" target="_blank" rel="noreferrer" class="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs text-white/85">
         <img src="${order.receiptUrl}" alt="Chek" class="${size} rounded object-cover" />
         <span>View receipt</span>
       </a>`
    : '';

// ====== ORDERS ======
const renderOrders = () => {
  const data = window.__orders || [];

  if (!data.length) {
    emptyState.classList.remove('hidden');
    ordersList.innerHTML = '';
    return;
  }
  emptyState.classList.add('hidden');
  ordersList.innerHTML = data
    .map(
      (order) => `
      <div class="rounded-2xl glass p-4 shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p class="text-xs text-slate-400">${t('order_id')}</p>
            <p class="font-semibold text-white">${order.id}</p>
          </div>
          <div>
            <p class="text-xs text-slate-400">${t('order_date')}</p>
            <p class="text-sm text-slate-300">${toDisplayDate(order.createdAt)}</p>
          </div>
          <div>
            <p class="text-xs text-slate-400">${t('order_status')}</p>
            <span class="${statusLabel(order.status).cls}">${formatStatus(order.status)}</span>
            ${
              order.status === 'rejected' && order.rejectReason
                ? `<p class="mt-2 text-xs text-rose-200">Sabab: ${order.rejectReason}</p>`
                : ''
            }
          </div>
          <div>
            <p class="text-xs text-slate-400">${t('total')}</p>
            <p class="font-semibold text-white">${formatPrice(order.total)} so'm</p>
          </div>
          ${renderReceiptThumb(order)}
          <button class="order-detail-btn neon-btn rounded-lg px-3 py-1 text-xs font-semibold" data-id="${
            order.id
          }">${t('details')}</button>
        </div>
      </div>
    `
    )
    .join('');
};

// ====== MODAL ======
const openModal = (orderId) => {
  const order = window.__orders?.find((item) => item.id === orderId);
  if (!order) return;
  modalContent.innerHTML = `
    <h3 class="text-lg font-semibold text-white">${order.id}</h3>
    <p class="text-sm text-slate-400">${new Date(order.createdAt?.toDate ? order.createdAt.toDate() : order.createdAt).toLocaleString(getLang() === 'ru' ? 'ru-RU' : 'uz-UZ')}</p>
    ${renderReceiptThumb(order, 'h-10 w-10')}
    <div class="mt-4 space-y-2">
      ${order.items
        .map((item) => {
          const product = productsMap.get(String(item.id));
          return `
          <div class="flex items-center justify-between text-sm text-slate-300">
            <span>${product ? product.title : `Product #${item.id}`}</span>
            <span>${item.qty}x</span>
          </div>`;
        })
        .join('')}
    </div>
  `;
  modal.classList.remove('hidden');
};

ordersList.addEventListener('click', (event) => {
  const button = event.target.closest('.order-detail-btn');
  if (button) {
    openModal(button.dataset.id);
  }
});

modalClose.addEventListener('click', () => modal.classList.add('hidden'));
modal.addEventListener('click', (event) => {
  if (event.target === modal) {
    modal.classList.add('hidden');
  }
});

const fetchOrdersFromFirestore = async (currentUser) => {
  if (!currentUser) return [];

  let items = [];
  if (currentUser.id) {
    const byUserId = await getDocs(
      query(collection(db, 'orders'), where('userId', '==', currentUser.id), orderBy('createdAt', 'desc'), limit(50))
    );
    items = byUserId.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  }

  if (!items.length && currentUser.phone) {
    const byPhone = await getDocs(
      query(collection(db, 'orders'), where('userPhone', '==', currentUser.phone), orderBy('createdAt', 'desc'), limit(50))
    );
    items = byPhone.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  }

  return items;
};

// ====== DATA BOOTSTRAP ======
const init = async () => {
  const { products } = await fetchProducts();
  productsMap = new Map(products.map((product) => [String(product.id), product]));
  renderSkeleton();

  const cached = getCache();
  if (cached?.items?.length) {
    window.__orders = cached.items;
    renderOrders();
  }

  const currentUser = getCurrentUser();
  if (!currentUser) {
    emptyState.classList.remove('hidden');
    ordersList.innerHTML = '';
    return;
  }

  if (!navigator.onLine && offlineNotice) {
    offlineNotice.classList.remove('hidden');
  }

  try {
    const firebaseOrders = await fetchOrdersFromFirestore(currentUser);
    window.__orders = firebaseOrders;
    renderOrders();
    saveCache(firebaseOrders);
  } catch (error) {
    console.error('Firestore orders load failed:', error);
    const localFallback = JSON.parse(localStorage.getItem(LS_FALLBACK_KEY) || '[]');
    const fallbackOrders = localFallback
      .filter(
        (order) =>
          (currentUser.id && order.userId === currentUser.id) ||
          (currentUser.phone && order.userPhone === currentUser.phone)
      )
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    if (fallbackOrders.length) {
      window.__orders = fallbackOrders;
      renderOrders();
    } else if (!cached?.items?.length) {
      emptyState.classList.remove('hidden');
      ordersList.innerHTML = offlineBlockHTML(
        'Buyurtmalar yuklanmadi',
        'Internetga ulanib qayta urinib ko‘ring.'
      );
    }
  }
};

init();

window.addEventListener('langChanged', () => {
  renderOrders();
});

window.addEventListener('online', () => {
  if (offlineNotice) {
    offlineNotice.classList.add('hidden');
  }
});

window.addEventListener('offline', () => {
  if (offlineNotice) {
    offlineNotice.classList.remove('hidden');
  }
});
