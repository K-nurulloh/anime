import {
  ensureSeedData,
  getProductComments,
  saveProductComments,
} from './storage.js';
import { fetchProducts } from './api.js';
import { showToast, statusLabel } from './ui.js';
import { IMGBB_API_KEY } from './config.js';
import { imgbbUpload } from './imgbb.js';
import {
  db,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  getDoc,
  orderBy,
  serverTimestamp,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
} from './firebase.js';

ensureSeedData();

// ====== DOM ======
const accessDenied = document.querySelector('#access-denied');
const adminPanel = document.querySelector('#admin-panel');
const pendingOrdersList = document.querySelector('#pending-orders');
const pendingEmpty = document.querySelector('#pending-empty');

const receiptModal = document.querySelector('#receipt-modal');
const receiptImage = document.querySelector('#receipt-image');
const receiptClose = document.querySelector('#receipt-close');

const productForm = document.querySelector('#admin-product-form');
const productTitle = document.querySelector('#product-title');
const productCategory = document.querySelector('#product-category');
const productPrice = document.querySelector('#product-price');
const productStock = document.querySelector('#product-stock');
const productOldPrice = document.querySelector('#product-old-price');
const productDiscount = document.querySelector('#product-discount');
const productDescription = document.querySelector('#pDesc');
const productRating = document.querySelector('#product-rating');
const productVariantName = document.querySelector('#variant-name');
const productVariantPrice = document.querySelector('#variant-price');
const addVariantBtn = document.querySelector('#add-variant-btn');
const variantList = document.querySelector('#variant-list');
const productImages = document.querySelector('#pImages');
const imageLimitError = document.querySelector('#image-limit-error');
const imagePreview = document.querySelector('#image-preview');

const adminProductsEmpty = document.querySelector('#admin-products-empty');
const adminProductsList = document.querySelector('#adminProducts');
const saveButton = document.querySelector('#btnSave');

const commentsEmpty = document.querySelector('#comments-empty');
const adminComments = document.querySelector('#admin-comments');

// ====== LABELS ======
const statusLabels = {
  pending: 'Ko‘rib chiqilyapti',
  pending_verification: 'Ko‘rib chiqilyapti',
  approved: 'Buyurtma qabul qilindi',
  rejected: 'Buyurtma rad etildi',
};

// ====== LOCAL KEYS (agar pending localdan ham ko‘rsatayotgan bo‘lsang) ======
const PENDING_ORDERS_KEY = 'PENDING_ORDERS';
const APPROVED_ORDERS_KEY = 'APPROVED_ORDERS';
const REJECTED_ORDERS_KEY = 'REJECTED_ORDERS';

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

// ====== STATE ======
let selectedFiles = [];
let selectedPreviews = [];
let productsMap = new Map();
let adminProducts = [];
let editingId = null;
let productVariants = [];

