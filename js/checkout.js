import {
  ensureSeedData,
  getCart,
  saveCart,
  getOrders,
  saveOrders,
  getCurrentUser,
  updateCurrentUser,
} from './storage.js';
import { fetchProducts } from './api.js';
import { formatPrice, showToast, updateCartBadge } from './ui.js';
import { applyTranslations, initLangSwitcher, t } from './i18n.js';
import { STORE_PAYMENT } from './config.js';

ensureSeedData();
applyTranslations();
initLangSwitcher();
updateCartBadge();

const form = document.querySelector('#checkout-form');
const summaryBox = document.querySelector('#checkout-summary');
const paymentDoneBtn = document.querySelector('#payment-done');
const receiptStep = document.querySelector('#receipt-step');
const receiptInput = document.querySelector('#receipt-input');
const receiptPreview = document.querySelector('#receipt-preview');
const receiptSubmit = document.querySelector('#receipt-submit');
const copyButtons = document.querySelectorAll('.copy-btn');

let productsMap = new Map();
let receiptData = null;

const calculateSummary = () => {
  const cart = getCart();
  const subtotal = cart.reduce((sum, item) => {
    const product = productsMap.get(item.id);
    if (!product) return sum;
    return sum + product.price * item.qty;
  }, 0);
  const delivery = subtotal > 0 ? 25000 : 0;
  const total = subtotal + delivery;

  summaryBox.innerHTML = `
    <div class="space-y-2 text-sm text-slate-300">
      <div class="flex justify-between"><span>${t('subtotal')}</span><span>${formatPrice(subtotal)} so'm</span></div>
      <div class="flex justify-between"><span>${t('delivery')}</span><span>${formatPrice(delivery)} so'm</span></div>
    </div>
    <div class="mt-4 flex justify-between text-lg font-bold text-white">
      <span>${t('total')}</span><span>${formatPrice(total)} so'm</span>
    </div>
  `;
  return { subtotal, delivery, total };
};

const createOrder = ({ status, paymentMethod, receipt }) => {
  const cart = getCart();
  if (!cart.length) {
    showToast(t('cart_empty'), 'error');
    return;
  }
  const formData = new FormData(form);
  const payment = formData.get('payment');
  const shipping = formData.get('shipping');
  const { total, delivery } = calculateSummary();

  const order = {
    id: `ORD-${Date.now()}`,
    date: new Date().toISOString(),
    status,
    items: cart,
    total,
    delivery,
    payment: paymentMethod || payment,
    shipping,
    receipt: receipt || null,
    contact: {
      name: formData.get('name'),
      phone: formData.get('phone'),
      city: formData.get('city'),
      district: formData.get('district'),
      address: formData.get('address'),
    },
    userId: getCurrentUser()?.id || null,
  };

  const orders = getOrders();
  orders.unshift(order);
  saveOrders(orders);

  if (order.userId) {
    updateCurrentUser((user) => ({
      ...user,
      orders: [order, ...(user.orders || [])],
    }));
  }

  saveCart([]);
  showToast(t('order_created'));
  setTimeout(() => {
    window.location.href = 'orders.html';
  }, 800);
};

const init = async () => {
  const { products } = await fetchProducts();
  productsMap = new Map(products.map((product) => [product.id, product]));
  const cart = getCart();
  if (!cart.length) {
    summaryBox.innerHTML = `<p class="text-sm text-slate-300">${t('cart_empty')}</p>`;
    return;
  }
  calculateSummary();
  document.querySelector('#store-owner').textContent = STORE_PAYMENT.ownerFullName;
  document.querySelector('#store-card').textContent = STORE_PAYMENT.cardNumber;
  document.querySelector('#store-bank').textContent = STORE_PAYMENT.bank;
};

const showReceiptStep = () => {
  receiptStep.classList.remove('hidden');
  receiptStep.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const payment = formData.get('payment');
  if (payment === 'card_transfer') {
    showReceiptStep();
    showToast(t('receipt_required'), 'error');
    return;
  }
  createOrder({ status: 'processing', paymentMethod: 'cash' });
});

paymentDoneBtn.addEventListener('click', () => {
  showReceiptStep();
});

receiptInput.addEventListener('change', () => {
  const file = receiptInput.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    receiptData = {
      name: file.name,
      type: file.type,
      size: file.size,
      dataUrl: reader.result,
    };
    receiptPreview.innerHTML = `<img src="${reader.result}" alt="receipt" class="h-full w-full rounded-xl object-cover" />`;
  };
  reader.readAsDataURL(file);
});

receiptSubmit.addEventListener('click', () => {
  if (!receiptData) {
    showToast(t('receipt_required'), 'error');
    return;
  }
  createOrder({
    status: 'pending_verification',
    paymentMethod: 'card_transfer',
    receipt: receiptData,
  });
});

copyButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const target = document.querySelector(`#${button.dataset.copyTarget}`);
    if (!target) return;
    navigator.clipboard.writeText(target.textContent.trim());
    showToast(t('copied'));
  });
});

init();

window.addEventListener('langChanged', () => {
  applyTranslations();
  calculateSummary();
});