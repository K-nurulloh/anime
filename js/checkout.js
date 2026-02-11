import {
  ensureSeedData,
  getCart,
  saveCart,
  getCurrentUser,
  getCachedProducts,
  setCachedProducts,
} from './storage.js';
import { formatPrice, showToast, updateCartBadge } from './ui.js';
import { applyTranslations, initLangSwitcher, t } from './i18n.js';
import { STORE_PAYMENT, IMGBB_API_KEY } from './config.js';
import { imgbbUpload } from './imgbb.js';
import { db, nowTs, collection, addDoc, getDocs, query, orderBy } from './firebase.js';

// ====== INIT ======
ensureSeedData();
applyTranslations();
initLangSwitcher();
updateCartBadge();

const form = document.querySelector('#checkout-form');
const summaryBox = document.querySelector('#checkout-summary');
const paymentDoneBtn = document.querySelector('#payment-done');
const receiptStep = document.querySelector('#receipt-step');
const receiptInput =
  document.querySelector('#receipt-input') || document.querySelector('input[type="file"]');
const receiptPreview = document.querySelector('#receipt-preview');
const receiptFilename = document.querySelector('#receipt-filename');
const receiptSubmit =
  document.querySelector('#receipt-submit') ||
  Array.from(document.querySelectorAll('button')).find(
    (button) => button.textContent.trim() === 'Chekni yuborish'
  );
const copyButtons = document.querySelectorAll('.copy-btn');

let productsMap = new Map();
let receiptFile = null;
let receiptPreviewUrl = null;

const normalizePhone = (value) => (value || '').toString().replace(/\D/g, '');
const isValidPhone = (value) =>
  value.length === 9 || (value.length === 12 && value.startsWith('998'));

const getValidatedPhone = () => {
  const formData = new FormData(form);
  const phone = normalizePhone(formData.get('phone'));
  if (!phone) {
    showToast('Telefon raqamingizni kiriting', 'error');
    return null;
  }
  if (!isValidPhone(phone)) {
    showToast('Telefon raqami noto‘g‘ri', 'error');
    return null;
  }
  return phone;
};

