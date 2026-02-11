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

// ====== INIT ======
ensureSeedData();

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
const productImages = document.querySelector('#pImages');
const imageLimitError = document.querySelector('#image-limit-error');
const imagePreview = document.querySelector('#image-preview');
const adminProductsEmpty = document.querySelector('#admin-products-empty');
const adminProductsList = document.querySelector('#adminProducts');
const saveButton = document.querySelector('#btnSave');
const commentsEmpty = document.querySelector('#comments-empty');
const adminComments = document.querySelector('#admin-comments');

const statusLabels = {
  pending: 'Ko‘rib chiqilyapti',
  pending_verification: 'Ko‘rib chiqilyapti',
  approved: 'Buyurtma qabul qilindi',
  rejected: 'Buyurtma rad etildi',
};

// ====== STATE ======
let selectedFiles = [];
let selectedPreviews = [];
let productsMap = new Map();
let adminProducts = [];
let editingId = null;

// ====== ADMIN CHECK ======
const readCurrentUser = () => {
  const raw = localStorage.getItem('currentUser');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
};

const currentUser = readCurrentUser();
const isAdmin = currentUser?.isAdmin === true;

if (!isAdmin) {
  accessDenied.classList.remove('hidden');
  adminPanel.classList.add('hidden');
} else {
  accessDenied.classList.add('hidden');
  adminPanel.classList.remove('hidden');
}

// ====== ORDERS ======
const formatDate = (value) => {
  const dateValue = value?.toDate ? value.toDate() : value;
  return new Date(dateValue).toLocaleString('uz-UZ');
};
const getItemsCount = (items = []) => items.reduce((sum, item) => sum + item.qty, 0);

const renderOrderCard = (order, { showActions }) => {
  const buyerName = order.userName || 'Noma\'lum';
  const buyerPhone = order.userPhone || 'Telefon: N/A';
  const receiptSrc = order.receiptUrl || null;
  const receiptMarkup = receiptSrc
    ? `
      <a href="${receiptSrc}" target="_blank" rel="noreferrer" class="receipt-open mt-3 inline-flex items-center gap-2 rounded-xl glass-soft px-3 py-2 text-xs text-white/80" data-id="${order.id}">
        <img src="${receiptSrc}" alt="Receipt" class="h-16 w-16 rounded-lg object-cover" />
        <span>View receipt</span>
      </a>
    `
    : '<p class="mt-3 text-xs text-slate-500">Receipt mavjud emas.</p>';

  const rejectReason = order.rejectReason
    ? `<p class="mt-2 text-xs text-rose-200">Sabab: ${order.rejectReason}</p>`
    : '';

  const statusChip = statusLabel(order.status);
  return `
    <article class="rounded-2xl glass p-4 shadow-sm">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-xs text-slate-400">Buyurtma ID</p>
          <p class="text-sm font-semibold text-white">${order.id}</p>
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
          <p class="text-sm font-semibold text-white">${order.total.toLocaleString('uz-UZ')} so'm</p>
          <p class="mt-2 text-xs text-slate-400">To'lov turi</p>
          <p class="text-sm text-slate-200">${order.payment}</p>
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
          <button class="confirm-btn neon-btn rounded-xl px-4 py-2 text-xs font-semibold" data-id="${
            order.id
          }">✅ Qabul</button>
          <button class="reject-btn rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:border-white/40" data-id="${
            order.id
          }">❌ Rad</button>
        </div>
      `
          : ''
      }
    </article>
  `;
};

const updateOrderStatus = async (orderId, status, rejectReason = null) => {
  await updateDoc(doc(db, 'orders', orderId), {
    status,
    rejectReason: rejectReason || null,
    reviewedAt: serverTimestamp(),
  });
  await renderOrders();
};

// ====== PRODUCTS ======
const renderAdminProducts = () => {
  if (!adminProducts.length) {
    adminProductsEmpty.classList.remove('hidden');
    adminProductsList.innerHTML = '';
    return;
  }
  adminProductsEmpty.classList.add('hidden');
  adminProductsList.innerHTML = adminProducts
    .map(
      (product) => `
      <article class="rounded-2xl border border-slate-700 bg-slate-800/60 p-4 text-sm text-slate-200">
        <img src="${product.images?.[0] || product.img}" alt="${product.title}" class="h-32 w-full rounded-xl object-cover" />
        <div class="mt-3 space-y-1">
          <p class="font-semibold text-white">${product.title}</p>
          <p class="text-xs text-slate-400">${product.category}</p>
        </div>
        <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span class="text-sm font-semibold text-white">${Number(product.price || 0).toLocaleString('uz-UZ')} so'm</span>
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
  const snapshot = await getDocs(query(collection(db, 'products'), orderBy('createdAt', 'desc')));
  adminProducts = snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));
  renderAdminProducts();
};

