import {
  ensureSeedData,
  getUsers,
  saveUsers,
  getAdminProducts,
  saveAdminProducts,
  getProductComments,
  saveProductComments,
} from './storage.js';
import { fetchProducts } from './api.js';
import { showToast } from './ui.js';
import {
  db,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  updateDoc,
  doc,
  serverTimestamp,
} from './firebase.js';

// ====== INIT ======
ensureSeedData();

const accessDenied = document.querySelector('#access-denied');
const adminPanel = document.querySelector('#admin-panel');
const pendingOrdersList = document.querySelector('#pending-orders');
const pendingEmpty = document.querySelector('#pending-empty');
const allOrdersList = document.querySelector('#all-orders');
const ordersEmpty = document.querySelector('#orders-empty');
const receiptModal = document.querySelector('#receipt-modal');
const receiptImage = document.querySelector('#receipt-image');
const receiptClose = document.querySelector('#receipt-close');
const productForm = document.querySelector('#admin-product-form');
const productTitle = document.querySelector('#product-title');
const productCategory = document.querySelector('#product-category');
const productPrice = document.querySelector('#product-price');
const productOldPrice = document.querySelector('#product-old-price');
const productDescription = document.querySelector('#product-description');
const productImages = document.querySelector('#product-images');
const imagePreview = document.querySelector('#image-preview');
const adminProductsEmpty = document.querySelector('#admin-products-empty');
const adminProductsList = document.querySelector('#admin-products-list');
const commentsEmpty = document.querySelector('#comments-empty');
const adminComments = document.querySelector('#admin-comments');

const statusLabels = {
  pending_verification: 'Chek tekshiruvda',
  confirmed: "Muvaffaqiyatli to‘landi",
  rejected: "To‘lov tasdiqlanmadi (siz to‘lamadingiz)",
  processing: 'Jarayonda',
  delivered: 'Yetkazildi',
  cancelled: 'Bekor qilingan',
};

// ====== STATE ======
let selectedImages = [];
let productsMap = new Map();

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
const isAdmin = currentUser && currentUser.role === 'admin';

if (!isAdmin) {
  accessDenied.classList.remove('hidden');
  setTimeout(() => {
    window.location.href = 'index.html';
  }, 800);
} else {
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
  const receiptMarkup = order.receiptUrl
    ? `
      <a href="${order.receiptUrl}" target="_blank" rel="noreferrer" class="receipt-open mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs text-slate-200" data-id="${order.id}">
        <img src="${order.receiptUrl}" alt="Receipt" class="h-16 w-16 rounded-lg object-cover" />
        <span>View receipt</span>
      </a>
    `
    : '<p class="mt-3 text-xs text-slate-500">Receipt mavjud emas.</p>';

  const rejectReason = order.rejectReason
    ? `<p class="mt-2 text-xs text-rose-200">Sabab: ${order.rejectReason}</p>`
    : '';

  return `
    <article class="rounded-2xl border border-slate-700 bg-[#0f2f52] p-4 shadow-sm">
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
          <span class="inline-flex rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-200">${
            statusLabels[order.status] || order.status
          }</span>
          ${rejectReason}
        </div>
      </div>
      ${receiptMarkup}
      ${
        showActions
          ? `
        <div class="mt-4 flex flex-wrap gap-3">
          <button class="confirm-btn rounded-xl bg-blue-500 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-600" data-id="${
            order.id
          }">✅ Confirm payment</button>
          <button class="reject-btn rounded-xl bg-slate-700 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-600" data-id="${
            order.id
          }">❌ Reject payment</button>
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
    updatedAt: serverTimestamp(),
  });
  await renderOrders();
};

