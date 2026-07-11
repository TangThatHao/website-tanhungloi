const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'khathohao0208@gmail.com';
const BREVO_SENDER_NAME = 'Tân Hưng Lợi';

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

// Gửi qua Brevo API (HTTPS) thay vì SMTP - Render free tier chặn SMTP
// (cổng 465 và 587 đều timeout) nhưng vẫn cho gọi HTTPS API bình thường.
// Trả về true/false để caller biết có gửi được không.
async function sendViaBrevo(toList, subject, html) {
  if (!BREVO_API_KEY) return false;
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'api-key': BREVO_API_KEY
      },
      body: JSON.stringify({
        sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
        to: toList.map((email) => ({ email })),
        subject,
        htmlContent: html
      })
    });
    if (!res.ok) {
      console.error('[notify] Brevo API tra ve loi:', await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('[notify] Gui email qua Brevo that bai:', err.message);
    return false;
  }
}

const ADMIN_RECOVERY_EMAILS = ['khathohao0208@gmail.com', 'tholan.kha@gmail.com'];

async function sendAdminPasswordReset(newPassword) {
  return sendViaBrevo(
    ADMIN_RECOVERY_EMAILS,
    'Mật khẩu admin mới - Tân Hưng Lợi',
    `<p>Mật khẩu đăng nhập trang quản trị vừa được đặt lại.</p><p><b>Mật khẩu mới:</b> ${escapeHtml(newPassword)}</p><p>Vui lòng đăng nhập và đổi lại mật khẩu khác nếu muốn.</p>`
  );
}

async function sendMemberPasswordReset(email, newPassword) {
  return sendViaBrevo(
    [email],
    'Mật khẩu mới cho tài khoản Tân Hưng Lợi',
    `<p>Mật khẩu đăng nhập tài khoản của bạn trên website Tân Hưng Lợi vừa được đặt lại.</p><p><b>Mật khẩu mới:</b> ${escapeHtml(newPassword)}</p><p>Vui lòng đăng nhập và đổi lại mật khẩu khác nếu muốn.</p>`
  );
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

  const notifyEmails = process.env.NOTIFY_EMAIL ? [process.env.NOTIFY_EMAIL] : ADMIN_RECOVERY_EMAILS;
  await Promise.all([
    sendTelegram(telegramText),
    sendViaBrevo(notifyEmails, `Đơn hàng mới #${order.id} - ${total}`, emailHtml)
  ]);
}

module.exports = { notifyNewOrder, sendAdminPasswordReset, sendMemberPasswordReset };