const getEditIdFromQuery = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get('editId');
};

const loadProductForEdit = async (editId) => {
  if (!editId) return;
  const docSnap = await getDoc(doc(db, 'products', editId));
  if (!docSnap.exists()) {
    showToast('Mahsulot topilmadi', 'error');
    return;
  }
  const product = docSnap.data();
  editingId = editId;
  productTitle.value = product.title || '';
  productCategory.value = product.category || 'Telefon';
  productPrice.value = product.price ?? '';
  productStock.value = product.stock ?? '';
  productOldPrice.value = product.oldPrice ?? '';
  productDiscount.value = product.discount ?? product.discountPercent ?? '';
  if (productRating) productRating.value = product.rating ?? '';
  if (productDescription) productDescription.value = product.desc || product.description || '';
  selectedFiles = [];
  selectedPreviews = product.images?.length ? [...product.images] : [];
  updateImagePreview();
  if (saveButton) saveButton.textContent = 'Yangilash';
  productForm?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const updateImagePreview = () => {
  imagePreview.innerHTML = selectedPreviews
    .map(
      (image, index) => `
      <div class="relative overflow-hidden rounded-xl border border-slate-700 bg-slate-800/60">
        <img src="${image}" alt="preview" class="h-32 w-full object-cover" />
        <button type="button" class="remove-image absolute right-2 top-2 rounded-full bg-black/70 px-2 py-1 text-xs text-white" data-index="${index}">❌</button>
      </div>
    `
    )
    .join('');
};

productImages?.addEventListener('change', (event) => {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;
  if (files.length + selectedFiles.length > 10) {
    showToast('Maksimum 10 ta rasm yuklash mumkin', 'error');
    imageLimitError?.classList.remove('hidden');
    productImages.value = '';
    return;
  }
  if (editingId && selectedFiles.length === 0) {
    selectedPreviews.forEach((preview) => {
      if (preview.startsWith('blob:')) {
        URL.revokeObjectURL(preview);
      }
    });
    selectedPreviews = [];
  }
  imageLimitError?.classList.add('hidden');
  files.forEach((file) => {
    selectedFiles.push(file);
    selectedPreviews.push(URL.createObjectURL(file));
  });
  updateImagePreview();
  productImages.value = '';
});

imagePreview?.addEventListener('click', (event) => {
  const removeBtn = event.target.closest('.remove-image');
  if (!removeBtn) return;
  const index = Number(removeBtn.dataset.index);
  const [removed] = selectedPreviews.splice(index, 1);
  if (removed && removed.startsWith('blob:')) URL.revokeObjectURL(removed);
  selectedFiles.splice(index, 1);
  updateImagePreview();
});

const resetProductForm = () => {
  selectedFiles.forEach((file, index) => {
    const preview = selectedPreviews[index];
    if (preview && preview.startsWith('blob:')) URL.revokeObjectURL(preview);
  });
  selectedFiles = [];
  selectedPreviews = [];
  updateImagePreview();
  imageLimitError?.classList.add('hidden');
  editingId = null;
  if (saveButton) saveButton.textContent = 'Saqlash';
  productForm.reset();
};

productForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!selectedFiles.length && !selectedPreviews.length) {
    showToast('Kamida 1 ta rasm yuklang', 'error');
    return;
  }
  if (selectedFiles.length > 10) {
    showToast('Maksimum 10 ta rasm yuklash mumkin', 'error');
    imageLimitError?.classList.remove('hidden');
    return;
  }
  const title = productTitle.value.trim();
  const price = Number(productPrice.value);
  const stock = Number(productStock?.value);
  const oldPrice = Number(productOldPrice.value);
  const discount = Number(productDiscount.value);
  const rating = Number(productRating?.value);
  const description = productDescription?.value.trim();
  if (!title) {
    showToast('Mahsulot nomini kiriting', 'error');
    return;
  }
  try {
    const payload = {
      title,
      category: productCategory.value,
      price: Number.isFinite(price) ? price : 0,
      stock: Number.isFinite(stock) && stock >= 0 ? stock : null,
      oldPrice: Number.isFinite(oldPrice) && oldPrice > 0 ? oldPrice : null,
      discount: Number.isFinite(discount) && discount > 0 ? discount : null,
      rating: Number.isFinite(rating) && rating >= 0 ? rating : null,
      desc: description || null,
      updatedAt: serverTimestamp(),
      active: true,
    };
    const imageUrls = selectedFiles.length
      ? await Promise.all(selectedFiles.map((file) => imgbbUpload(file, IMGBB_API_KEY)))
      : [...selectedPreviews];

    if (editingId) {
      await updateDoc(doc(db, 'products', editingId), {
        ...payload,
        images: imageUrls,
      });
      showToast("Mahsulot muvaffaqiyatli qo‘shildi");
    } else {
      await addDoc(collection(db, 'products'), {
        ...payload,
        images: imageUrls,
        createdAt: serverTimestamp(),
      });
      showToast("Mahsulot muvaffaqiyatli qo‘shildi");
    }
    resetProductForm();
    await loadAdminProducts();
  } catch (error) {
    showToast('Mahsulotni saqlashda xatolik yuz berdi', 'error');
  }
});

