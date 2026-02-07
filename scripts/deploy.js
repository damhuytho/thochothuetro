import { google } from 'googleapis';
import fs from 'fs';
import { 
    getGoogleAuth, createSlug, cleanHouseNumber, 
    parsePriceV2, extractStreetOnly, getPriorityAmenitiesForSlug 
} from './utils.js';
import dotenv from 'dotenv';

dotenv.config();

// ============================================================
// ⚙️ CẤU HÌNH CHẾ ĐỘ (QUAN TRỌNG)
// ============================================================
// true  = CHẾ ĐỘ TEST (Chỉ tạo file JSON, KHÔNG đẩy lên Github)
// false = CHẾ ĐỘ THẬT (Tạo file JSON + Đẩy code lên Github)
const IS_TEST_MODE = false; // Đã chuyển về false để bạn chạy luôn

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// Tên 2 Sheet nguồn
const SHEET_ACTIVE = 'Nguonhang'; // Chứa phòng Active
const SHEET_RENTED = 'Luu_Tru';   // Chứa phòng đã thuê

// Đường dẫn file Output
const OUTPUT_HANOI = './public/data_hanoi.json';
const OUTPUT_HCM   = './public/data_hochiminh.json';

// Mapping Cột (Giả định cả 2 bảng có cấu trúc cột Y HỆT nhau)
const COL = {
    UPDATED_AT_FALLBACK: 1, // B
    DISTRICT: 2,            // C 
    ADDRESS: 3,             // D 
    ROOM_CODE: 4,           // E 
    KEYPOINT: 5,            // F 
    PRICE: 6,               // G 
    DESC: 7,                // H (Mô tả gốc)
    PET: 8,                 // I 
    // STATUS: 9,           // J (Bỏ qua, dùng nguồn bảng để định đoạt)
    HOUSE_ID: 13,           // N
    ROOM_TYPE: 16,          // Q 
    UPDATED_AT: 18,         // S
    PROMOTION: 23,          // X 
    LAT: 26,                // AA 
    LNG: 27,                // AB 
    VIDEO: 28,              // AC 
    IMG_AD: 29,             // AD 
    IMG_AE: 30,             // AE 
    DESC_AI: 31,            // AF 
    CITY_INPUT: 32          // AG 
};

// ============================================================
// 🛠️ CÁC HÀM XỬ LÝ
// ============================================================

function normalizeCity(input) {
    if (!input) return 'hochiminh';
    const clean = createSlug(input).toLowerCase().replace(/[^a-z0-9]/g, "");
    const hanoiKeywords = ['hanoi', 'hn', 'thudo', 'bac', 'ha-noi'];
    if (hanoiKeywords.some(kw => clean.includes(kw))) {
        return 'hanoi';
    }
    return 'hochiminh';
}

function minifyDescription(text) {
    if (!text) return "";
    let cleanText = text;
    // Xóa câu dẫn dắt thừa thãi
    cleanText = cleanText.replace(/^(Tìm kiếm|Bạn đang tìm|Liên hệ ngay|Chào mừng đến với).*?(\.|\?|!)\s*/i, '');
    return cleanText.trim();
}

function extractCoreID(fullUrl) {
    if (!fullUrl) return "";
    try {
        const filename = fullUrl.split('/').pop();
        return filename
            .replace(/(_thumb|_web|_medium)\.webp$/i, "") 
            .replace(/\.webp$/i, "")
            .replace(/\.jpg$|\.png$/i, "");
    } catch (e) { return ""; }
}

function processRoomImages(rawAdJson, rawAeJson) {
    const adLinks = safeJsonParse(rawAdJson);
    const aeLinks = safeJsonParse(rawAeJson);

    let thumbUrl = adLinks.find(url => url.includes("_thumb"));
    let thumbID = "";
    if (thumbUrl) {
        thumbID = extractCoreID(thumbUrl);
    } else if (adLinks.length > 0) {
        thumbUrl = adLinks[0];
        thumbID = extractCoreID(thumbUrl);
    }

    const detailSet = new Set();
    adLinks.forEach(url => {
        if (url !== thumbUrl) {
            const id = extractCoreID(url);
            if (id) detailSet.add(id);
        }
    });

    const collageSet = new Set();
    aeLinks.forEach(url => {
        const id = extractCoreID(url);
        if (id) collageSet.add(id);
    });

    return {
        thumb: thumbID,
        detail: Array.from(detailSet),
        collage: Array.from(collageSet)
    };
}

function safeJsonParse(str) {
    try {
        if (!str) return [];
        if (String(str).trim().startsWith("http") && !String(str).trim().startsWith("[")) return [str.trim()];
        return JSON.parse(str);
    } catch (e) { return []; }
}

