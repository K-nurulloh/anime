// js/admin.js
import { ensureSeedData, getCurrentUser, getProductComments, saveProductComments } from "./storage.js";
import { showToast, statusLabel } from "./ui.js";
import { fetchProducts } from "./api.js";
import {
  db,
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  orderBy,
  query,
  limit
} from "./firebase.js";
import { imgbbUpload } from "./imgbb.js";
import { IMGBB_API_KEY } from "./config.js";

ensureSeedData();

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

// ===== ADMIN CHECK =====
const currentUser = getCurrentUser?.() || (() => {
  try { return JSON.parse(localStorage.getItem("currentUser") || "null"); } catch { return null; }
})();

const isAdmin = currentUser?.isAdmin === true;

if (!isAdmin) {
  accessDenied?.classList.remove("hidden");
  adminPanel?.classList.add("hidden");
} else {
  accessDenied?.classList.add("hidden");
  adminPanel?.classList.remove("hidden");
}

// ===== STATE =====
let selectedFiles = [];
let selectedPreviews = [];
let adminProducts = [];
let editingId = null;
let productVariants = [];
let productsMap = new Map();

// ===== HELPERS =====
const formatDate = (v) => {
  const d = v?.toDate ? v.toDate() : v ? new Date(v) : null;
  if (!d || isNaN(d.getTime())) return "—";
  return d.toLocaleString("uz-UZ");
};

const getItemsCount = (items = []) => (Array.isArray(items) ? items : []).reduce((s, it) => s + Number(it.qty || 1), 0);

const getReceiptUrl = (order) => {
  return order?.receiptUrl || order?.receiptBase64 || order?.receipt?.url || order?.receipt?.base64 || "";
};

const orderLink = (id) => `${location.origin}/searc.html?id=${encodeURIComponent(id)}`;

// ===== TELEGRAM VIA VERCEL API =====
async function sendTelegram(text) {
  // front-end -> /api/telegram
  const res = await fetch("/api/telegram", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    console.error("Telegram API error:", data);
    throw new Error(data?.error || "Telegramga yuborilmadi");
  }
  return data;
}

// ===== ORDERS RENDER =====
const renderOrderCard = (order) => {
  const buyerName = order.userName || order.user?.name || "—";
  const buyerPhone = order.userPhone || order.user?.phone || "—";
  const receiptSrc = getReceiptUrl(order);

  const addr = order.address && typeof order.address === "object"
    ? `${order.address.region || "—"}, ${order.address.district || "—"}, ${order.address.homeAddress || "—"}`
    : `${order.region || "—"}, ${order.district || "—"}, ${order.address || "—"}`;

  const statusChip = statusLabel(order.status);

  return `
    <article class="rounded-2xl glass p-4 shadow-sm">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-xs text-slate-400">Buyurtma ID</p>
          <p class="text-sm font-semibold text-white">${order.id}</p>

          <p class="mt-2 text-xs text-slate-400">Foydalanuvchi</p>
          <p class="text-sm text-slate-200">${buyerName} (${buyerPhone})</p>

          <p class="mt-2 text-xs text-slate-400">Manzil</p>
          <p class="text-sm text-slate-200">${addr}</p>
        </div>

        <div>
          <p class="text-xs text-slate-400">Sana</p>
          <p class="text-sm text-slate-200">${formatDate(order.createdAt || order.date)}</p>

          <p class="mt-2 text-xs text-slate-400">Mahsulotlar soni</p>
          <p class="text-sm text-slate-200">${getItemsCount(order.items)}</p>

          <p class="mt-2 text-xs text-slate-400">To'lov</p>
          <p class="text-sm text-slate-200">${order.payment || "—"}</p>
        </div>

        <div>
          <p class="text-xs text-slate-400">Jami</p>
          <p class="text-sm font-semibold text-white">${Number(order.total || 0).toLocaleString("uz-UZ")} so'm</p>

          <p class="mt-2 text-xs text-slate-400">Holat</p>
          <span class="${statusChip.cls}">${statusChip.text}</span>

          ${
            order.status === "rejected" && order.rejectReason
              ? `<p class="mt-2 text-xs text-rose-200">Sabab: ${order.rejectReason}</p>`
              : ""
          }
        </div>
      </div>

      ${
        receiptSrc
          ? `
            <a href="${receiptSrc}" target="_blank" rel="noreferrer"
               class="receipt-open mt-3 inline-flex items-center gap-2 rounded-xl glass-soft px-3 py-2 text-xs text-white/80"
               data-href="${receiptSrc}">
              <img src="${receiptSrc}" alt="Receipt" class="h-16 w-16 rounded-lg object-cover" />
              <span>Chekni ko‘rish</span>
            </a>
          `
          : `<p class="mt-3 text-xs text-slate-500">Chek mavjud emas.</p>`
      }

      <div class="mt-4 flex flex-wrap gap-3">
        <a class="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:border-white/40"
           target="_blank" rel="noreferrer"
           href="${orderLink(order.id)}">Buyurtmani ko‘rish</a>

        <button class="confirm-btn neon-btn rounded-xl px-4 py-2 text-xs font-semibold" data-id="${order.id}">✅ Qabul</button>
        <button class="reject-btn rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:border-white/40" data-id="${order.id}">❌ Rad</button>
      </div>
    </article>
  `;
};

