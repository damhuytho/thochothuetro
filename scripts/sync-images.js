import { google } from 'googleapis';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { getGoogleAuth, getDriveFolderId } from './utils.js';
import dotenv from 'dotenv';
import { pipeline } from 'stream/promises';

dotenv.config();

// ============================================================================
// 📍 CẤU HÌNH MAP CỘT
// ============================================================================
// A=0, B=1, C=2... E=4... N=13... U=20... AD=29, AE=30
const COL_INDEX_ROOM_CODE = 4;  // Cột E: Mã phòng
const COL_INDEX_HOUSE_ID  = 13; // Cột N: Mã nhà (Log kiểm tra)
const COL_INDEX_DRIVE     = 20; // Cột U: Link Folder Tòa Nhà
const COL_INDEX_KHUNG     = 29; // Cột AD: Output ảnh Khung
const COL_INDEX_COLLAGE   = 30; // Cột AE: Output ảnh Collage

// ============================================================================
// ⚙️ CẤU HÌNH CHẠY
// ============================================================================
// false = Bỏ qua nếu cột AD/AE đã có link
// true  = Chạy đè lên để cập nhật lại tên ảnh hoặc link mới
const FORCE_SYNC_AND_CLEAN = true; 

// Số lượng dòng xử lý song song cùng lúc (Tăng tốc độ)
// Khuyên dùng: 5. Nếu mạng khỏe có thể lên 10. Đừng để quá cao dễ bị Google chặn.
const CONCURRENT_LIMIT = 5; 

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = 'Nguonhang'; 
const TEMP_DIR = './temp_images';
const R2_DOMAIN = process.env.R2_PUBLIC_DOMAIN;

// Khởi tạo R2 (S3 Client)
const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

let sheets;
let drive;

// Tạo thư mục tạm nếu chưa có
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

/**
 * Hàm tạo tên file chuẩn cho Web:
 * - Bỏ dấu tiếng Việt
 * - Thay khoảng trắng và ký tự lạ bằng dấu gạch ngang
 * - Thêm hậu tố kích thước (web, medium, thumb)
 */
function generateFileNameFromOriginal(originalName, sizeSuffix) {
    const nameWithoutExt = path.parse(originalName).name;
    
    const cleanName = nameWithoutExt.toString()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Bỏ dấu
        .replace(/[đĐ]/g, 'd')
        .replace(/[^a-zA-Z0-9\-_]/g, '-') // Ký tự lạ thành -
        .replace(/-+/g, '-'); // Gộp nhiều dấu -
        
    return `${cleanName}_${sizeSuffix}.webp`;
}

/**
 * Xử lý download, resize và upload 1 file ảnh
 * Trả về danh sách link đã upload của ảnh đó
 */
async function processSingleImage(file, versionsToCreate) {
    const uploadedLinks = [];
    // Thêm timestamp vào tên file tạm để tránh xung đột khi chạy song song
    const tempFilePath = path.join(TEMP_DIR, `${file.id}_${Date.now()}.jpg`);

    try {
        // 1. Download từ Google Drive
        const dest = fs.createWriteStream(tempFilePath);
        const res = await drive.files.get({ fileId: file.id, alt: 'media' }, { responseType: 'stream' });
        await pipeline(res.data, dest);

        // 2. Resize và Upload lên R2
        for (const ver of versionsToCreate) {
            const fileName = generateFileNameFromOriginal(file.name, ver.suffix);
            
            const buffer = await sharp(tempFilePath)
                .resize({ width: ver.width, withoutEnlargement: true })
                .webp({ quality: 80 })
                .toBuffer();

            await s3.send(new PutObjectCommand({
                Bucket: process.env.R2_BUCKET_NAME,
                Key: fileName,
                Body: buffer,
                ContentType: 'image/webp',
                CacheControl: 'public, max-age=31536000, immutable' 
            }));

            const fullUrl = `${R2_DOMAIN}/${fileName}`;
            uploadedLinks.push(fullUrl);
        }
    } catch (error) {
        console.error(`      ❌ Lỗi xử lý file "${file.name}":`, error.message);
    } finally {
        // Xóa file tạm để giải phóng ổ cứng
        if (fs.existsSync(tempFilePath)) {
            try { fs.unlinkSync(tempFilePath); } catch (e) {}
        }
    }
    return uploadedLinks;
}

/**
 * Hàm xử lý logic cho từng dòng trong Sheet
 */