// ============================================================
// 🚀 MAIN FUNCTION
// ============================================================
async function main() {
    console.log(`🚀 BẮT ĐẦU SYNC DATA...`);
    console.log(`⚡ CHẾ ĐỘ: ${IS_TEST_MODE ? '🟡 TEST MODE (Không đẩy Github)' : '🔴 REAL MODE (Đẩy Github)'}`);
    
    const authClient = await getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    
    // 1. ĐỌC DỮ LIỆU TỪ 2 BẢNG
    console.log(`📥 Đang đọc bảng '${SHEET_ACTIVE}'...`);
    const resActive = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_ACTIVE}!A2:AG`, 
    });
    const rowsActive = resActive.data.values || [];
    console.log(`   -> Tìm thấy ${rowsActive.length} dòng Active.`);

    console.log(`📥 Đang đọc bảng '${SHEET_RENTED}'...`);
    const resRented = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_RENTED}!A2:AG`, 
    });
    const rowsRented = resRented.data.values || [];
    console.log(`   -> Tìm thấy ${rowsRented.length} dòng Rented.`);

    // Khởi tạo các biến chứa
    const roomsHanoi = [];
    const roomsHCM = [];
    const stats = {
        hanoi: { active: 0, rented: 0 },
        hcm: { active: 0, rented: 0 }
    };
    const slugTracker = {}; 

    // --- HÀM PHỤ TRỢ: Tách mã phòng để làm ID (Bỏ giá, bỏ dấu) ---
    const extractRoomCodeForID = (rawInput) => {
        if (!rawInput) return "";
        
        // 1. Tách lấy phần trước dấu "-" đầu tiên
        let str = String(rawInput).split('-')[0].trim();

        // 2. Xóa dấu tiếng Việt (giữ nguyên chữ Hoa/Thường để đẹp nếu cần debug)
        str = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        str = str.replace(/đ/g, "d").replace(/Đ/g, "D");

        // 3. Thay khoảng trắng thành dấu "-"
        str = str.replace(/\s+/g, '-');
        
        // 4. Xóa ký tự lạ
        str = str.replace(/[^a-zA-Z0-9\-]/g, "");

        return str;
    };

    // Hàm xử lý chung cho cả 2 nguồn (ĐÃ SỬA LẠI THEO YÊU CẦU MỚI)
    const processBatch = (rows, forcedStatus) => {
        rows.forEach((row) => {
            const colE_Composite = row[COL.ROOM_CODE] || ""; 
            if (!colE_Composite) return; 

            // 1. Phân loại thành phố
            const inputCityRaw = row[COL.CITY_INPUT] ? String(row[COL.CITY_INPUT]) : "";
            const cityKey = normalizeCity(inputCityRaw); 

            // 2. Xử lý thông tin cơ bản
            // --- GIỮ NGUYÊN room_code (Cột E) ---
            const roomCodeOriginal = colE_Composite; 

            // --- TẠO BIẾN RIÊNG ĐỂ GHÉP VÀO ID ---
            // Ví dụ Cột E là "P302-6.5TR-1PN" -> cleanCodeForSlug là "P302"
            const cleanCodeForSlug = extractRoomCodeForID(colE_Composite);
            
            const streetName = extractStreetOnly(row[COL.ADDRESS]); 
            const roomType = row[COL.ROOM_TYPE] || "Studio";
            const displayAddress = cleanHouseNumber(row[COL.ADDRESS]); 
            
            let finalKeypoint = row[COL.KEYPOINT] || "";
            if (String(roomType).toUpperCase().includes("1PN") && !String(finalKeypoint).toLowerCase().includes("tách bếp")) {
                finalKeypoint = "Tách bếp, " + finalKeypoint;
            }

            // 3. Xử lý trạng thái
            const finalStatus = forcedStatus; 

            // Thống kê
            if (cityKey === 'hanoi') {
                finalStatus === 'rented' ? stats.hanoi.rented++ : stats.hanoi.active++;
            } else {
                finalStatus === 'rented' ? stats.hcm.rented++ : stats.hcm.active++;
            }

            // 4. Tạo Slug (ID)
            const amenSlug = getPriorityAmenitiesForSlug(finalKeypoint, roomType);
            
            // LƯU Ý: Ở đây dùng 'cleanCodeForSlug' thay vì 'roomCodeOriginal'
            // ID sẽ KHÔNG còn chứa giá tiền
            const rawIDString = `can-ho ${roomType} ${streetName} ${amenSlug} ${cleanCodeForSlug}`;
            const baseSlug = createSlug(rawIDString);

            let finalSlug = baseSlug;
            if (slugTracker.hasOwnProperty(baseSlug)) {
                const count = slugTracker[baseSlug];
                finalSlug = `${baseSlug}-${count}`;
                slugTracker[baseSlug] = count + 1;
            } else {
                slugTracker[baseSlug] = 1;
            }

            // 5. Xử lý ảnh & Mô tả
            const processedImages = processRoomImages(row[COL.IMG_AD], row[COL.IMG_AE]);
            const minifiedDesc = minifyDescription(row[COL.DESC_AI] || row[COL.DESC] || "");

            // 6. TẠO OBJECT
            const room = {
                id: finalSlug,        // Slug sạch, không chứa giá
                city: cityKey,
                room_code: roomCodeOriginal, // Vẫn giữ nguyên cột E (P302-6.5TR...)
                district: row[COL.DISTRICT],
                address: displayAddress,
                keypoint: finalKeypoint,
                price: parsePriceV2(row[COL.PRICE]),
                desc: minifiedDesc,
                pet: row[COL.PET],
                status: finalStatus, 
                type: roomType,
                updated_at: row[COL.UPDATED_AT] || row[COL.UPDATED_AT_FALLBACK],
                promotion: row[COL.PROMOTION],
                lat: parseFloat(String(row[COL.LAT] || "0").replace(',', '.')),
                lng: parseFloat(String(row[COL.LNG] || "0").replace(',', '.')),
                video: row[COL.VIDEO],
                
                image_detail: processedImages.detail,
                image_collage: processedImages.collage,
                image_thumb: processedImages.thumb
            };

            if (cityKey === 'hanoi') {
                roomsHanoi.push(room);
            } else {
                roomsHCM.push(room);
            }
        });
    };

    // --- CHẠY XỬ LÝ ---
    // Xử lý bảng Nguonhang -> Gán Active
    processBatch(rowsActive, 'active');
    
    // Xử lý bảng Luu_Tru -> Gán Rented
    processBatch(rowsRented, 'rented');

    // --- GHI FILE ---
    const dataHanoi = {
        timestamp: new Date().getTime(),
        city: "Hà Nội",
        total: roomsHanoi.length,
        active: stats.hanoi.active,
        rented: stats.hanoi.rented,
        rooms: roomsHanoi
    };
    fs.writeFileSync(OUTPUT_HANOI, JSON.stringify(dataHanoi, null, 2));

    const dataHCM = {
        timestamp: new Date().getTime(),
        city: "Hồ Chí Minh",
        total: roomsHCM.length,
        active: stats.hcm.active,
        rented: stats.hcm.rented,
        rooms: roomsHCM
    };
    fs.writeFileSync(OUTPUT_HCM, JSON.stringify(dataHCM, null, 2));

    console.log("------------------------------------------------");
    console.log(`✅ Đã xuất file: ${OUTPUT_HANOI}`);
    console.log(`   📊 Hà Nội: Active ${stats.hanoi.active} | Rented ${stats.hanoi.rented}`);
    console.log(`✅ Đã xuất file: ${OUTPUT_HCM}`);
    console.log(`   📊 HCM:    Active ${stats.hcm.active} | Rented ${stats.hcm.rented}`);
    console.log("------------------------------------------------");

    // ============================================================
    // 📦 GIT PUSH (Chỉ chạy khi không phải Test Mode)
    // ============================================================
    if (!IS_TEST_MODE) {
        try {
            const { execSync } = await import('child_process');
            console.log("📦 Đang kiểm tra Git...");
            
            // Lấy danh sách file đã thay đổi (chỉ quan tâm file JSON)
            const status = execSync('git status --porcelain').toString();
            
            if (status) {
                console.log("🚀 Phát hiện thay đổi, đang đẩy code lên Github...");
                
                // --- ĐOẠN ĐÃ SỬA: CHỈ ADD ĐÚNG 2 FILE JSON ---
                // Thay vì 'git add .', ta chỉ add file cần thiết để tránh lỗi bảo mật
                execSync(`git add "${OUTPUT_HANOI}" "${OUTPUT_HCM}"`);
                
                // Kiểm tra xem có gì được add vào Staging Area không
                // Nếu chỉ có file rác khác thay đổi mà file JSON không đổi thì không commit
                const stagedDiff = execSync('git diff --name-only --cached').toString();
                
                if (stagedDiff.trim().length > 0) {
                    execSync('git commit -m "Auto Update Data: Multi-Source Status"');
                    execSync('git push');
                    console.log("🎉 PUSH THÀNH CÔNG!");
                } else {
                     console.log("☕ Dữ liệu JSON không đổi. Skip Push.");
                }
            } else {
                console.log("☕ Không có thay đổi nào. Skip Push.");
            }
        } catch (e) {
            console.error("⚠️ Lỗi Git:", e.message);
        }
    } else {
        console.log("🚧 Đang ở chế độ TEST. File JSON đã tạo nhưng KHÔNG đẩy lên Github.");
    }
}

main();