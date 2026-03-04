import {
  db,
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
} from "./firebase.js";

const app = document.getElementById("app");

const esc = (s) =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const toDateObj = (value) => {
  if (!value) return null;
  if (value?.toDate) return value.toDate(); // Firestore Timestamp
  if (typeof value === "string") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  if (value instanceof Date) return value;
  return null;
};

const fmtDateTime = (value) => {
  const d = toDateObj(value);
  if (!d) return "—";
  return d.toLocaleString("uz-UZ");
};

const getParam = (name) => {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
};

async function findOrderSmart(id) {
  if (!id) return { order: null, docId: null };

  // 1) docId sifatida urinamiz
  try {
    const snap = await getDoc(doc(db, "orders", id));
    if (snap.exists()) {
      return { order: { ...snap.data(), docId: snap.id }, docId: snap.id };
    }
  } catch (e) {
    console.warn("getDoc failed:", e);
  }

  // 2) field: id == ...
  try {
    const q1 = query(
      collection(db, "orders"),
      where("id", "==", id),
      limit(1)
    );
    const s1 = await getDocs(q1);
    if (!s1.empty) {
      const d = s1.docs[0];
      return { order: { ...d.data(), docId: d.id }, docId: d.id };
    }
  } catch (e) {
    console.warn("where(id==) failed:", e);
  }

  // 3) legacy: docId ichida saqlangan bo‘lishi mumkin
  try {
    const q2 = query(
      collection(db, "orders"),
      where("docId", "==", id),
      limit(1)
    );
    const s2 = await getDocs(q2);
    if (!s2.empty) {
      const d = s2.docs[0];
      return { order: { ...d.data(), docId: d.id }, docId: d.id };
    }
  } catch (e) {
    console.warn("where(docId==) failed:", e);
  }

  return { order: null, docId: null };
}

function render(order, requestedId) {
  if (!order) {
    app.innerHTML = `
      <div style="padding:16px;max-width:900px;margin:0 auto;font-family:system-ui;">
        <h1>Buyurtma</h1>
        <div style="margin-top:12px;padding:14px;border:1px solid #fca5a5;background:#fff1f2;border-radius:12px;">
          <b>Xatolik:</b> Buyurtma topilmadi.<br/>
          ID: <code>${esc(requestedId)}</code>
        </div>
      </div>
    `;
    return;
  }

  const status = order.status || "—";
  const created =
    order.createdAt ||
    order.date ||
    order.updatedAt ||
    order.reviewedAt ||
    null;

  const total = Number(order.total ?? 0);
  const userName = order.userName || order.user?.name || "—";
  const userPhone = order.userPhone || order.user?.phone || "—";

  const addr = order.address || {};
  const region = addr.region || order.region || "—";
  const district = addr.district || order.district || "—";
  const homeAddress = addr.homeAddress || order.addressLine || order.address || "—";

  const delivery = order.delivery?.label || order.deliveryType || "—";
  const payment = order.payment || "—";
  const receipt = order.receiptUrl || order.receipt?.url || order.receiptBase64 || "";

  const items = Array.isArray(order.items) ? order.items : [];

  const missingImportant =
    !order.userName && !order.userPhone && !items.length && !addr?.region && !order.total;

  const warnHtml = missingImportant
    ? `
    <div style="margin:12px 0;padding:14px;border:1px solid #fca5a5;background:#fff1f2;border-radius:12px;">
      <b>Diqqat:</b> Bu order Firestore’da to‘liq saqlanmagan (faqat status yozilgan bo‘lishi mumkin). 
      Shuning uchun foydalanuvchi/manzil/mahsulotlar ko‘rinmaydi.<br/><br/>
      <b>Yechim:</b> admin panel Firestore’dagi <b>ord_...</b> docId bilan update qilishi kerak (pastda admin.js fix bor).
    </div>`
    : "";

  app.innerHTML = `
    <div style="padding:16px;max-width:900px;margin:0 auto;font-family:system-ui;">
      <h1>Buyurtma</h1>

      ${warnHtml}

      <p><b>ID:</b> ${esc(order.id || requestedId || "—")}</p>
      <p><b>docId:</b> ${esc(order.docId || "—")}</p>
      <p><b>Status:</b> ${esc(status)}</p>
      <p><b>Sana:</b> ${esc(fmtDateTime(created))}</p>
      <p><b>Jami:</b> ${esc(total.toLocaleString("uz-UZ"))} so'm</p>
      <p><b>Foydalanuvchi:</b> ${esc(userName)} (${esc(userPhone)})</p>
      <p><b>Manzil:</b> ${esc(region)}, ${esc(district)}, ${esc(homeAddress)}</p>
      <p><b>Yetkazish:</b> ${esc(delivery)}</p>
      <p><b>To'lov:</b> ${esc(payment)}</p>
      <p><b>Chek:</b> ${
        receipt
          ? `<a href="${esc(receipt)}" target="_blank" rel="noreferrer">Chekni ko‘rish</a>`
          : "—"
      }</p>

      <h2>Mahsulotlar</h2>
      ${
        items.length
          ? `<ul>${items
              .map((it) => {
                const title = it.title || it.name || it.productTitle || `Product #${it.id ?? "?"}`;
                const qty = Number(it.qty || 1);
                return `<li>${esc(title)} — <b>${qty}x</b></li>`;
              })
              .join("")}</ul>`
          : `<p>—</p>`
      }

      <h2>Raw JSON</h2>
      <pre style="background:#0b1220;color:#a7f3d0;padding:14px;border-radius:12px;overflow:auto;">${esc(
        JSON.stringify(order, null, 2)
      )}</pre>
    </div>
  `;
}

(async function init() {
  const requestedId = getParam("id");
  app.textContent = "Yuklanmoqda...";
  const { order } = await findOrderSmart(requestedId);
  render(order, requestedId);
})();   