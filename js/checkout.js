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
import { STORE_PAYMENT } from './config.js';
import { imgbbUpload } from "./imgbb.js";
import { db, nowTs, collection, addDoc, getDocs, query, orderBy } from './firebase.js';

ensureSeedData();
applyTranslations();
initLangSwitcher();
updateCartBadge();

const API_KEY = "9a6bc6256c8f61ac7df85be0514643b8";
const PENDING_ORDERS_KEY = 'PENDING_ORDERS';

const readJSON = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const writeJSON = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const uid = () => `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;


const form = document.querySelector('#checkout-form');
const summaryBox = document.querySelector('#checkout-summary');
const paymentDoneBtn = document.querySelector('#payment-done');
const receiptStep = document.querySelector('#receipt-step');
const receiptInput = document.querySelector('#receipt-input');
const receiptPreview = document.querySelector('#receipt-preview');
const receiptFilename = document.querySelector('#receipt-filename');
const receiptSubmit = document.querySelector('#receipt-submit');
const copyButtons = document.querySelectorAll('.copy-btn');
const citySelect = document.querySelector('#citySelect');
const districtSelect = document.querySelector('#districtSelect');

const REGIONS = {
  Toshkent: ["Mirzo Ulug‘bek", 'Yunusobod', 'Chilonzor', 'Olmazor'],
  Andijon: ['Andijon tumani', 'Asaka', 'Baliqchi'],
  "Farg‘ona": ["Farg‘ona tumani", 'Quva', 'Marg‘ilon'],
  Namangan: ['Namangan tumani', 'Chortoq', 'Pop'],
  Samarqand: ['Samarqand tumani', 'Urgut', 'Jomboy'],
  Buxoro: ['Buxoro tumani', 'G‘ijduvon', 'Kogon'],
  Xorazm: ['Urganch', 'Xiva', 'Hazorasp'],
  Qashqadaryo: ['Qarshi', 'Shahrisabz', 'Kitob'],
  Surxondaryo: ['Termiz', 'Denov', 'Sherobod'],
  Jizzax: ['Jizzax tumani', 'Zomin', 'G‘allaorol'],
  Navoiy: ['Navoiy tumani', 'Zarafshon', 'Karmana'],
  Sirdaryo: ['Guliston', 'Yangiyer', 'Boyovut'],
};

const DELIVERY_OPTIONS = {
  standard: {
    label: 'Standart (14–18 kun)',
    perKgUsd: 5,
    weightKg: 1,
    price: Math.round(5 * 13000),
  },
  fast: {
    label: 'Tezkor (7–10 kun)',
    perKgUsd: 9,
    weightKg: 1,
    price: Math.round(9 * 13000),
  },
};

let productsMap = new Map();
let receiptFile = null;
let receiptPreviewUrl = null;
let selectedDelivery = 'standard';

const normalizePhone = (value) => (value || '').toString().replace(/\D/g, '');
const isValidPhone = (value) => value.length === 9 || (value.length === 12 && value.startsWith('998'));

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
    } catch {
      snapshot = await getDocs(collection(db, 'products'));
    }

    const products = snapshot.docs.map((docSnap) => {
      const data = docSnap.data() || {};
      const images = Array.isArray(data.images) ? data.images : data.img ? [data.img] : [];
      return { id: docSnap.id, ...data, images, img: data.img || images[0] || '' };
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
    return sum + Number(product.price || 0) * (Number(item.qty) || 1);
  }, 0);

  const deliveryMeta = DELIVERY_OPTIONS[selectedDelivery];
  const total = subtotal;

  summaryBox.innerHTML = `
    <div class="space-y-2 text-sm text-slate-300">
      <div class="flex justify-between"><span>${t('subtotal')}</span><span>${formatPrice(subtotal)} so'm</span></div>
      <div class="flex justify-between"><span>Yetkazish</span><span>${deliveryMeta.label}</span></div>
    </div>
    <div class="mt-4 flex justify-between text-lg font-bold text-white">
      <span>${t('total')}</span><span>${formatPrice(total)} so'm</span>
    </div>
  `;

  return { total, subtotal, deliveryMeta };
};

const setDeliveryType = (type) => {
  selectedDelivery = type;
  form.querySelectorAll('input[name="shipping"]').forEach((radio) => {
    radio.checked = radio.value === type;
    const card = radio.closest('label');
    if (card) {
      card.classList.toggle('border-emerald-400/60', radio.checked);
      card.classList.toggle('bg-emerald-500/10', radio.checked);
      card.classList.toggle('shadow-lg', radio.checked);
      card.classList.toggle('shadow-emerald-500/20', radio.checked);
    }
  });
  calculateSummary();
};

const prependOrderToLocalStorage = (orderPayload) => {
  const keys = ['orders', 'userOrders'];
  keys.forEach((key) => {
    try {
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      const list = Array.isArray(existing) ? existing : [];
      list.unshift(orderPayload);
      localStorage.setItem(key, JSON.stringify(list));
    } catch {
      localStorage.setItem(key, JSON.stringify([orderPayload]));
    }
  });
};

const createOrder = async ({ paymentMethod, receiptUrl = '' , contactPhone }) => {
  const cart = getCart();
  if (!cart.length) {
    showToast(t('cart_empty'), 'error');
    return;
  }

  const formData = new FormData(form);
  const { total, subtotal, deliveryMeta } = calculateSummary();
  const currentUser = getCurrentUser();

  const payload = {
    id: `o-${Date.now()}`,
    date: new Date().toISOString(),
    userId: currentUser?.id || null,
    userName: formData.get('name') || currentUser?.name || 'Guest',
    userPhone: contactPhone || currentUser?.phone || '',
    items: cart.map((item) => ({ ...item })),
    totalProductsSum: subtotal,
    total,
    payment: paymentMethod,
    status: 'pending',
    receiptUrl: receiptUrl || '',
    deliveryType: selectedDelivery || null,
    delivery: {
      type: selectedDelivery,
      label: deliveryMeta.label,
      price: deliveryMeta.price,
      perKgUsd: deliveryMeta.perKgUsd,
      weightKg: deliveryMeta.weightKg,
    },
    address: {
      region: formData.get('city') || '',
      district: formData.get('district') || '',
      homeAddress: formData.get('address') || '',
    },
    createdAt: nowTs(),
    updatedAt: nowTs(),
  };

  await addDoc(collection(db, 'orders'), payload);
  prependOrderToLocalStorage(payload);

  saveCart([]);
  updateCartBadge();
  showToast(paymentMethod === 'card_transfer' ? 'Chek yuborildi. Tekshirilmoqda...' : 'Buyurtma yuborildi!');

  receiptInput.value = '';
  receiptFile = null;
  if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl);
  receiptPreviewUrl = null;
  receiptPreview.innerHTML = t('receipt_preview');
  receiptFilename.textContent = 'Fayl tanlanmagan';

  setTimeout(() => {
    window.location.href = 'orders.html';
  }, 700);
};

const fillDistricts = (region) => {
  if (!districtSelect) return;
  const districts = REGIONS[region] || [];
  districtSelect.innerHTML =
    '<option value="">Tumanni tanlang</option>' +
    districts.map((item) => `<option value="${item}">${item}</option>`).join('');
  districtSelect.disabled = districts.length === 0;
};

const initAddressSelectors = () => {
  if (!citySelect || !districtSelect) return;
  citySelect.innerHTML =
    '<option value="">Hududni tanlang</option>' +
    Object.keys(REGIONS).map((region) => `<option value="${region}">${region}</option>`).join('');
  fillDistricts('');

  citySelect.addEventListener('change', () => {
    fillDistricts(citySelect.value);
  });
};

const showReceiptStep = () => {
  receiptStep?.classList.remove('hidden');
  receiptStep?.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

const init = async () => {
  const products = await fetchProductsFromFirestore();
  productsMap = new Map(products.map((product) => [String(product.id), product]));

  if (!getCart().length) {
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

  initAddressSelectors();
  setDeliveryType('standard');

  form?.querySelectorAll('input[name="shipping"]').forEach((radio) => {
    radio.addEventListener('change', () => setDeliveryType(radio.value));
  });
};

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const phone = getValidatedPhone();
  if (!phone) return;

  const payment = form.querySelector('input[name="payment"]:checked')?.value || 'card_transfer';
  if (payment === 'card_transfer') {
    showReceiptStep();
    return;
  }

  try {
    await createOrder({ paymentMethod: payment, contactPhone: phone });
  } catch {
    showToast('Buyurtma yaratishda xatolik', 'error');
  }
});

paymentDoneBtn?.addEventListener('click', () => {
  const phone = getValidatedPhone();
  if (!phone) return;
  showReceiptStep();
});

receiptInput?.addEventListener('change', () => {
  const file = receiptInput.files?.[0];
  if (!file) {
    receiptFile = null;
    if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl);
    receiptPreviewUrl = null;
    receiptPreview.innerHTML = t('receipt_preview');
    receiptFilename.textContent = 'Fayl tanlanmagan';
    return;
  }

  receiptFile = file;
  if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl);
  receiptPreviewUrl = URL.createObjectURL(file);
  receiptPreview.innerHTML = `<img src="${receiptPreviewUrl}" alt="Chek" class="h-full w-full rounded-2xl object-cover" />`;
  receiptFilename.textContent = file.name;
});

receiptSubmit?.addEventListener('click', async () => {
  const phone = getValidatedPhone();
  if (!phone) return;

  const currentUser = getCurrentUser();
  if (!currentUser) {
    showToast('Iltimos, avval akkauntga kiring', 'error');
    return;
  }

  const cart = getCart();
  if (!cart.length) {
    showToast(t('cart_empty'), 'error');
    return;
  }

  if (!receiptFile) {
    showToast('Chek faylini tanlang', 'error');
    return;
  }

  try {
    setButtonLoading(receiptSubmit, 'Yuborilmoqda...', true);
    const imageUrl = await imgbbUpload(receiptFile, API_KEY);

    const formData = new FormData(form);
    const { subtotal } = calculateSummary();
    const deliveryType = selectedDelivery === 'standard' ? 'standart' : selectedDelivery === 'fast' ? 'tezkor' : null;
    const pendingOrder = {
      id: uid(),
      createdAt: Date.now(),
      user: {
        name: String(formData.get('name') || currentUser?.name || ''),
        phone,
      },
      items: cart.map((item) => {
        const product = productsMap.get(String(item.id)) || {};
        return {
          id: item.id,
          title: String(product.title || item.title || 'Mahsulot'),
          price: Number(product.price ?? item.price ?? 0),
          qty: Number(item.qty) || 1,
          img: product.img || product.images?.[0] || item.img || '',
        };
      }),
      subtotal,
      deliveryType,
      region: String(formData.get('city') || ''),
      district: String(formData.get('district') || ''),
      address: String(formData.get('address') || ''),
      paymentMethod: 'receipt',
      receipt: {
        url: imageUrl,
        fileName: receiptFile.name || '',
      },
      status: 'pending',
    };

    const pending = readJSON(PENDING_ORDERS_KEY, []);
    pending.unshift(pendingOrder);
    writeJSON(PENDING_ORDERS_KEY, pending);

    saveCart([]);
    updateCartBadge();
    showToast('Tekshiruvga yuborildi');

    receiptInput.value = '';
    receiptFile = null;
    if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl);
    receiptPreviewUrl = null;
    receiptPreview.innerHTML = t('receipt_preview');
    receiptFilename.textContent = 'Fayl tanlanmagan';

    setTimeout(() => {
      window.location.href = 'orders.html';
    }, 700);
  } catch (error) {
    console.error(error);
    const message = String(error?.message || 'Chekni yuborishda xatolik');
    showToast(message, 'error');
  } finally {
    setButtonLoading(receiptSubmit, '', false);
  }
});

copyButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    const id = button.dataset.copyTarget;
    const target = document.getElementById(id);
    if (!target) return;
    try {
      await navigator.clipboard.writeText(target.textContent.trim());
      showToast(t('copied'));
    } catch {
      showToast('Nusxalab bo‘lmadi', 'error');
    }
  });
});

init();
