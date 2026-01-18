import { ensureSeedData, getOrders, getCurrentUser } from './storage.js';
import { formatPrice, initThemeToggle, updateCartBadge } from './ui.js';
import { fetchProducts } from './api.js';

ensureSeedData();
initThemeToggle();
updateCartBadge();

const ordersList = document.querySelector('#orders-list');
const emptyState = document.querySelector('#orders-empty');
const modal = document.querySelector('#order-modal');
const modalContent = document.querySelector('#modal-content');
const modalClose = document.querySelector('#modal-close');

let productsMap = new Map();

const renderOrders = () => {
  const currentUser = getCurrentUser();
  const orders = getOrders();
  const data = currentUser ? orders.filter((order) => order.userId === currentUser.id) : orders;

  if (!data.length) {
    emptyState.classList.remove('hidden');
    ordersList.innerHTML = '';
    return;
  }
  emptyState.classList.add('hidden');
  ordersList.innerHTML = data
    .map(
      (order) => `
      <div class="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p class="text-xs text-slate-500">Order ID</p>
            <p class="font-semibold text-slate-800 dark:text-white">${order.id}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500">Sana</p>
            <p class="text-sm text-slate-700 dark:text-slate-200">${new Date(
              order.date
            ).toLocaleDateString('uz-UZ')}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500">Status</p>
            <span class="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-200">${
              order.status
            }</span>
          </div>
          <div>
            <p class="text-xs text-slate-500">Jami</p>
            <p class="font-semibold text-slate-800 dark:text-white">${formatPrice(
              order.total
            )} so'm</p>
          </div>
          <button class="order-detail-btn rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-200" data-id="${
            order.id
          }">Batafsil</button>
        </div>
      </div>
    `
    )
    .join('');
};

const openModal = (orderId) => {
  const orders = getOrders();
  const order = orders.find((item) => item.id === orderId);
  if (!order) return;
  modalContent.innerHTML = `
    <h3 class="text-lg font-semibold text-slate-800 dark:text-white">${order.id}</h3>
    <p class="text-sm text-slate-500">${new Date(order.date).toLocaleString('uz-UZ')}</p>
    <div class="mt-4 space-y-2">
      ${order.items
        .map((item) => {
          const product = productsMap.get(item.id);
          return `
          <div class="flex items-center justify-between text-sm text-slate-700 dark:text-slate-200">
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

const init = async () => {
  const { products } = await fetchProducts();
  productsMap = new Map(products.map((product) => [product.id, product]));
  renderOrders();
};

init();