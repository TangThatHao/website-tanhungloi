// One-off script: backfill real product descriptions (copied verbatim from
// tanhungloi.com product detail pages) onto products that were already
// inserted with the old generic placeholder description.
// Safe to re-run: always overwrites description for the given slug.
require('dotenv').config();
const { run } = require('../db/index');

const TPL_HACCP =
  'Sử dụng nguyên liệu cao cấp.\nDa bánh mềm.\nVị ngọt dịu không gắt.\nThịt sầu riêng nguyên chất.\nLàm bằng phương pháp truyền thống kết hợp dây chuyền sản xuất khép kín.\nĐạt chuẩn HACCP - GMP, đã xuất khẩu đi nhiều nước trên thế giới.\nCông nghệ bảo quản bằng bao bì cao cấp dùng gói hút oxi bên trong để ngăn chặn sự phát triển của vi khuẩn, nấm mốc, kéo dài thời gian bảo quản bánh, sản phẩm không sử dụng chất bảo quản hay phẩm màu độc hại\n\nĐặc biệt Tân Hưng Lợi hổ trợ giao hàng tận nơi cho quý khách có nhu cầu. Giảm giá đặc biệt cho đơn hàng đặc biệt. Mọi chi tiết liên hệ SĐT 0908409788\n\nCách bảo quản: Để nơi khô ráo thoáng mát. Nên sử dụng ngay sau khi mở bao bì. Sản phẩm được bảo quản bằng bao bì và gói hút oxi bên trong, vì vậy sau khi xé bao bì thì nên ăn liền trong khoảng 7 ngày hoặc bảo quản trong ngăn mát tủ lạnh. Khi ăn có thể lấy ra cho vào lò vi sóng (Micro wave) quay nóng lại ăn sẽ ngon như bánh mới nướng hoặc ăn lạnh bánh cũng rất ngon.\n\nHạn sử dụng: 60 ngày kể từ ngày sản xuất.\n\nNgày sản xuất: Xem trên bao bì.';

