import {
  ensureSeedData,
  getProductComments,
  saveProductComments,
} from "./storage.js";
import { fetchProducts } from "./api.js";
import { showToast, statusLabel } from "./ui.js";
import { IMGBB_API_KEY } from "./config.js";
import { imgbbUpload } from "./imgbb.js";

import {
  db,
  collection,
  addDoc,
  getDocs,
  getDoc,
  query,
  orderBy,
  serverTimestamp,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  limit,
} from "./firebase.js";

ensureSeedData();

// ====== SETTINGS (SHUNI O'ZING QO'YASAN) ======
const PUBLIC_BASE_URL = "https://YOUR-VERCEL-DOMAIN.vercel.app"; // <<< Vercel domeningni yoz

// Telegram
const TG_BOT_TOKEN = "PASTE_YOUR_BOT_TOKEN"; // <<< tokenni yoz
const TG_CHAT_ID = "PASTE_YOUR_CHAT_ID";     // <<< chat idni yoz

async function sendTelegram(text) {
  const url = `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TG_CHAT_ID,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    console.error("Telegram error:", data);
    throw new Error(data?.description || "Telegramga yuborilmadi");
  }
}

// ====== ELEMENTS ======
const accessDenied = document.querySelector("#access-denied");
const adminPanel = document.querySelector("#admin-panel");

const pendingOrdersList = document.querySelector("#pending-orders");
const pendingEmpty = document.querySelector("#pending-empty");

const receiptModal = document.querySelector("#receipt-modal");
const receiptImage = document.querySelector("#receipt-image");
const receiptClose = document.querySelector("#receipt-close");

const productForm = document.querySelector("#admin-product-form");
const productTitle = document.querySelector("#product-title");
const productCategory = document.querySelector("#product-category");
const productPrice = document.querySelector("#product-price");
const productStock = document.querySelector("#product-stock");
const productOldPrice = document.querySelector("#product-old-price");
const productDiscount = document.querySelector("#product-discount");
const productDescription = document.querySelector("#pDesc");
const productRating = document.querySelector("#product-rating");
const productVariantName = document.querySelector("#variant-name");
const productVariantPrice = document.querySelector("#variant-price");
const addVariantBtn = document.querySelector("#add-variant-btn");
const variantList = document.querySelector("#variant-list");
const productImages = document.querySelector("#pImages");
const imageLimitError = document.querySelector("#image-limit-error");
const imagePreview = document.querySelector("#image-preview");
const adminProductsEmpty = document.querySelector("#admin-products-empty");
const adminProductsList = document.querySelector("#adminProducts");
const saveButton = document.querySelector("#btnSave");

const commentsEmpty = document.querySelector("#comments-empty");
const adminComments = document.querySelector("#admin-comments");

// ====== ADMIN CHECK ======
const readCurrentUser = () => {
  const raw = localStorage.getItem("currentUser");
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
  accessDenied?.classList.remove("hidden");
  adminPanel?.classList.add("hidden");
} else {
  accessDenied?.classList.add("hidden");
  adminPanel?.classList.remove("hidden");
}

// ====== HELPERS ======
const statusLabels = {
  pending: "Ko‘rib chiqilyapti",
  pending_verification: "Ko‘rib chiqilyapti",
  approved: "Buyurtma qabul qilindi",
  rejected: "Buyurtma rad etildi",
};

const formatDate = (value) => {
  const dateValue = value?.toDate ? value.toDate() : value;
  if (!dateValue) return "—";
  return new Date(dateValue).toLocaleString("uz-UZ");
};

const getItemsCount = (items = []) =>
  (items || []).reduce((sum, item) => sum + Number(item.qty || 0), 0);

const safe = (v, fallback = "—") =>
  v === null || v === undefined || v === "" ? fallback : v;

// ====== ORDERS (Firestore) ======
let lastOrders = []; // cache

const renderOrderCard = (order) => {
  const buyerName = order.userName || order.user?.name || "Noma'lum";
  const buyerPhone = order.userPhone || order.user?.phone || "Telefon: N/A";
  const receiptSrc = order.receiptUrl || order.receipt?.url || order.receiptBase64 || null;

  const statusChip = statusLabel(order.status);

  // Telegram link (order detail page) — admin panelning o'zida link chiqarmaymiz,
  // faqat telegramga yuboramiz.
  const publicId = order.id || order.docId || order.__docId;

  const rejectReason = order.rejectReason
    ? `<p class="mt-2 text-xs text-rose-200">Sabab: ${order.rejectReason}</p>`
    : "";

  const receiptMarkup = receiptSrc
    ? `
      <a href="${receiptSrc}" target="_blank" rel="noreferrer"
         class="receipt-open mt-3 inline-flex items-center gap-2 rounded-xl glass-soft px-3 py-2 text-xs text-white/80"
         data-receipt="${receiptSrc}">
        <img src="${receiptSrc}" alt="Receipt" class="h-16 w-16 rounded-lg object-cover" />
        <span>Chekni ko‘rish</span>
      </a>
    `
    : `<p class="mt-3 text-xs text-slate-500">Chek mavjud emas.</p>`;

  return `
    <article class="rounded-2xl glass p-4 shadow-sm">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-xs text-slate-400">Buyurtma</p>
          <p class="text-sm font-semibold text-white">${safe(publicId)}</p>
          <p class="mt-2 text-xs text-slate-400">Kim buyurtma qildi</p>
          <p class="text-sm text-slate-200">${buyerName} (${buyerPhone})</p>
        </div>

        <div>
          <p class="text-xs text-slate-400">Sana</p>
          <p class="text-sm text-slate-200">${formatDate(order.createdAt || order.date)}</p>

          <p class="mt-2 text-xs text-slate-400">Mahsulotlar soni</p>
          <p class="text-sm text-slate-200">${getItemsCount(order.items)}</p>
        </div>

        <div>
          <p class="text-xs text-slate-400">Jami</p>
          <p class="text-sm font-semibold text-white">${Number(order.total || 0).toLocaleString("uz-UZ")} so'm</p>

          <p class="mt-2 text-xs text-slate-400">To'lov</p>
          <p class="text-sm text-slate-200">${safe(order.payment, "—")}</p>
        </div>

        <div>
          <p class="text-xs text-slate-400">Holat</p>
          <span class="${statusChip.cls}">
            ${statusChip.text || statusLabels[order.status] || order.status}
          </span>
          ${rejectReason}
        </div>
      </div>

      ${receiptMarkup}

      <div class="mt-4 flex flex-wrap gap-3">
        <button class="confirm-btn neon-btn rounded-xl px-4 py-2 text-xs font-semibold"
                data-docid="${order.__docId}" data-publicid="${publicId}">
          ✅ Qabul
        </button>
        <button class="reject-btn rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:border-white/40"
                data-docid="${order.__docId}" data-publicid="${publicId}">
          ❌ Rad
        </button>
      </div>
    </article>
  `;
};

const loadPendingOrders = async () => {
  if (!isAdmin) return [];

  // ✅ INDEX muammosiz: faqat orderBy qilib olamiz, keyin JS'da filter qilamiz
  const snap = await getDocs(
    query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(100))
  );

  const items = snap.docs.map((d) => ({
    __docId: d.id,
    ...d.data(),
  }));

  // pending / pending_verification
  return items.filter((o) => o.status === "pending" || o.status === "pending_verification");
};

const renderOrders = async () => {
  if (!isAdmin) return;

  let pending = [];
  try {
    pending = await loadPendingOrders();
    lastOrders = pending;
  } catch (e) {
    console.error(e);
    pending = lastOrders || [];
  }

  if (!pending.length) {
    pendingEmpty?.classList.remove("hidden");
    if (pendingOrdersList) pendingOrdersList.innerHTML = "";
    return;
  }

  pendingEmpty?.classList.add("hidden");
  pendingOrdersList.innerHTML = pending.map(renderOrderCard).join("");
};

const updateOrderStatusByDocId = async (docId, status, rejectReason = null) => {
  const ref = doc(db, "orders", docId);
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
};

// ====== RECEIPT MODAL + ACTIONS ======
adminPanel?.addEventListener("click", async (event) => {
  // open receipt
  const receiptOpen = event.target.closest(".receipt-open");
  if (receiptOpen) {
    event.preventDefault();
    const href = receiptOpen.dataset.receipt || receiptOpen.getAttribute("href");
    if (!href) return;

    const isImage = /\.(png|jpe?g|webp|gif|bmp|svg)(\?|$)/i.test(href) || href.includes("imgbb.com");
    if (isImage && receiptImage && receiptModal) {
      receiptImage.src = href;
      receiptModal.classList.remove("hidden");
      receiptModal.classList.add("flex");
    } else {
      window.open(href, "_blank", "noopener");
    }
    return;
  }

  const confirmBtn = event.target.closest(".confirm-btn");
  const rejectBtn = event.target.closest(".reject-btn");

  if (confirmBtn) {
    const docId = confirmBtn.dataset.docid;
    const publicId = confirmBtn.dataset.publicid || docId;
    if (!docId) return;

    try {
      await updateOrderStatusByDocId(docId, "approved");

      // ✅ telegram link
      const link = `${PUBLIC_BASE_URL}/search.html?id=${encodeURIComponent(publicId)}`;
      await sendTelegram(
        `✅ <b>Buyurtma qabul qilindi</b>\n🆔 ID: <code>${publicId}</code>\n🔗 <a href="${link}">Buyurtmani ko‘rish</a>`
      );

      showToast("Buyurtma qabul qilindi");
      await renderOrders();
    } catch (e) {
      console.error(e);
      showToast("Xatolik: buyurtma tasdiqlanmadi", "error");
    }
    return;
  }

  if (rejectBtn) {
    const docId = rejectBtn.dataset.docid;
    const publicId = rejectBtn.dataset.publicid || docId;
    if (!docId) return;

    const reason = prompt("Rad etish sababi (ixtiyoriy):") || null;

    try {
      await updateOrderStatusByDocId(docId, "rejected", reason);

      const link = `${PUBLIC_BASE_URL}/search.html?id=${encodeURIComponent(publicId)}`;
      await sendTelegram(
        `❌ <b>Buyurtma rad etildi</b>\n🆔 ID: <code>${publicId}</code>\n📝 Sabab: ${reason || "-"}\n🔗 <a href="${link}">Buyurtmani ko‘rish</a>`
      );

      showToast("Buyurtma rad etildi", "error");
      await renderOrders();
    } catch (e) {
      console.error(e);
      showToast("Xatolik: buyurtma rad etilmadi", "error");
    }
    return;
  }
});

receiptClose?.addEventListener("click", () => {
  receiptModal?.classList.add("hidden");
  receiptModal?.classList.remove("flex");
});

receiptModal?.addEventListener("click", (event) => {
  if (event.target === receiptModal) {
    receiptModal.classList.add("hidden");
    receiptModal.classList.remove("flex");
  }
});

// ====== PRODUCTS (sizdagi kodga tegmadim, faqat ishlashi uchun qoldirdim) ======
let selectedFiles = [];
let selectedPreviews = [];
let adminProducts = [];
let editingId = null;
let productVariants = [];

const renderVariants = () => {
  if (!variantList) return;
  if (!productVariants.length) {
    variantList.innerHTML =
      '<p class="text-xs text-white/50">Variantlar qoshilmagan. Narx uchun asosiy price ishlatiladi.</p>';
    return;
  }
  variantList.innerHTML = productVariants
    .map(
      (variant, index) => `
      <div class="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900/40 px-3 py-2 text-sm">
        <div>
          <p class="font-medium text-white">${variant.name}</p>
          <p class="text-xs text-white/60">${Number(variant.price).toLocaleString('uz-UZ')} so'm</p>
        </div>
        <button type="button" class="remove-variant rounded-lg border border-rose-400/50 px-2 py-1 text-xs text-rose-200" data-index="${index}">❌</button>
      </div>
    `
    )
    .join("");
};

const setVariantsForEdit = (variants) => {
  productVariants = Array.isArray(variants)
    ? variants
        .map((v) => ({ name: String(v?.name || "").trim(), price: Number(v?.price) }))
        .filter((v) => v.name && Number.isFinite(v.price) && v.price > 0)
    : [];
  renderVariants();
};

const updateImagePreview = () => {
  if (!imagePreview) return;
  imagePreview.innerHTML = selectedPreviews
    .map(
      (image, index) => `
      <div class="relative overflow-hidden rounded-xl border border-slate-700 bg-slate-800/60">
        <img src="${image}" alt="preview" class="h-32 w-full object-cover" />
        <button type="button" class="remove-image absolute right-2 top-2 rounded-full bg-black/70 px-2 py-1 text-xs text-white" data-index="${index}">❌</button>
      </div>
    `
    )
    .join("");
};

const renderAdminProducts = () => {
  if (!adminProductsList || !adminProductsEmpty) return;

  if (!adminProducts.length) {
    adminProductsEmpty.classList.remove("hidden");
    adminProductsList.innerHTML = "";
    return;
  }

  adminProductsEmpty.classList.add("hidden");
  adminProductsList.innerHTML = adminProducts
    .map(
      (product) => `
      <article class="rounded-2xl border border-slate-700 bg-slate-800/60 p-4 text-sm text-slate-200">
        <img src="${product.images?.[0] || product.img || ""}" alt="${product.title}" class="h-32 w-full rounded-xl object-cover" />
        <div class="mt-3 space-y-1">
          <p class="font-semibold text-white">${product.title}</p>
          <p class="text-xs text-slate-400">${product.category || ""}</p>
        </div>
        <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span class="text-sm font-semibold text-white">${Number(product.price || 0).toLocaleString("uz-UZ")} so'm</span>
          ${
            product.discount
              ? `<span class="text-xs font-semibold text-emerald-200">-${product.discount}%</span>`
              : ""
          }
        </div>
        <div class="mt-3 flex justify-end gap-2">
          <button type="button" class="edit-product-btn rounded-lg border border-slate-600 px-3 py-1 text-xs text-slate-200 hover:border-slate-400" data-id="${product.id}">✏️ Edit</button>
          <button type="button" class="delete-product-btn rounded-lg border border-rose-500/60 px-3 py-1 text-xs text-rose-200 hover:border-rose-400" data-id="${product.id}">🗑 Delete</button>
        </div>
      </article>
    `
    )
    .join("");
};

const loadAdminProducts = async () => {
  const snapshot = await getDocs(query(collection(db, "products"), orderBy("createdAt", "desc")));
  adminProducts = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderAdminProducts();
};

productImages?.addEventListener("change", (event) => {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;

  if (files.length + selectedFiles.length > 10) {
    showToast("Maksimum 10 ta rasm yuklash mumkin", "error");
    imageLimitError?.classList.remove("hidden");
    productImages.value = "";
    return;
  }

  imageLimitError?.classList.add("hidden");
  files.forEach((file) => {
    selectedFiles.push(file);
    selectedPreviews.push(URL.createObjectURL(file));
  });
  updateImagePreview();
  productImages.value = "";
});

imagePreview?.addEventListener("click", (event) => {
  const removeBtn = event.target.closest(".remove-image");
  if (!removeBtn) return;
  const index = Number(removeBtn.dataset.index);
  const [removed] = selectedPreviews.splice(index, 1);
  if (removed?.startsWith("blob:")) URL.revokeObjectURL(removed);
  selectedFiles.splice(index, 1);
  updateImagePreview();
});

addVariantBtn?.addEventListener("click", () => {
  const name = productVariantName?.value.trim();
  const price = Number(productVariantPrice?.value);
  if (!name) return showToast("Variant nomini kiriting", "error");
  if (!Number.isFinite(price) || price <= 0) return showToast("Variant narxi musbat bo‘lishi kerak", "error");
  productVariants.push({ name, price });
  renderVariants();
  productVariantName.value = "";
  productVariantPrice.value = "";
});

variantList?.addEventListener("click", (event) => {
  const removeBtn = event.target.closest(".remove-variant");
  if (!removeBtn) return;
  const index = Number(removeBtn.dataset.index);
  productVariants = productVariants.filter((_, i) => i !== index);
  renderVariants();
});

productForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!selectedFiles.length && !selectedPreviews.length) {
    showToast("Kamida 1 ta rasm yuklang", "error");
    return;
  }

  const title = productTitle.value.trim();
  if (!title) return showToast("Mahsulot nomini kiriting", "error");

  const payload = {
    title,
    category: productCategory.value,
    price: Number(productPrice.value) || 0,
    stock: Number(productStock.value) || null,
    oldPrice: Number(productOldPrice.value) || null,
    discount: Number(productDiscount.value) || null,
    rating: Number(productRating?.value) || null,
    desc: productDescription?.value.trim() || null,
    updatedAt: serverTimestamp(),
    active: true,
    variants: productVariants,
  };

  try {
    const imageUrls = selectedFiles.length
      ? await Promise.all(selectedFiles.map((f) => imgbbUpload(f, IMGBB_API_KEY)))
      : [...selectedPreviews];

    if (editingId) {
      await updateDoc(doc(db, "products", editingId), { ...payload, images: imageUrls });
      showToast("Mahsulot yangilandi");
    } else {
      await addDoc(collection(db, "products"), { ...payload, images: imageUrls, createdAt: serverTimestamp() });
      showToast("Mahsulot qo‘shildi");
    }

    selectedFiles = [];
    selectedPreviews = [];
    editingId = null;
    productVariants = [];
    updateImagePreview();
    renderVariants();
    productForm.reset();
    await loadAdminProducts();
  } catch (e) {
    console.error(e);
    showToast("Mahsulotni saqlashda xatolik", "error");
  }
});

adminProductsList?.addEventListener("click", async (event) => {
  const del = event.target.closest(".delete-product-btn");
  const edit = event.target.closest(".edit-product-btn");

  if (del) {
    const id = del.dataset.id;
    if (!id) return;
    if (!confirm("O‘chirishni tasdiqlaysizmi?")) return;
    try {
      await deleteDoc(doc(db, "products", id));
      showToast("Mahsulot o‘chirildi");
      await loadAdminProducts();
    } catch (e) {
      console.error(e);
      showToast("O‘chirishda xatolik", "error");
    }
    return;
  }

  if (edit) {
    const id = edit.dataset.id;
    const snap = await getDoc(doc(db, "products", id));
    if (!snap.exists()) return showToast("Mahsulot topilmadi", "error");
    const p = snap.data();
    editingId = id;

    productTitle.value = p.title || "";
    productCategory.value = p.category || "Telefon";
    productPrice.value = p.price ?? "";
    productStock.value = p.stock ?? "";
    productOldPrice.value = p.oldPrice ?? "";
    productDiscount.value = p.discount ?? "";
    if (productRating) productRating.value = p.rating ?? "";
    if (productDescription) productDescription.value = p.desc || "";

    selectedFiles = [];
    selectedPreviews = Array.isArray(p.images) ? [...p.images] : [];
    setVariantsForEdit(p.variants);
    updateImagePreview();
    if (saveButton) saveButton.textContent = "Yangilash";
  }
});

// ====== COMMENTS (sizda qanday bo'lsa shunday) ======
const renderAdminComments = () => {
  const comments = getProductComments();
  const entries = Object.values(comments).flat();
  if (!entries.length) {
    commentsEmpty?.classList.remove("hidden");
    adminComments.innerHTML = "";
    return;
  }
  commentsEmpty?.classList.add("hidden");
  adminComments.innerHTML = entries
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((c) => {
      return `
        <article class="rounded-2xl border border-slate-700 bg-[#0f2f52] p-4 text-sm text-slate-200">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p class="text-xs text-slate-400">Mahsulot ID</p>
              <p class="font-semibold text-white">${c.productId}</p>
            </div>
            <div class="text-xs text-slate-400">${formatDate(c.createdAt)}</div>
          </div>
          <p class="mt-2">Kimdan: ${c.userName} (${c.userPhone || "Telefon: N/A"})</p>
          <p class="mt-2 text-slate-300">${c.text}</p>
        </article>
      `;
    })
    .join("");
};

const init = async () => {
  // products map (commentlar uchun)
  try {
    await fetchProducts();
  } catch {}
  await loadAdminProducts();
  await renderOrders();
  renderAdminComments();
  renderVariants();
};

init();