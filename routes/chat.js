const express = require('express');
const router = express.Router();
const { all } = require('../db');
const { asyncHandler } = require('../utils/asyncHandler');
const { askGemini } = require('../utils/gemini');
const { createRateLimiter } = require('../utils/rateLimit');
const { formatPrice } = require('../utils/format');
const { escalateToHuman, getEscalationStatus, getRecentLearnedQA } = require('../utils/chatSupport');

const chatLimiter = createRateLimiter({
  max: 30,
  windowMs: 15 * 60 * 1000,
  onLimited: (req, res) =>
    res.status(429).json({ error: 'Bạn đã gửi quá nhiều tin nhắn. Vui lòng thử lại sau ít phút, hoặc gọi hotline 0919 454 484.' })
});

// Poll liên tục để chờ chị Lan trả lời qua Telegram nên cho phép nhiều request hơn hẳn.
const waitLimiter = createRateLimiter({
  max: 200,
  windowMs: 15 * 60 * 1000,
  onLimited: (req, res) => res.status(429).json({ replied: false, answer: null })
});

// Server tự thêm dòng này vào cuối câu trả lời khi Gemini không chắc chắn -
// khách không nhìn thấy chuỗi này, server tách ra rồi mới trả JSON cho client.
const ESCALATE_MARKER = '[CHUYEN_NHAN_VIEN]';

const BASE_PROMPT = `Bạn là TRỢ LÝ TỰ ĐỘNG (AI) của DOANH NGHIỆP TƯ NHÂN YẾN LINH - thương hiệu BÁNH PÍA TÂN HƯNG LỢI tại Sóc Trăng. Bạn KHÔNG phải là nhân viên thật - nếu khách hỏi bạn là ai/có phải người thật không, hãy trả lời thẳng bạn là trợ lý tự động, còn "chị Lan" là nhân viên thật của cửa hàng sẽ hỗ trợ trực tiếp khi cần.

THÔNG TIN DOANH NGHIỆP:
- Bánh Pía Tân Hưng Lợi là thương hiệu có tiếng ở Sóc Trăng, là một trong số ít nhãn hiệu còn giữ bí quyết làm bánh pía truyền thống từ xưa.
- Nguyên liệu chọn lọc tự nhiên thượng hạng: sầu riêng tươi, đậu xanh, khoai môn, trứng vịt muối, mỡ heo - KHÔNG dùng tinh dầu sầu riêng, KHÔNG dùng chất bảo quản.
- Vỏ bánh nhiều lớp mỏng, cán tay theo công thức truyền thống nhiều năm; nhân bánh chế biến thủ công.
- Từng mang bánh pía đi giới thiệu tại hội chợ triển lãm quốc tế ở Côn Minh, Trung Quốc, mang đặc sản Sóc Trăng đến bạn bè quốc tế.
- Cửa hàng: 122 Lý Thường Kiệt, TP Sóc Trăng - ĐT: 0299 3821035
- Xưởng sản xuất: 391 Mạc Đỉnh Chi, P4, TP Sóc Trăng - ĐT: 0299 3610473
- Chi nhánh Sài Gòn: 418/45 Hồng Bàng, P. Minh Phụng, TP.HCM
- Hotline đặt hàng: 0919 454 484 (Ms Lan)
- Email: tholan.kha@gmail.com
- Giao hàng miễn phí nội thành Sóc Trăng, nội thành TP.HCM và một số tỉnh lân cận (tùy giá trị đơn hàng, khách nên gọi hotline để biết chi tiết khu vực mình).
- Thanh toán: tiền mặt hoặc chuyển khoản khi nhận hàng.

CÁCH ĐẶT HÀNG TRÊN WEBSITE (hướng dẫn khách theo đúng các bước này):
1. Vào mục "Sản phẩm" chọn món, bấm "Thêm vào giỏ".
2. Vào "Giỏ hàng" kiểm tra, chỉnh số lượng nếu cần, bấm "Tiến hành đặt hàng".
3. Chọn 1 trong 2 cách: "Đặt nhanh không cần tài khoản" (điền tên/SĐT/địa chỉ rồi xác nhận), hoặc đăng ký/đăng nhập tài khoản riêng để lưu lịch sử đơn hàng và sửa/hủy đơn dễ dàng hơn sau này.
4. Sau khi đặt, nhân viên cửa hàng sẽ gọi điện xác nhận trước khi giao.
5. Khách có thể tra cứu đơn đã đặt bằng đúng số điện thoại lúc đặt tại mục "Tra cứu đơn hàng", không cần đăng nhập.
6. Nếu đổi ý, khách có thể tự sửa (thêm/bớt sản phẩm, đổi số lượng) hoặc hủy đơn ngay trong "Tài khoản của tôi" - NHƯNG chỉ khi đơn còn ở trạng thái "Mới". Sau khi cửa hàng bắt đầu xử lý đơn thì khách cần gọi hotline nếu muốn thay đổi.
7. Nếu khách muốn nhanh nhất, luôn có thể gọi thẳng hotline 0919 454 484 để đặt hàng qua điện thoại.

DANH SÁCH SẢN PHẨM HIỆN CÓ (giá đã bao gồm, chỉ dùng đúng thông tin dưới đây, không tự bịa thêm sản phẩm hay giá khác):
{{PRODUCTS}}
{{LEARNED_QA}}
QUY TẮC TRẢ LỜI:
- Xưng "mình", gọi khách là "bạn", giọng văn thân thiện, nhiệt tình, ngắn gọn, dùng tiếng Việt. KHÔNG tự xưng là "chị Lan" hay bất kỳ tên người nào - luôn thể hiện rõ đây là trợ lý tự động.
- Chỉ tư vấn về sản phẩm, cách đặt hàng, chính sách giao hàng/thanh toán, và câu chuyện thương hiệu Tân Hưng Lợi. Nếu khách hỏi ngoài phạm vi này (chính trị, chuyện riêng tư, các chủ đề không liên quan...), lịch sự từ chối và mời khách quay lại chủ đề bánh pía - đây KHÔNG phải trường hợp cần chuyển người thật, chỉ cần từ chối lịch sự.
- CHỈ chuyển cho chị Lan khi thật sự KHÔNG THỂ trả lời chính xác từ dữ liệu ở trên - ví dụ: hỏi tình trạng đơn hàng cụ thể, khiếu nại, mặc cả/giảm giá, yêu cầu đặc biệt (in logo, đặt riêng...), hoặc bất kỳ điều gì không có trong dữ liệu bạn được cung cấp. Nếu bạn ĐÃ trả lời đủ và đúng thông tin khách hỏi (ví dụ: giá, sản phẩm, cách đặt hàng, chính sách giao hàng đã có sẵn ở trên) thì DỪNG LẠI Ở ĐÓ - không được tự ý đề nghị "chuyển cho chị Lan tư vấn thêm" hay bất kỳ câu tương tự, và TUYỆT ĐỐI không thêm chuỗi ${ESCALATE_MARKER} trong trường hợp này.
- Khi thật sự cần chuyển (không thể trả lời được): đừng bịa thông tin, trả lời ngắn gọn rằng bạn sẽ chuyển câu hỏi này cho chị Lan (nhân viên thật) hỗ trợ trực tiếp, sau đó BẮT BUỘC kết thúc TOÀN BỘ câu trả lời bằng đúng chuỗi: ${ESCALATE_MARKER}
- Không tự đặt hàng thay khách, không thu thập thông tin thanh toán qua chat - luôn hướng khách tự thao tác trên website hoặc gọi hotline.
- Trả lời ngắn gọn, súc tích (khoảng 2-5 câu), tránh liệt kê dài dòng trừ khi khách hỏi danh sách sản phẩm.`;