const descriptions = {
  'me-lao': '',
  'pia-dau-sau-rieng-400gram-p4': TPL_HACCP + '\n\nThành phần: bột mì, đậu xanh, sầu riêng, mỡ thịt, dầu ăn, trứng, màu đỏ thực phẩm (E124)\nTrọng lượng: 400 gram/ 4 cái\nSản phẩm của DNTN Yến Linh',
  'pia-dau-sau-rieng-500gram-p5': 'gói gồm 4 bánh có 4 trứng ,  mỗi cái 125g và 1 trứng trong mỗi bánh .\n\n' + TPL_HACCP.replace('Ngày sản xuất: Xem trên bao bì.', 'Ngày sản xuất: Xem trên bao bì. bánh mới sản xuất cam kết sản xuất đúng ngày giao hàng .'),
  'hop-qua-tang-2-goi-banh-pia-dat-biet': 'Hộp quà bánh pía Tân Hưng Lợi\n\n' + TPL_HACCP,
  'hop-qua-banh-pia-khong-trung': 'Hộp quà tặng bánh pía cái nhỏ, mẫu mã đẹp, bánh nhỏ nhưng đặc biệt nhiều thịt sầu riêng, thơm ngon, không trứng\n\n' + TPL_HACCP,
  'pia-dau-sau-rieng-trung-550gram-p6l': 'Bánh được đóng gói từng cái rời, mỗi gói gồm 4 cái bên trong. Trọng lượng 550gram/gói (4 trứng)\n\n' + TPL_HACCP + 'cam kết hàng mới sản xuất đúng ngày gửi hàng.',
  'pia-chay-dau-sau-rieng-400gram-p4cc': 'Bánh pía chay Tân Hưng Lơi, đạt chuẩn HACCAP và GMP, đã xuất khẩu đi các nước Châu Âu, Mĩ, Úc, Ấn, Hàn, Trung Quốc ...\n\nBánh sử dụng những nguyên liệu cao cấp, thịt sầu riêng nguyên chất, đậu xanh loại thượng hạng, làm bằng phương pháp làm bánh truyền thống kết hợp dây chuyền sản xuất khép kín, không sử dụng chất bảo quản độc hại. \n\nĐặc biệt Tân Hưng Lợi hổ trợ giao bánh tận nơi cho khách hàng có nhu cầu. Liên hệ 0908409788.',
  'pia-dau-sau-rieng-600gram-p6': 'Thành phần: bột mì, đậu xanh, sầu riêng, mỡ thịt, dầu ăn, trứng, màu đỏ thực phẩm (E124)\nTrọng lượng: 600 gram/ 4 cái , mỗi cái 1 trứng gói 4 trứng .\nSản phẩm của DNTN Yến Linh\n\n' + TPL_HACCP + 'cam kết hàng mới sản xuất đúng ngày gửi hàng.',
  'pia-dau-sau-rieng-trung-450gram-p5l': '',
  'pia-dau-sau-rieng-250gram-p250': 'Thành phần: bột mì, đậu xanh, sầu riêng, mỡ thịt, dầu ăn, màu đỏ thực phẩm (E124)\nTrọng lượng: 250 gram/ 4 cái\nSản phẩm của DNTN Yến Linh',
  'pia-dau-sau-rieng-khong-trung-500gram-p5kt': 'Thành phần: bột mì, đậu xanh, sầu riêng, mỡ thịt, dầu ăn, màu đỏ thực phẩm (E124)\nTrọng lượng: 500 gram/ 4 cái\nSản phẩm của DNTN Yến Linh',
  'pia-mon-sau-rieng-500gram-p5m': 'Thành phần: bột mì, khoai môn, sầu riêng, mỡ thịt, dầu ăn, trứng, màu đỏ thực phẩm (E124)\nTrọng lượng: 500gram/ 4 cái\nSản phẩm của DNTN Yến Linh',
  'banh-pia-dau-dua-sau-rieng': '',
  'banh-in-nhan-500gram': 'bánh in nhân đậu xanh sầu riêng , gói 4 cái , làm từ bột nếp , đậu xanh , sầu riêng , đường , dầu ăn và mạch nha , không chất bảo quản , bánh mền dẻo và thơm béo tự nhiên ,\n\nhạn sử dụng 30 ngày , ngày  sản xuất  mới nhất .',
  'banh-pia-dau-sau-rieng-trung': 'Thành phần: bột mì, đậu xanh, sầu riêng, trứng muối, mỡ, đường\n\nQuy cách đóng gỏi: 4cái/gói (300gram)\n\nQuy cách đóng thùng: 60 gói/thùng',
  'pia-dau-sau-rieng-trung-400gram-p4l': 'Bánh được đóng gói từng cái rời, mỗi gói gồm 4 cái bên trong. Trọng lượng 400gram/gói (2 trứng)\n\n' + TPL_HACCP + 'cam kết hàng mới sản xuất đúng ngày gửi hàng.',
  'pia-mon-sau-rieng-300gram-p3m': 'Thành phần: bột mì, khoai môn, sầu riêng, mỡ thịt, dầu ăn, trứng, màu đỏ thực phẩm (E124)\nTrọng lượng: 300gram/ 4 cái\nSản phẩm của DNTN Yến Linh',
  'hop-qua-banh-pia-sau-rieng-dac-biet-khong-trung': 'Hộp quà tặng bánh pía cái nhỏ, mẫu mã đẹp, bánh nhỏ nhưng đặc biệt nhiều thịt sầu riêng, thơm ngon, không trứng\n\nĐặc trưng của bánh pia Tân Hưng Lợi là còn giữ lại phương pháp làm bánh truyền thống, kết hợp sản xuất trên quy trình khép kín đạt chuẩn HACCAP và GMP, công nghệ bảo quản bằng bao bì cao cấp dùng gói hút oxi bên trong để ngăn chặn sự phát triển của vi khuẩn, nấm mốc, kéo dài thời gian bảo quản bánh, sản phẩm không sử dụng chất bảo quản hay phẩm màu độc hại\n\nĐặc biệt Tân Hưng Lợi hổ trợ giao hàng tận nơi cho quý khách có nhu cầu. Giảm giá đặc biệt cho đơn hàng đặc biệt. Mọi chi tiết liên hệ SĐT 0908409788',
  'banh-in-nhan-hinh-chu-nhat': 'Bánh in nhân hình chữ nhật Tân Hưng Lợi',
  'banh-chay-xuat-khau-400gram': '',
  'banh-pia-sau-rieng-khong-trung-xuat-khau': 'Thành phần: bột mì, đậu xanh, sầu riêng, mỡ thịt, dầu ăn, màu đỏ thực phẩm (E124)\nTrọng lượng: 400 gram/ 4 cái\nSản phẩm của DNTN Yến Linh',
  'banh-pia-khoai-mon-sau-rieng-dac-biet-thom-ngon': 'Mã sản phẩm: PKT_KM Bánh pía khoai môn sầu riêng đặc biệt thơm ngon\n\nTrọng lượng 500gram\n\nThành phần: khoai môn, sầu riêng, bột mì, đường dầu ăn...',
  'pia-dau-sau-rieng-450gram-ph450': '',
  'pia-dau-sau-rieng-trung-550gram-p6l-2': 'Bánh được đóng gói từng cái rời, mỗi gói gồm 4 cái bên trong. Trọng lượng 550gram/gói (4 trứng)\n\n' + TPL_HACCP + 'cam kết hàng mới sản xuất đúng ngày gửi hàng.',
  'pia-dau-sau-rieng-400gram-p4l': 'Bánh được đóng gói từng cái rời, mỗi gói gồm 4 cái bên trong. Trọng lượng 400gram/gói\n\n' + TPL_HACCP,
  'pia-dau-sau-rieng-450gram-ph450-2': ''
};

async function main() {
  let updated = 0;
  for (const [slug, desc] of Object.entries(descriptions)) {
    const r = await run('UPDATE products SET description = ? WHERE slug = ?', [desc, slug]);
    if (r.rowCount > 0) updated++;
    else console.log(`[not found] ${slug}`);
  }
  console.log(`Xong. Đã cập nhật mô tả cho ${updated} sản phẩm.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
