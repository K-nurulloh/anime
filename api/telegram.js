// api/telegram.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  try {
    const { text, chat_id } = req.body || {};
    if (!text) return res.status(400).json({ ok: false, error: "text required" });

    const token = process.env.TG_BOT_TOKEN;
    const defaultChatId = process.env.TG_CHAT_ID;

    if (!token) return res.status(500).json({ ok: false, error: "TG_BOT_TOKEN missing" });
    const finalChatId = chat_id || defaultChatId;
    if (!finalChatId) return res.status(500).json({ ok: false, error: "TG_CHAT_ID missing" });

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const tgRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: finalChatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    const data = await tgRes.json().catch(() => ({}));
    if (!tgRes.ok || !data.ok) {
      return res.status(500).json({ ok: false, error: data?.description || "Telegram error", data });
    }

    return res.status(200).json({ ok: true, data });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}