adminProductsList?.addEventListener('click', async (event) => {
  const editBtn = event.target.closest('.edit-product-btn');
  const deleteBtn = event.target.closest('.delete-product-btn');
  if (deleteBtn) {
    const id = deleteBtn.dataset.id;
    if (!id) return;
    if (!window.confirm('Mahsulotni o‘chirishni tasdiqlaysizmi?')) return;
    try {
      await deleteDoc(doc(db, 'products', id));
      showToast('Mahsulot o‘chirildi');
      await loadAdminProducts();
    } catch (error) {
      showToast('O‘chirishda xatolik yuz berdi', 'error');
    }
    return;
  }
  if (!editBtn) return;
  const product = adminProducts.find((item) => String(item.id) === String(editBtn.dataset.id));
  if (!product) return;
  editingId = product.id;
  productTitle.value = product.title || '';
  productCategory.value = product.category || 'Telefon';
  productPrice.value = product.price ?? '';
  productStock.value = product.stock ?? '';
  productOldPrice.value = product.oldPrice ?? '';
  productDiscount.value = product.discount ?? product.discountPercent ?? '';
  if (productRating) productRating.value = product.rating ?? '';
  if (productDescription) productDescription.value = product.desc || product.description || '';
  selectedFiles = [];
  selectedPreviews.forEach((preview) => {
    if (preview.startsWith('blob:')) {
      URL.revokeObjectURL(preview);
    }
  });
  selectedPreviews = product.images?.length ? [...product.images] : [];
  updateImagePreview();
  if (saveButton) saveButton.textContent = 'Yangilash';
});


// ====== COMMENTS ======
const renderAdminComments = () => {
  const comments = getProductComments();
  const entries = Object.values(comments).flat();
  if (!entries.length) {
    commentsEmpty.classList.remove('hidden');
    adminComments.innerHTML = '';
    return;
  }
  commentsEmpty.classList.add('hidden');
  adminComments.innerHTML = entries
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((comment) => {
      const product = productsMap.get(comment.productId);
      return `
        <article class="rounded-2xl border border-slate-700 bg-[#0f2f52] p-4 text-sm text-slate-200">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p class="text-xs text-slate-400">Mahsulot</p>
              <p class="font-semibold text-white">${product?.title || "Noma'lum"} (${comment.productId})</p>
            </div>
            <div class="text-xs text-slate-400">${formatDate(comment.createdAt)}</div>
          </div>
          <p class="mt-2">Kimdan: ${comment.userName} (${comment.userPhone || 'Telefon: N/A'})</p>
          <p class="mt-2 text-slate-300">${comment.text}</p>
          ${comment.rating ? `<p class="mt-2 text-xs text-amber-400">Reyting: ${comment.rating}/5</p>` : ''}
          <form class="reply-form mt-3 flex flex-col gap-2" data-id="${comment.id}" data-product-id="${comment.productId}">
            <textarea rows="2" required class="w-full rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs text-white" placeholder="Javob yozing..."></textarea>
            <button class="self-start rounded-xl bg-blue-500 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-600">Javob berish</button>
          </form>
        </article>
      `;
    })
    .join('');
};

