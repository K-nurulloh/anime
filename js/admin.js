// js/admin.js (FULL ADMIN: Orders + Products + Comments + Payments)
// Works with Vercel / Firestore / /api/telegram
import {
  db,
  nowTs,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
} from "./firebase.js";

/* -------------------- helpers -------------------- */
const $ = (sel, root = document) => root.querySelector(sel);

const esc = (s) =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const toDateObj = (ts) => {
  try {
    if (!ts) return null;
    if (ts?.toDate) return ts.toDate();
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  } catch {
    return null;
  }
};

const toDateText = (ts) => {
  const d = toDateObj(ts);
  if (!d) return "—";
  return d.toLocaleString("uz-UZ");
};

const formatPrice = (n) => {
  const num = Number(n || 0);
  return num.toLocaleString("uz-UZ");
};

function toast(msg, type = "info") {
  let box = $("#__toast");
  if (!box) {
    box = document.createElement("div");
    box.id = "__toast";
    box.className =
      "fixed bottom-4 right-4 z-[9999] flex max-w-sm flex-col gap-2";
    document.body.appendChild(box);
  }
  const el = document.createElement("div");
  const cls =
    type === "error"
      ? "border-rose-300/30 bg-rose-500/15 text-rose-100"
      : type === "success"
      ? "border-emerald-300/30 bg-emerald-500/15 text-emerald-100"
      : "border-white/15 bg-white/10 text-white/90";
  el.className =
    "rounded-2xl border px-4 py-3 text-sm shadow-lg backdrop-blur " + cls;
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

const statusMeta = (status) => {
  const s = String(status || "pending");
  if (s === "approved" || s === "accepted")
    return {
      text: "Qabul qilindi",
      cls: "bg-emerald-500/15 text-emerald-200 border-emerald-400/30",
    };
  if (s === "rejected")
    return {
      text: "Rad etildi",
      cls: "bg-rose-500/15 text-rose-200 border-rose-400/30",
    };
  if (s === "pending_verification" || s === "pending")
    return {
      text: "Ko‘rib chiqilyapti",
      cls: "bg-amber-500/15 text-amber-200 border-amber-400/30",
    };
  return { text: s, cls: "bg-white/10 text-white/80 border-white/15" };
};

const getOrderDocId = (order) => String(order?.docId || order?.id || "");

/* -------------------- Telegram (via Vercel API) -------------------- */
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

function buildPublicOrderLink(order) {
  // Sen aytgandek: searc.html ochilsin
  const id = String(order?.id || "");
  return `${window.location.origin}/searc.html?id=${encodeURIComponent(id)}`;
}

/* -------------------- UI skeleton -------------------- */
function ensureAdminLayout() {
  // admin.html ichida <main> bo'lsa o'sha yerga joylaymiz
  const host = $("main") || document.body;

  let root = $("#adminRoot");
  if (!root) {
    root = document.createElement("div");
    root.id = "adminRoot";
    root.className = "mx-auto max-w-6xl px-4 pb-24 pt-4 md:pt-6";
    host.appendChild(root);
  }

  // Top tabs
  let tabs = $("#adminTabs");
  if (!tabs) {
    tabs = document.createElement("div");
    tabs.id = "adminTabs";
    tabs.className =
      "mb-5 flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 backdrop-blur";
    tabs.innerHTML = `
      <a class="adminTab rounded-xl px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10" href="#orders">Buyurtmalar</a>
      <a class="adminTab rounded-xl px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10" href="#products">Mahsulotlar</a>
      <a class="adminTab rounded-xl px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10" href="#comments">Kommentlar</a>
      <a class="adminTab rounded-xl px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10" href="#payments">Payments</a>
      <span class="ml-auto flex items-center gap-2 px-2 text-xs text-white/60">
        <span id="adminNetDot" class="inline-block h-2 w-2 rounded-full bg-emerald-400"></span>
        <span id="adminNetText">online</span>
      </span>
    `;
    root.appendChild(tabs);
  }

  let view = $("#adminView");
  if (!view) {
    view = document.createElement("div");
    view.id = "adminView";
    view.className = "space-y-6";
    root.appendChild(view);
  }

  // Receipt modal
  let rModal = $("#receipt-modal");
  if (!rModal) {
    rModal = document.createElement("div");
    rModal.id = "receipt-modal";
    rModal.className = "fixed inset-0 hidden items-center justify-center bg-black/60 p-4 z-[9998]";
    rModal.innerHTML = `
      <div class="w-full max-w-3xl rounded-2xl border border-white/10 bg-slate-950 p-4">
        <div class="flex items-center justify-between">
          <h3 class="text-white font-semibold">Chek</h3>
          <button id="receipt-close" class="text-white/70 hover:text-white">✕</button>
        </div>
        <div class="mt-3">
          <img id="receipt-img" src="" alt="receipt" class="w-full rounded-xl border border-white/10 bg-white/5 object-contain" />
          <div class="mt-3 flex flex-wrap gap-2">
            <a id="receipt-open" href="#" target="_blank" rel="noreferrer"
              class="inline-flex rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/80 hover:bg-white/10">
              Yangi oynada ochish
            </a>
            <button id="receipt-copy" class="inline-flex rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/80 hover:bg-white/10">
              Linkni nusxalash
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(rModal);
  }

  // Order detail modal
  let oModal = $("#order-modal");
  if (!oModal) {
    oModal = document.createElement("div");
    oModal.id = "order-modal";
    oModal.className = "fixed inset-0 hidden items-center justify-center bg-black/60 p-4 z-[9998]";
    oModal.innerHTML = `
      <div class="w-full max-w-3xl rounded-2xl border border-white/10 bg-slate-950 p-4">
        <div class="flex items-center justify-between">
          <h3 class="text-white font-semibold">Buyurtma</h3>
          <button id="order-close" class="text-white/70 hover:text-white">✕</button>
        </div>
        <div id="order-content" class="mt-3"></div>
      </div>
    `;
    document.body.appendChild(oModal);
  }

  // Product modal
  let pModal = $("#product-modal");
  if (!pModal) {
    pModal = document.createElement("div");
    pModal.id = "product-modal";
    pModal.className = "fixed inset-0 hidden items-center justify-center bg-black/60 p-4 z-[9998]";
    pModal.innerHTML = `
      <div class="w-full max-w-3xl rounded-2xl border border-white/10 bg-slate-950 p-4">
        <div class="flex items-center justify-between">
          <h3 id="product-modal-title" class="text-white font-semibold">Mahsulot</h3>
          <button id="product-close" class="text-white/70 hover:text-white">✕</button>
        </div>

        <form id="product-form" class="mt-4 grid gap-3 md:grid-cols-2">
          <input type="hidden" name="docId" />
          <label class="block">
            <div class="mb-1 text-xs text-white/60">Title</div>
            <input name="title" class="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none" required />
          </label>

          <label class="block">
            <div class="mb-1 text-xs text-white/60">Category</div>
            <input name="category" class="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none" />
          </label>

          <label class="block">
            <div class="mb-1 text-xs text-white/60">Price (so'm)</div>
            <input name="price" type="number" class="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none" required />
          </label>

          <label class="block">
            <div class="mb-1 text-xs text-white/60">Discount (%)</div>
            <input name="discount" type="number" class="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none" />
          </label>

          <label class="block md:col-span-2">
            <div class="mb-1 text-xs text-white/60">Image URL</div>
            <input name="img" class="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none" placeholder="https://..." />
          </label>

          <label class="block md:col-span-2">
            <div class="mb-1 text-xs text-white/60">Description</div>
            <textarea name="desc" rows="3" class="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"></textarea>
          </label>

          <div class="md:col-span-2 flex flex-wrap gap-2 pt-2">
            <button id="product-save" type="submit" class="rounded-xl bg-emerald-500/90 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400">
              Saqlash
            </button>
            <button id="product-cancel" type="button" class="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/80 hover:bg-white/10">
              Bekor
            </button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(pModal);
  }
}

ensureAdminLayout();

const view = $("#adminView");
const netDot = $("#adminNetDot");
const netText = $("#adminNetText");

/* -------------------- network indicator -------------------- */
function setNet() {
  const on = navigator.onLine;
  if (netDot) netDot.className = "inline-block h-2 w-2 rounded-full " + (on ? "bg-emerald-400" : "bg-rose-400");
  if (netText) netText.textContent = on ? "online" : "offline";
}
window.addEventListener("online", setNet);
window.addEventListener("offline", setNet);
setNet();

/* -------------------- modals logic -------------------- */
const receiptModal = $("#receipt-modal");
const receiptImg = $("#receipt-img");
const receiptOpen = $("#receipt-open");
const receiptClose = $("#receipt-close");
const receiptCopy = $("#receipt-copy");

function openReceipt(url) {
  if (!url) return;
  receiptImg.src = url;
  receiptOpen.href = url;
  receiptModal.classList.remove("hidden");
  receiptModal.classList.add("flex");
}
function closeReceipt() {
  receiptModal.classList.add("hidden");
  receiptModal.classList.remove("flex");
  receiptImg.src = "";
  receiptOpen.href = "#";
}
receiptClose?.addEventListener("click", closeReceipt);
receiptModal?.addEventListener("click", (e) => {
  if (e.target === receiptModal) closeReceipt();
});
receiptCopy?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(receiptOpen.href);
    toast("Nusxalandi", "success");
  } catch {
    toast("Nusxalab bo'lmadi", "error");
  }
});

