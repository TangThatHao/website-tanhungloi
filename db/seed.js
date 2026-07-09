const bcrypt = require('bcryptjs');
const { run, get, all } = require('./index');

async function seedIfEmpty() {
  const catCount = (await get('SELECT COUNT(*) AS c FROM categories')).c;
  if (Number(catCount) > 0) return;

  console.log('[seed] Dang khoi tao du lieu mau...');

  const categories = [
    { name: 'Bánh xuất khẩu', slug: 'banh-xuat-khau' },
    { name: 'Pía đậu sầu riêng trứng', slug: 'pia-dau-sau-rieng-trung' },
    { name: 'Pía môn sầu riêng trứng', slug: 'pia-mon-sau-rieng-trung' },
    { name: 'Pía sầu riêng không trứng', slug: 'pia-sau-rieng-khong-trung' },
    { name: 'Bánh chay', slug: 'banh-chay' },
    { name: 'Bánh in', slug: 'banh-in' },
    { name: 'Đặc sản khác', slug: 'dac-san-khac' }
  ];

  const catIds = {};
  for (let i = 0; i < categories.length; i++) {
    const c = categories[i];
    await run('INSERT INTO categories (name, slug, sort_order) VALUES (?, ?, ?)', [c.name, c.slug, i]);
    catIds[c.slug] = (await get('SELECT id FROM categories WHERE slug = ?', [c.slug])).id;
  }

  const desc = (name) =>
    `${name} được làm thủ công từ nguyên liệu chọn lọc: sầu riêng nguyên chất, đậu xanh tán nhuyễn, lòng đỏ trứng vịt muối và vỏ bột mì thơm mềm. Sản phẩm mang thương hiệu Tân Hưng Lợi, đặc sản nổi tiếng của Sóc Trăng.`;

  const products = [
    { name: 'Mè láo', slug: 'me-lao', price: 30000, image: '/images/products/me-lao.jpg', cat: 'dac-san-khac', hot: 1 },
    { name: 'Pía đậu sầu riêng 400gram (MSP: P4)', slug: 'pia-dau-sau-rieng-400gram-p4', price: 45000, image: '/images/products/pia-dau-400g.jpg', cat: 'pia-dau-sau-rieng-trung', hot: 1 },
    { name: 'Pía đậu sầu riêng 500gram (MSP: P5)', slug: 'pia-dau-sau-rieng-500gram-p5', price: 60000, image: '/images/products/pia-dau-500g.jpg', cat: 'pia-dau-sau-rieng-trung', hot: 1 },
    { name: 'Hộp quà tặng 2 gói bánh pía đặc biệt Tân Hưng Lợi', slug: 'hop-qua-tang-2-goi-banh-pia-dat-biet', price: 130000, image: '/images/products/hop-qua-2-goi.jpg', cat: 'dac-san-khac', newp: 1 },
    { name: 'Hộp quà bánh pía không trứng', slug: 'hop-qua-banh-pia-khong-trung', price: 120000, image: '/images/products/hop-qua-khong-trung.png', cat: 'pia-sau-rieng-khong-trung', newp: 1 },
    { name: 'Pía đậu sầu riêng trứng 550gram (MSP: P6L)', slug: 'pia-dau-sau-rieng-trung-550gram-p6l', price: 75000, image: '/images/products/pia-dau-trung-550g.png', cat: 'pia-dau-sau-rieng-trung', hot: 1, newp: 1 },
    { name: 'Pía chay đậu sầu riêng 400gram (P4_CC)', slug: 'pia-chay-dau-sau-rieng-400gram-p4cc', price: 50000, image: '/images/products/pia-chay-400g.jpg', cat: 'banh-chay' },
    { name: 'Pía đậu sầu riêng 600gram (MSP: P6)', slug: 'pia-dau-sau-rieng-600gram-p6', price: 65000, image: '/images/products/pia-dau-600g.jpg', cat: 'pia-dau-sau-rieng-trung' },
    { name: 'Pía đậu sầu riêng trứng 450gram (MSP: P5L)', slug: 'pia-dau-sau-rieng-trung-450gram-p5l', price: 53000, image: '/images/products/pia-dau-trung-450g.jpg', cat: 'pia-dau-sau-rieng-trung', newp: 1 },
    { name: 'Pía đậu sầu riêng 250gram (MSP: P250)', slug: 'pia-dau-sau-rieng-250gram-p250', price: 30000, image: '/images/products/pia-dau-250g.jpg', cat: 'pia-dau-sau-rieng-trung', newp: 1 },
    { name: 'Pía đậu sầu riêng không trứng 500gram (MSP: P5_KT)', slug: 'pia-dau-sau-rieng-khong-trung-500gram-p5kt', price: 50000, image: '/images/products/pia-dau-khong-trung-500g.jpg', cat: 'pia-sau-rieng-khong-trung', newp: 1 },
    { name: 'Pía môn sầu riêng trứng 500gram', slug: 'pia-mon-sau-rieng-trung-500gram', price: 60000, image: '/images/products/pia-dau-500g.jpg', cat: 'pia-mon-sau-rieng-trung' },
    { name: 'Bánh Pía Đậu dừa sầu riêng', slug: 'banh-pia-dau-dua-sau-rieng', price: null, image: '/images/products/banh-pia-dau-dua.jpg', cat: 'banh-xuat-khau', exp: 1 },
    { name: 'Bánh in nhân (500gram)', slug: 'banh-in-nhan-500gram', price: 45000, image: '/images/products/banh-in-nhan.jpg', cat: 'banh-in', exp: 1 }
  ];

  for (const p of products) {
    await run(
      `INSERT INTO products (category_id, name, slug, price, image, description, is_hot, is_new, is_export, stock)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [catIds[p.cat], p.name, p.slug, p.price, p.image, desc(p.name), p.hot ? 1 : 0, p.newp ? 1 : 0, p.exp ? 1 : 0, 100]
    );
  }

  const news = [
    {
      title: 'Bánh pía Tân Hưng Lợi tại hội chợ triển lãm quốc tế ở Côn Minh, Trung Quốc',
      slug: 'banh-pia-tan-hung-loi-tai-hoi-cho-trien-lam-quoc-te-o-con-minh-trung-quoc',
      thumbnail: '/images/news/hoi-cho-con-minh.png',
      summary: 'Thương hiệu bánh pía Tân Hưng Lợi mang đặc sản Sóc Trăng đến với bạn bè quốc tế tại hội chợ triển lãm ở Côn Minh, Trung Quốc.',
      content: 'Bánh pía Tân Hưng Lợi là thương hiệu nổi tiếng tại Sóc Trăng, được nhiều khách hàng trong và ngoài nước tin dùng. Tham gia hội chợ triển lãm quốc tế tại Côn Minh, Trung Quốc là cơ hội để giới thiệu đặc sản miền Tây Nam Bộ đến bạn bè quốc tế, khẳng định chất lượng và hương vị đặc trưng của bánh pía Sóc Trăng.',
      featured: 1
    },
    {
      title: 'Khuyến mãi áp dụng cho khách hàng đặt bánh qua website tanhungloi.com',
      slug: 'khuyen-mai-ap-dung-cho-khach-hang-dat-banh-qua-website',
      thumbnail: '/images/news/khuyen-mai.jpg',
      summary: 'Ưu đãi đặc biệt dành cho khách hàng đặt bánh trực tuyến qua website chính thức của Tân Hưng Lợi.',
      content: 'Với thịt sầu riêng nguyên chất, vị ngọt dịu không gắt, bánh pía Tân Hưng Lợi luôn là lựa chọn hàng đầu của người dân Sóc Trăng và du khách. Nhằm tri ân khách hàng, chúng tôi áp dụng chương trình khuyến mãi đặc biệt cho các đơn hàng đặt qua website tanhungloi.com.',
      featured: 0
    },
    {
      title: 'Tại sao bạn nên mua bánh pía Tân Hưng Lợi?',
      slug: 'tai-sao-ban-nen-mua-banh-pia-tan-hung-loi',
      thumbnail: '/images/news/tai-sao-nen-mua.jpg',
      summary: 'Bánh pía Tân Hưng Lợi thơm ngon, sử dụng sầu riêng nguyên chất và quy trình sản xuất đảm bảo vệ sinh an toàn thực phẩm.',
      content: 'Bánh pía Tân Hưng Lợi thơm ngon, sử dụng sầu riêng nguyên chất, đậu xanh và lòng đỏ trứng muối tuyển chọn. Với hơn nhiều năm kinh nghiệm sản xuất, Tân Hưng Lợi luôn giữ vững chất lượng và hương vị truyền thống, là đặc sản không thể bỏ qua khi đến Sóc Trăng.',
      featured: 1
    }
  ];

  for (const n of news) {
    await run(
      `INSERT INTO news (title, slug, thumbnail, summary, content, is_featured) VALUES (?, ?, ?, ?, ?, ?)`,
      [n.title, n.slug, n.thumbnail, n.summary, n.content, n.featured]
    );
  }

  const adminHash = bcrypt.hashSync('admin123', 10);
  await run(
    `INSERT INTO users (full_name, email, phone, username, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)`,
    ['Quản trị viên', 'admin@tanhungloi.com', '0299 3821035', 'admin', adminHash, 'admin']
  );

  const memberHash = bcrypt.hashSync('123456', 10);
  await run(
    `INSERT INTO users (full_name, email, phone, username, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)`,
    ['Khách hàng demo', 'khachhang@example.com', '0908409788', 'khachhang', memberHash, 'member']
  );

  console.log('[seed] Xong. Tai khoan admin: admin / admin123 -- Tai khoan thanh vien demo: khachhang / 123456');
}

module.exports = { seedIfEmpty };
