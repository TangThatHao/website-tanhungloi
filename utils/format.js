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

module.exports = { formatPrice, slugify };
