// api/telegram.js
import * as functions from "firebase-functions";

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    // Firebase Functions params dan olish
    const token = functions.config().telegram?.bot_token;
    const chatId = functions.config().telegram?.chat_id;

    if (!token) return res.status(500).json({ ok: false, error: "TG_BOT_TOKEN missing" });
    if (!chatId) return res.status(500).json({ ok: false, error: "TG_CHAT_ID missing" });

    
    const { text } = req.body || {};
    if (!text) return res.status(400).json({ ok: false, error: "text required" });

    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    const tgRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: false,
      }),
    });

    const data = await tgRes.json().catch(() => ({}));

    if (!tgRes.ok || data?.ok === false) {
      return res.status(500).json({ ok: false, error: "Telegram error", details: data });
    }

    return res.status(200).json({ ok: true, result: data });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}