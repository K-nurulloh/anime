// js/admin.js
import {
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  orderBy,
  limit,
} from "./firebase.js";

/* ==========================
   CONFIG
========================== */
const BASE_URL = window.location.origin;
const ORDER_LINK = (id) => `${BASE_URL}/searc.html?id=${encodeURIComponent(id)}`;

// Telegram serverless endpoint (Vercel)
async function sendTelegram(text) {
  const res = await fetch("/api/telegram", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    console.error("Telegram API error:", data);
    throw new Error(data?.error || "Telegram yuborilmadi");
  }
  return data;
}

/* ==========================
   DOM
========================== */
const elPending = document.querySelector("#pending-orders");
const elProducts = document.querySelector("#products-list");
const elComments = document.querySelector("#comments-list");
const elToast = document.querySelector("#toast");

// Receipt modal
const receiptModal = document.querySelector("#receipt-modal");
const receiptImg = document.querySelector("#receipt-img");
const receiptClose = document.querySelector("#receipt-close");

/* ==========================
   UTIL
========================== */
const esc = (s) =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const money = (n) => Number(n || 0).toLocaleString("uz-UZ");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function toast(msg, type = "info") {
  if (!elToast) {
    console.log("[toast]", msg);
    return;
  }
  elToast.textContent = msg;
  elToast.classList.remove("hidden");
  elToast.dataset.type = type;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => elToast.classList.add("hidden"), 2600);
}

function toDateText(v) {
  const d = v?.toDate ? v.toDate() : v ? new Date(v) : null;
  if (!d || isNaN(d.getTime())) return "—";
  return d.toLocaleString("uz-UZ");
}

function getReceiptUrl(order) {
  return (
    order?.receiptUrl ||
    order?.receipt?.url ||
    order?.receiptBase64 ||
    order?.receipt?.base64 ||
    ""
  );
}

function statusText(s) {
  if (s === "pending" || s === "pending_verification") return "Ko‘rib chiqilyapti";
  if (s === "approved" || s === "accepted") return "Qabul qilindi";
  if (s === "rejected") return "Rad etildi";
  return s || "—";
}

/* ==========================
   STATE
========================== */
let state = {
  products: [],
  comments: [],
  orders: [],
};

/* ==========================
   FIRESTORE LOADERS
========================== */
async function loadProducts() {
  const snap = await getDocs(query(collection(db, "products"), orderBy("createdAt", "desc"), limit(200)));
  return snap.docs.map((d) => {
    const data = d.data() || {};
    const images = Array.isArray(data.images) ? data.images : data.img ? [data.img] : [];
    return { id: d.id, ...data, images, img: data.img || images[0] || "" };
  });
}

