import fs from 'fs';
import path from 'path';

// --- CẤU HÌNH ---
const DATA_DIR = './public';
const FILE_HN = 'data_hanoi.json';
const FILE_HCM = 'data_hochiminh.json';

// Hàm tạo Slug (Copy y hệt từ code Astro của bạn để test độ chính xác)
function createSlug(str) {
    if (!str) return '';
    return str.toString().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .replace(/[^a-z0-9\s]/g, '')
        .trim()
        .replace(/\s+/g, '-');
}

// Hàm in màu cho dễ nhìn
const color = {
    red: (msg) => `\x1b[31m${msg}\x1b[0m`,
    green: (msg) => `\x1b[32m${msg}\x1b[0m`,
    yellow: (msg) => `\x1b[33m${msg}\x1b[0m`,
    blue: (msg) => `\x1b[34m${msg}\x1b[0m`
};

async function checkFile(fileName) {
    const filePath = path.join(DATA_DIR, fileName);
    console.log(`\n🔍 Đang kiểm tra file: ${color.blue(fileName)}...`);

    if (!fs.existsSync(filePath)) {
        console.log(color.red(`❌ LỖI CHÍ TỬ: Không tìm thấy file ${fileName} trong thư mục public!`));
        console.log(color.yellow(`👉 GIẢI PHÁP: Bạn phải chạy lệnh "node deploy.js" để sinh file data này trước.`));
        return null;
    }

    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);
        
        if (!data.rooms || !Array.isArray(data.rooms)) {
            console.log(color.red(`❌ Lỗi cấu trúc: File JSON không có mảng "rooms".`));
            return null;
        }

        const total = data.rooms.length;
        const active = data.rooms.filter(r => r.status === 'active').length;
        
        console.log(color.green(`✅ File tồn tại. Tổng số phòng: ${total} | Active: ${active}`));
        
        if (active === 0) {
            console.log(color.red(`⚠️ CẢNH BÁO: Không có phòng nào Active! Trang danh sách sẽ trống trơn.`));
        }

        return data.rooms;
    } catch (e) {
        console.log(color.red(`❌ Lỗi đọc file JSON: ${e.message}`));
        return null;
    }
}

async function runDiagnosis() {
    console.log("==========================================");
    console.log("  🕵️  BẮT ĐẦU CHẨN ĐOÁN HỆ THỐNG DATA");
    console.log("==========================================");

    // 1. KIỂM TRA FILE DATA
    const roomsHN = await checkFile(FILE_HN);
    const roomsHCM = await checkFile(FILE_HCM);

    if (!roomsHN && !roomsHCM) {
        console.log(color.red("\n⛔ DỪNG KIỂM TRA VÌ KHÔNG CÓ DATA."));
        return;
    }

    const allRooms = [...(roomsHN || []), ...(roomsHCM || [])];

    // 2. GIẢ LẬP LOGIC TRANG /ho-chi-minh (LISTING)
    console.log(`\n------------------------------------------`);
    console.log(`🏙️  KIỂM TRA TRANG DANH SÁCH: /ho-chi-minh`);
    console.log(`------------------------------------------`);
    
    // Logic Astro: Lọc city = 'hochiminh' và status = 'active'
    const hcmListingRooms = allRooms.filter(r => {
        const rCity = r.city ? r.city : 'hochiminh'; // Fallback logic
        return (rCity === 'hochiminh' || rCity === 'ho-chi-minh') && r.status === 'active';
    });

    if (hcmListingRooms.length > 0) {
        console.log(color.green(`✅ Trang /ho-chi-minh sẽ hiển thị ${hcmListingRooms.length} sản phẩm.`));
        console.log(`   (Mẫu phòng đầu tiên: ${hcmListingRooms[0].id})`);
    } else {
        console.log(color.red(`❌ LỖI: Trang /ho-chi-minh sẽ KHÔNG CÓ sản phẩm nào!`));
        console.log(`   👉 Nguyên nhân có thể:`);
        console.log(`      1. Không có phòng nào có status="active" trong file data_hochiminh.json`);
        console.log(`      2. Trường "city" trong data không phải là "hochiminh".`);
        
        // Debug sâu hơn
        const activeButWrongCity = allRooms.filter(r => r.status === 'active');
        if (activeButWrongCity.length > 0) {
             console.log(color.yellow(`      💡 Gợi ý: Tìm thấy ${activeButWrongCity.length} phòng Active nhưng City code đang là: "${activeButWrongCity[0].city}"`));
        }
    }

    // 3. GIẢ LẬP LOGIC TRANG /ho-chi-minh/[district] (DETAIL QUẬN)
    console.log(`\n------------------------------------------`);
    console.log(`📍 KIỂM TRA TRANG QUẬN: /ho-chi-minh/phu-nhuan`);
    console.log(`------------------------------------------`);

    const targetDistrictName = "Phú Nhuận"; // Tên trong Data gốc (Ví dụ)
    const targetSlug = "phu-nhuan";         // Slug mong muốn trên URL

    // Tìm xem có phòng nào thuộc quận này không
    const districtRooms = allRooms.filter(r => {
        // Chuẩn hóa tên quận trong data để so sánh
        return r.district && r.district.toLowerCase().includes("phú nhuận");
    });

    if (districtRooms.length === 0) {
        console.log(color.yellow(`⚠️ Không tìm thấy phòng nào có tên quận chứa "Phú Nhuận" trong data.`));
        console.log(`   👉 Hãy kiểm tra lại cột Quận (Cột C) trong file Excel.`);
        // Liệt kê các quận đang có
        const existingDistricts = [...new Set(allRooms.map(r => r.district))];
        console.log(`   📋 Các quận hiện có trong data: ${existingDistricts.join(', ')}`);
    } else {
        console.log(color.green(`✅ Tìm thấy ${districtRooms.length} phòng thuộc quận "Phú Nhuận" (hoặc tương tự).`));
        
        // Kiểm tra Slug sinh ra
        const rawDist = districtRooms[0].district;
        const generatedSlug = createSlug(rawDist);
        
        console.log(`   🔹 Dữ liệu gốc trong JSON: "${rawDist}"`);
        console.log(`   🔹 Slug code sẽ tạo ra:    "${generatedSlug}"`);
        
        if (generatedSlug === targetSlug) {
            console.log(color.green(`✅ Slug KHỚP hoàn toàn! Trang /ho-chi-minh/${generatedSlug} sẽ hoạt động tốt.`));
            
            // Check active trong quận này
            const activeInDist = districtRooms.filter(r => r.status === 'active').length;
            console.log(`   🔹 Số phòng Active trong quận này: ${activeInDist}`);
        } else {
            console.log(color.red(`❌ LỆCH SLUG! URL thực tế sẽ là: /ho-chi-minh/${generatedSlug}`));
            console.log(`   👉 Bạn đang truy cập sai URL hoặc data quận nhập chưa chuẩn.`);
        }
    }

    console.log("\n==========================================");
    console.log("  🏁  KẾT THÚC CHẨN ĐOÁN");
    console.log("==========================================");
}

runDiagnosis();