const orderModal = $("#order-modal");
const orderClose = $("#order-close");
const orderContent = $("#order-content");
function openOrderModal(html) {
  orderContent.innerHTML = html;
  orderModal.classList.remove("hidden");
  orderModal.classList.add("flex");
}
function closeOrderModal() {
  orderModal.classList.add("hidden");
  orderModal.classList.remove("flex");
  orderContent.innerHTML = "";
}
orderClose?.addEventListener("click", closeOrderModal);
orderModal?.addEventListener("click", (e) => {
  if (e.target === orderModal) closeOrderModal();
});

const productModal = $("#product-modal");
const productClose = $("#product-close");
const productCancel = $("#product-cancel");
const productForm = $("#product-form");
const productModalTitle = $("#product-modal-title");

function openProductModal(title = "Mahsulot") {
  productModalTitle.textContent = title;
  productModal.classList.remove("hidden");
  productModal.classList.add("flex");
}
function closeProductModal() {
  productModal.classList.add("hidden");
  productModal.classList.remove("flex");
  productForm.reset();
  productForm.docId.value = "";
}
productClose?.addEventListener("click", closeProductModal);
productCancel?.addEventListener("click", closeProductModal);
productModal?.addEventListener("click", (e) => {
  if (e.target === productModal) closeProductModal();
});

