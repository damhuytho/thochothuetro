import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config();

// =========================================================
// 🛑 CẤU HÌNH AN TOÀN (CHÚ Ý CHỖ NÀY)
// =========================================================
// true  = CHỈ QUÉT VÀ ĐẾM (Không xóa gì cả) -> Mặc định
// false = XÓA THẬT (Dữ liệu mất vĩnh viễn)
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
    console.log("🔥 CÔNG CỤ XÓA TOÀN BỘ DỮ LIỆU R2");
    console.log(`🛡️  CHẾ ĐỘ AN TOÀN (DRY_RUN): ${DRY_RUN ? "BẬT (Chỉ xem)" : "TẮT (Xóa thật)"}`);
    console.log("-------------------------------------------------------------");

    const bucketName = process.env.R2_BUCKET_NAME;

    // 1. QUÉT TOÀN BỘ FILE HIỆN CÓ
    let continuationToken = undefined;
    let allKeys = [];
    
    console.log("📡 Đang tải danh sách file từ R2 (vui lòng chờ)...");
    
    do {
        const command = new ListObjectsV2Command({
            Bucket: bucketName,
            ContinuationToken: continuationToken
        });
        const response = await s3.send(command);
        
        if (response.Contents) {
            response.Contents.forEach(item => allKeys.push({ Key: item.Key }));
        }
        continuationToken = response.NextContinuationToken;
        process.stdout.write(`   ...Đã tìm thấy ${allKeys.length} file\r`);
    } while (continuationToken);

    console.log(`\n📦 TỔNG CỘNG: ${allKeys.length} file đang nằm trên R2.`);

    if (allKeys.length === 0) {
        console.log("✨ R2 đã trống trơn! Không có gì để xóa.");
        return;
    }

    // 2. THỰC HIỆN XÓA (HOẶC GIẢ LẬP)
    if (DRY_RUN) {
        console.log("\n⚠️  CẢNH BÁO: Bạn đang ở chế độ xem trước.");
        console.log("👉 Để xóa thật, hãy mở file code, sửa dòng 11 thành: const DRY_RUN = false;");
        console.log("👉 Sau đó chạy lại lệnh này.");
    } else {
        console.log(`\n💀 ĐANG TIẾN HÀNH XÓA VĨNH VIỄN ${allKeys.length} FILE...`);
        console.log("⏳ Quá trình này có thể mất vài phút...");

        // R2 chỉ cho xóa tối đa 1000 file mỗi lần request
        const chunkSize = 1000;
        let deletedCount = 0;

        for (let i = 0; i < allKeys.length; i += chunkSize) {
            const chunk = allKeys.slice(i, i + chunkSize);
            
            const deleteParams = {
                Bucket: bucketName,
                Delete: { Objects: chunk }
            };

            try {
                await s3.send(new DeleteObjectsCommand(deleteParams));
                deletedCount += chunk.length;
                process.stdout.write(`   🗑️  Đã xóa: ${deletedCount}/${allKeys.length} file...\r`);
            } catch (e) {
                console.error("\n❌ Lỗi khi xóa:", e.message);
            }
        }

        console.log("\n\n🎉 ĐÃ XÓA SẠCH SẼ! R2 GIỜ TRỐNG TRƠN.");
    }
}

main();