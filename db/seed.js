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

  // Mô tả lấy nguyên văn (copy y chang) từ trang tanhungloi.com, kể cả
  // những sản phẩm trang gốc không có mô tả (để trống '').
  const TPL_HACCP =
    'Sử dụng nguyên liệu cao cấp.\nDa bánh mềm.\nVị ngọt dịu không gắt.\nThịt sầu riêng nguyên chất.\nLàm bằng phương pháp truyền thống kết hợp dây chuyền sản xuất khép kín.\nĐạt chuẩn HACCP - GMP, đã xuất khẩu đi nhiều nước trên thế giới.\nCông nghệ bảo quản bằng bao bì cao cấp dùng gói hút oxi bên trong để ngăn chặn sự phát triển của vi khuẩn, nấm mốc, kéo dài thời gian bảo quản bánh, sản phẩm không sử dụng chất bảo quản hay phẩm màu độc hại\n\nĐặc biệt Tân Hưng Lợi hổ trợ giao hàng tận nơi cho quý khách có nhu cầu. Giảm giá đặc biệt cho đơn hàng đặc biệt. Mọi chi tiết liên hệ SĐT 0908409788\n\nCách bảo quản: Để nơi khô ráo thoáng mát. Nên sử dụng ngay sau khi mở bao bì. Sản phẩm được bảo quản bằng bao bì và gói hút oxi bên trong, vì vậy sau khi xé bao bì thì nên ăn liền trong khoảng 7 ngày hoặc bảo quản trong ngăn mát tủ lạnh. Khi ăn có thể lấy ra cho vào lò vi sóng (Micro wave) quay nóng lại ăn sẽ ngon như bánh mới nướng hoặc ăn lạnh bánh cũng rất ngon.\n\nHạn sử dụng: 60 ngày kể từ ngày sản xuất.\n\nNgày sản xuất: Xem trên bao bì.';

  const products = [
    { name: 'Mè láo', slug: 'me-lao', price: 30000, image: '/images/products/me-lao.jpg', cat: 'dac-san-khac', hot: 1, desc: '' },
    { name: 'Pía đậu sầu riêng 400gram (MSP: P4)', slug: 'pia-dau-sau-rieng-400gram-p4', price: 45000, image: '/images/products/pia-dau-400g.jpg', cat: 'pia-dau-sau-rieng-trung', hot: 1,
      desc: TPL_HACCP + '\n\nThành phần: bột mì, đậu xanh, sầu riêng, mỡ thịt, dầu ăn, trứng, màu đỏ thực phẩm (E124)\nTrọng lượng: 400 gram/ 4 cái\nSản phẩm của DNTN Yến Linh' },
    { name: 'Pía đậu sầu riêng 500gram (MSP: P5)', slug: 'pia-dau-sau-rieng-500gram-p5', price: 60000, image: '/images/products/pia-dau-500g.jpg', cat: 'pia-dau-sau-rieng-trung', hot: 1,
      desc: 'gói gồm 4 bánh có 4 trứng ,  mỗi cái 125g và 1 trứng trong mỗi bánh .\n\n' + TPL_HACCP.replace('Ngày sản xuất: Xem trên bao bì.', 'Ngày sản xuất: Xem trên bao bì. bánh mới sản xuất cam kết sản xuất đúng ngày giao hàng .') },
    { name: 'Hộp quà tặng 2 gói bánh pía đặc biệt Tân Hưng Lợi', slug: 'hop-qua-tang-2-goi-banh-pia-dat-biet', price: 130000, image: '/images/products/hop-qua-2-goi.jpg', cat: 'pia-dau-sau-rieng-trung', newp: 1,
      desc: 'Hộp quà bánh pía Tân Hưng Lợi\n\n' + TPL_HACCP },
    { name: 'Hộp quà bánh pía không trứng', slug: 'hop-qua-banh-pia-khong-trung', price: 120000, image: '/images/products/hop-qua-khong-trung.png', cat: 'pia-sau-rieng-khong-trung', newp: 1,
      desc: 'Hộp quà tặng bánh pía cái nhỏ, mẫu mã đẹp, bánh nhỏ nhưng đặc biệt nhiều thịt sầu riêng, thơm ngon, không trứng\n\n' + TPL_HACCP },
    { name: 'Pía đậu sầu riêng trứng 550gram (MSP: P6L)', slug: 'pia-dau-sau-rieng-trung-550gram-p6l', price: 75000, image: '/images/products/pia-dau-trung-550g.png', cat: 'pia-dau-sau-rieng-trung', hot: 1, newp: 1,
      desc: 'Bánh được đóng gói từng cái rời, mỗi gói gồm 4 cái bên trong. Trọng lượng 550gram/gói (4 trứng)\n\n' + TPL_HACCP + 'cam kết hàng mới sản xuất đúng ngày gửi hàng.' },
    { name: 'Pía chay đậu sầu riêng 400gram (P4_CC)', slug: 'pia-chay-dau-sau-rieng-400gram-p4cc', price: 50000, image: '/images/products/pia-chay-400g.jpg', cat: 'banh-chay',
      desc: 'Bánh pía chay Tân Hưng Lơi, đạt chuẩn HACCAP và GMP, đã xuất khẩu đi các nước Châu Âu, Mĩ, Úc, Ấn, Hàn, Trung Quốc ...\n\nBánh sử dụng những nguyên liệu cao cấp, thịt sầu riêng nguyên chất, đậu xanh loại thượng hạng, làm bằng phương pháp làm bánh truyền thống kết hợp dây chuyền sản xuất khép kín, không sử dụng chất bảo quản độc hại. \n\nĐặc biệt Tân Hưng Lợi hổ trợ giao bánh tận nơi cho khách hàng có nhu cầu. Liên hệ 0908409788.' },
    { name: 'Pía đậu sầu riêng 600gram (MSP: P6)', slug: 'pia-dau-sau-rieng-600gram-p6', price: 65000, image: '/images/products/pia-dau-600g.jpg', cat: 'pia-dau-sau-rieng-trung',
      desc: 'Thành phần: bột mì, đậu xanh, sầu riêng, mỡ thịt, dầu ăn, trứng, màu đỏ thực phẩm (E124)\nTrọng lượng: 600 gram/ 4 cái , mỗi cái 1 trứng gói 4 trứng .\nSản phẩm của DNTN Yến Linh\n\n' + TPL_HACCP + 'cam kết hàng mới sản xuất đúng ngày gửi hàng.' },
    { name: 'Pía đậu sầu riêng trứng 450gram (MSP: P5L)', slug: 'pia-dau-sau-rieng-trung-450gram-p5l', price: 53000, image: '/images/products/pia-dau-trung-450g.jpg', cat: 'pia-dau-sau-rieng-trung', newp: 1, desc: '' },
    { name: 'Pía đậu sầu riêng 250gram (MSP: P250)', slug: 'pia-dau-sau-rieng-250gram-p250', price: 30000, image: '/images/products/pia-dau-250g.jpg', cat: 'pia-dau-sau-rieng-trung', newp: 1,
      desc: 'Thành phần: bột mì, đậu xanh, sầu riêng, mỡ thịt, dầu ăn, màu đỏ thực phẩm (E124)\nTrọng lượng: 250 gram/ 4 cái\nSản phẩm của DNTN Yến Linh' },
    { name: 'Pía đậu sầu riêng không trứng 500gram (MSP: P5_KT)', slug: 'pia-dau-sau-rieng-khong-trung-500gram-p5kt', price: 50000, image: '/images/products/pia-dau-khong-trung-500g.jpg', cat: 'pia-sau-rieng-khong-trung', newp: 1,
      desc: 'Thành phần: bột mì, đậu xanh, sầu riêng, mỡ thịt, dầu ăn, màu đỏ thực phẩm (E124)\nTrọng lượng: 500 gram/ 4 cái\nSản phẩm của DNTN Yến Linh' },
    { name: 'Pía môn sầu riêng 500gram (MSP: P5_M)', slug: 'pia-mon-sau-rieng-500gram-p5m', price: 60000, image: '/images/products/pia-mon-500g.jpg', cat: 'pia-mon-sau-rieng-trung',
      desc: 'Thành phần: bột mì, khoai môn, sầu riêng, mỡ thịt, dầu ăn, trứng, màu đỏ thực phẩm (E124)\nTrọng lượng: 500gram/ 4 cái\nSản phẩm của DNTN Yến Linh' },
    { name: 'Bánh Pía Đậu dừa sầu riêng', slug: 'banh-pia-dau-dua-sau-rieng', price: null, image: '/images/products/banh-pia-dau-dua.jpg', cat: 'banh-xuat-khau', exp: 1, desc: '' },
    { name: 'Bánh in nhân (500gram)', slug: 'banh-in-nhan-500gram', price: 45000, image: '/images/products/banh-in-nhan.jpg', cat: 'banh-in', exp: 1,
      desc: 'bánh in nhân đậu xanh sầu riêng , gói 4 cái , làm từ bột nếp , đậu xanh , sầu riêng , đường , dầu ăn và mạch nha , không chất bảo quản , bánh mền dẻo và thơm béo tự nhiên ,\n\nhạn sử dụng 30 ngày , ngày  sản xuất  mới nhất .' },
    { name: 'Bánh pía đậu sầu riêng trứng', slug: 'banh-pia-dau-sau-rieng-trung', price: 40000, image: '/images/products/pia-dau-trung.jpg', cat: 'pia-dau-sau-rieng-trung',
      desc: 'Thành phần: bột mì, đậu xanh, sầu riêng, trứng muối, mỡ, đường\n\nQuy cách đóng gỏi: 4cái/gói (300gram)\n\nQuy cách đóng thùng: 60 gói/thùng' },
    { name: 'Pía đậu sầu riêng trứng 400gram (MSP: P4L)', slug: 'pia-dau-sau-rieng-trung-400gram-p4l', price: 55000, image: '/images/products/pia-dau-trung-400g-p4l.jpg', cat: 'pia-dau-sau-rieng-trung', newp: 1,
      desc: 'Bánh được đóng gói từng cái rời, mỗi gói gồm 4 cái bên trong. Trọng lượng 400gram/gói (2 trứng)\n\n' + TPL_HACCP + 'cam kết hàng mới sản xuất đúng ngày gửi hàng.' },
    { name: 'Pía môn sầu riêng 300gram (MSP: P3_M)', slug: 'pia-mon-sau-rieng-300gram-p3m', price: 40000, image: '/images/products/pia-mon-300g.jpg', cat: 'pia-mon-sau-rieng-trung',
      desc: 'Thành phần: bột mì, khoai môn, sầu riêng, mỡ thịt, dầu ăn, trứng, màu đỏ thực phẩm (E124)\nTrọng lượng: 300gram/ 4 cái\nSản phẩm của DNTN Yến Linh' },
    { name: 'Hộp quà bánh pía sầu riêng đặc biệt không trứng', slug: 'hop-qua-banh-pia-sau-rieng-dac-biet-khong-trung', price: 120000, image: '/images/products/hop-qua-khong-trung-dat-biet.png', cat: 'pia-sau-rieng-khong-trung', newp: 1,
      desc: 'Hộp quà tặng bánh pía cái nhỏ, mẫu mã đẹp, bánh nhỏ nhưng đặc biệt nhiều thịt sầu riêng, thơm ngon, không trứng\n\nĐặc trưng của bánh pia Tân Hưng Lợi là còn giữ lại phương pháp làm bánh truyền thống, kết hợp sản xuất trên quy trình khép kín đạt chuẩn HACCAP và GMP, công nghệ bảo quản bằng bao bì cao cấp dùng gói hút oxi bên trong để ngăn chặn sự phát triển của vi khuẩn, nấm mốc, kéo dài thời gian bảo quản bánh, sản phẩm không sử dụng chất bảo quản hay phẩm màu độc hại\n\nĐặc biệt Tân Hưng Lợi hổ trợ giao hàng tận nơi cho quý khách có nhu cầu. Giảm giá đặc biệt cho đơn hàng đặc biệt. Mọi chi tiết liên hệ SĐT 0908409788' },
    { name: 'Bánh in nhân hình chữ nhật', slug: 'banh-in-nhan-hinh-chu-nhat', price: 45000, image: '/images/products/banh-in-nhan-chu-nhat.jpg', cat: 'banh-in', desc: 'Bánh in nhân hình chữ nhật Tân Hưng Lợi' },
    { name: 'Bánh chay xuất khẩu 400gram', slug: 'banh-chay-xuat-khau-400gram', price: 50000, image: '/images/products/banh-chay-xuat-khau-400g.jpg', cat: 'banh-xuat-khau', desc: '' },
    { name: 'Bánh pía sầu riêng không trứng (xuất khẩu)', slug: 'banh-pia-sau-rieng-khong-trung-xuat-khau', price: null, image: '/images/products/banh-pia-khong-trung-xk.jpg', cat: 'banh-xuat-khau', exp: 1,
      desc: 'Thành phần: bột mì, đậu xanh, sầu riêng, mỡ thịt, dầu ăn, màu đỏ thực phẩm (E124)\nTrọng lượng: 400 gram/ 4 cái\nSản phẩm của DNTN Yến Linh' },
    { name: 'Bánh pía khoai môn sầu riêng đặc biệt thơm ngon', slug: 'banh-pia-khoai-mon-sau-rieng-dac-biet-thom-ngon', price: null, image: '/images/products/banh-pia-khoai-mon-dac-biet.jpg', cat: 'banh-xuat-khau', exp: 1,
      desc: 'Mã sản phẩm: PKT_KM Bánh pía khoai môn sầu riêng đặc biệt thơm ngon\n\nTrọng lượng 500gram\n\nThành phần: khoai môn, sầu riêng, bột mì, đường dầu ăn...' },
    { name: 'Pía đậu sầu riêng 450gram (MSP: P_H450)', slug: 'pia-dau-sau-rieng-450gram-ph450', price: null, image: '/images/products/pia-dau-450g-ph450.jpg', cat: 'banh-xuat-khau', exp: 1, desc: '' },
    { name: 'Pía đậu sầu riêng trứng 550gram (MSP: P6L)', slug: 'pia-dau-sau-rieng-trung-550gram-p6l-2', price: 75000, image: '/images/products/pia-dau-trung-550g.png', cat: 'pia-dau-sau-rieng-trung',
      desc: 'Bánh được đóng gói từng cái rời, mỗi gói gồm 4 cái bên trong. Trọng lượng 550gram/gói (4 trứng)\n\n' + TPL_HACCP + 'cam kết hàng mới sản xuất đúng ngày gửi hàng.' },
    { name: 'Pía đậu sầu riêng 400gram (MSP: P4L)', slug: 'pia-dau-sau-rieng-400gram-p4l', price: 55000, image: '/images/products/pia-dau-trung-400g-p4l.jpg', cat: 'pia-dau-sau-rieng-trung',
      desc: 'Bánh được đóng gói từng cái rời, mỗi gói gồm 4 cái bên trong. Trọng lượng 400gram/gói\n\n' + TPL_HACCP },
    { name: 'Pía đậu sầu riêng 450gram (MSP: P_H450)', slug: 'pia-dau-sau-rieng-450gram-ph450-2', price: null, image: '/images/products/pia-dau-450g-ph450.jpg', cat: 'banh-chay', exp: 1, desc: '' }
  ];

  for (const p of products) {
    await run(
      `INSERT INTO products (category_id, name, slug, price, image, description, is_hot, is_new, is_export, stock)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [catIds[p.cat], p.name, p.slug, p.price, p.image, p.desc, p.hot ? 1 : 0, p.newp ? 1 : 0, p.exp ? 1 : 0, 100]
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
      title: 'Khuyến mãi áp dụng cho khách hàng đặt bánh qua website banhpiasoctrang.onrender.com',
      slug: 'khuyen-mai-ap-dung-cho-khach-hang-dat-banh-qua-website',
      thumbnail: '/images/news/khuyen-mai.jpg',
      summary: 'Ưu đãi đặc biệt dành cho khách hàng đặt bánh trực tuyến qua website chính thức của Tân Hưng Lợi.',
      content: 'Với thịt sầu riêng nguyên chất, vị ngọt dịu không gắt, bánh pía Tân Hưng Lợi luôn là lựa chọn hàng đầu của người dân Sóc Trăng và du khách. Nhằm tri ân khách hàng, chúng tôi áp dụng chương trình khuyến mãi đặc biệt cho các đơn hàng đặt qua website banhpiasoctrang.onrender.com.',
      featured: 0
    },
    {
      title: 'Tại sao bạn nên mua bánh pía Tân Hưng Lợi?',
      slug: 'tai-sao-ban-nen-mua-banh-pia-tan-hung-loi',
      thumbnail: '/images/news/tai-sao-nen-mua.jpg',
      summary: 'Bánh pía Tân Hưng Lợi thơm ngon, sử dụng sầu riêng nguyên chất và quy trình sản xuất đảm bảo vệ sinh an toàn thực phẩm.',
      content: 'Bánh pía Tân Hưng Lợi thơm ngon, sử dụng sầu riêng nguyên chất, đậu xanh và lòng đỏ trứng muối tuyển chọn. Với hơn nhiều năm kinh nghiệm sản xuất, Tân Hưng Lợi luôn giữ vững chất lượng và hương vị truyền thống, là đặc sản không thể bỏ qua khi đến Sóc Trăng.',
      featured: 1
    },
    {
      title: 'Bánh pía Tân Hưng Lợi - thương hiệu bánh pía trứ danh Sóc Trăng',
      slug: 'banh-pia-tan-hung-loi-thuong-hieu-banh-pia-tru-danh-soc-trang',
      thumbnail: '/images/news/hoi-cho-con-minh.png',
      summary: 'Tân Hưng Lợi là thương hiệu bánh pía nổi tiếng Sóc Trăng, còn giữ được bí quyết làm bánh gia truyền, nguyên liệu tự nhiên chọn lọc, không dùng hương liệu hay chất bảo quản.',
      content: 'Bánh pía Tân Hưng Lợi là thương hiệu nổi tiếng tại Sóc Trăng, một trong số ít cơ sở còn giữ được bí quyết làm bánh gia truyền. Nguyên liệu làm bánh được chọn lọc kỹ càng: sầu riêng nguyên chất, không sử dụng hương liệu, không dùng chất bảo quản sầu riêng.\n\nDOANH NGHIỆP TƯ NHÂN YẾN LINH - THƯƠNG HIỆU BÁNH PÍA TÂN HƯNG LỢI\n\nCửa hàng: 122 Lý Thường Kiệt, TP Sóc Trăng. ĐT: 0299 3821035\nXưởng sản xuất: 391 Mạc Đỉnh Chi, P4, TP Sóc Trăng. ĐT: 0299 3610473\nChi nhánh Sài Gòn: 418/45 Hồng Bàng, P. Minh Phụng, TP.HCM\nHotline: 0919 454 484\nWebsite: banhpiasoctrang.onrender.com\n\nChúng tôi chuyên cung cấp bánh pía chất lượng với giá cả hợp lý, phục vụ quà biếu, tiệc cưới, quà tặng doanh nghiệp, gia đình và các đơn hàng xuất khẩu.\n\nChúng tôi luôn quan tâm đến nhu cầu của khách hàng và cam kết mang lại sự hài lòng tuyệt đối về chất lượng sản phẩm và dịch vụ. Hãy liên hệ với chúng tôi ngay hôm nay!\n\nCách đặt hàng: Quý khách liên hệ qua điện thoại hoặc đặt hàng trực tiếp trên website, chúng tôi sẽ liên hệ lại nhanh chóng.\n\nThanh toán: tiền mặt hoặc chuyển khoản.\n\nLý do nên chọn sản phẩm và dịch vụ của chúng tôi:\n- Giao hàng nhanh chóng.\n- Sản phẩm đa dạng, phong phú.\n- Chất lượng đảm bảo.\n- Giá cả hợp lý.\n- Miễn phí giao hàng nội thành và các khu vực lân cận tùy theo giá trị đơn hàng.',
      featured: 0
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
