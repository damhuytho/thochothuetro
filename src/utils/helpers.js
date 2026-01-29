// src/utils/helpers.js

export function formatPrice(price) {
    if (!price) return 'Liên hệ';
    if (price >= 1000000) return (price / 1000000).toString() + " Triệu";
    return new Intl.NumberFormat('vi-VN').format(price);
}

export function hideNumber(address) {
    if (!address) return "";
    return address.replace(/^[0-9][0-9a-zA-Z\/,.-]*\s+/, '');
}

export function getDistrictSlug(district) {
    if (!district) return '';
    return district === 'Tân Bình' ? 'tan-binh' : 'phu-nhuan';
}

export function getThumbnail(images) {
    if (!images || images.length === 0) return '/logo.png';
    const thumb = images.find(img => img.includes('_thumb'));
    return thumb ? thumb : images[0];
}