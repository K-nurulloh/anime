import {
  db,
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "./firebase.js";

const app = document.querySelector("#app");

const money = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0";
  return x.toLocaleString("uz-UZ");
};

const formatDate = (value) => {
  if (!value) return "-";
  const dateValue = value?.toDate ? value.toDate() : value;
  try {
    return new Date(dateValue).toLocaleString("uz-UZ");
  } catch {
    return "-";
  }
};

async function getOrderByAnyId(orderId) {
  // 1) docId sifatida tekshir
  const direct = await getDoc(doc(db, "orders", orderId));
  if (direct.exists()) return { docId: direct.id, ...direct.data() };

  // 2) eski orderlar uchun data.id bo‘yicha qidir
  const q = query(collection(db, "orders"), where("id", "==", orderId));
  const qs = await getDocs(q);
  if (!qs.empty) {
    const d = qs.docs[0];
    return { docId: d.id, ...d.data() };
  }

  return null;
}

async function getProductsMap() {
  // agar sendagi order.items ichida title/img/price bo‘lmasa,
  // keyin mahsulotlarni productId bo‘yicha topish uchun kerak bo‘ladi.
  // Hozircha optional qilamiz.
  return new Map();
}

function renderItems(items = []) {
  if (!Array.isArray(items) || !items.length) return `<p>Mahsulotlar: -</p>`;

  const rows = items.map((it) => {
    const title = it.title || it.name || it.productTitle || it.productName || `Mahsulot (${it.id || it.productId || "-"})`;
    const img = it.img || it.image || it.photo || it.images?.[0] || "";
    const qty = Number(it.qty || 1);
    const price = Number(it.price || 0);
    const line = price * qty;

    return `
      <div style="display:flex;gap:12px;align-items:center;border:1px solid #eee;padding:10px;border-radius:10px;margin:8px 0;">
        <div style="width:70px;height:70px;flex:0 0 70px;border-radius:10px;overflow:hidden;background:#f3f3f3;">
          ${img ? `<img src="${img}" style="width:100%;height:100%;object-fit:cover;" />` : ""}
        </div>
        <div style="flex:1;">
          <div style="font-weight:700">${title}</div>
          <div style="margin-top:4px;color:#444">Narx: ${money(price)} so'm</div>
          <div style="margin-top:2px;color:#444">Soni: ${qty}</div>
          <div style="margin-top:2px;font-weight:700">Jami: ${money(line)} so'm</div>
        </div>
      </div>
    `;
  });

  return `
    <h3>Mahsulotlar</h3>
    ${rows.join("")}
  `;
}

async function main() {
  const params = new URLSearchParams(location.search);
  const id = params.get("id");

  if (!id) {
    app.innerHTML = `<h2>Topilmadi</h2><p>Order ID yo‘q</p>`;
    return;
  }

  app.innerHTML = "Yuklanmoqda...";

  const order = await getOrderByAnyId(id);

  if (!order) {
    app.innerHTML = `<h2>Topilmadi</h2><p>Order: ${id}</p>`;
    return;
  }

  const userName = order.userName || "—";
  const userPhone = order.userPhone || "—";

  const region = order.address?.region || "—";
  const district = order.address?.district || "—";
  const homeAddress = order.address?.homeAddress || "—";

  const total = Number(order.total || 0);

  app.innerHTML = `
    <h2>Buyurtma</h2>
    <p><b>ID:</b> ${order.id || id}</p>
    <p><b>Status:</b> ${order.status || "-"}</p>
    <p><b>Sana:</b> ${formatDate(order.createdAt || order.date)}</p>
    <p><b>Jami:</b> ${money(total)} so'm</p>
    <p><b>Foydalanuvchi:</b> ${userName} (${userPhone})</p>
    <p><b>Manzil:</b> ${region}, ${district}, ${homeAddress}</p>

    ${renderItems(order.items)}

    <h3 style="margin-top:18px;">Raw JSON</h3>
    <pre style="background:#111;color:#0f0;padding:12px;border-radius:8px;overflow:auto;">
${JSON.stringify(order, null, 2)}
    </pre>
  `;
}

main().catch((e) => {
  console.error(e);
  app.innerHTML = `<h2>Xatolik</h2><p>${String(e?.message || e)}</p>`;
});