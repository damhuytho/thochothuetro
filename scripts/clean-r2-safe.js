import fs from 'fs';
import path from 'path';
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config();

// =========================================================
// ⚙️ CẤU HÌNH AN TOÀN
// =========================================================
const DATA_PATH = './public/data.json';
const R2_BUCKET = process.env.R2_BUCKET_NAME;

// ⚠️ QUAN TRỌNG: Để true để CHẠY THỬ (Chỉ in ra, KHÔNG XÓA).
// Sau khi kiểm tra log thấy chuẩn 100% thì mới sửa thành false để xóa thật.
const DRY_RUN = false; 

// =========================================================

const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

async function main() {
    console.log(`\n🛡️  CHẾ ĐỘ AN TOÀN: ${DRY_RUN ? "BẬT (CHỈ QUÉT, KHÔNG XÓA)" : "TẮT (SẼ XÓA VĨNH VIỄN)"}`);
    console.log("-------------------------------------------------------------");

    // 1. PHÂN TÍCH DATA.JSON (Tạo Whitelist & Active HouseIDs)
    const rawData = fs.readFileSync(DATA_PATH);
    const data = JSON.parse(rawData);
    
    // Set chứa tên file ĐANG DÙNG (Giữ lại)
    const activeFiles = new Set();
    // Set chứa HouseID ĐANG ACTIVE (Để phân loại rác)
    const activeHouseIDs = new Set();

    data.rooms.forEach(room => {
        if(room.house_id) activeHouseIDs.add(room.house_id);

        const collectFile = (url) => {
            if(!url) return;
            // Lấy tên file chuẩn, bỏ query param
            const filename = path.basename(url).split('?')[0];
            activeFiles.add(filename);
        };

        if (room.image_detail) room.image_detail.forEach(collectFile);
        if (room.image_collage) room.image_collage.forEach(collectFile);
    });

    console.log(`✅ Dữ liệu chuẩn:`);
    console.log(`   - ${data.rooms.length} phòng active.`);
    console.log(`   - ${activeHouseIDs.size} House ID.`);
    console.log(`   - ${activeFiles.size} file ảnh đang được sử dụng (Whitelist).\n`);

    // 2. QUÉT TOÀN BỘ R2
    let continuationToken = undefined;
    let r2Files = [];
    console.log("📡 Đang tải danh sách file từ R2...");
    
    do {
        const command = new ListObjectsV2Command({
            Bucket: R2_BUCKET,
            ContinuationToken: continuationToken
        });
        const response = await s3.send(command);
        if (response.Contents) {
            response.Contents.forEach(item => r2Files.push(item.Key));
        }
        continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    console.log(`📦 Tổng file trên R2: ${r2Files.length} file.`);

    // 3. PHÂN LOẠI RÁC (ANALYZE)
    let trashFiles = [];
    let reasonStats = {
        old_version: 0, // Của phòng đang active nhưng là ảnh cũ/timestamp cũ
        deleted_room: 0, // Của phòng đã xóa khỏi hệ thống
        unknown: 0       // Không nhận diện được (nguy hiểm)
    };

    console.log("\n🔍 ĐANG PHÂN TÍCH FILE RÁC...");
    
    for (let key of r2Files) {
        // Chỉ quét file ảnh
        if (!key.match(/\.(jpg|jpeg|png|webp)$/i)) continue;

        // Nếu file có trong whitelist -> BỎ QUA (Giữ lại)
        if (activeFiles.has(key)) continue;

        // Nếu không có -> ĐÂY LÀ RÁC. Phân tích tại sao?
        let reason = "unknown";
        
        // Trích xuất HouseID từ tên file theo quy luật bạn cung cấp
        // Mẫu: ..._H_F068AB1E-ID...
        // Regex tìm chuỗi bắt đầu bằng H_ và theo sau là ký tự chữ số
        const houseIdMatch = key.match(/(H_[A-Z0-9]+)/);
        
        if (houseIdMatch) {
            const extractedHouseId = houseIdMatch[1];
            if (activeHouseIDs.has(extractedHouseId)) {
                reason = "old_version"; // HouseID này vẫn còn, nhưng file này không dùng -> Ảnh cũ
                reasonStats.old_version++;
            } else {
                reason = "deleted_room"; // HouseID này không còn trong data -> Phòng đã xóa
                reasonStats.deleted_room++;
            }
        } else {
            reasonStats.unknown++;
        }

        trashFiles.push({ key, reason });
    }

    // 4. BÁO CÁO CHI TIẾT
    console.log(`\n📋 KẾT QUẢ PHÂN TÍCH:`);
    console.log(`   🗑️  Tổng số file thừa: ${trashFiles.length}`);
    console.log(`   ---------------------------------------`);
    console.log(`   🔄 Ảnh cũ (Timestamp cũ/Resize cũ): ${reasonStats.old_version}`);
    console.log(`   ❌ Ảnh của phòng đã giải thể:       ${reasonStats.deleted_room}`);
    console.log(`   ❓ Ảnh lạ (Không có HouseID):       ${reasonStats.unknown}`);

    if (trashFiles.length > 0) {
        // In thử 10 file đầu tiên để user check
        console.log(`\n👀 Ví dụ 10 file sẽ bị xóa:`);
        trashFiles.slice(0, 10).forEach(f => {
            let label = "";
            if(f.reason === 'old_version') label = "🔄 [CŨ]";
            if(f.reason === 'deleted_room') label = "❌ [ĐÃ XÓA]";
            if(f.reason === 'unknown') label = "❓ [LẠ]";
            console.log(`   ${label} ${f.key}`);
        });

        // 5. THỰC HIỆN XÓA (Nếu DRY_RUN = false)
        if (!DRY_RUN) {
            console.log(`\n💀 ĐANG TIẾN HÀNH XÓA ${trashFiles.length} FILE...`);
            
            // Chia lô 1000 để xóa
            const chunkSize = 1000;
            for (let i = 0; i < trashFiles.length; i += chunkSize) {
                const chunk = trashFiles.slice(i, i + chunkSize);
                const deleteParams = {
                    Bucket: R2_BUCKET,
                    Delete: { Objects: chunk.map(f => ({ Key: f.key })) }
                };
                try {
                    await s3.send(new DeleteObjectsCommand(deleteParams));
                    process.stdout.write(`   Deleted ${Math.min(i + chunk.length, trashFiles.length)}/${trashFiles.length}...\r`);
                } catch (e) {
                    console.error("Lỗi xóa:", e.message);
                }
            }
            console.log("\n🎉 ĐÃ DỌN DẸP SẠCH SẼ!");
        } else {
            console.log(`\n⚠️  ĐANG Ở CHẾ ĐỘ GIẢ LẬP (DRY RUN). KHÔNG CÓ FILE NÀO BỊ XÓA.`);
            console.log(`👉 Hãy kiểm tra kỹ log trên. Nếu thấy hợp lý, mở file code sửa dòng 15: const DRY_RUN = false;`);
        }
    } else {
        console.log("\n✨ R2 SẠCH BONG! Không có file rác.");
    }
}

main();