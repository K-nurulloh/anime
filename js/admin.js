// js/admin.js
import {
  db,
  nowTs,
  collection,
  doc,
  getDocs,
  query,
  orderBy,
  limit,
  updateDoc,
} from "./firebase.js";

/**
 * ADMIN PANEL FIX:
 * - products.json 404 -> olib tashlandi (admin Firestore'dan ishlaydi)
 * - Firestore query index muammo -> orderBy(createdAt) + limit -> client filter
 * - Telegram CORS muammo -> faqat /api/telegram ga yuboramiz
 * - Card ichidan "Buyurtmani ko'rish" tugmasi olib tashlandi (faqat admin ichida ko'rinadi)
 */

const $ = (sel, root = document) => root.querySelector(sel);

const esc = (s) =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const toDateText = (ts) => {
  try {
    if (!ts) return "—";
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("uz-UZ");
  } catch {
    return "—";
  }
};

const formatPrice = (n) => {
  const num = Number(n || 0);
  return num.toLocaleString("uz-UZ");
};

const statusMeta = (status) => {
  const s = String(status || "pending");
  if (s === "approved" || s === "accepted")
    return { text: "Qabul qilindi", cls: "bg-emerald-500/15 text-emerald-200 border-emerald-400/30" };
  if (s === "rejected")
    return { text: "Rad etildi", cls: "bg-rose-500/15 text-rose-200 border-rose-400/30" };
  if (s === "pending_verification" || s === "pending")
    return { text: "Ko‘rib chiqilyapti", cls: "bg-amber-500/15 text-amber-200 border-amber-400/30" };
  return { text: s, cls: "bg-white/10 text-white/80 border-white/15" };
};

const getOrderDocId = (order) => {
  // YANGI FORMAT: id = ord_.... va docId ham shunga teng
  // ESKI FORMAT: id = o-.... va docId = o-....
  // Ba'zan docId yo'q bo'ladi -> id ni ishlatamiz
  return String(order?.docId || order?.id || "");
};

const buildPublicOrderLink = (order) => {
  // Telegramdan ochiladigan sahifa
  // SEN aytgandek: search.html emas, searc.html ochilsin
  const id = String(order?.id || "");
  const base = window.location.origin; // vercel domeni
  return `${base}/searc.html?id=${encodeURIComponent(id)}`;
};