const renderOrders = async () => {
  if (!isAdmin) return;
  const pendingSnapshot = await getDocs(
    query(
      collection(db, 'orders'),
      where('status', 'in', ['pending', 'pending_verification']),
      orderBy('createdAt', 'desc')
    )
  );
  const pendingOrders = pendingSnapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    const normalizedStatus =
      data.status === 'pending_verification' ? 'pending' : data.status;
    return {
      id: docSnap.id,
      ...data,
      status: normalizedStatus,
    };
  });

  if (!pendingOrders.length) {
    pendingEmpty.classList.remove('hidden');
    pendingOrdersList.innerHTML = '';
    return;
  }

  pendingEmpty.classList.add('hidden');
  pendingOrdersList.innerHTML = pendingOrders
    .map((order) => renderOrderCard(order, { showActions: true }))
    .join('');
};

// ====== RECEIPT VERIFICATION ======
adminPanel.addEventListener('click', async (event) => {
  const confirmBtn = event.target.closest('.confirm-btn');
  const rejectBtn = event.target.closest('.reject-btn');
  const receiptOpen = event.target.closest('.receipt-open');

  if (receiptOpen) {
    event.preventDefault();
    const href = receiptOpen.getAttribute('href');
    if (!href) return;
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
    await updateOrderStatus(confirmBtn.dataset.id, 'approved');
  }

  if (rejectBtn) {
    const reason = window.prompt('Rad etish sababini kiriting:');
    if (!reason || !reason.trim()) {
      showToast('Rad etish sababini kiriting', 'error');
      return;
    }
    await updateOrderStatus(rejectBtn.dataset.id, 'rejected', reason.trim());
  }
});

receiptClose.addEventListener('click', () => {
  receiptModal.classList.add('hidden');
  receiptModal.classList.remove('flex');
});

receiptModal.addEventListener('click', (event) => {
  if (event.target === receiptModal) {
    receiptModal.classList.add('hidden');
    receiptModal.classList.remove('flex');
  }
});

adminComments?.addEventListener('submit', (event) => {
  const form = event.target.closest('.reply-form');
  if (!form) return;
  event.preventDefault();
  const textarea = form.querySelector('textarea');
  const text = textarea.value.trim();
  if (!text) return;
  const productId = form.dataset.productId;
  const commentId = form.dataset.id;
  const allComments = getProductComments();
  const list = allComments[productId] || [];
  const updatedList = list.map((comment) => {
    if (comment.id !== commentId) return comment;
    return {
      ...comment,
      replies: [
        {
          id: `r-${Date.now()}`,
          adminId: currentUser?.id || 'admin',
          adminName: currentUser?.name || 'Admin',
          text,
          createdAt: new Date().toISOString(),
        },
        ...(comment.replies || []),
      ],
    };
  });
  allComments[productId] = updatedList;
  saveProductComments(allComments);
  renderAdminComments();
});

const init = async () => {
  const { products } = await fetchProducts();
  await loadAdminProducts();
  const editId = getEditIdFromQuery();
  if (editId) {
    await loadProductForEdit(editId);
  }
  const combinedProducts = [...products, ...adminProducts];
  productsMap = new Map(combinedProducts.map((product) => [String(product.id), product]));
  await renderOrders();
  renderAdminComments();
  if (window.location.hash) {
    const target = document.querySelector(window.location.hash);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
};

init();