/* -------------------- state -------------------- */
let __orders = [];
let __products = [];
let __comments = [];

/* -------------------- Firestore loaders -------------------- */
async function loadOrders() {
  // orderBy(createdAt) single field -> index so'ramaydi
  const snap = await getDocs(query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(150)));
  __orders = snap.docs.map((d) => ({ docId: d.id, ...d.data() }));
  return __orders;
}

async function loadProducts() {
  // products collection
  let snap;
  try {
    snap = await getDocs(query(collection(db, "products"), orderBy("createdAt", "desc"), limit(300)));
  } catch {
    snap = await getDocs(collection(db, "products"));
  }
  __products = snap.docs.map((d) => ({ docId: d.id, ...d.data() }));
  return __products;
}

async function loadComments() {
  // comments collection
  let snap;
  try {
    snap = await getDocs(query(collection(db, "comments"), orderBy("createdAt", "desc"), limit(200)));
  } catch {
    snap = await getDocs(collection(db, "comments"));
  }
  __comments = snap.docs.map((d) => ({ docId: d.id, ...d.data() }));
  return __comments;
}

async function loadPaymentSettings() {
  // settings/payment doc
  const ref = doc(db, "settings", "payment");
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : {};
  return data || {};
}

/* -------------------- Orders actions -------------------- */
async function setOrderStatus(order, status, extra = {}) {
  const docId = getOrderDocId(order);
  if (!docId) throw new Error("docId topilmadi");
  await updateDoc(doc(db, "orders", docId), {
    status,
    updatedAt: nowTs(),
    ...extra,
  });
}

