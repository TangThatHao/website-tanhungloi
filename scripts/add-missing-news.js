// One-off script: insert news articles added to db/seed.js after the initial
// seed already ran (seedIfEmpty only fires when the table is empty).
// Safe to re-run: skips any slug that already exists.
require('dotenv').config();
const { run, get } = require('../db/index');

const newArticles = [
  {
    title: 'Bánh pía Tân Hưng Lợi - thương hiệu bánh pía trứ danh Sóc Trăng',
    slug: 'banh-pia-tan-hung-loi-thuong-hieu-banh-pia-tru-danh-soc-trang',
    thumbnail: '/images/news/hoi-cho-con-minh.png',
    summary: 'Tân Hưng Lợi là thương hiệu bánh pía nổi tiếng Sóc Trăng, còn giữ được bí quyết làm bánh gia truyền, nguyên liệu tự nhiên chọn lọc, không dùng hương liệu hay chất bảo quản.',
    content: 'Bánh pía Tân Hưng Lợi là thương hiệu nổi tiếng tại Sóc Trăng, một trong số ít cơ sở còn giữ được bí quyết làm bánh gia truyền. Nguyên liệu làm bánh được chọn lọc kỹ càng: sầu riêng nguyên chất, không sử dụng hương liệu, không dùng chất bảo quản sầu riêng.\n\nDOANH NGHIỆP TƯ NHÂN YẾN LINH - THƯƠNG HIỆU BÁNH PÍA TÂN HƯNG LỢI\n\nCửa hàng: 122 Lý Thường Kiệt, TP Sóc Trăng. ĐT: 0299 3821035\nXưởng sản xuất: 391 Mạc Đỉnh Chi, P4, TP Sóc Trăng. ĐT: 0299 3610473\nChi nhánh Sài Gòn: 418/45 Hồng Bàng, P. Minh Phụng, TP.HCM\nHotline: 0919 454 484\nWebsite: banhpiasoctrang.onrender.com\n\nChúng tôi chuyên cung cấp bánh pía chất lượng với giá cả hợp lý, phục vụ quà biếu, tiệc cưới, quà tặng doanh nghiệp, gia đình và các đơn hàng xuất khẩu.\n\nChúng tôi luôn quan tâm đến nhu cầu của khách hàng và cam kết mang lại sự hài lòng tuyệt đối về chất lượng sản phẩm và dịch vụ. Hãy liên hệ với chúng tôi ngay hôm nay!\n\nCách đặt hàng: Quý khách liên hệ qua điện thoại hoặc đặt hàng trực tiếp trên website, chúng tôi sẽ liên hệ lại nhanh chóng.\n\nThanh toán: tiền mặt hoặc chuyển khoản.\n\nLý do nên chọn sản phẩm và dịch vụ của chúng tôi:\n- Giao hàng nhanh chóng.\n- Sản phẩm đa dạng, phong phú.\n- Chất lượng đảm bảo.\n- Giá cả hợp lý.\n- Miễn phí giao hàng nội thành và các khu vực lân cận tùy theo giá trị đơn hàng.',
    featured: 0
  }
];

async function main() {
  let added = 0;
  for (const n of newArticles) {
    const exists = await get('SELECT id FROM news WHERE slug = ?', [n.slug]);
    if (exists) {
      console.log(`[skip] ${n.title} (đã có)`);
      continue;
    }
    await run(
      `INSERT INTO news (title, slug, thumbnail, summary, content, is_featured) VALUES (?, ?, ?, ?, ?, ?)`,
      [n.title, n.slug, n.thumbnail, n.summary, n.content, n.featured]
    );
    console.log(`[added] ${n.title}`);
    added++;
  }
  console.log(`Xong. Đã thêm ${added} bài viết mới.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
