import { initializeApp } from 'firebase-admin/app';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';

initializeApp();

// Set this to your deployed site URL (example: https://your-project.web.app)
const YOUR_SITE_URL = '<YOUR_SITE_URL>';

const botToken = defineSecret('TELEGRAM_BOT_TOKEN');
const chatId = defineSecret('TELEGRAM_CHAT_ID');

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const getItemsCount = (order) => {
  const items = Array.isArray(order?.items) ? order.items : [];
  return items.reduce((sum, item) => sum + (toNumber(item?.qty) || 1), 0);
};

const getShipping = (order) =>
  order?.delivery?.label || order?.deliveryType || order?.shipping || '—';

const getAddress = (order) => {
  const region = order?.address?.region || order?.region || '—';
  const district = order?.address?.district || order?.district || '—';
  const homeAddress = order?.address?.homeAddress || order?.address || '—';
  return { region, district, homeAddress };
};

const buildBaseMessage = ({ title, orderId, order }) => {
  const { region, district, homeAddress } = getAddress(order);
  const itemsCount = getItemsCount(order);
  const total = toNumber(order?.total || order?.subtotal || order?.totalProductsSum);
  const receiptUrl = order?.receiptUrl || order?.receipt?.url || '';
  const adminOrderUrl = `${YOUR_SITE_URL}/orders.html?orderId=${encodeURIComponent(orderId)}`;

  return [
    `<b>${esc(title)}</b>`,
    '',
    `<b>Buyurtma ID:</b> <code>${esc(orderId)}</code>`,
    `<b>Xaridor:</b> ${esc(order?.userName || order?.user?.name || '—')}`,
    `<b>Telefon:</b> ${esc(order?.userPhone || order?.user?.phone || '—')}`,
    `<b>Jami:</b> ${esc(total.toLocaleString('uz-UZ'))} so'm`,
    `<b>To'lov:</b> ${esc(order?.payment || order?.paymentMethod || '—')}`,
    `<b>Yetkazish:</b> ${esc(getShipping(order))}`,
    `<b>Manzil:</b> ${esc(region)}, ${esc(district)}, ${esc(homeAddress)}`,
    `<b>Mahsulotlar soni:</b> ${esc(itemsCount)}`,
    `<b>Status:</b> ${esc(order?.status || '—')}`,
    receiptUrl ? `<b>Chek:</b> ${esc(receiptUrl)}` : '<b>Chek:</b> —',
    '',
    `<a href="${esc(adminOrderUrl)}">Admin panelda ochish</a>`,
  ].join('\n');
};

const notifyTelegram = async (text, token, chat) => {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chat,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram API xatolik: ${res.status} ${body}`);
  }
};

export const notifyOrderCreated = onDocumentCreated(
  {
    document: 'orders/{orderId}',
    secrets: [botToken, chatId],
  },
  async (event) => {
    const orderId = event.params.orderId;
    const order = event.data?.data();
    if (!order) return;

    const message = buildBaseMessage({
      title: '🆕 Yangi buyurtma',
      orderId,
      order,
    });

    try {
      await notifyTelegram(message, botToken.value(), chatId.value());
    } catch (error) {
      logger.error('Yangi buyurtma xabari yuborilmadi', { orderId, error: String(error) });
      throw error;
    }
  }
);

export const notifyOrderStatusUpdated = onDocumentUpdated(
  {
    document: 'orders/{orderId}',
    secrets: [botToken, chatId],
  },
  async (event) => {
    const orderId = event.params.orderId;
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    const oldStatus = String(before.status || '');
    const newStatus = String(after.status || '');

    // Avoid duplicate spam: notify only when status actually changes
    if (oldStatus === newStatus) return;
    if (!['approved', 'rejected'].includes(newStatus)) return;

    const base = buildBaseMessage({
      title: '📦 Buyurtma statusi yangilandi',
      orderId,
      order: after,
    });

    const statusLine = `<b>Status:</b> ${esc(oldStatus || '—')} ➜ ${esc(newStatus)}`;
    const rejectReason =
      newStatus === 'rejected' && after.rejectReason
        ? `\n<b>Rad etish sababi:</b> ${esc(after.rejectReason)}`
        : '';

    const message = `${base}\n${statusLine}${rejectReason}`;

    try {
      await notifyTelegram(message, botToken.value(), chatId.value());
    } catch (error) {
      logger.error('Status yangilanish xabari yuborilmadi', {
        orderId,
        oldStatus,
        newStatus,
        error: String(error),
      });
      throw error;
    }
  }
);