async function approveOrder(order) {
  await setOrderStatus(order, "approved", { reviewedAt: nowTs(), rejectReason: null });

  const link = buildPublicOrderLink(order);
  const text =
    `✅ Buyurtma qabul qilindi\n` +
    `ID: ${order.id || order.docId}\n` +
    `Jami: ${formatPrice(order.total)} so'm\n` +
    `\n🔗 Buyurtmani ko'rish:\n${link}`;

  await sendTelegram(text);
}

async function rejectOrder(order) {
  const reason = prompt("Rad etish sababi (majburiy):", "");
  if (!reason || !reason.trim()) return;

  await setOrderStatus(order, "rejected", { reviewedAt: nowTs(), rejectReason: reason.trim() });

  const link = buildPublicOrderLink(order);
  const text =
    `❌ Buyurtma rad etildi\n` +
    `ID: ${order.id || order.docId}\n` +
    `Sabab: ${reason.trim()}\n` +
    `\n🔗 Buyurtmani ko'rish:\n${link}`;

  await sendTelegram(text);
}

/* -------------------- Orders render -------------------- */
function orderCardHTML(order) {
  const id = String(order?.id || order?.docId || "");
  const userName = order?.userName || order?.user?.name || "—";
  const userPhone = order?.userPhone || order?.user?.phone || "—";

  const region = order?.address?.region || "—";
  const district = order?.address?.district || "—";
  const homeAddress = order?.address?.homeAddress || "—";
  const addrText = [region, district, homeAddress].filter(Boolean).join(", ");

  const itemsCount = Array.isArray(order?.items) ? order.items.length : 0;
  const total = Number(order?.total || 0);
  const payment = order?.payment || "—";
  const createdAt = order?.createdAt || order?.date || null;

  const st = statusMeta(order?.status);
  const receiptUrl = order?.receiptUrl || "";

  return `
    <div class="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="text-xs text-white/60">Buyurtma ID</div>
          <div class="font-semibold text-white break-all">${esc(id)}</div>
        </div>

        <div class="flex items-center gap-2">
          <button data-action="detail" data-id="${esc(id)}" class="rounded-xl border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10">
            Ko‘rib chiqilyapti
          </button>
          <span class="shrink-0 rounded-full border px-3 py-1 text-xs ${st.cls}">
            ${esc(st.text)}
          </span>
        </div>
      </div>

      <div class="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <div class="text-xs text-white/50">Kim buyurtma qildi</div>
          <div class="font-medium text-white/90">${esc(userName)} (${esc(userPhone)})</div>
        </div>

        <div>
          <div class="text-xs text-white/50">Sana</div>
          <div class="font-medium text-white/90">${esc(toDateText(createdAt))}</div>
        </div>

        <div>
          <div class="text-xs text-white/50">Manzil</div>
          <div class="font-medium text-white/90">${esc(addrText || "—")}</div>
        </div>

        <div>
          <div class="text-xs text-white/50">Jami</div>
          <div class="font-semibold text-white">${formatPrice(total)} so'm</div>
        </div>

        <div>
          <div class="text-xs text-white/50">Mahsulotlar soni</div>
          <div class="font-medium text-white/90">${itemsCount}</div>
        </div>

        <div>
          <div class="text-xs text-white/50">To'lov</div>
          <div class="font-medium text-white/90">${esc(payment)}</div>
        </div>
      </div>

      <div class="mt-4 flex flex-wrap items-center gap-2">
        ${
          receiptUrl
            ? `
            <button data-action="receipt" data-url="${esc(receiptUrl)}"
              class="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 hover:bg-white/10">
              <img src="${esc(receiptUrl)}" class="h-9 w-9 rounded-xl object-cover border border-white/10" alt="receipt" />
              Chekni ko‘rish
            </button>
          `
            : `<div class="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60">Chek yo‘q</div>`
        }

        <button data-action="approve" data-id="${esc(id)}"
          class="ml-auto inline-flex items-center justify-center rounded-2xl bg-emerald-500/90 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400">
          ✅ Qabul
        </button>

        <button data-action="reject" data-id="${esc(id)}"
          class="inline-flex items-center justify-center rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/15">
          ❌ Rad
        </button>
      </div>

      ${
        order?.status === "rejected" && order?.rejectReason
          ? `<div class="mt-3 rounded-xl border border-rose-300/20 bg-rose-500/10 p-3 text-xs text-rose-100">
               Sabab: ${esc(order.rejectReason)}
             </div>`
          : ""
      }
    </div>
  `;
}

