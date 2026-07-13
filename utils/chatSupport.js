const { run, get, all } = require('../db');
const { sendTelegramAndGetMessageId } = require('./notify');

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Chatbot không chắc chắn trả lời được (hoặc gọi Gemini bị lỗi) -> lưu câu
// hỏi lại và báo cho chủ shop qua Telegram để trả lời trực tiếp.
async function escalateToHuman(sessionId, question) {
  const inserted = await get(
    `INSERT INTO chat_escalations (session_id, question) VALUES (?, ?) RETURNING id`,
    [sessionId, question]
  );
  const escalationId = inserted.id;

  const text =
    `❓ Khách hỏi (bot chưa trả lời chắc chắn được):\n"${question}"\n\n` +
    `👉 Trả lời bằng cách REPLY (trả lời) trực tiếp tin nhắn này trên Telegram - hệ thống sẽ tự gửi câu trả lời cho khách và ghi nhớ luôn cho lần sau.\n` +
    `Mã: #${escalationId}`;
  const messageId = await sendTelegramAndGetMessageId(text);
  if (messageId) {
    await run('UPDATE chat_escalations SET telegram_message_id = ? WHERE id = ?', [messageId, escalationId]);
  }

  return escalationId;
}

async function getEscalationStatus(id) {
  const row = await get('SELECT status, admin_reply FROM chat_escalations WHERE id = ?', [id]);
  if (!row) return { replied: false, answer: null };
  return { replied: row.status === 'da_tra_loi', answer: row.admin_reply || null };
}

// Các câu chủ shop đã tự tay trả lời qua Telegram trước đây - nạp lại vào
// system prompt của Gemini để những lần chat sau bot tự trả lời được ngay,
// khỏi phải chuyển người thật lại từ đầu.
async function getRecentLearnedQA(limit = 30) {
  return all(
    `SELECT question, admin_reply FROM chat_escalations
     WHERE status = 'da_tra_loi' AND admin_reply IS NOT NULL
     ORDER BY created_at DESC LIMIT ?`,
    [limit]
  );
}

let pollOffset = 0;
let pollingStarted = false;

// Chủ shop trả lời bằng cách Reply (trả lời) đúng tin nhắn câu hỏi trên
// Telegram - khớp reply_to_message.message_id với telegram_message_id đã
// lưu lúc escalate. Chỉ chấp nhận tin nhắn từ đúng TELEGRAM_CHAT_ID (chủ
// shop) để tránh người lạ nhắn thẳng cho bot giả mạo câu trả lời.
async function handleUpdate(update) {
  const message = update.message;
  if (!message || !message.text) return;
  if (String(message.chat.id) !== String(TELEGRAM_CHAT_ID)) return;

  if (!message.reply_to_message) {
    // Luôn yêu cầu Reply đúng tin nhắn câu hỏi - không đoán, tránh gửi
    // nhầm câu trả lời cho khách khác khi có nhiều câu hỏi chờ cùng lúc.
    await sendTelegramAndGetMessageId(
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
  await sendTelegramAndGetMessageId(`✅ Đã gửi câu trả lời này cho khách (mã #${row.id}).`);
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
      '[chatSupport] Chua cau hinh TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID - tinh nang chuyen cau hoi chatbot cho nguoi that qua Telegram se khong hoat dong.'
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
  getEscalationStatus,
  getRecentLearnedQA,
  startTelegramPolling,
  handleUpdate
};
