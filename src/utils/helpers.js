// src/utils/helpers.js

export function formatPrice(price) {
    if (!price) return 'Liên hệ';
    // [Gợi ý nhỏ] Sửa lại chỗ này một chút để hiển thị đẹp hơn (VD: 3.5 thay vì 3.500000)
    if (price >= 1000000) {
        let p = price / 1000000;
        // Làm tròn tối đa 1 số lẻ để gọn (VD: 3.5 Triệu)
        return parseFloat(p.toFixed(1)).toString() + " Triệu"; 
    }
    return new Intl.NumberFormat('vi-VN').format(price);
}

// [ĐÃ XÓA] export function hideNumber(address) ...

export function getDistrictSlug(district) {
    if (!district) return '';
    // Logic này hơi cứng nhắc (hardcode), nhưng nếu web chỉ có 2 quận thì OK
    return district === 'Tân Bình' ? 'tan-binh' : 'phu-nhuan';
}

export function getThumbnail(images) {
    if (!images || images.length === 0) return '/logo.png';
    const thumb = images.find(img => img.includes('_thumb'));
    return thumb ? thumb : images[0];
}
export function createSlug(str) {
  if (!str) return "";
  return str
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}