function renderOrdersPage() {
  const pending = __orders.filter((o) => {
    const s = String(o?.status || "pending");
    return s === "pending" || s === "pending_verification";
  });

  const recent = __orders.slice(0, 30);

  view.innerHTML = `
    <section class="space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-semibold text-white">Tekshiruvdagi buyurtmalar</h2>
        <button id="ordersRefresh" class="rounded-xl border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80 hover:bg-white/10">
          Yangilash
        </button>
      </div>
      <div id="pendingList" class="space-y-4"></div>
      <div id="pendingEmpty" class="hidden rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
        Tekshiruvda buyurtma yo‘q.
      </div>
    </section>

    <section class="space-y-3">
      <h2 class="text-lg font-semibold text-white">Oxirgi buyurtmalar</h2>
      <div id="recentList" class="space-y-3"></div>
    </section>
  `;

  const pendingList = $("#pendingList");
  const pendingEmpty = $("#pendingEmpty");
  const recentList = $("#recentList");

  if (!pending.length) {
    pendingEmpty.classList.remove("hidden");
    pendingList.innerHTML = "";
  } else {
    pendingEmpty.classList.add("hidden");
    pendingList.innerHTML = pending.map(orderCardHTML).join("");
  }

  recentList.innerHTML = recent
    .map((o) => {
      const st = statusMeta(o.status);
      return `
        <div class="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm">
          <div class="flex items-center justify-between gap-2">
            <div class="min-w-0">
              <div class="text-xs text-white/60">ID</div>
              <div class="font-semibold text-white break-all">${esc(o.id || o.docId)}</div>
            </div>
            <span class="rounded-full border px-3 py-1 text-xs ${st.cls}">${esc(st.text)}</span>
          </div>
          <div class="mt-2 text-xs text-white/60">${esc(toDateText(o.createdAt || o.date))}</div>
        </div>
      `;
    })
    .join("");

  $("#ordersRefresh")?.addEventListener("click", async () => {
    await bootstrap("orders");
  });

  // click handlers
  view.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;

    if (action === "receipt") {
      openReceipt(btn.dataset.url);
      return;
    }

    const id = btn.dataset.id;
    const order = __orders.find((o) => String(o.id || o.docId) === String(id));
    if (!order) return toast("Order topilmadi", "error");

    if (action === "detail") {
      const items = Array.isArray(order.items) ? order.items : [];
      const itemsHtml = items
        .map((it) => {
          return `<div class="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80">
            <span>Product: ${esc(it.id)}</span><span>Qty: ${esc(it.qty || 1)}</span>
          </div>`;
        })
        .join("");

      const link = buildPublicOrderLink(order);

      openOrderModal(`
        <div class="space-y-3">
          <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div class="text-xs text-white/60">ID</div>
            <div class="text-white font-semibold break-all">${esc(order.id || order.docId)}</div>

            <div class="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <div class="text-xs text-white/60">Status</div>
                <div class="text-white/90">${esc(statusMeta(order.status).text)}</div>
              </div>
              <div>
                <div class="text-xs text-white/60">Sana</div>
                <div class="text-white/90">${esc(toDateText(order.createdAt || order.date))}</div>
              </div>
              <div>
                <div class="text-xs text-white/60">Jami</div>
                <div class="text-white font-semibold">${formatPrice(order.total)} so'm</div>
              </div>
              <div>
                <div class="text-xs text-white/60">To'lov</div>
                <div class="text-white/90">${esc(order.payment || "—")}</div>
              </div>
            </div>

            <div class="mt-4 flex flex-wrap gap-2">
              <a href="${esc(link)}" target="_blank" class="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/80 hover:bg-white/10">
                Public sahifa (searc.html)
              </a>
            </div>
          </div>

          <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div class="text-sm font-semibold text-white">Items</div>
            <div class="mt-3 space-y-2">${itemsHtml || `<div class="text-xs text-white/60">Items yo‘q</div>`}</div>
          </div>
        </div>
      `);
      return;
    }

    // approve / reject
    btn.disabled = true;
    try {
      if (action === "approve") {
        await approveOrder(order);
        toast("Qabul qilindi + Telegramga yuborildi", "success");
        await bootstrap("orders");
      } else if (action === "reject") {
        await rejectOrder(order);
        toast("Rad qilindi + Telegramga yuborildi", "success");
        await bootstrap("orders");
      }
    } catch (err) {
      console.error(err);
      toast("Xatolik: " + (err?.message || err), "error");
    } finally {
      btn.disabled = false;
    }
  });
}

