function formatPrice(price) {
  if (price === null || price === undefined) return 'Liên hệ';
  return Number(price).toLocaleString('vi-VN') + ' VNĐ';
}

function slugify(str) {
  return str
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const CATEGORY_ICON_RULES = [
  [/xuất khẩu/i, '📦'],
  [/sầu riêng/i, '🌰'],
  [/môn/i, '🍠'],
  [/không trứng|chay/i, '🌿'],
  [/trứng/i, '🥚'],
  [/in\b/i, '🍪'],
  [/gạo/i, '🌾'],
  [/đặc sản/i, '⭐']
];

function categoryIcon(name) {
  const match = CATEGORY_ICON_RULES.find(([re]) => re.test(name));
  return match ? match[1] : '🥮';
}

module.exports = { formatPrice, slugify, categoryIcon };