/** ====== DOM BOOTSTRAP ====== */
function ensureLayout() {
  // admin.html ichida aniq id'lar bo'lmasa ham ishlashi uchun
  let root = $("#admin-root") || $("main") || document.body;

  let wrap = $("#adminPanel");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "adminPanel";
    wrap.className = "mx-auto max-w-6xl space-y-6 p-4";
    root.appendChild(wrap);
  }

  // Pending section
  let pendingBox = $("#pendingBox");
  if (!pendingBox) {
    pendingBox = document.createElement("section");
    pendingBox.id = "pendingBox";
    pendingBox.className = "space-y-3";
    pendingBox.innerHTML = `
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-semibold text-white">Tekshiruvdagi buyurtmalar</h2>
        <button id="refreshBtn" class="rounded-xl border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80 hover:bg-white/10">
          Yangilash
        </button>
      </div>
      <div id="pendingList" class="space-y-4"></div>
      <div id="pendingEmpty" class="hidden rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
        Tekshiruvda buyurtma yo‘q.
      </div>
    `;
    wrap.appendChild(pendingBox);
  }

  // Modal
  let modal = $("#receipt-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "receipt-modal";
    modal.className = "fixed inset-0 hidden items-center justify-center bg-black/60 p-4";
    modal.innerHTML = `
      <div class="w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-950 p-4">
        <div class="flex items-center justify-between">
          <h3 class="text-white font-semibold">Chek</h3>
          <button id="receipt-close" class="text-white/70 hover:text-white">✕</button>
        </div>
        <div class="mt-3">
          <img id="receipt-img" src="" alt="receipt" class="w-full rounded-xl border border-white/10 bg-white/5 object-contain" />
          <a id="receipt-open" href="#" target="_blank" rel="noreferrer"
             class="mt-3 inline-flex rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/80 hover:bg-white/10">
            Yangi oynada ochish
          </a>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // tab route: #payments bo'lsa
  // (admin.html da payment bo'lim bo'lsa ham bo'lmasa ham zarar qilmaydi)
}

ensureLayout();

const pendingList = $("#pendingList");
const pendingEmpty = $("#pendingEmpty");
const refreshBtn = $("#refreshBtn");

const receiptModal = $("#receipt-modal");
const receiptImg = $("#receipt-img");
const receiptOpen = $("#receipt-open");
const receiptClose = $("#receipt-close");

/** ====== RECEIPT MODAL ====== */
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

/** ====== TELEGRAM (Vercel API) ====== */
async function sendTelegram(text) {
  // Faqat shu endpoint -> CORS yo'q
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

/** ====== FIRESTORE ====== */
async function fetchRecentOrders() {
  // Index muammo bo'lmasligi uchun: faqat createdAt bo'yicha olamiz, keyin filter
  const snap = await getDocs(query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(100)));
  return snap.docs.map((d) => ({ docId: d.id, ...d.data() }));
}

async function setOrderStatus(order, status, extra = {}) {
  const docId = getOrderDocId(order);
  if (!docId) throw new Error("docId topilmadi");

  await updateDoc(doc(db, "orders", docId), {
    status,
    updatedAt: nowTs(),
    ...extra,
  });
}

/** ====== RENDER ====== */
function orderCardHTML(order) {
  const id = String(order?.id || order?.docId || "");
  const docId = String(order?.docId || "");
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
          ${docId && docId !== id ? `<div class="mt-1 text-[11px] text-white/40">docId: ${esc(docId)}</div>` : ""}
        </div>

        <span class="shrink-0 rounded-full border px-3 py-1 text-xs ${st.cls}">
          ${esc(st.text)}
        </span>
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
          <div class="font-medium text-white/90">${esc(addrText)}</div>
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

      <!-- "Buyurtmani ko'rish" tugmasi carddan olib tashlandi (sening talabing) -->
    </div>
  `;
}

function renderPending(list) {
  if (!pendingList) return;
  if (!list.length) {
    pendingList.innerHTML = "";
    pendingEmpty?.classList.remove("hidden");
    return;
  }
  pendingEmpty?.classList.add("hidden");
  pendingList.innerHTML = list.map(orderCardHTML).join("");
}

/** ====== ACTIONS ====== */
async function approveOrder(order) {
  await setOrderStatus(order, "approved", { reviewedAt: nowTs(), rejectReason: null });

  // Telegram message
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

/** ====== LOAD LOOP ====== */
let __orders = [];
async function load() {
  try {
    const all = await fetchRecentOrders();

    // faqat tekshiruvdagilar (indexsiz client filter)
    const pending = all.filter((o) => {
      const s = String(o?.status || "pending");
      return s === "pending" || s === "pending_verification";
    });

    __orders = all;
    renderPending(pending);
  } catch (e) {
    console.error("Admin load error:", e);
    if (pendingList) {
      pendingList.innerHTML = `
        <div class="rounded-2xl border border-rose-300/20 bg-rose-500/10 p-4 text-sm text-rose-100">
          Xatolik: ${esc(e?.message || e)}
          <div class="mt-2 text-xs text-rose-100/80">
            Eslatma: Vercel env tokenlar qo'shilganini va /api/telegram mavjudligini tekshir.
          </div>
        </div>
      `;
    }
  }
}

refreshBtn?.addEventListener("click", load);

pendingList?.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  if (action === "receipt") {
    openReceipt(btn.dataset.url);
    return;
  }

  // order topish: id orqali
  const id = btn.dataset.id;
  const order = __orders.find((o) => String(o.id || o.docId) === String(id));
  if (!order) return alert("Order topilmadi");

  btn.disabled = true;

  try {
    if (action === "approve") {
      await approveOrder(order);
      await load();
      alert("✅ Qabul qilindi + Telegramga yuborildi");
    } else if (action === "reject") {
      await rejectOrder(order);
      await load();
      alert("❌ Rad qilindi + Telegramga yuborildi");
    }
  } catch (err) {
    console.error(err);
    alert("Xatolik: " + (err?.message || err));
  } finally {
    btn.disabled = false;
  }
});

// Auto refresh (har 10 sekund)
load();
setInterval(load, 10000);