async function fetchPendingOrders() {
  // INDEX muammosini olmaslik uchun faqat orderBy qilyapmiz, filterni JS’da qilamiz
  const snap = await getDocs(query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(50)));
  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return all.filter((o) => o.status === "pending" || o.status === "pending_verification");
}

async function renderOrders() {
  if (!isAdmin) return;
  try {
    const orders = await fetchPendingOrders();
    if (!orders.length) {
      pendingEmpty?.classList.remove("hidden");
      pendingOrdersList.innerHTML = "";
      return;
    }
    pendingEmpty?.classList.add("hidden");
    pendingOrdersList.innerHTML = orders.map((o) => renderOrderCard(o)).join("");
  } catch (e) {
    console.error(e);
    pendingEmpty?.classList.remove("hidden");
    pendingOrdersList.innerHTML = "";
    showToast("Buyurtmalarni yuklashda xatolik", "error");
  }
}

// ===== UPDATE ORDER STATUS =====
async function updateOrderStatus(orderId, status, rejectReason = null) {
  const ref = doc(db, "orders", orderId);
  await setDoc(ref, { status, rejectReason: rejectReason || null, reviewedAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
  await renderOrders();
}

// ===== RECEIPT MODAL =====
adminPanel?.addEventListener("click", async (event) => {
  const confirmBtn = event.target.closest(".confirm-btn");
  const rejectBtn = event.target.closest(".reject-btn");
  const receiptOpen = event.target.closest(".receipt-open");

  if (receiptOpen) {
    event.preventDefault();
    const href = receiptOpen.getAttribute("data-href") || receiptOpen.getAttribute("href");
    if (!href) return;
    if (receiptImage && receiptModal) {
      receiptImage.src = href;
      receiptModal.classList.remove("hidden");
      receiptModal.classList.add("flex");
    } else {
      window.open(href, "_blank", "noopener");
    }
    return;
  }

  if (confirmBtn) {
    const id = confirmBtn.dataset.id;
    await updateOrderStatus(id, "approved");

    const link = orderLink(id);
    try {
      await sendTelegram(`✅ <b>Buyurtma qabul qilindi</b>\n🆔 ID: <code>${id}</code>\n🔗 <a href="${link}">Buyurtmani ko‘rish</a>`);
    } catch (e) {
      console.error(e);
    }

    showToast("Buyurtma qabul qilindi");
    return;
  }

  if (rejectBtn) {
    const id = rejectBtn.dataset.id;
    const reason = prompt("Rad etish sababi (ixtiyoriy):") || null;

    await updateOrderStatus(id, "rejected", reason);

    const link = orderLink(id);
    try {
      await sendTelegram(`❌ <b>Buyurtma rad etildi</b>\n🆔 ID: <code>${id}</code>\n📝 Sabab: ${reason || "-"}\n🔗 <a href="${link}">Buyurtmani ko‘rish</a>`);
    } catch (e) {
      console.error(e);
    }

    showToast("Buyurtma rad etildi", "error");
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

// ===== PRODUCTS CRUD (sening eski logikangni saqlab qoldim) =====
const renderVariants = () => {
  if (!variantList) return;
  if (!productVariants.length) {
    variantList.innerHTML =
      '<p class="text-xs text-white/50">Variantlar qo‘shilmagan. Narx uchun asosiy price ishlatiladi.</p>';
    return;
  }
  variantList.innerHTML = productVariants
    .map(
      (v, i) => `
      <div class="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900/40 px-3 py-2 text-sm">
        <div>
          <p class="font-medium text-white">${v.name}</p>
          <p class="text-xs text-white/60">${Number(v.price).toLocaleString('uz-UZ')} so'm</p>
        </div>
        <button type="button" class="remove-variant rounded-lg border border-rose-400/50 px-2 py-1 text-xs text-rose-200" data-index="${i}">❌</button>
      </div>`
    )
    .join("");
};

const updateImagePreview = () => {
  if (!imagePreview) return;
  imagePreview.innerHTML = selectedPreviews
    .map(
      (img, i) => `
      <div class="relative overflow-hidden rounded-xl border border-slate-700 bg-slate-800/60">
        <img src="${img}" class="h-32 w-full object-cover" />
        <button type="button" class="remove-image absolute right-2 top-2 rounded-full bg-black/70 px-2 py-1 text-xs text-white" data-index="${i}">❌</button>
      </div>`
    )
    .join("");
};

const resetProductForm = () => {
  selectedFiles.forEach((_, i) => {
    const p = selectedPreviews[i];
    if (p && p.startsWith("blob:")) URL.revokeObjectURL(p);
  });
  selectedFiles = [];
  selectedPreviews = [];
  editingId = null;
  productVariants = [];
  updateImagePreview();
  renderVariants();
  imageLimitError?.classList.add("hidden");
  if (saveButton) saveButton.textContent = "Saqlash";
  productForm?.reset();
};

const renderAdminProducts = () => {
  if (!adminProducts.length) {
    adminProductsEmpty?.classList.remove("hidden");
    adminProductsList.innerHTML = "";
    return;
  }
  adminProductsEmpty?.classList.add("hidden");

  adminProductsList.innerHTML = adminProducts
    .map((p) => `
      <article class="rounded-2xl border border-slate-700 bg-slate-800/60 p-4 text-sm text-slate-200">
        <img src="${(p.images && p.images[0]) || p.img || ""}" class="h-32 w-full rounded-xl object-cover" />
        <div class="mt-3 space-y-1">
          <p class="font-semibold text-white">${p.title || "—"}</p>
          <p class="text-xs text-slate-400">${p.category || "—"}</p>
        </div>
        <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span class="text-sm font-semibold text-white">${Number(p.price || 0).toLocaleString("uz-UZ")} so'm</span>
          ${(p.discount ?? p.discountPercent) ? `<span class="text-xs font-semibold text-emerald-200">-${p.discount ?? p.discountPercent}%</span>` : ""}
        </div>
        <div class="mt-3 flex justify-end gap-2">
          <button type="button" class="edit-product-btn rounded-lg border border-slate-600 px-3 py-1 text-xs text-slate-200 hover:border-slate-400" data-id="${p.id}">✏️ Edit</button>
          <button type="button" class="delete-product-btn rounded-lg border border-rose-500/60 px-3 py-1 text-xs text-rose-200 hover:border-rose-400" data-id="${p.id}">🗑 Delete</button>
        </div>
      </article>
    `)
    .join("");
};

async function loadAdminProducts() {
  const snap = await getDocs(query(collection(db, "products"), orderBy("createdAt", "desc")));
  adminProducts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderAdminProducts();
}

productImages?.addEventListener("change", (e) => {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;

  if (files.length + selectedFiles.length > 10) {
    showToast("Maksimum 10 ta rasm yuklash mumkin", "error");
    imageLimitError?.classList.remove("hidden");
    productImages.value = "";
    return;
  }

  imageLimitError?.classList.add("hidden");

  files.forEach((f) => {
    selectedFiles.push(f);
    selectedPreviews.push(URL.createObjectURL(f));
  });

  updateImagePreview();
  productImages.value = "";
});

imagePreview?.addEventListener("click", (e) => {
  const btn = e.target.closest(".remove-image");
  if (!btn) return;
  const idx = Number(btn.dataset.index);
  const [removed] = selectedPreviews.splice(idx, 1);
  if (removed && removed.startsWith("blob:")) URL.revokeObjectURL(removed);
  selectedFiles.splice(idx, 1);
  updateImagePreview();
});

addVariantBtn?.addEventListener("click", () => {
  const name = productVariantName?.value?.trim();
  const price = Number(productVariantPrice?.value);
  if (!name) return showToast("Variant nomini kiriting", "error");
  if (!Number.isFinite(price) || price <= 0) return showToast("Variant narxi musbat bo‘lishi kerak", "error");
  productVariants.push({ name, price });
  renderVariants();
  if (productVariantName) productVariantName.value = "";
  if (productVariantPrice) productVariantPrice.value = "";
});

variantList?.addEventListener("click", (e) => {
  const btn = e.target.closest(".remove-variant");
  if (!btn) return;
  const idx = Number(btn.dataset.index);
  productVariants = productVariants.filter((_, i) => i !== idx);
  renderVariants();
});

productForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

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
    stock: Number.isFinite(Number(productStock?.value)) ? Number(productStock.value) : null,
    oldPrice: Number(productOldPrice.value) || null,
    discount: Number(productDiscount.value) || null,
    rating: Number(productRating?.value) || null,
    desc: (productDescription?.value || "").trim() || null,
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
      showToast("Mahsulot muvaffaqiyatli qo‘shildi");
    }

    resetProductForm();
    await loadAdminProducts();
  } catch (err) {
    console.error(err);
    showToast("Mahsulotni saqlashda xatolik", "error");
  }
});

adminProductsList?.addEventListener("click", async (e) => {
  const del = e.target.closest(".delete-product-btn");
  const edit = e.target.closest(".edit-product-btn");

  if (del) {
    const id = del.dataset.id;
    if (!id) return;
    if (!confirm("Mahsulotni o‘chirishni tasdiqlaysizmi?")) return;
    try {
      await deleteDoc(doc(db, "products", id));
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
    const p = adminProducts.find((x) => String(x.id) === String(id));
    if (!p) return;

    editingId = p.id;
    productTitle.value = p.title || "";
    productCategory.value = p.category || "Telefon";
    productPrice.value = p.price ?? "";
    productStock.value = p.stock ?? "";
    productOldPrice.value = p.oldPrice ?? "";
    productDiscount.value = p.discount ?? p.discountPercent ?? "";
    if (productRating) productRating.value = p.rating ?? "";
    if (productDescription) productDescription.value = p.desc || p.description || "";

    selectedFiles = [];
    selectedPreviews = (p.images && p.images.length) ? [...p.images] : (p.img ? [p.img] : []);
    productVariants = Array.isArray(p.variants) ? p.variants : [];
    renderVariants();
    updateImagePreview();

    if (saveButton) saveButton.textContent = "Yangilash";
  }
});

// ===== COMMENTS (o'zgartirmadim) =====
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
      const p = productsMap.get(String(c.productId));
      return `
        <article class="rounded-2xl border border-slate-700 bg-[#0f2f52] p-4 text-sm text-slate-200">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p class="text-xs text-slate-400">Mahsulot</p>
              <p class="font-semibold text-white">${p?.title || "Noma'lum"} (${c.productId})</p>
            </div>
            <div class="text-xs text-slate-400">${formatDate(c.createdAt)}</div>
          </div>
          <p class="mt-2">Kimdan: ${c.userName} (${c.userPhone || "Telefon: N/A"})</p>
          <p class="mt-2 text-slate-300">${c.text}</p>
          ${c.rating ? `<p class="mt-2 text-xs text-amber-400">Reyting: ${c.rating}/5</p>` : ""}
          <form class="reply-form mt-3 flex flex-col gap-2" data-id="${c.id}" data-product-id="${c.productId}">
            <textarea rows="2" required class="w-full rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs text-white" placeholder="Javob yozing..."></textarea>
            <button class="self-start rounded-xl bg-blue-500 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-600">Javob berish</button>
          </form>
        </article>
      `;
    })
    .join("");
};

adminComments?.addEventListener("submit", (e) => {
  const form = e.target.closest(".reply-form");
  if (!form) return;
  e.preventDefault();
  const textarea = form.querySelector("textarea");
  const text = textarea.value.trim();
  if (!text) return;

  const productId = form.dataset.productId;
  const commentId = form.dataset.id;

  const all = getProductComments();
  const list = all[productId] || [];
  const updated = list.map((c) => {
    if (c.id !== commentId) return c;
    return {
      ...c,
      replies: [
        { id: `r-${Date.now()}`, adminId: currentUser?.id || "admin", adminName: currentUser?.name || "Admin", text, createdAt: new Date().toISOString() },
        ...(c.replies || []),
      ],
    };
  });

  all[productId] = updated;
  saveProductComments(all);
  renderAdminComments();
});

// ===== INIT =====
async function init() {
  // productsMap comment uchun
  try {
    const { products } = await fetchProducts();
    const combined = [...products];
    productsMap = new Map(combined.map((p) => [String(p.id), p]));
  } catch {
    productsMap = new Map();
  }

  await loadAdminProducts();
  await renderOrders();
  renderAdminComments();
  renderVariants();
}

init();