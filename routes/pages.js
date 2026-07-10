const express = require('express');
const router = express.Router();
const { run } = require('../db');
const { asyncHandler } = require('../utils/asyncHandler');

router.get('/gioi-thieu', (req, res) => {
  res.render('page-static', {
    title: 'Giới thiệu',
    activeNav: 'about',
    content: `
      <p>Bánh pía có ở nhiều tỉnh thuộc miền Tây Nam Bộ nhưng chỉ có bánh pía Sóc Trăng là nổi tiếng nhất. Cũng là vỏ bột mì,
      nhân đậu xanh hoặc khoai môn tán nhuyễn trộn với sầu riêng, mỡ heo xắt nhỏ, lòng đỏ trứng vịt muối nhưng bánh pía Sóc Trăng
      lại mang một hương vị riêng. Lớp vỏ bánh không khô cứng mà mềm dẻo, mịn màng ôm lấy nhân bánh thơm ngọt phía trong, mùi thơm
      của bánh được tạo nên bởi những trái sầu riêng tươi ngon.</p>
      <p>Người phương xa mỗi khi ghé thăm Sóc Trăng bao giờ cũng mua vài phong bánh Pía làm quà cho người ở nhà, như mang theo
      hương vị ngọt ngào đậm đà, chân chất của một vùng quê Nam Bộ.</p>
      <p>Bánh Pía <strong>TÂN HƯNG LỢI</strong> là một thương hiệu có tiếng ở Sóc Trăng, là nhãn hiệu duy nhất còn giữ lại bí quyết
      làm bánh từ xưa, nguyên liệu để làm ra chiếc bánh Tân Hưng Lợi được chọn lọc nguyên liệu thiên nhiên thượng hạng, không sử
      dụng tinh dầu sầu riêng, không sử dụng chất bảo quản.</p>

      <p style="margin-top:24px;"><strong>DOANH NGHIỆP TƯ NHÂN YẾN LINH – THƯƠNG HIỆU BÁNH PÍA TÂN HƯNG LỢI</strong><br/>
      Cửa hàng: 122 Lý Thường Kiệt, TP Sóc Trăng — ĐT: 0299 3821035<br/>
      Xưởng sản xuất: 391 Mạc Đỉnh Chi, P4, TP Sóc Trăng — ĐT: 0299 3610473<br/>
      Chi nhánh Sài Gòn: 418/45 Hồng Bàng, P. Minh Phụng, TP.HCM<br/>
      Hotline: 0919 454 484<br/>
      Website: banhpiasoctrang.onrender.com<br/>
      Email: tholan.kha@gmail.com</p>

      <p style="margin-top:24px;">Chúng tôi chuyên cung cấp những sản phẩm chất lượng đảm bảo với giá cả hợp lý dành cho các gói
      quà, bánh cưới hỏi, công ty và gia đình, xuất khẩu...</p>
      <p>Chúng tôi luôn quan tâm đến nhu cầu của khách hàng và đảm bảo sẽ làm hài lòng quý khách về chất lượng sản phẩm cũng như
      dịch vụ. Hãy gọi ngay cho chúng tôi!</p>

      <p style="margin-top:24px;"><strong>Cách thức đặt hàng rất đơn giản:</strong><br/>
      Chỉ cần liên hệ với chúng tôi qua điện thoại hoặc qua website. Chúng tôi sẽ nhanh chóng liên hệ với Quý khách để xác nhận
      thông tin.</p>
      <p>Hình thức thanh toán: Tiền mặt hoặc Chuyển khoản.</p>

      <p style="margin-top:24px;"><strong>Những lý do nên sử dụng dịch vụ và sản phẩm của chúng tôi:</strong></p>
      <ul style="padding-left:20px; line-height:2;">
        <li>Giao hàng nhanh chóng.</li>
        <li>Sản phẩm phong phú, đa dạng.</li>
        <li>Chất lượng đảm bảo.</li>
        <li>Giá cả hợp lý.</li>
        <li>Đặc biệt giao hàng miễn phí trong thành phố Sóc Trăng, nội thành TP.HCM và các tỉnh lân cận (tùy giá trị đơn hàng).
        Chi tiết vui lòng liên hệ hotline 0919 454 484.</li>
      </ul>

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