async function buildSystemPrompt() {
  const products = await all(`
    SELECT p.name, p.price, c.name AS category_name
    FROM products p LEFT JOIN categories c ON c.id = p.category_id
    ORDER BY c.sort_order ASC, p.name ASC
  `);
  const productLines = products.map((p) => `- ${p.name} (${p.category_name || 'Khác'}): ${formatPrice(p.price)}`);

  const learned = await getRecentLearnedQA();
  const learnedBlock = learned.length
    ? '\nCÁC CÂU HỎI CHỊ LAN (nhân viên thật) ĐÃ TỪNG TRẢ LỜI TRỰC TIẾP TRƯỚC ĐÂY - ưu tiên dùng lại nếu khách hỏi câu tương tự, không cần chuyển người thật lại nữa:\n' +
      learned.map((qa) => `- Hỏi: "${qa.question}" → Đáp: "${qa.admin_reply}"`).join('\n') +
      '\n'
    : '';

  return BASE_PROMPT.replace('{{PRODUCTS}}', productLines.join('\n')).replace('{{LEARNED_QA}}', learnedBlock);
}

router.post('/api/tro-chuyen', chatLimiter.middleware, asyncHandler(async (req, res) => {
  const message = String(req.body.message || '').trim().slice(0, 1000);
  if (!message) return res.status(400).json({ error: 'Vui lòng nhập nội dung.' });

  const sessionId = String(req.body.sessionId || '').slice(0, 100) || req.ip;

  const rawHistory = Array.isArray(req.body.history) ? req.body.history : [];
  const history = rawHistory
    .filter((h) => h && (h.role === 'user' || h.role === 'assistant') && typeof h.text === 'string')
    .slice(-10)
    .map((h) => ({ role: h.role, text: h.text.slice(0, 1000) }));

  try {
    const systemPrompt = await buildSystemPrompt();
    const reply = await askGemini({ systemPrompt, history, message });

    if (reply.includes(ESCALATE_MARKER)) {
      const cleanedReply = reply.replace(ESCALATE_MARKER, '').trim();
      const escalationId = await escalateToHuman(sessionId, message);
      return res.json({
        reply: `${cleanedReply}\n\n⏳ Đang chờ chị Lan trả lời trực tiếp...`,
        escalationId,
        waitingForHuman: true
      });
    }

    res.json({ reply });
  } catch (err) {
    if (err.message === 'MISSING_API_KEY') {
      console.error('[chat] Thieu GEMINI_API_KEY');
    } else {
      console.error('[chat] Loi goi Gemini:', err.message);
    }
    const escalationId = await escalateToHuman(sessionId, message);
    res.status(200).json({
      reply: 'Xin lỗi, hiện mình chưa trả lời được câu này. Mình đã báo cho chị Lan hỗ trợ trực tiếp, chị sẽ trả lời bạn ngay tại đây trong giây lát nhé!\n\n⏳ Đang chờ chị Lan trả lời trực tiếp...',
      escalationId,
      waitingForHuman: true
    });
  }
}));

router.get('/api/tro-chuyen/cho-tra-loi/:id', waitLimiter.middleware, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ replied: false, answer: null });
  const status = await getEscalationStatus(id);
  res.json(status);
}));

module.exports = router;
