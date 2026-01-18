import { ensureSeedData, getCurrentUser } from './storage.js';
import { formatPrice, updateCartBadge } from './ui.js';
import { applyTranslations, initLangSwitcher, t, getLang } from './i18n.js';
import { fetchProducts } from './api.js';
import { db, collection, query, where, getDocs, orderBy } from './firebase.js';

// ====== INIT ======
ensureSeedData();
applyTranslations();
initLangSwitcher();
updateCartBadge();

const ordersList = document.querySelector('#orders-list');
const emptyState = document.querySelector('#orders-empty');
const modal = document.querySelector('#order-modal');
const modalContent = document.querySelector('#modal-content');
const modalClose = document.querySelector('#modal-close');

let productsMap = new Map();

// ====== HELPERS ======
const formatStatus = (status) => {
  if (status === 'pending_verification') return 'Tekshiruvda';
  if (status === 'confirmed') return 'Muvaffaqiyatli to‘landi';
  if (status === 'rejected') return 'To‘lov tasdiqlanmadi';
  return t(status);
};

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
      <div class="rounded-2xl border border-slate-700 bg-[#0f2f52] p-4 shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p class="text-xs text-slate-400">${t('order_id')}</p>
            <p class="font-semibold text-white">${order.id}</p>
          </div>
          <div>
            <p class="text-xs text-slate-400">${t('order_date')}</p>
            <p class="text-sm text-slate-300">${new Date(order.createdAt?.toDate ? order.createdAt.toDate() : order.createdAt).toLocaleDateString(getLang() === 'ru' ? 'ru-RU' : 'uz-UZ')}</p>
          </div>
          <div>
            <p class="text-xs text-slate-400">${t('order_status')}</p>
            <span class="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-200">${formatStatus(
              order.status
            )}</span>
          </div>
          <div>
            <p class="text-xs text-slate-400">${t('total')}</p>
            <p class="font-semibold text-white">${formatPrice(order.total)} so'm</p>
          </div>
          <button class="order-detail-btn rounded-lg bg-blue-500 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-600" data-id="${
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
    <div class="mt-4 space-y-2">
      ${order.items
        .map((item) => {
          const product = productsMap.get(item.id);
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

// ====== DATA BOOTSTRAP ======
const init = async () => {
  const { products } = await fetchProducts();
  productsMap = new Map(products.map((product) => [product.id, product]));
  const currentUser = getCurrentUser();
  if (!currentUser) {
    emptyState.classList.remove('hidden');
    ordersList.innerHTML = '';
    return;
  }
  const snapshot = await getDocs(
    query(
      collection(db, 'orders'),
      where('userId', '==', currentUser.id),
      orderBy('createdAt', 'desc')
    )
  );
  window.__orders = snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));
  renderOrders();
};

init();

window.addEventListener('langChanged', () => {
  renderOrders();
});
