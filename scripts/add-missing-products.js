// One-off script: insert the products that were added to db/seed.js after the
// initial seed already ran (seedIfEmpty only fires when the table is empty).
// Safe to re-run: skips any slug that already exists.
require('dotenv').config();
const { run, get } = require('../db/index');

const newProducts = [
  { name: 'Bánh pía đậu sầu riêng trứng', slug: 'banh-pia-dau-sau-rieng-trung', price: 40000, image: '/images/products/pia-dau-trung.jpg', cat: 'pia-dau-sau-rieng-trung' },
  { name: 'Pía đậu sầu riêng trứng 400gram (MSP: P4L)', slug: 'pia-dau-sau-rieng-trung-400gram-p4l', price: 55000, image: '/images/products/pia-dau-trung-400g-p4l.jpg', cat: 'pia-dau-sau-rieng-trung', newp: 1 },
  { name: 'Pía môn sầu riêng 300gram (MSP: P3_M)', slug: 'pia-mon-sau-rieng-300gram-p3m', price: 40000, image: '/images/products/pia-mon-300g.jpg', cat: 'pia-mon-sau-rieng-trung' },
  { name: 'Hộp quà bánh pía sầu riêng đặc biệt không trứng', slug: 'hop-qua-banh-pia-sau-rieng-dac-biet-khong-trung', price: 120000, image: '/images/products/hop-qua-khong-trung-dat-biet.png', cat: 'pia-sau-rieng-khong-trung', newp: 1 },
  { name: 'Bánh in nhân hình chữ nhật', slug: 'banh-in-nhan-hinh-chu-nhat', price: 45000, image: '/images/products/banh-in-nhan-chu-nhat.jpg', cat: 'banh-in' },
  { name: 'Bánh chay xuất khẩu 400gram', slug: 'banh-chay-xuat-khau-400gram', price: 50000, image: '/images/products/banh-chay-xuat-khau-400g.jpg', cat: 'banh-xuat-khau' },
  { name: 'Bánh pía sầu riêng không trứng (xuất khẩu)', slug: 'banh-pia-sau-rieng-khong-trung-xuat-khau', price: null, image: '/images/products/banh-pia-khong-trung-xk.jpg', cat: 'banh-xuat-khau', exp: 1 },
  { name: 'Bánh pía khoai môn sầu riêng đặc biệt thơm ngon', slug: 'banh-pia-khoai-mon-sau-rieng-dac-biet-thom-ngon', price: null, image: '/images/products/banh-pia-khoai-mon-dac-biet.jpg', cat: 'banh-xuat-khau', exp: 1 },
  { name: 'Pía đậu sầu riêng 450gram (MSP: P_H450)', slug: 'pia-dau-sau-rieng-450gram-ph450', price: null, image: '/images/products/pia-dau-450g-ph450.jpg', cat: 'banh-xuat-khau', exp: 1 }
];

const desc = (name) =>
  `${name} được làm thủ công từ nguyên liệu chọn lọc: sầu riêng nguyên chất, đậu xanh tán nhuyễn, lòng đỏ trứng vịt muối và vỏ bột mì thơm mềm. Sản phẩm mang thương hiệu Tân Hưng Lợi, đặc sản nổi tiếng của Sóc Trăng.`;

async function main() {
  let added = 0;
  for (const p of newProducts) {
    const exists = await get('SELECT id FROM products WHERE slug = ?', [p.slug]);
    if (exists) {
      console.log(`[skip] ${p.name} (đã có)`);
      continue;
    }
    const cat = await get('SELECT id FROM categories WHERE slug = ?', [p.cat]);
    if (!cat) {
      console.log(`[error] Không tìm thấy danh mục ${p.cat} cho ${p.name}`);
      continue;
    }
    await run(
      `INSERT INTO products (category_id, name, slug, price, image, description, is_hot, is_new, is_export, stock)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [cat.id, p.name, p.slug, p.price, p.image, desc(p.name), p.hot ? 1 : 0, p.newp ? 1 : 0, p.exp ? 1 : 0, 100]
    );
    console.log(`[added] ${p.name}`);
    added++;
  }
  console.log(`Xong. Đã thêm ${added} sản phẩm mới.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
