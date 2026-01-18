import {
  ensureSeedData,
  getCurrentUser,
  readStorage,
  writeStorage,
  getOrders,
} from './storage.js';
import { formatPrice, initThemeToggle, updateCartBadge, showToast } from './ui.js';

ensureSeedData();
initThemeToggle();
updateCartBadge();

const accessDenied = document.querySelector('#access-denied');
const sellerPanel = document.querySelector('#seller-panel');
const productForm = document.querySelector('#product-form');
const productList = document.querySelector('#seller-products');
const ordersList = document.querySelector('#seller-orders');

const renderProducts = () => {
  const products = readStorage('sellerProducts', []);
  if (!products.length) {
    productList.innerHTML = '<p class="text-sm text-slate-500">Mahsulot yo\'q.</p>';
    return;
  }
  productList.innerHTML = products
    .map(
      (product) => `
      <div class="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div class="flex items-center justify-between">
          <div>
            <p class="font-semibold text-slate-800 dark:text-white">${product.title}</p>
            <p class="text-xs text-slate-500">${product.category}</p>
          </div>
          <div class="text-sm font-semibold text-slate-800 dark:text-white">${formatPrice(
            product.price
          )} so'm</div>
        </div>
        <div class="mt-3 flex gap-2">
          <button class="edit-btn rounded-lg border border-slate-200 px-3 py-1 text-xs" data-id="${
            product.id
          }">Tahrirlash</button>
          <button class="delete-btn rounded-lg border border-rose-200 px-3 py-1 text-xs text-rose-500" data-id="${
            product.id
          }">O'chirish</button>
        </div>
      </div>
    `
    )
    .join('');
};

const renderOrders = () => {
  const orders = getOrders();
  ordersList.innerHTML = orders
    .slice(0, 5)
    .map(
      (order) => `
      <div class="rounded-xl border border-slate-100 bg-white p-3 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p class="font-semibold text-slate-700 dark:text-white">${order.id}</p>
        <p class="text-xs text-slate-500">${new Date(order.date).toLocaleString('uz-UZ')}</p>
        <p class="text-xs text-slate-500">Status: ${order.status}</p>
      </div>
    `
    )
    .join('');
};

const init = () => {
  const currentUser = getCurrentUser();
  if (!currentUser || currentUser.role !== 'seller') {
    accessDenied.classList.remove('hidden');
    sellerPanel.classList.add('hidden');
    return;
  }
  accessDenied.classList.add('hidden');
  sellerPanel.classList.remove('hidden');
  renderProducts();
  renderOrders();
};

productForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(productForm);
  const products = readStorage('sellerProducts', []);
  const editId = productForm.dataset.editId;
  const payload = {
    id: editId ? Number(editId) : Date.now(),
    title: formData.get('title'),
    price: Number(formData.get('price')),
    oldPrice: Number(formData.get('price')) + 100000,
    img: formData.get('img'),
    desc: formData.get('desc'),
    category: formData.get('category'),
    rating: (Math.random() * 1 + 4).toFixed(1),
  };

  if (editId) {
    const index = products.findIndex((product) => product.id === Number(editId));
    products[index] = payload;
    showToast('Mahsulot yangilandi');
  } else {
    products.unshift(payload);
    showToast('Mahsulot qo\'shildi');
  }

  writeStorage('sellerProducts', products);
  productForm.reset();
  productForm.dataset.editId = '';
  renderProducts();
});

productList.addEventListener('click', (event) => {
  const editBtn = event.target.closest('.edit-btn');
  const deleteBtn = event.target.closest('.delete-btn');
  const products = readStorage('sellerProducts', []);
  if (editBtn) {
    const product = products.find((item) => item.id === Number(editBtn.dataset.id));
    if (!product) return;
    productForm.title.value = product.title;
    productForm.price.value = product.price;
    productForm.img.value = product.img;
    productForm.desc.value = product.desc;
    productForm.category.value = product.category;
    productForm.dataset.editId = product.id;
    showToast('Tahrirlash rejimi');
  }
  if (deleteBtn) {
    const updated = products.filter((item) => item.id !== Number(deleteBtn.dataset.id));
    writeStorage('sellerProducts', updated);
    renderProducts();
    showToast('O\'chirildi');
  }
});

init();