async function processRow(row, rowIndex) {
    // Lấy dữ liệu từ Sheet
    const roomCode = row[COL_INDEX_ROOM_CODE] ? row[COL_INDEX_ROOM_CODE].toString().trim() : "";
    const driveLink = row[COL_INDEX_DRIVE];

    // Kiểm tra xem đã có dữ liệu chưa
    const hasDataAD = row[COL_INDEX_KHUNG] && row[COL_INDEX_KHUNG].length > 10;
    const hasDataAE = row[COL_INDEX_COLLAGE] && row[COL_INDEX_COLLAGE].length > 10; 

    // Nếu không Force và đã có đủ dữ liệu thì bỏ qua
    if (!FORCE_SYNC_AND_CLEAN && hasDataAD && hasDataAE) {
        return;
    }

    if (!driveLink || !roomCode) {
        return;
    }

    // Lấy Folder ID từ link
    const folderId = getDriveFolderId(driveLink);
    if (!folderId) return;

    try {
        // 1. Lấy danh sách file trong folder (Lấy tối đa 150 file để lọc)
        const res = await drive.files.list({
            q: `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`,
            fields: 'files(id, name)',
            pageSize: 150 
        });
        const allFiles = res.data.files || [];

        if (allFiles.length === 0) return;

        // 2. Lọc sơ bộ: Chỉ lấy những file có tên chứa Mã Phòng
        const roomFiles = allFiles.filter(f => 
            f.name.toLowerCase().includes(roomCode.toLowerCase())
        );

        if (roomFiles.length === 0) {
            console.log(`⚠️ Dòng ${rowIndex} (${roomCode}): Không tìm thấy ảnh nào chứa mã phòng.`);
            return;
        }

        // ============================================================
        // 3. LỌC ẢNH KHUNG (Cột AD)
        // Điều kiện: Tên chứa mã phòng AND chứa chữ "khung"
        // ============================================================
        const khungFiles = roomFiles
            .filter(f => f.name.toLowerCase().includes("khung"))
            .sort((a, b) => a.name.localeCompare(b.name)) // Sắp xếp A-Z
            .slice(0, 6); // Lấy tối đa 6 ảnh

        // ============================================================
        // 4. LỌC ẢNH COLLAGE (Cột AE)
        // Điều kiện: Tên chứa mã phòng AND chứa chữ "collage"
        // ============================================================
        const collageFiles = roomFiles
            .filter(f => f.name.toLowerCase().includes("collage"))
            .sort((a, b) => a.name.localeCompare(b.name))
            .slice(0, 1); // Lấy đúng 1 ảnh

        let listKhungLinks = [];
        let listCollageLinks = [];

        // --- Bắt đầu upload ảnh KHUNG ---
        if (khungFiles.length > 0) {
            for (const [idx, file] of khungFiles.entries()) {
                // Ảnh đầu tiên tạo 3 bản, các ảnh sau tạo 2 bản
                const versions = [{ suffix: 'web', width: 1200 }, { suffix: 'medium', width: 800 }];
                if (idx === 0) versions.push({ suffix: 'thumb', width: 400 });

                const links = await processSingleImage(file, versions);
                listKhungLinks.push(...links);
            }
        }

        // --- Bắt đầu upload ảnh COLLAGE ---
        if (collageFiles.length > 0) {
            for (const file of collageFiles) {
                // Collage tạo 2 bản: web và medium
                const versions = [{ suffix: 'web', width: 1200 }, { suffix: 'medium', width: 800 }];
                const links = await processSingleImage(file, versions);
                listCollageLinks.push(...links);
            }
        }

        // ============================================================
        // 5. Cập nhật vào Sheet (Nếu có dữ liệu mới)
        // ============================================================
        if (listKhungLinks.length > 0 || listCollageLinks.length > 0) {
            const valKhung = listKhungLinks.length > 0 ? JSON.stringify(listKhungLinks) : "";
            const valCollage = listCollageLinks.length > 0 ? JSON.stringify(listCollageLinks) : "";

            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEET_NAME}!AD${rowIndex}:AE${rowIndex}`,
                valueInputOption: 'RAW',
                requestBody: { values: [[valKhung, valCollage]] }
            });
            console.log(`✅ Dòng ${rowIndex} (${roomCode}): Đã cập nhật [Khung: ${khungFiles.length} ảnh] - [Collage: ${collageFiles.length} ảnh]`);
        } else {
            console.log(`⚠️ Dòng ${rowIndex} (${roomCode}): Tìm thấy ảnh mã phòng nhưng không có ảnh 'Khung' hoặc 'Collage' phù hợp.`);
        }

    } catch (err) {
        console.error(`❌ Lỗi dòng ${rowIndex}:`, err.message);
    }
}

/**
 * Hàm Main: Điều phối chương trình
 */
async function main() {
    try {
        console.log('🚀 Đang khởi động...');
        const auth = await getGoogleAuth(); 
        sheets = google.sheets({ version: 'v4', auth });
        drive = google.drive({ version: 'v3', auth });

        console.log('✅ Kết nối Google thành công. Đang đọc Sheet...');

        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A2:AE`, 
        });
        
        const rows = res.data.values;
        if (!rows || rows.length === 0) return console.log('Không có dữ liệu trong Sheet.');

        console.log(`📊 Tổng số dòng dữ liệu: ${rows.length}`);
        console.log(`⚡ Chế độ chạy: ${FORCE_SYNC_AND_CLEAN ? "GHI ĐÈ (Force)" : "Bỏ qua dòng đã có dữ liệu"}`);
        console.log(`🚀 Tốc độ xử lý: ${CONCURRENT_LIMIT} dòng cùng lúc`);
        console.log('------------------------------------------------');

        // CHẠY SONG SONG THEO CỤM (Chunking)
        for (let i = 0; i < rows.length; i += CONCURRENT_LIMIT) {
            // Cắt ra một cụm dòng (ví dụ 5 dòng)
            const chunk = rows.slice(i, i + CONCURRENT_LIMIT);
            
            // Xử lý song song các dòng trong cụm này
            const promises = chunk.map((row, index) => {
                const actualRowIndex = i + index + 2; // Tính lại số dòng thực tế trong Excel (A2 bắt đầu là dòng 2)
                return processRow(row, actualRowIndex);
            });

            // Đợi tất cả các dòng trong cụm này chạy xong mới qua cụm tiếp theo
            await Promise.all(promises);
            
            console.log(`--- Đã xử lý xong cụm dòng ${i + 2} đến ${i + 2 + chunk.length - 1} ---`);
        }
        
        console.log('🎉🎉🎉 HOÀN TẤT TOÀN BỘ CÔNG VIỆC!');

    } catch (err) {
        console.error('💥 Lỗi nghiêm trọng:', err);
    }
}

main();