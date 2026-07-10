const nodemailer = require('nodemailer');

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function sendTelegram(text) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text })
    });
    if (!res.ok) console.error('[notify] Telegram API tra ve loi:', await res.text());
  } catch (err) {
    console.error('[notify] Gui Telegram that bai:', err.message);
  }
}

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  return transporter;
}

async function sendEmail(subject, html) {
  const t = getTransporter();
  if (!t) return;
  try {
    await t.sendMail({
      from: `"Tân Hưng Lợi - Đơn hàng" <${process.env.SMTP_USER}>`,
      to: process.env.NOTIFY_EMAIL || process.env.SMTP_USER,
      subject,
      html
    });
  } catch (err) {
    console.error('[notify] Gui email that bai:', err.message);
  }
}

// Gọi sau khi tạo đơn hàng thành công. Không throw lỗi ra ngoài - nếu gửi
// thông báo thất bại (chưa cấu hình, hoặc lỗi mạng) thì đơn hàng vẫn được
// tạo bình thường, chỉ ghi log lỗi ở server.
async function notifyNewOrder(order, items) {
  const total = Number(order.total).toLocaleString('vi-VN') + ' đ';
  const itemsText = items.map((it) => `- ${it.name} x${it.qty}`).join('\n');
  const itemsHtml = items.map((it) => `<li>${escapeHtml(it.name)} x${it.qty}</li>`).join('');

  const telegramText =
    `🔔 Đơn hàng mới #${order.id}\n` +
    `Khách: ${order.customer_name}\n` +
    `SĐT: ${order.phone}\n` +
    `Địa chỉ: ${order.address}\n` +
    `Sản phẩm:\n${itemsText}\n` +
    `Tổng: ${total}`;

  const emailHtml =
    `<h3>Đơn hàng mới #${order.id}</h3>` +
    `<p><b>Khách:</b> ${escapeHtml(order.customer_name)}<br/>` +
    `<b>SĐT:</b> ${escapeHtml(order.phone)}<br/>` +
    `<b>Địa chỉ:</b> ${escapeHtml(order.address)}</p>` +
    `<p><b>Sản phẩm:</b></p><ul>${itemsHtml}</ul>` +
    `<p><b>Tổng:</b> ${total}</p>`;

  await Promise.all([sendTelegram(telegramText), sendEmail(`Đơn hàng mới #${order.id} - ${total}`, emailHtml)]);
}

module.exports = { notifyNewOrder };