/* -------------------- Products page -------------------- */
function productCardHTML(p) {
  const title = p.title || p.name || "No title";
  const price = Number(p.price || 0);
  const img = p.img || (Array.isArray(p.images) ? p.images[0] : "") || "";
  return `
    <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div class="flex gap-3">
        <div class="h-16 w-16 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          ${img ? `<img src="${esc(img)}" class="h-full w-full object-cover" />` : ""}
        </div>
        <div class="min-w-0 flex-1">
          <div class="font-semibold text-white truncate">${esc(title)}</div>
          <div class="text-xs text-white/60">${esc(p.category || "")}</div>
          <div class="mt-1 text-sm text-white">${formatPrice(price)} so'm</div>
        </div>
        <div class="flex flex-col gap-2">
          <button data-paction="edit" data-id="${esc(p.docId)}" class="rounded-xl border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80 hover:bg-white/10">
            Edit
          </button>
          <button data-paction="delete" data-id="${esc(p.docId)}" class="rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-1 text-xs text-rose-200 hover:bg-rose-500/15">
            Delete
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderProductsPage() {
  view.innerHTML = `
    <section class="space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-xl font-semibold text-white">Mahsulotlar</h2>
        <div class="flex flex-wrap gap-2">
          <button id="prodAdd" class="rounded-xl bg-emerald-500/90 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400">
            + Mahsulot qo‘shish
          </button>
          <button id="prodRefresh" class="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/80 hover:bg-white/10">
            Yangilash
          </button>
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        <input id="prodSearch" placeholder="Qidirish..." class="w-full md:w-80 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none" />
      </div>

      <div id="prodList" class="grid gap-3 md:grid-cols-2"></div>
      <div id="prodEmpty" class="hidden rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
        Mahsulot yo‘q.
      </div>
    </section>
  `;

  const list = $("#prodList");
  const empty = $("#prodEmpty");
  const search = $("#prodSearch");

  function draw(items) {
    if (!items.length) {
      empty.classList.remove("hidden");
      list.innerHTML = "";
      return;
    }
    empty.classList.add("hidden");
    list.innerHTML = items.map(productCardHTML).join("");
  }

  draw(__products);

  $("#prodAdd")?.addEventListener("click", () => {
    openProductModal("Mahsulot qo‘shish");
  });

  $("#prodRefresh")?.addEventListener("click", async () => {
    await bootstrap("products");
  });

  search?.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    if (!q) return draw(__products);
    draw(
      __products.filter((p) =>
        String(p.title || p.name || "")
          .toLowerCase()
          .includes(q)
      )
    );
  });

  // list actions
  view.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-paction]");
    if (!btn) return;
    const action = btn.dataset.paction;
    const id = btn.dataset.id;

    const product = __products.find((p) => String(p.docId) === String(id));
    if (!product) return toast("Mahsulot topilmadi", "error");

    if (action === "edit") {
      // fill form
      productForm.docId.value = product.docId;
      productForm.title.value = product.title || product.name || "";
      productForm.category.value = product.category || "";
      productForm.price.value = Number(product.price || 0);
      productForm.discount.value = Number(product.discount || product.sale || 0);
      productForm.img.value = product.img || (Array.isArray(product.images) ? product.images[0] : "") || "";
      productForm.desc.value = product.desc || product.description || "";
      openProductModal("Mahsulotni tahrirlash");
      return;
    }

    if (action === "delete") {
      const ok = confirm("Rostdan ham o‘chirasizmi?");
      if (!ok) return;

      try {
        await deleteDoc(doc(db, "products", product.docId));
        toast("O‘chirildi", "success");
        await bootstrap("products");
      } catch (err) {
        console.error(err);
        toast("Xatolik: " + (err?.message || err), "error");
      }
    }
  });
}

// product form submit
productForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    title: productForm.title.value.trim(),
    category: productForm.category.value.trim(),
    price: Number(productForm.price.value || 0),
    discount: Number(productForm.discount.value || 0),
    img: productForm.img.value.trim(),
    images: productForm.img.value.trim() ? [productForm.img.value.trim()] : [],
    desc: productForm.desc.value.trim(),
    updatedAt: nowTs(),
  };

  const docId = productForm.docId.value.trim();

  try {
    if (docId) {
      await updateDoc(doc(db, "products", docId), payload);
      toast("Saqlanib yangilandi", "success");
    } else {
      payload.createdAt = nowTs();
      await addDoc(collection(db, "products"), payload);
      toast("Mahsulot qo‘shildi", "success");
    }
    closeProductModal();
    await bootstrap("products");
  } catch (err) {
    console.error(err);
    toast("Xatolik: " + (err?.message || err), "error");
  }
});

/* -------------------- Comments page -------------------- */
function commentCardHTML(c) {
  const name = c.userName || c.name || "Anon";
  const text = c.text || c.comment || "";
  return `
    <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <div class="font-semibold text-white">${esc(name)}</div>
          <div class="text-xs text-white/60">${esc(toDateText(c.createdAt))}</div>
        </div>
        <button data-caction="delete" data-id="${esc(c.docId)}"
          class="rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-1 text-xs text-rose-200 hover:bg-rose-500/15">
          Delete
        </button>
      </div>
      <div class="mt-3 whitespace-pre-wrap text-sm text-white/85">${esc(text)}</div>
    </div>
  `;
}

function renderCommentsPage() {
  view.innerHTML = `
    <section class="space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-xl font-semibold text-white">Kommentlar</h2>
        <button id="comRefresh" class="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/80 hover:bg-white/10">
          Yangilash
        </button>
      </div>

      <div class="flex flex-wrap gap-2">
        <input id="comSearch" placeholder="Qidirish..." class="w-full md:w-80 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none" />
      </div>

      <div id="comList" class="space-y-3"></div>
      <div id="comEmpty" class="hidden rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
        Hozircha izoh yo‘q.
      </div>
    </section>
  `;

  const list = $("#comList");
  const empty = $("#comEmpty");
  const search = $("#comSearch");

  function draw(items) {
    if (!items.length) {
      empty.classList.remove("hidden");
      list.innerHTML = "";
      return;
    }
    empty.classList.add("hidden");
    list.innerHTML = items.map(commentCardHTML).join("");
  }

  draw(__comments);

  $("#comRefresh")?.addEventListener("click", async () => {
    await bootstrap("comments");
  });

  search?.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    if (!q) return draw(__comments);
    draw(
      __comments.filter((c) => {
        const a = String(c.userName || c.name || "").toLowerCase();
        const b = String(c.text || c.comment || "").toLowerCase();
        return a.includes(q) || b.includes(q);
      })
    );
  });

  view.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-caction]");
    if (!btn) return;
    const id = btn.dataset.id;
    const ok = confirm("Kommentni o‘chirasizmi?");
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "comments", id));
      toast("O‘chirildi", "success");
      await bootstrap("comments");
    } catch (err) {
      console.error(err);
      toast("Xatolik: " + (err?.message || err), "error");
    }
  });
}

/* -------------------- Payments page -------------------- */
function renderPaymentsPage(settings) {
  const owner = settings?.ownerFullName || "";
  const cardNumber = settings?.cardNumber || "";
  const bank = settings?.bank || "";

  view.innerHTML = `
    <section class="space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-xl font-semibold text-white">Payments</h2>
        <button id="payRefresh" class="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/80 hover:bg-white/10">
          Yangilash
        </button>
      </div>

      <form id="payForm" class="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
        <label class="block">
          <div class="mb-1 text-xs text-white/60">Owner (F.I.O)</div>
          <input name="owner" value="${esc(owner)}" class="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none" />
        </label>

        <label class="block">
          <div class="mb-1 text-xs text-white/60">Card number</div>
          <input name="card" value="${esc(cardNumber)}" class="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none" />
        </label>

        <label class="block">
          <div class="mb-1 text-xs text-white/60">Bank</div>
          <input name="bank" value="${esc(bank)}" class="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none" />
        </label>

        <button type="submit" class="rounded-xl bg-emerald-500/90 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400">
          Saqlash
        </button>
      </form>

      <div class="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/70">
        Eslatma: bu qiymatlar Firestore: <b>settings/payment</b> doc ichiga saqlanadi.
      </div>
    </section>
  `;

  $("#payRefresh")?.addEventListener("click", async () => {
    await bootstrap("payments");
  });

  $("#payForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      ownerFullName: String(fd.get("owner") || ""),
      cardNumber: String(fd.get("card") || ""),
      bank: String(fd.get("bank") || ""),
      updatedAt: nowTs(),
    };
    try {
      await setDoc(doc(db, "settings", "payment"), payload, { merge: true });
      toast("Payments saqlandi", "success");
    } catch (err) {
      console.error(err);
      toast("Xatolik: " + (err?.message || err), "error");
    }
  });
}

/* -------------------- router & bootstrap -------------------- */
function setActiveTab() {
  const hash = (location.hash || "#orders").replace("#", "");
  document.querySelectorAll(".adminTab").forEach((a) => {
    const active = a.getAttribute("href") === `#${hash}`;
    a.classList.toggle("bg-white/10", active);
    a.classList.toggle("text-white", active);
    a.classList.toggle("text-white/80", !active);
  });
}

async function bootstrap(route) {
  const r = route || (location.hash || "#orders").replace("#", "") || "orders";
  setActiveTab();

  // loader
  view.innerHTML = `
    <div class="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
      Yuklanmoqda...
    </div>
  `;

  try {
    if (r === "products") {
      await loadProducts();
      renderProductsPage();
      return;
    }

    if (r === "comments") {
      await loadComments();
      renderCommentsPage();
      return;
    }

    if (r === "payments") {
      const settings = await loadPaymentSettings();
      renderPaymentsPage(settings);
      return;
    }

    // default orders
    await loadOrders();
    renderOrdersPage();
  } catch (err) {
    console.error(err);
    view.innerHTML = `
      <div class="rounded-2xl border border-rose-300/20 bg-rose-500/10 p-4 text-sm text-rose-100">
        Xatolik: ${esc(err?.message || err)}
      </div>
    `;
  }
}

window.addEventListener("hashchange", () => bootstrap());
bootstrap();

// Auto refresh orders page every 12s (only when on orders tab)
setInterval(async () => {
  const r = (location.hash || "#orders").replace("#", "") || "orders";
  if (r !== "orders") return;
  try {
    await loadOrders();
    renderOrdersPage();
  } catch {}
}, 12000);