const setButtonLoading = (button, loadingText, isLoading) => {
  if (!button) return;
  if (isLoading) {
    button.dataset.originalText = button.textContent;
    button.textContent = loadingText;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
};

const fetchProductsFromFirestore = async () => {
  const cached = getCachedProducts();
  if (cached?.length) return cached;
  try {
    let snapshot;
    try {
      snapshot = await getDocs(query(collection(db, 'products'), orderBy('createdAt', 'desc')));
      if (!snapshot.docs.length) snapshot = await getDocs(collection(db, 'products'));
    } catch (error) {
      snapshot = await getDocs(collection(db, 'products'));
    }
    const products = snapshot.docs.map((docSnap) => {
      const data = docSnap.data() || {};
      const images = Array.isArray(data.images) ? data.images : data.img ? [data.img] : [];
      return {
        id: docSnap.id,
        ...data,
        images,
        img: data.img || images[0] || '',
      };
    });
    setCachedProducts(products);
    return products;
  } catch (error) {
    console.error('Failed to fetch products:', error);
    return [];
  }
};


const calculateSummary = () => {
  const cart = getCart();
  const subtotal = cart.reduce((sum, item) => {
    const product = productsMap.get(String(item.id));
    if (!product) return sum;
    return sum + Number(product.price || 0) * item.qty;
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
  return { total };
};

const createOrder = async ({ paymentMethod, receiptUrl = null, contactPhone }) => {
  const cart = getCart();
  if (!cart.length) {
    showToast(t('cart_empty'), 'error');
    return;
  }

  const formData = new FormData(form);
  const { total } = calculateSummary();

  const currentUser = getCurrentUser();
  const shipping =
    formData.get('shipping') ||
    formData.get('deliveryType') ||
    formData.get('delivery') ||
    'standard';

  const payload = {
    userId: currentUser?.id || null,
    userName: formData.get('name') || currentUser?.name || 'Guest',
    userPhone: contactPhone || currentUser?.phone || '',
    items: cart.map((item) => ({ id: String(item.id), qty: Number(item.qty) || 1 })),
    total,
    payment: paymentMethod,
    shipping,
    status: 'pending_verification',
    receiptUrl: receiptUrl || null,
    createdAt: nowTs(),
    updatedAt: nowTs(),
  };

  await addDoc(collection(db, 'orders'), payload);
  saveCart([]);
  updateCartBadge();
  showToast('Buyurtma yuborildi');
  setTimeout(() => {
    window.location.href = 'orders.html';
  }, 800);
};

const showReceiptStep = () => {
  receiptStep?.classList.remove('hidden');
  receiptStep?.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

const init = async () => {
  const products = await fetchProductsFromFirestore();
  productsMap = new Map(products.map((product) => [String(product.id), product]));
  const cart = getCart();
  if (!cart.length) {
    summaryBox.innerHTML = `<p class="text-sm text-slate-300">${t('cart_empty')}</p>`;
  } else {
    calculateSummary();
  }

  const owner = document.querySelector('#store-owner');
  const card = document.querySelector('#store-card');
  const bank = document.querySelector('#store-bank');
  if (owner) owner.textContent = STORE_PAYMENT.ownerFullName;
  if (card) card.textContent = STORE_PAYMENT.cardNumber;
  if (bank) bank.textContent = STORE_PAYMENT.bank;
};

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const payment = formData.get('payment');
  const contactPhone = getValidatedPhone();
  if (!contactPhone) return;

  if (payment === 'card_transfer') {
    showReceiptStep();
    showToast('Chek rasmini yuklang', 'error');
    return;
  }

  try {
    setButtonLoading(form.querySelector('button[type="submit"]'), 'Yuborilmoqda...', true);
    await createOrder({ paymentMethod: 'cash', contactPhone });
  } catch (error) {
    console.error('Order create error:', error);
    showToast('Buyurtma yuborishda xatolik', 'error');
  } finally {
    setButtonLoading(form.querySelector('button[type="submit"]'), '', false);
  }
});

paymentDoneBtn?.addEventListener('click', () => {
  showReceiptStep();
});

receiptInput?.addEventListener('change', () => {
  const file = receiptInput.files?.[0];
  if (!file) {
    receiptFile = null;
    if (receiptPreviewUrl) {
      URL.revokeObjectURL(receiptPreviewUrl);
      receiptPreviewUrl = null;
    }
    if (receiptPreview) receiptPreview.src = '';
    if (receiptFilename) receiptFilename.textContent = t('receipt_not_selected');
    return;
  }

  receiptFile = file;
  if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl);
  receiptPreviewUrl = URL.createObjectURL(file);
  if (receiptPreview) receiptPreview.src = receiptPreviewUrl;
  if (receiptFilename) receiptFilename.textContent = file.name;
});

receiptSubmit?.addEventListener('click', async () => {
  const contactPhone = getValidatedPhone();
  if (!contactPhone) return;
  if (!receiptFile) {
    showToast(t('receipt_required'), 'error');
    return;
  }

  try {
    setButtonLoading(receiptSubmit, 'Yuborilmoqda...', true);
    const receiptUrl = await imgbbUpload(receiptFile, IMGBB_API_KEY);
    await createOrder({ paymentMethod: 'card_transfer', receiptUrl, contactPhone });
  } catch (error) {
    console.error('Receipt/order error:', error);
    showToast(error.message || 'Chekni yuborishda xatolik', 'error');
  } finally {
    setButtonLoading(receiptSubmit, '', false);
  }
});

copyButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    const text = button.dataset.copy || '';
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      showToast('Nusxa olindi');
    } catch (error) {
      showToast('Nusxa olib bo‘lmadi', 'error');
    }
  });
});

init();

window.addEventListener('langChanged', () => {
  calculateSummary();
});