// ====== PRODUCTS ======
const renderAdminProducts = () => {
  const products = getAdminProducts();
  if (!products.length) {
    adminProductsEmpty.classList.remove('hidden');
    adminProductsList.innerHTML = '';
    return;
  }
  adminProductsEmpty.classList.add('hidden');
  adminProductsList.innerHTML = products
    .map(
      (product) => `
      <article class="rounded-2xl border border-slate-700 bg-slate-800/60 p-4 text-sm text-slate-200">
        <img src="${product.images?.[0] || product.img}" alt="${product.title}" class="h-32 w-full rounded-xl object-cover" />
        <div class="mt-3 space-y-1">
          <p class="font-semibold text-white">${product.title}</p>
          <p class="text-xs text-slate-400">${product.category}</p>
        </div>
      </article>
    `
    )
    .join('');
};

const updateImagePreview = () => {
  imagePreview.innerHTML = selectedImages
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
  if (files.length + selectedImages.length > 10) {
    showToast('Maksimum 10 ta rasm yuklash mumkin', 'error');
    productImages.value = '';
    return;
  }
  files.forEach((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      selectedImages.push(reader.result);
      updateImagePreview();
    };
    reader.readAsDataURL(file);
  });
  productImages.value = '';
});

imagePreview?.addEventListener('click', (event) => {
  const removeBtn = event.target.closest('.remove-image');
  if (!removeBtn) return;
  const index = Number(removeBtn.dataset.index);
  selectedImages.splice(index, 1);
  updateImagePreview();
});

productForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!selectedImages.length) {
    showToast('Kamida 1 ta rasm yuklang', 'error');
    return;
  }
  if (selectedImages.length > 10) {
    showToast('Maksimum 10 ta rasm yuklash mumkin', 'error');
    return;
  }
  const price = Number(productPrice.value);
  const oldPrice = Number(productOldPrice.value);
  const newProduct = {
    id: `a-${Date.now()}`,
    title: productTitle.value.trim(),
    desc: productDescription.value.trim(),
    price,
    oldPrice: Number.isFinite(oldPrice) && oldPrice > 0 ? oldPrice : price,
    category: productCategory.value,
    images: [...selectedImages],
    img: selectedImages[0],
    rating: 4.9,
  };
  const products = getAdminProducts();
  saveAdminProducts([newProduct, ...products]);
  selectedImages = [];
  updateImagePreview();
  productForm.reset();
  renderAdminProducts();
  showToast('Mahsulot muvaffaqiyatli qo‘shildi');
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
    query(collection(db, 'orders'), where('status', '==', 'pending_verification'))
  );
  const pendingOrders = pendingSnapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));

  const allSnapshot = await getDocs(
    query(collection(db, 'orders'), orderBy('createdAt', 'desc'))
  );
  const orders = allSnapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));

  if (!pendingOrders.length) {
    pendingEmpty.classList.remove('hidden');
    pendingOrdersList.innerHTML = '';
  } else {
    pendingEmpty.classList.add('hidden');
    pendingOrdersList.innerHTML = pendingOrders.map((order) => renderOrderCard(order, { showActions: true })).join('');
  }

  if (!orders.length) {
    ordersEmpty.classList.remove('hidden');
    allOrdersList.innerHTML = '';
    return;
  }
  ordersEmpty.classList.add('hidden');
  allOrdersList.innerHTML = orders.map((order) => renderOrderCard(order, { showActions: false })).join('');
};

// ====== RECEIPT VERIFICATION ======
adminPanel.addEventListener('click', async (event) => {
  const confirmBtn = event.target.closest('.confirm-btn');
  const rejectBtn = event.target.closest('.reject-btn');

  if (confirmBtn) {
    await updateOrderStatus(confirmBtn.dataset.id, 'confirmed');
  }

  if (rejectBtn) {
    const reason = window.prompt('Sababni kiriting (ixtiyoriy):');
    await updateOrderStatus(rejectBtn.dataset.id, 'rejected', reason && reason.trim() ? reason.trim() : null);
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
  productsMap = new Map(products.map((product) => [String(product.id), product]));
  await renderOrders();
  renderAdminProducts();
  renderAdminComments();
  if (window.location.hash) {
    const target = document.querySelector(window.location.hash);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
};

init();
