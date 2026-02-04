import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

// ============================================================================
// PHẦN 1: KẾT NỐI HỆ THỐNG (GIỮ NGUYÊN TỪ NODE.JS)
// ============================================================================

// Kết nối Google Auth
export async function getGoogleAuth() {
    const auth = new google.auth.GoogleAuth({
        keyFile: 'credentials.json',
        scopes: [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive.readonly'
        ],
    });
    return auth.getClient();
}

// Lấy Folder ID từ Link (Dùng cho sync-images)
export function getDriveFolderId(url) {
    if (!url) return null;
    const match = url.match(/[-\w]{25,}/);
    return match ? match[0] : null;
}

// ============================================================================
// PHẦN 2: LOGIC NGHIỆP VỤ CỐT LÕI (MIGRATE CHUẨN 100% TỪ SYNCGIT.TXT)
// ============================================================================

// [SOURCE 82] Hàm tạo Slug chuẩn (Giữ nguyên logic cũ)
export function createSlug(str) {
    if (!str) return "unknown";
    str = String(str); // Đảm bảo là chuỗi
    return str.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[đĐ]/g, "d")
        .replace(/[^a-z0-9]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

// [SOURCE 81] Hàm Parse Giá (Lấy số nguyên, bỏ chữ)
export function parsePriceV2(str) {
    if (!str) return 0;
    // Thay thế mọi ký tự không phải số bằng rỗng -> Parse Int
    return parseInt(String(str).replace(/\D/g, '')) || 0;
}

// [SOURCE 58-63] Hàm Bóc tách tên đường (Logic Regex quan trọng)
export function extractStreetOnly(fullAddress) {
    if (!fullAddress) return "";
    let segment = String(fullAddress).split(',')[0].trim(); // Lấy trước dấu phẩy
    
    // Cắt bỏ đuôi hành chính (Phường, Quận...)
    const stopIndex = segment.search(/(\s+Phường\b|\s+P\.\d|\s+P\d|\s+F\d|\s+Quận\b|\s+Q\.)/i);
    if (stopIndex !== -1) segment = segment.substring(0, stopIndex).trim();

    // Xóa số nhà phức tạp (A75, 39F/16...)
    segment = segment.replace(/^[\w\d\/]+\s+/i, "");
    // Xóa chữ "đường" hoặc "số" ở đầu
    segment = segment.replace(/^(đường|số)\s+/i, "");
    
    return segment.trim();
}

// [SOURCE 83-86] Hàm Xóa số nhà để hiển thị (Clean Display Address)
export function cleanHouseNumber(fullAddress) {
    if (!fullAddress) return "";
    let segment = String(fullAddress).trim();
    // Regex xóa cụm ký tự đầu tiên (số nhà/ngõ/ngách...)
    segment = segment.replace(/^[\w\d\/\.]+\s+/i, "");
    // Xóa tiếp chữ thừa
    segment = segment.replace(/^(đường|số)\s+/i, "");
    return segment.trim();
}

// [SOURCE 63-70] Hàm Tạo Slug Tiện ích (Logic ưu tiên & Logic 1PN)
export function getPriorityAmenitiesForSlug(keypoint, roomType) {
    let kp = (keypoint || "").toLowerCase();
    
    // Logic: 1PN là phải có tách bếp (tự động thêm nếu thiếu để tạo slug đúng)
    if (String(roomType).toUpperCase().includes("1PN") && !kp.includes("tách bếp")) {
        kp += ", tách bếp";
    }

    const results = [];
    const hasBanCong = kp.includes("ban công");
    const hasCuaSo = kp.includes("cửa sổ");
    const hasTachBep = kp.includes("tách bếp");
    const hasThangMay = kp.includes("thang máy");

    // Quy tắc 1: Có Ban công thì KHÔNG lấy Cửa sổ
    if (hasBanCong) results.push("ban-cong");
    else if (hasCuaSo) results.push("cua-so");

    // Quy tắc 2: Lấy thêm Tách bếp hoặc Thang máy (tối đa 2 tag)
    if (results.length < 2 && hasTachBep) results.push("tach-bep");
    if (results.length < 2 && hasThangMay) results.push("thang-may");

    return results.join("-");
}