// ====== ADMIN CHECK ======
const readCurrentUser = () => {
  const raw = localStorage.getItem('currentUser');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const currentUser = readCurrentUser();
const isAdmin = currentUser?.isAdmin === true;

if (!isAdmin) {
  accessDenied?.classList.remove('hidden');
  adminPanel?.classList.add('hidden');
} else {
  accessDenied?.classList.add('hidden');
  adminPanel?.classList.remove('hidden');
}

// ====== HELPERS ======
const formatDate = (value) => {
  const dateValue = value?.toDate ? value.toDate() : value;
  if (!dateValue) return '-';
  return new Date(dateValue).toLocaleString('uz-UZ');
};

const getItemsCount = (items = []) => (Array.isArray(items) ? items.reduce((sum, item) => sum + Number(item.qty || 0), 0) : 0);

const safeNumber = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

// ====== ✅ Local orderni topish (pending/approved/rejected) ======
const findLocalOrder = (id) => {
  const pending = readJSON(PENDING_ORDERS_KEY, []);
  const approved = readJSON(APPROVED_ORDERS_KEY, []);
  const rejected = readJSON(REJECTED_ORDERS_KEY, []);

  return (
    pending.find((o) => o.id === id) ||
    approved.find((o) => o.id === id) ||
    rejected.find((o) => o.id === id) ||
    null
  );
};

// ====== ✅ Eski local formatlarni Firestore order formatiga moslab berish ======
const normalizePendingToFirestore = (o) => {
  const userName = o.userName || o.user?.name || 'Guest';
  const userPhone = o.userPhone || o.user?.phone || '';

  const region = o.address?.region || o.region || '';
  const district = o.address?.district || o.district || '';
  const homeAddress = o.address?.homeAddress || o.address || '';

  const receiptUrl = o.receiptUrl || o.receipt?.url || o.receiptBase64 || '';

  const items = Array.isArray(o.items) ? o.items : Array.isArray(o.cart) ? o.cart : [];

  const totalProductsSum = safeNumber(o.totalProductsSum ?? o.subtotal ?? 0);
  const total = safeNumber(o.total ?? o.totalPrice ?? totalProductsSum ?? 0);

  return {
    id: o.id,
    date: o.date || new Date().toISOString(),
    userId: o.userId || o.user?.id || null,
    userName: String(userName),
    userPhone: String(userPhone),
    items: items.map((it) => ({ ...it })),
    totalProductsSum,
    total,
    payment: o.payment || 'receipt',
    status: o.status || 'pending',
    receiptUrl,
    deliveryType: o.deliveryType || o.delivery?.type || null,
    delivery: o.delivery || null,
    address: {
      region: String(region),
      district: String(district),
      homeAddress: String(homeAddress),
    },
    createdAt: o.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
};

// ====== ✅ Firestore'dan orderni olish (docId yoki field id bo‘yicha) ======
async function getOrderByAnyId(orderId) {
  // 1) docId sifatida tekshir
  const direct = await getDoc(doc(db, 'orders', orderId));
  if (direct.exists()) return { docId: direct.id, ...direct.data() };

  // 2) eski orderlar uchun data.id bo‘yicha qidir
  const q = query(collection(db, 'orders'), where('id', '==', orderId));
  const qs = await getDocs(q);
  if (!qs.empty) {
    const d = qs.docs[0];
    return { docId: d.id, ...d.data() };
  }

  return null;
}

// ====== ✅ Status update (merge bilan) ======
const updateOrderStatus = async (orderId, status, rejectReason = null) => {
  const ref = doc(db, 'orders', orderId);

  await setDoc(
    ref,
    {
      status,
      rejectReason: rejectReason || null,
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  await renderOrders(); // yangilab ko‘rsatish
};

// ====== ✅ Card render (Firestore formatiga mos) ======
const renderOrderCard = (order, { showActions }) => {
  const buyerName = order.userName || "Noma'lum";
  const buyerPhone = order.userPhone || 'N/A';
  const receiptSrc = order.receiptUrl || order.receiptBase64 || null;

  const receiptMarkup = receiptSrc
    ? `
      <a href="${receiptSrc}" target="_blank" rel="noreferrer"
         class="receipt-open mt-3 inline-flex items-center gap-2 rounded-xl glass-soft px-3 py-2 text-xs text-white/80"
         data-id="${order.id}">
        <img src="${receiptSrc}" alt="Receipt" class="h-16 w-16 rounded-lg object-cover" />
        <span>Chekni ko‘rish</span>
      </a>
    `
    : `<p class="mt-3 text-xs text-slate-500">Chek mavjud emas.</p>`;

  const rejectReason = order.rejectReason
    ? `<p class="mt-2 text-xs text-rose-200">Sabab: ${order.rejectReason}</p>`
    : '';

  const statusChip = statusLabel(order.status);

  const base = location.origin;
  const detailLink = `${base}/searc.html?id=${encodeURIComponent(order.id)}`;

  return `
    <article class="rounded-2xl glass p-4 shadow-sm">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-xs text-slate-400">Buyurtma ID</p>
          <a class="text-sm font-semibold text-white underline" href="${detailLink}" target="_blank" rel="noreferrer">${order.id}</a>

          <p class="mt-2 text-xs text-slate-400">Kim buyurtma qildi</p>
          <p class="text-sm text-slate-200">Kimdan: ${buyerName} (${buyerPhone})</p>
        </div>

        <div>
          <p class="text-xs text-slate-400">Sana</p>
          <p class="text-sm text-slate-200">${formatDate(order.createdAt)}</p>

          <p class="mt-2 text-xs text-slate-400">Mahsulotlar soni</p>
          <p class="text-sm text-slate-200">${getItemsCount(order.items)}</p>
        </div>

        <div>
          <p class="text-xs text-slate-400">Jami</p>
          <p class="text-sm font-semibold text-white">${safeNumber(order.total).toLocaleString('uz-UZ')} so'm</p>

          <p class="mt-2 text-xs text-slate-400">To'lov turi</p>
          <p class="text-sm text-slate-200">${order.payment || '-'}</p>
        </div>

        <div>
          <p class="text-xs text-slate-400">Holat</p>
          <span class="${statusChip.cls}">${statusChip.text || statusLabels[order.status] || order.status}</span>
          ${rejectReason}
        </div>
      </div>

      ${receiptMarkup}

      ${
        showActions
          ? `
        <div class="mt-4 flex flex-wrap gap-3">
          <button class="confirm-btn neon-btn rounded-xl px-4 py-2 text-xs font-semibold" data-id="${order.id}">✅ Qabul</button>
          <button class="reject-btn rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:border-white/40" data-id="${order.id}">❌ Rad</button>
        </div>
      `
          : ''
      }
    </article>
  `;
};

// ====== ✅ ORDERS LIST (Firestore’dan pendinglarni olib chiqadi) ======
const renderOrders = async () => {
  if (!isAdmin) return;

  // pendinglarni Firestore’dan olamiz
  const q = query(collection(db, 'orders'), where('status', '==', 'pending'));
  const snap = await getDocs(q);

  if (snap.empty) {
    pendingEmpty?.classList.remove('hidden');
    pendingOrdersList.innerHTML = '';
    return;
  }

  pendingEmpty?.classList.add('hidden');

  const list = snap.docs.map((d) => ({ docId: d.id, ...d.data() }));

  // yangi orderlar tepada chiqsin (createdAt bo‘lsa)
  list.sort((a, b) => {
    const ta = a.createdAt?.seconds ? a.createdAt.seconds : 0;
    const tb = b.createdAt?.seconds ? b.createdAt.seconds : 0;
    return tb - ta;
  });

  pendingOrdersList.innerHTML = list.map((o) => renderOrderCard(o, { showActions: true })).join('');
};

// ====== PRODUCTS ======
const renderAdminProducts = () => {
  if (!adminProducts.length) {
    adminProductsEmpty?.classList.remove('hidden');
    adminProductsList.innerHTML = '';
    return;
  }
  adminProductsEmpty?.classList.add('hidden');

  adminProductsList.innerHTML = adminProducts
    .map(
      (product) => `
      <article class="rounded-2xl border border-slate-700 bg-slate-800/60 p-4 text-sm text-slate-200">
        <img src="${product.images?.[0] || product.img || ''}" alt="${product.title || ''}" class="h-32 w-full rounded-xl object-cover" />
        <div class="mt-3 space-y-1">
          <p class="font-semibold text-white">${product.title || ''}</p>
          <p class="text-xs text-slate-400">${product.category || ''}</p>
        </div>
        <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span class="text-sm font-semibold text-white">${safeNumber(product.price).toLocaleString('uz-UZ')} so'm</span>
          ${
            (product.discount ?? product.discountPercent)
              ? `<span class="text-xs font-semibold text-emerald-200">-${product.discount ?? product.discountPercent}%</span>`
              : ''
          }
        </div>
        <div class="mt-3 flex justify-end gap-2">
          <button type="button" class="edit-product-btn rounded-lg border border-slate-600 px-3 py-1 text-xs text-slate-200 hover:border-slate-400" data-id="${product.id}">✏️ Edit</button>
          <button type="button" class="delete-product-btn rounded-lg border border-rose-500/60 px-3 py-1 text-xs text-rose-200 hover:border-rose-400" data-id="${product.id}">🗑 Delete</button>
        </div>
      </article>
    `
    )
    .join('');
};

const loadAdminProducts = async () => {
  const snap = await getDocs(query(collection(db, 'products'), orderBy('createdAt', 'desc')));
  adminProducts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderAdminProducts();
};

const renderVariants = () => {
  if (!variantList) return;
  if (!productVariants.length) {
    variantList.innerHTML = '<p class="text-xs text-white/50">Variantlar yo‘q. Asosiy price ishlatiladi.</p>';
    return;
  }
  variantList.innerHTML = productVariants
    .map(
      (v, i) => `
      <div class="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900/40 px-3 py-2 text-sm">
        <div>
          <p class="font-medium text-white">${v.name}</p>
          <p class="text-xs text-white/60">${safeNumber(v.price).toLocaleString('uz-UZ')} so'm</p>
        </div>
        <button type="button" class="remove-variant rounded-lg border border-rose-400/50 px-2 py-1 text-xs text-rose-200" data-index="${i}">❌</button>
      </div>
    `
    )
    .join('');
};

const setVariantsForEdit = (variants) => {
  productVariants = Array.isArray(variants)
    ? variants
        .map((v) => ({ name: String(v?.name || '').trim(), price: safeNumber(v?.price) }))
        .filter((v) => v.name && v.price > 0)
    : [];
  renderVariants();
};

const updateImagePreview = () => {
  if (!imagePreview) return;
  imagePreview.innerHTML = selectedPreviews
    .map(
      (img, idx) => `
      <div class="relative overflow-hidden rounded-xl border border-slate-700 bg-slate-800/60">
        <img src="${img}" alt="preview" class="h-32 w-full object-cover" />
        <button type="button" class="remove-image absolute right-2 top-2 rounded-full bg-black/70 px-2 py-1 text-xs text-white" data-index="${idx}">❌</button>
      </div>
    `
    )
    .join('');
};

productImages?.addEventListener('change', (e) => {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;
  if (files.length + selectedFiles.length > 10) {
    showToast('Maksimum 10 ta rasm yuklash mumkin', 'error');
    imageLimitError?.classList.remove('hidden');
    productImages.value = '';
    return;
  }
  imageLimitError?.classList.add('hidden');

  files.forEach((f) => {
    selectedFiles.push(f);
    selectedPreviews.push(URL.createObjectURL(f));
  });
  updateImagePreview();
  productImages.value = '';
});

imagePreview?.addEventListener('click', (e) => {
  const btn = e.target.closest('.remove-image');
  if (!btn) return;
  const idx = Number(btn.dataset.index);
  const removed = selectedPreviews[idx];
  if (removed?.startsWith('blob:')) URL.revokeObjectURL(removed);
  selectedPreviews.splice(idx, 1);
  selectedFiles.splice(idx, 1);
  updateImagePreview();
});

addVariantBtn?.addEventListener('click', () => {
  const name = productVariantName?.value.trim();
  const price = safeNumber(productVariantPrice?.value, -1);

  if (!name) return showToast('Variant nomini kiriting', 'error');
  if (!(price > 0)) return showToast('Variant narxi musbat bo‘lishi kerak', 'error');

  productVariants.push({ name, price });
  renderVariants();
  if (productVariantName) productVariantName.value = '';
  if (productVariantPrice) productVariantPrice.value = '';
});

variantList?.addEventListener('click', (e) => {
  const btn = e.target.closest('.remove-variant');
  if (!btn) return;
  const idx = Number(btn.dataset.index);
  productVariants = productVariants.filter((_, i) => i !== idx);
  renderVariants();
});

const resetProductForm = () => {
  selectedPreviews.forEach((p) => p?.startsWith('blob:') && URL.revokeObjectURL(p));
  selectedFiles = [];
  selectedPreviews = [];
  updateImagePreview();
  imageLimitError?.classList.add('hidden');
  editingId = null;
  productVariants = [];
  renderVariants();
  if (saveButton) saveButton.textContent = 'Saqlash';
  productForm?.reset();
};

productForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!selectedFiles.length && !selectedPreviews.length) {
    return showToast('Kamida 1 ta rasm yuklang', 'error');
  }

  try {
    const title = productTitle.value.trim();
    if (!title) return showToast('Mahsulot nomini kiriting', 'error');

    const payload = {
      title,
      category: productCategory.value,
      price: safeNumber(productPrice.value),
      stock: productStock?.value === '' ? null : safeNumber(productStock.value),
      oldPrice: productOldPrice.value === '' ? null : safeNumber(productOldPrice.value),
      discount: productDiscount.value === '' ? null : safeNumber(productDiscount.value),
      rating: productRating?.value === '' ? null : safeNumber(productRating.value),
      desc: productDescription?.value.trim() || null,
      variants: productVariants,
      updatedAt: serverTimestamp(),
      active: true,
    };

    const imageUrls = selectedFiles.length
      ? await Promise.all(selectedFiles.map((file) => imgbbUpload(file, IMGBB_API_KEY)))
      : [...selectedPreviews];

    if (editingId) {
      await updateDoc(doc(db, 'products', editingId), { ...payload, images: imageUrls });
      showToast('Mahsulot yangilandi');
    } else {
      await addDoc(collection(db, 'products'), { ...payload, images: imageUrls, createdAt: serverTimestamp() });
      showToast('Mahsulot qo‘shildi');
    }

    resetProductForm();
    await loadAdminProducts();
  } catch (err) {
    console.error(err);
    showToast('Mahsulotni saqlashda xatolik', 'error');
  }
});

adminProductsList?.addEventListener('click', async (e) => {
  const del = e.target.closest('.delete-product-btn');
  const edit = e.target.closest('.edit-product-btn');

  if (del) {
    const id = del.dataset.id;
    if (!id) return;
    if (!confirm('Mahsulotni o‘chirishni tasdiqlaysizmi?')) return;
    try {
      await deleteDoc(doc(db, 'products', id));
      showToast("Mahsulot o‘chirildi");
      await loadAdminProducts();
    } catch (err) {
      console.error(err);
      showToast("O‘chirishda xatolik", "error");
    }
    return;
  }

  if (edit) {
    const id = edit.dataset.id;
    const docSnap = await getDoc(doc(db, 'products', id));
    if (!docSnap.exists()) return showToast('Mahsulot topilmadi', 'error');

    const p = docSnap.data();
    editingId = id;

    productTitle.value = p.title || '';
    productCategory.value = p.category || 'Telefon';
    productPrice.value = p.price ?? '';
    productStock.value = p.stock ?? '';
    productOldPrice.value = p.oldPrice ?? '';
    productDiscount.value = p.discount ?? p.discountPercent ?? '';
    if (productRating) productRating.value = p.rating ?? '';
    if (productDescription) productDescription.value = p.desc || p.description || '';

    selectedFiles = [];
    selectedPreviews = p.images?.length ? [...p.images] : (p.img ? [p.img] : []);
    setVariantsForEdit(p.variants);
    updateImagePreview();
    if (saveButton) saveButton.textContent = 'Yangilash';
  }
});

// ====== COMMENTS ======
const renderAdminComments = () => {
  const comments = getProductComments();
  const entries = Object.values(comments).flat();

  if (!entries.length) {
    commentsEmpty?.classList.remove('hidden');
    adminComments.innerHTML = '';
    return;
  }

  commentsEmpty?.classList.add('hidden');
  adminComments.innerHTML = entries
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((c) => {
      const product = productsMap.get(c.productId);
      return `
        <article class="rounded-2xl border border-slate-700 bg-[#0f2f52] p-4 text-sm text-slate-200">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p class="text-xs text-slate-400">Mahsulot</p>
              <p class="font-semibold text-white">${product?.title || "Noma'lum"} (${c.productId})</p>
            </div>
            <div class="text-xs text-slate-400">${formatDate(c.createdAt)}</div>
          </div>
          <p class="mt-2">Kimdan: ${c.userName} (${c.userPhone || 'Telefon: N/A'})</p>
          <p class="mt-2 text-slate-300">${c.text}</p>
          ${c.rating ? `<p class="mt-2 text-xs text-amber-400">Reyting: ${c.rating}/5</p>` : ''}
          <form class="reply-form mt-3 flex flex-col gap-2" data-id="${c.id}" data-product-id="${c.productId}">
            <textarea rows="2" required class="w-full rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs text-white" placeholder="Javob yozing..."></textarea>
            <button class="self-start rounded-xl bg-blue-500 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-600">Javob berish</button>
          </form>
        </article>
      `;
    })
    .join('');
};

adminComments?.addEventListener('submit', (e) => {
  const form = e.target.closest('.reply-form');
  if (!form) return;
  e.preventDefault();

  const textarea = form.querySelector('textarea');
  const text = textarea.value.trim();
  if (!text) return;

  const productId = form.dataset.productId;
  const commentId = form.dataset.id;

  const all = getProductComments();
  const list = all[productId] || [];
  all[productId] = list.map((c) => {
    if (c.id !== commentId) return c;
    return {
      ...c,
      replies: [
        {
          id: `r-${Date.now()}`,
          adminId: currentUser?.id || 'admin',
          adminName: currentUser?.name || 'Admin',
          text,
          createdAt: new Date().toISOString(),
        },
        ...(c.replies || []),
      ],
    };
  });

  saveProductComments(all);
  renderAdminComments();
});

// ====== RECEIPT MODAL + ACTIONS ======
adminPanel?.addEventListener('click', async (e) => {
  const receiptOpen = e.target.closest('.receipt-open');
  const confirmBtn = e.target.closest('.confirm-btn');
  const rejectBtn = e.target.closest('.reject-btn');

  if (receiptOpen) {
    e.preventDefault();
    const href = receiptOpen.getAttribute('href');
    if (!href || href === '#') return;

    const isImage = /\.(png|jpe?g|webp|gif|bmp|svg)(\?|$)/i.test(href) || href.includes('imgbb.com');
    if (isImage && receiptImage && receiptModal) {
      receiptImage.src = href;
      receiptModal.classList.remove('hidden');
      receiptModal.classList.add('flex');
    } else {
      window.open(href, '_blank', 'noopener');
    }
    return;
  }

  if (confirmBtn) {
    const id = confirmBtn.dataset.id;
    if (!id) return;

    // ✅ 0) Agar Firestore’da order yo‘q bo‘lsa, localdan topib to‘liq yozib qo‘yamiz
    const existing = await getOrderByAnyId(id);
    if (!existing) {
      const localOrder = findLocalOrder(id);
      if (localOrder) {
        const payload = normalizePendingToFirestore(localOrder);
        await setDoc(doc(db, 'orders', id), payload, { merge: true });
      }
    }

    // ✅ 1) status
    await updateOrderStatus(id, 'approved');

    // ✅ 2) Telegram
    try {
      const base = location.origin;
      const link = `${base}/searc.html?id=${encodeURIComponent(id)}`;
      await sendTelegram(`✅ <b>Buyurtma qabul qilindi</b>\n🧾 <a href="${link}">Order: ${id}</a>`);
    } catch (err) {
      console.error(err);
    }

    showToast('Buyurtma qabul qilindi');
    return;
  }

  if (rejectBtn) {
    const id = rejectBtn.dataset.id;
    if (!id) return;

    const reason = prompt('Rad etish sababi (ixtiyoriy):') || null;

    const existing = await getOrderByAnyId(id);
    if (!existing) {
      const localOrder = findLocalOrder(id);
      if (localOrder) {
        const payload = normalizePendingToFirestore(localOrder);
        await setDoc(doc(db, 'orders', id), payload, { merge: true });
      }
    }

    await updateOrderStatus(id, 'rejected', reason);

    try {
      await sendTelegram(`❌ <b>Buyurtma rad etildi</b>\n🆔 ID: <code>${id}</code>\n📝 Sabab: ${reason || '-'}`);
    } catch (err) {
      console.error(err);
    }

    showToast('Buyurtma rad etildi', 'error');
    return;
  }
});

receiptClose?.addEventListener('click', () => {
  receiptModal?.classList.add('hidden');
  receiptModal?.classList.remove('flex');
});

receiptModal?.addEventListener('click', (e) => {
  if (e.target === receiptModal) {
    receiptModal.classList.add('hidden');
    receiptModal.classList.remove('flex');
  }
});

// ====== TELEGRAM (✅ TUZATILGAN) ======
const TG_BOT_TOKEN = "8238090465:AAGbMa3eflX7bFET2kpZsClfMyHyaPtjrAk";
const TG_CHAT_ID = "5128272954";

async function sendTelegram(text) {
  const url = `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TG_CHAT_ID,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    console.error('Telegram error:', data);
    throw new Error(data?.description || 'Telegramga yuborilmadi');
  }
}

// ====== INIT ======
const init = async () => {
  const { products } = await fetchProducts();
  await loadAdminProducts();

  const combinedProducts = [...products, ...adminProducts];
  productsMap = new Map(combinedProducts.map((p) => [String(p.id), p]));

  await renderOrders();
  renderAdminComments();
  renderVariants();
};

init();