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
import { uploadToImgBB } from './imgbb.js';
import { db, nowTs, collection, addDoc, getDocs, query, orderBy } from './firebase.js';

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

  return { total, deliveryMeta };
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

const createOrder = async ({ paymentMethod, receiptUrl = null, contactPhone }) => {
  const cart = getCart();
  if (!cart.length) {
    showToast(t('cart_empty'), 'error');
    return;
  }

  const formData = new FormData(form);
  const { total, deliveryMeta } = calculateSummary();
  const currentUser = getCurrentUser();

  const payload = {
    userId: currentUser?.id || null,
    userName: formData.get('name') || currentUser?.name || 'Guest',
    userPhone: contactPhone || currentUser?.phone || '',
    items: cart.map((item) => ({ id: String(item.id), qty: Number(item.qty) || 1 })),
    total,
    payment: paymentMethod,
    status: 'pending_verification',
    receiptUrl: receiptUrl || null,
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
  saveCart([]);
  updateCartBadge();
  showToast('Buyurtma yuborildi!');

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


const ensureImgBBApiKey = () => {
  const windowKey = typeof window !== 'undefined' ? window.IMGBB_API_KEY : '';
  let localKey = '';
  try {
    localKey = localStorage.getItem('IMGBB_API_KEY') || '';
  } catch {
    localKey = '';
  }

  const existingKey = String(windowKey || localKey || '').trim();
  if (existingKey) return existingKey;

  const entered = prompt('ImgBB API key kiriting:');
  const key = String(entered || '').trim();
  if (!key) {
    showToast('ImgBB API key kiritilmadi', 'error');
    return null;
  }

  try {
    localStorage.setItem('IMGBB_API_KEY', key);
  } catch {
    // ignore storage write failures
  }

  if (typeof window !== 'undefined') {
    window.IMGBB_API_KEY = key;
  }

  return key;
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
  if (!receiptFile) {
    showToast(t('receipt_required'), 'error');
    return;
  }

  const apiKey = ensureImgBBApiKey();
  if (!apiKey) return;

  try {
    setButtonLoading(receiptSubmit, 'Yuborilmoqda...', true);
    const { url: receiptUrl } = await uploadToImgBB(receiptFile);
    await createOrder({ paymentMethod: 'card_transfer', receiptUrl, contactPhone: phone });
  } catch (error) {
    console.error(error);
    showToast('Chekni yuborishda xatolik', 'error');
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