async function loadComments() {
  // Agar comments kolleksiyang boshqa nomda bo'lsa, shu yerini o'zgartirasan.
  const snap = await getDocs(query(collection(db, "comments"), orderBy("createdAt", "desc"), limit(200)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function loadOrders() {
  // INDEX muammosini kamaytirish uchun:
  // createdAt bo'yicha oxirgi buyurtmalarni olib, statusni JS'da ajratamiz.
  const snap = await getDocs(query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(200)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/* ==========================
   RENDER: PRODUCTS
========================== */
function renderProducts() {
  if (!elProducts) return;

  if (!state.products.length) {
    elProducts.innerHTML = `
      <div class="rounded-2xl glass p-4 text-sm text-white/70">
        Mahsulot yo‘q.
      </div>`;
    return;
  }

  elProducts.innerHTML = state.products
    .map((p) => {
      const img = p.img || p.images?.[0] || "";
      return `
        <div class="rounded-2xl glass p-4 border border-white/10 shadow-sm">
          <div class="flex gap-4">
            <div class="h-20 w-20 rounded-xl overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center">
              ${img ? `<img src="${esc(img)}" class="h-full w-full object-cover" alt="">` : `<span class="text-white/40 text-xs">No image</span>`}
            </div>

            <div class="flex-1">
              <div class="text-white font-semibold">${esc(p.title || p.name || "Nomsiz")}</div>
              <div class="text-white/60 text-xs mt-1">${esc(p.category || "")}</div>
              <div class="mt-2 flex items-center justify-between">
                <div class="text-white font-bold">${money(p.price)} so'm</div>
                <div class="text-white/60 text-xs">${p.discount ? `-${esc(p.discount)}%` : ""}</div>
              </div>

              <div class="mt-3 flex gap-2">
                <button class="btn-edit neon-btn rounded-lg px-3 py-2 text-xs font-semibold" data-edit-product="${esc(p.id)}">✏️ Edit</button>
                <button class="btn-del rounded-lg px-3 py-2 text-xs font-semibold border border-rose-400/40 text-rose-200" data-del-product="${esc(p.id)}">🗑 Delete</button>
              </div>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

/* ==========================
   RENDER: COMMENTS
========================== */
function renderComments() {
  if (!elComments) return;

  if (!state.comments.length) {
    elComments.innerHTML = `
      <div class="rounded-2xl glass p-4 text-sm text-white/70">
        Hozircha izoh yo‘q.
      </div>`;
    return;
  }

  elComments.innerHTML = state.comments
    .map((c) => {
      return `
        <div class="rounded-2xl glass p-4 border border-white/10">
          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="text-white font-semibold">${esc(c.userName || c.name || "Anonim")}</div>
              <div class="text-white/60 text-xs">${toDateText(c.createdAt || c.date)}</div>
            </div>
            <button class="rounded-lg px-3 py-2 text-xs font-semibold border border-rose-400/40 text-rose-200" data-del-comment="${esc(c.id)}">Delete</button>
          </div>
          <div class="mt-2 text-white/85 text-sm">${esc(c.text || c.comment || "")}</div>
        </div>
      `;
    })
    .join("");
}

/* ==========================
   RENDER: PENDING ORDERS (Tekshiruvdagi)
========================== */
function orderCardHTML(order) {
  const buyerName = order.userName || order.user?.name || "—";
  const buyerPhone = order.userPhone || order.user?.phone || "—";

  const addr = order.address && typeof order.address === "object" ? order.address : null;
  const region = addr?.region || order.region || "—";
  const district = addr?.district || order.district || "—";
  const home = addr?.homeAddress || addr?.address || order.addressText || "—";

  const receiptUrl = getReceiptUrl(order);

  // BUYURTMANI KO'RISH tugmasi yo'q (siz so'ragansiz)
  return `
    <div class="rounded-2xl glass p-4 border border-white/10 shadow-sm">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-xs text-white/50">Buyurtma ID</div>
          <div class="font-semibold text-white">${esc(order.id)}</div>
        </div>
        <div class="text-right">
          <div class="text-xs text-white/50">Holat</div>
          <div class="inline-flex rounded-full px-3 py-1 text-xs font-semibold bg-amber-400/20 text-amber-200">
            ${esc(statusText(order.status))}
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3 pt-3 text-sm text-white/85">
        <div>
          <div class="text-xs text-white/50">Kim buyurtma qildi</div>
          <div class="font-medium">${esc(buyerName)} (${esc(buyerPhone)})</div>
        </div>
        <div>
          <div class="text-xs text-white/50">Sana</div>
          <div class="font-medium">${esc(toDateText(order.createdAt || order.date))}</div>
        </div>

        <div>
          <div class="text-xs text-white/50">Manzil</div>
          <div class="font-medium">${esc(region)}, ${esc(district)}, ${esc(home)}</div>
        </div>
        <div>
          <div class="text-xs text-white/50">Jami</div>
          <div class="font-semibold text-white">${money(order.total || 0)} so'm</div>
        </div>

        <div>
          <div class="text-xs text-white/50">To'lov</div>
          <div class="font-medium">${esc(order.payment || "—")}</div>
        </div>
        <div>
          <div class="text-xs text-white/50">Mahsulotlar soni</div>
          <div class="font-medium">${Array.isArray(order.items) ? order.items.length : (order.itemsCount || 0)}</div>
        </div>
      </div>

      <div class="pt-3">
        <div class="text-xs text-white/50 mb-2">Chek</div>
        ${
          receiptUrl
            ? `
              <button class="inline-flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                      data-open-receipt="${esc(receiptUrl)}">
                <img src="${esc(receiptUrl)}" class="h-12 w-12 rounded-lg object-cover" alt="Chek">
                <span class="text-sm font-semibold text-white">Chekni ko‘rish</span>
              </button>
            `
            : `<div class="text-white/60 text-sm">Chek yo‘q</div>`
        }
      </div>

      ${
        order.status === "rejected" && order.rejectReason
          ? `<div class="mt-3 text-xs text-rose-200">Sabab: ${esc(order.rejectReason)}</div>`
          : ""
      }

      <div class="pt-4 flex items-center gap-3">
        <button class="neon-btn rounded-xl px-5 py-2 text-sm font-semibold" data-accept="${esc(order.id)}">✅ Qabul</button>
        <button class="rounded-xl px-5 py-2 text-sm font-semibold border border-rose-400/40 text-rose-200" data-reject="${esc(order.id)}">❌ Rad</button>
      </div>
    </div>
  `;
}

function renderPendingOrders() {
  if (!elPending) return;

  const pending = state.orders.filter((o) =>
    ["pending", "pending_verification"].includes(String(o.status || "").toLowerCase())
  );

  if (!pending.length) {
    elPending.innerHTML = `
      <div class="rounded-2xl glass p-4 text-sm text-white/70">
        Tekshiruvda buyurtma yo‘q.
      </div>`;
    return;
  }

  elPending.innerHTML = pending.map(orderCardHTML).join("");
}

/* ==========================
   ACTIONS: ORDER APPROVE / REJECT
========================== */
async function approveOrder(orderId) {
  toast("Qabul qilinyapti...");
  const ref = doc(db, "orders", orderId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Order topilmadi");

  await updateDoc(ref, {
    status: "approved",
    rejectReason: null,
    reviewedAt: new Date(),
    updatedAt: new Date(),
  });

  const link = ORDER_LINK(orderId);
  const msg =
    `✅ Buyurtma qabul qilindi\n` +
    `ID: ${orderId}\n` +
    `🔗 Buyurtmani ko‘rish: ${link}`;

  await sendTelegram(msg);

  toast("✅ Qabul qilindi (telegramga yuborildi)");
}

async function rejectOrder(orderId) {
  const reason = prompt("Rad etish sababi?");
  if (reason === null) return;

  toast("Rad etilyapti...");
  const ref = doc(db, "orders", orderId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Order topilmadi");

  const rejectReason = String(reason || "").trim() || "Sabab ko‘rsatilmagan";

  await updateDoc(ref, {
    status: "rejected",
    rejectReason,
    reviewedAt: new Date(),
    updatedAt: new Date(),
  });

  const link = ORDER_LINK(orderId);
  const msg =
    `❌ Buyurtma rad etildi\n` +
    `ID: ${orderId}\n` +
    `Sabab: ${rejectReason}\n` +
    `🔗 Buyurtmani ko‘rish: ${link}`;

  await sendTelegram(msg);

  toast("✅ Rad etildi (telegramga yuborildi)");
}

/* ==========================
   ACTIONS: PRODUCTS (edit/delete)
========================== */
async function deleteProduct(id) {
  if (!confirm("Mahsulot o‘chirilsinmi?")) return;
  toast("O‘chirilmoqda...");
  await deleteDoc(doc(db, "products", id));
  toast("✅ O‘chirildi");
}

async function editProduct(id) {
  const p = state.products.find((x) => x.id === id);
  if (!p) return;

  const title = prompt("Title:", p.title || p.name || "");
  if (title === null) return;

  const priceStr = prompt("Price (so'm):", String(p.price || 0));
  if (priceStr === null) return;

  const price = Number(priceStr || 0);

  toast("Saqlanyapti...");
  await updateDoc(doc(db, "products", id), {
    title,
    price,
    updatedAt: new Date(),
  });
  toast("✅ Saqlandi");
}

/* ==========================
   ACTIONS: COMMENTS
========================== */
async function deleteComment(id) {
  if (!confirm("Izoh o‘chirilsinmi?")) return;
  toast("O‘chirilmoqda...");
  await deleteDoc(doc(db, "comments", id));
  toast("✅ O‘chirildi");
}

/* ==========================
   RECEIPT MODAL
========================== */
function openReceipt(url) {
  if (!receiptModal || !receiptImg) {
    // fallback: new tab
    window.open(url, "_blank");
    return;
  }
  receiptImg.src = url;
  receiptModal.classList.remove("hidden");
}
function closeReceipt() {
  if (!receiptModal || !receiptImg) return;
  receiptModal.classList.add("hidden");
  receiptImg.src = "";
}

receiptClose?.addEventListener("click", closeReceipt);
receiptModal?.addEventListener("click", (e) => {
  if (e.target === receiptModal) closeReceipt();
});

/* ==========================
   EVENTS
========================== */
document.addEventListener("click", async (e) => {
  const btnAccept = e.target.closest("[data-accept]");
  const btnReject = e.target.closest("[data-reject]");
  const btnOpenReceipt = e.target.closest("[data-open-receipt]");

  const btnDelProduct = e.target.closest("[data-del-product]");
  const btnEditProduct = e.target.closest("[data-edit-product]");

  const btnDelComment = e.target.closest("[data-del-comment]");

  try {
    if (btnOpenReceipt) {
      openReceipt(btnOpenReceipt.dataset.openReceipt);
      return;
    }

    if (btnAccept) {
      await approveOrder(btnAccept.dataset.accept);
      await refreshAll();
      return;
    }

    if (btnReject) {
      await rejectOrder(btnReject.dataset.reject);
      await refreshAll();
      return;
    }

    if (btnDelProduct) {
      await deleteProduct(btnDelProduct.dataset.delProduct);
      await refreshAll();
      return;
    }

    if (btnEditProduct) {
      await editProduct(btnEditProduct.dataset.editProduct);
      await refreshAll();
      return;
    }

    if (btnDelComment) {
      await deleteComment(btnDelComment.dataset.delComment);
      await refreshAll();
      return;
    }
  } catch (err) {
    console.error(err);
    toast("❌ Xatolik: " + (err?.message || "error"), "error");
  }
});

/* ==========================
   MAIN: LOAD + RENDER
========================== */
async function refreshAll() {
  // Skeleton / Loading (xohlasang chiroyli skeleton qo‘shamiz)
  try {
    const [products, comments, orders] = await Promise.all([
      loadProducts().catch((e) => {
        console.error("products load:", e);
        return [];
      }),
      loadComments().catch((e) => {
        console.error("comments load:", e);
        return [];
      }),
      loadOrders().catch((e) => {
        console.error("orders load:", e);
        return [];
      }),
    ]);

    state.products = products;
    state.comments = comments;
    state.orders = orders;

    renderProducts();
    renderComments();
    renderPendingOrders();
  } catch (e) {
    console.error(e);
    toast("❌ Yuklashda xatolik: " + (e?.message || "error"), "error");
  }
}

// Auto refresh
refreshAll();

// xohlasang har 10 sekundda yangilab turadi:
setInterval(() => {
  refreshAll();
}, 10000);