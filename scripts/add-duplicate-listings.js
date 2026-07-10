// One-off script: tanhungloi.com itself has a few products listed twice under
// different product IDs (same name/price/photo) — P6L, P4L (400gram, no
// "trứng" in the name) and P_H450 (cross-listed in both Bánh xuất khẩu and
// Bánh chay). To mirror the real site exactly, add these as separate rows.
// Safe to re-run: skips any slug that already exists.
require('dotenv').config();
const { run, get } = require('../db/index');

const newProducts = [
  { name: 'Pía đậu sầu riêng trứng 550gram (MSP: P6L)', slug: 'pia-dau-sau-rieng-trung-550gram-p6l-2', price: 75000, image: '/images/products/pia-dau-trung-550g.png', cat: 'pia-dau-sau-rieng-trung' },
  { name: 'Pía đậu sầu riêng 400gram (MSP: P4L)', slug: 'pia-dau-sau-rieng-400gram-p4l', price: 55000, image: '/images/products/pia-dau-trung-400g-p4l.jpg', cat: 'pia-dau-sau-rieng-trung' },
  { name: 'Pía đậu sầu riêng 450gram (MSP: P_H450)', slug: 'pia-dau-sau-rieng-450gram-ph450-2', price: null, image: '/images/products/pia-dau-450g-ph450.jpg', cat: 'banh-chay', exp: 1 }
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
