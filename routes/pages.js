const express = require('express');
const router = express.Router();
const { run } = require('../db');
const { asyncHandler } = require('../utils/asyncHandler');

router.get('/gioi-thieu', (req, res) => {
  res.render('page-static', {
    title: 'Giới thiệu',
    activeNav: 'about',
    content: `
      <p>Bánh pía Tân Hưng Lợi là thương hiệu đặc sản nổi tiếng của Sóc Trăng, thuộc <strong>Doanh nghiệp tư nhân Yến Linh</strong>,
      thành lập từ năm 2005. Với hơn nhiều năm kinh nghiệm, chúng tôi tự hào mang đến những chiếc bánh pía thơm ngon,
      được làm thủ công từ sầu riêng nguyên chất, đậu xanh, khoai môn và lòng đỏ trứng vịt muối tuyển chọn.</p>
      <p>Sản phẩm của chúng tôi không chỉ được ưa chuộng tại thị trường trong nước mà còn xuất khẩu sang nhiều quốc gia,
      góp phần quảng bá đặc sản miền Tây Nam Bộ đến bạn bè quốc tế.</p>
      <p>Chúng tôi cam kết quy trình sản xuất đảm bảo vệ sinh an toàn thực phẩm, giữ trọn hương vị truyền thống trong từng sản phẩm.</p>

      <h3 style="margin-top:32px;">Quy trình sản xuất</h3>
      <div class="process-steps">
        <div class="process-step">
          <div class="process-step-num">1</div>
          <div class="process-step-title">Chọn nguyên liệu</div>
          <div class="process-step-desc">Sầu riêng, đậu xanh, khoai môn, trứng muối được tuyển chọn kỹ lưỡng ngay từ đầu vào.</div>
        </div>
        <div class="process-step">
          <div class="process-step-num">2</div>
          <div class="process-step-title">Sơ chế & làm nhân</div>
          <div class="process-step-desc">Nhân bánh chế biến thủ công, giữ trọn hương vị tự nhiên của nguyên liệu.</div>
        </div>
        <div class="process-step">
          <div class="process-step-num">3</div>
          <div class="process-step-title">Cán vỏ & tạo hình</div>
          <div class="process-step-desc">Vỏ bánh nhiều lớp mỏng, cán tay theo công thức truyền thống nhiều năm.</div>
        </div>
        <div class="process-step">
          <div class="process-step-num">4</div>
          <div class="process-step-title">Nướng bánh</div>
          <div class="process-step-desc">Nướng đúng nhiệt độ và thời gian để bánh vàng đều, thơm ngon.</div>
        </div>
        <div class="process-step">
          <div class="process-step-num">5</div>
          <div class="process-step-title">Đóng gói & kiểm tra</div>
          <div class="process-step-desc">Kiểm tra chất lượng, đóng gói đảm bảo vệ sinh an toàn thực phẩm trước khi giao.</div>
        </div>
      </div>
    `
  });
});

router.get('/dich-vu', (req, res) => {
  res.render('page-static', {
    title: 'Dịch vụ',
    activeNav: 'service',
    content: `
      <p>Tân Hưng Lợi cung cấp các dịch vụ:</p>
      <ul style="padding-left:20px; line-height:2;">
        <li>Đặt bánh pía sỉ và lẻ cho các dịp lễ, tết, quà biếu</li>
        <li>Giao hàng tận nơi trong nội thành Sóc Trăng và nội thành TPHCM</li>
        <li>Sản xuất theo đơn đặt hàng số lượng lớn, xuất khẩu</li>
        <li>Đóng gói hộp quà tặng theo yêu cầu</li>
      </ul>
      <p>Liên hệ hotline <strong>0919 454 484</strong> để được tư vấn chi tiết.</p>
    `
  });
});

router.get('/lien-he', (req, res) => {
  res.render('contact', { successMsg: null });
});

router.post('/lien-he', asyncHandler(async (req, res) => {
  const { name, email, phone, message } = req.body;
  if (name && email && phone && message) {
    await run('INSERT INTO contacts (name, email, phone, message) VALUES (?, ?, ?, ?)', [name, email, phone, message]);
  }
  res.render('contact', { successMsg: 'Cảm ơn bạn đã liên hệ! Chúng tôi sẽ phản hồi sớm nhất.' });
}));

module.exports = router;
