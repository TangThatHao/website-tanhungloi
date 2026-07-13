const { run, get, all } = require('../db');

// Bot Telegram RIÊNG cho câu hỏi khó của chatbot, tách khỏi bot báo đơn hàng
// (utils/notify.js) - tin báo đơn hàng nhiều dễ làm trôi mất câu hỏi khách.
const TELEGRAM_TOKEN = process.env.CHAT_TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.CHAT_TELEGRAM_CHAT_ID;

async function sendChatTelegram(text, replyToMessageId) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) return null;
  try {
    const body = { chat_id: TELEGRAM_CHAT_ID, text };
    if (replyToMessageId) body.reply_to_message_id = replyToMessageId;
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      console.error('[chatSupport] Telegram API tra ve loi:', await res.text());
      return null;
    }
    const data = await res.json();
    return data?.result?.message_id ?? null;
  } catch (err) {
    console.error('[chatSupport] Gui Telegram that bai:', err.message);
    return null;
  }
}

// Chatbot không chắc chắn trả lời được (hoặc gọi Gemini bị lỗi) -> lưu câu
// hỏi lại và báo cho chủ shop qua Telegram để trả lời trực tiếp. Kèm thông
// tin khách (nếu đã đăng nhập) để chủ có thể gọi điện thẳng nếu cần gấp,
// không nhất thiết phải trả lời qua Telegram.
async function escalateToHuman(sessionId, question, customer) {
  const inserted = await get(
    'INSERT INTO chat_escalations (session_id, question, customer_name, customer_phone) VALUES (?, ?, ?, ?) RETURNING id',
    [sessionId, question, customer?.name || null, customer?.phone || null]
  );
  const escalationId = inserted.id;

  const customerLine = customer
    ? `👤 Khách: ${customer.name || '(chưa có tên)'} - ${customer.phone || 'chưa có SĐT'} (đã đăng nhập)`
    : '👤 Khách: ẩn danh (chưa để lại SĐT)';

  const text =
    `❓ Khách hỏi (bot chưa trả lời chắc chắn được):\n"${question}"\n\n${customerLine}\n\n` +
    '👉 Trả lời bằng cách bấm giữ/vuốt vào tin nhắn này rồi chọn "Trả lời" (Reply) - hệ thống sẽ tự gửi câu trả lời cho khách.\n' +
    `Mã: #${escalationId}`;

  const messageId = await sendChatTelegram(text);
  if (messageId) {
    await run('UPDATE chat_escalations SET telegram_message_id = ? WHERE id = ?', [messageId, escalationId]);
  }

  return escalationId;
}

// Khách ẩn danh để lại SĐT sau khi câu hỏi đã được chuyển - báo thêm 1 tin
// Telegram (reply vào đúng câu hỏi gốc nếu có) để chủ tiện gọi ngay nếu gấp.
async function recordCustomerPhone(escalationId, phone) {
  const row = await get('SELECT telegram_message_id FROM chat_escalations WHERE id = ?', [escalationId]);
  if (!row) return false;
  await run('UPDATE chat_escalations SET customer_phone = ? WHERE id = ?', [phone, escalationId]);
  await sendChatTelegram(
    `📞 Khách vừa để lại SĐT cho câu hỏi #${escalationId}: ${phone} - bạn có thể gọi trực tiếp nếu cần gấp, không cần trả lời tin nhắn.`,
    row.telegram_message_id || undefined
  );
  return true;
}

async function getEscalationStatus(id) {
  const row = await get('SELECT status, admin_reply FROM chat_escalations WHERE id = ?', [id]);
  if (!row) return { replied: false, answer: null };
  return { replied: row.status === 'da_tra_loi', answer: row.admin_reply || null };
}

// Chỉ những câu chủ đã DUYỆT/gõ trong trang quản trị (/admin/chatbot-cau-hoi,
// cột curated_answer) mới được nạp vào system prompt cho bot "học" - câu trả
// lời nhanh qua Telegram (admin_reply) chỉ gửi riêng cho đúng khách đó,
// không tự động trở thành kiến thức chung cho mọi khách sau này.
async function getRecentLearnedQA(limit = 30) {
  return all(
    `SELECT question, curated_answer FROM chat_escalations
     WHERE curated_answer IS NOT NULL AND curated_answer != ''
     ORDER BY created_at DESC LIMIT ?`,
    [limit]
  );
}

let pollOffset = 0;
let pollingStarted = false;

// Chủ shop trả lời bằng cách Reply (trả lời) đúng tin nhắn câu hỏi trên
// Telegram - khớp reply_to_message.message_id với telegram_message_id đã
// lưu lúc escalate. Chỉ chấp nhận tin nhắn từ đúng CHAT_TELEGRAM_CHAT_ID
// (chủ shop) để tránh người lạ nhắn thẳng cho bot giả mạo câu trả lời. Luôn
// yêu cầu Reply, không đoán câu đang chờ - tránh gửi nhầm câu trả lời cho
// khách khác khi có nhiều câu hỏi chờ cùng lúc.
async function handleUpdate(update) {
  const message = update.message;
  if (!message || !message.text) return;
  if (String(message.chat.id) !== String(TELEGRAM_CHAT_ID)) return;

  if (!message.reply_to_message) {
    await sendChatTelegram(
      'ℹ️ Vui lòng bấm giữ/vuốt vào đúng tin nhắn câu hỏi rồi chọn "Trả lời" (Reply) để gửi câu trả lời nhé, không gõ trả lời thường.'
    );
    return;
  }

  const row = await get(
    "SELECT id FROM chat_escalations WHERE telegram_message_id = ? AND status = 'cho_tra_loi'",
    [message.reply_to_message.message_id]
  );
  if (!row) return;

  await run(
    "UPDATE chat_escalations SET admin_reply = ?, status = 'da_tra_loi', replied_at = CURRENT_TIMESTAMP WHERE id = ?",
    [message.text, row.id]
  );
  await sendChatTelegram(`✅ Đã gửi câu trả lời này cho khách (mã #${row.id}).`);
}

async function pollOnce() {
  const res = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?offset=${pollOffset}&timeout=0`
  );
  if (!res.ok) {
    console.error('[chatSupport] getUpdates tra ve loi:', await res.text());
    return;
  }
  const data = await res.json();
  const updates = data.result || [];
  for (const update of updates) {
    pollOffset = update.update_id + 1;
    await handleUpdate(update);
  }
}

// Dùng long-polling (getUpdates) thay vì webhook - không cần biết public
// URL của server, chạy được cả ở local dev, không cần thêm hạ tầng.
function startTelegramPolling() {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn(
      '[chatSupport] Chua cau hinh CHAT_TELEGRAM_BOT_TOKEN/CHAT_TELEGRAM_CHAT_ID - tinh nang chuyen cau hoi chatbot cho nguoi that qua Telegram se khong hoat dong.'
    );
    return;
  }
  if (pollingStarted) return;
  pollingStarted = true;
  const timer = setInterval(() => {
    pollOnce().catch((err) => console.error('[chatSupport] Loi polling Telegram:', err.message));
  }, 4000);
  timer.unref();
}

module.exports = {
  escalateToHuman,
  recordCustomerPhone,
  getEscalationStatus,
  getRecentLearnedQA,
  startTelegramPolling,
  handleUpdate
};
