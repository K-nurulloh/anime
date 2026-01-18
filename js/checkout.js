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
import { formatPrice, showToast, updateCartBadge, initThemeToggle } from './ui.js';

ensureSeedData();
initThemeToggle();
updateCartBadge();

const form = document.querySelector('#checkout-form');
const summaryBox = document.querySelector('#checkout-summary');
let productsMap = new Map();

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
    <div class="space-y-2 text-sm text-slate-600 dark:text-slate-300">
      <div class="flex justify-between"><span>Subtotal</span><span>${formatPrice(subtotal)} so'm</span></div>
      <div class="flex justify-between"><span>Yetkazish</span><span>${formatPrice(delivery)} so'm</span></div>
    </div>
    <div class="mt-4 flex justify-between text-lg font-bold text-slate-900 dark:text-white">
      <span>Jami</span><span>${formatPrice(total)} so'm</span>
    </div>
  `;
  return { subtotal, delivery, total };
};

const init = async () => {
  const { products } = await fetchProducts();
  productsMap = new Map(products.map((product) => [product.id, product]));
  const cart = getCart();
  if (!cart.length) {
    summaryBox.innerHTML = '<p class="text-sm text-slate-500">Savat bo\'sh. Iltimos mahsulot qo\'shing.</p>';
    return;
  }
  calculateSummary();
};

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const cart = getCart();
  if (!cart.length) {
    showToast('Savat bo\'sh', 'error');
    return;
  }

  const formData = new FormData(form);
  const payment = formData.get('payment');
  const shipping = formData.get('shipping');
  const { total, delivery } = calculateSummary();

  const order = {
    id: `ORD-${Date.now()}`,
    date: new Date().toISOString(),
    status: ['processing', 'delivered', 'cancelled'][Math.floor(Math.random() * 3)],
    items: cart,
    total,
    delivery,
    payment,
    shipping,
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
  showToast('Buyurtma yaratildi');
  setTimeout(() => {
    window.location.href = 'orders.html';
  }, 800);
});

init();