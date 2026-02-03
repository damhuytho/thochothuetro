import fs from 'fs';
import path from 'path';
import axios from 'axios';
import sharp from 'sharp';
import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListBucketsCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import { pipeline } from 'stream/promises';

dotenv.config();

// --- CẤU HÌNH ---
const DATA_PATH = './public/data.json';
const TEMP_DIR = './temp_process';
const R2_DOMAIN = process.env.R2_PUBLIC_DOMAIN;
const TIMEOUT_MS = 60000;

const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
    requestHandler: { connectionTimeout: 10000, socketTimeout: 60000 }
});

const runWithTimeout = (promise, ms, label) => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(`TIMEOUT: Quá ${ms/1000}s tại bước [${label}]`));
        }, ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
};

async function testConnection() {
    try {
        await runWithTimeout(s3.send(new ListBucketsCommand({})), 10000, "Test Connect");
        console.log("✅ Kết nối R2 tốt.");
        return true;
    } catch (e) {
        console.error("❌ Lỗi kết nối R2:", e.message);
        return false;
    }
}

async function checkR2Exists(key) {
    try {
        await s3.send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }));
        return true;
    } catch (e) { return false; }
}

async function uploadToR2(filePath, key) {
    const fileContent = fs.readFileSync(filePath);
    await runWithTimeout(s3.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME, Key: key, Body: fileContent,
        ContentType: 'image/webp', CacheControl: 'public, max-age=31536000'
    })), TIMEOUT_MS, "Upload");
}

async function deleteFromR2(key) {
    try {
        await runWithTimeout(s3.send(new DeleteObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME, Key: key
        })), 10000, "Delete");
    } catch (e) {}
}

async function downloadImage(url, filepath) {
    const response = await axios({ url, method: 'GET', responseType: 'stream', timeout: 30000 });
    await pipeline(response.data, fs.createWriteStream(filepath));
}

// --- MAIN FUNCTION ---
async function main() {
    if (!await testConnection()) return;
    if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

    const rawData = fs.readFileSync(DATA_PATH);
    let data = JSON.parse(rawData);

    let totalImages = 0;
    data.rooms.forEach(room => { if (room.image_detail) totalImages += room.image_detail.length; });

    console.log(`🚀 Tổng cộng: ${data.rooms.length} phòng - ${totalImages} ảnh.`);
    
    let globalImageCounter = 0;
    let errorCount = 0;

    for (let room of data.rooms) {
        if (!room.image_detail || room.image_detail.length === 0) continue;

        let newImageDetail = [];
        let roomChanged = false;

        for (let imgUrl of room.image_detail) {
            globalImageCounter++;
            const progressStr = `[${globalImageCounter}/${totalImages}]`;

            // Chỉ xử lý nếu chưa phải WebP
            if (!imgUrl.includes('.webp') && imgUrl.startsWith('http')) {
                const oldFileName = path.basename(imgUrl).split('?')[0];
                const newFileName = oldFileName.replace(/\.(jpg|jpeg|png)$/i, '') + '.webp';
                const tempInput = path.join(TEMP_DIR, oldFileName);
                const tempOutput = path.join(TEMP_DIR, newFileName);

                try {
                    const exists = await checkR2Exists(newFileName);

                    if (!exists) {
                        // TRƯỜNG HỢP 1: Chưa có trên R2 -> Làm bình thường
                        process.stdout.write(`${progressStr} 🔄 ${oldFileName.substring(0, 20)}... `);
                        await runWithTimeout(downloadImage(imgUrl, tempInput), 40000, "Download");
                        await sharp(tempInput).resize(1200, null, { withoutEnlargement: true }).webp({ quality: 80 }).toFile(tempOutput);
                        await uploadToR2(tempOutput, newFileName);
                        process.stdout.write(`✅ UP MỚI\n`);
                        
                        if (imgUrl.includes('img.thochothuetro.com')) await deleteFromR2(oldFileName);
                    } else {
                        // TRƯỜNG HỢP 2: Đã có trên R2 (Do chạy lần trước bị dở dang)
                        // [FIX QUAN TRỌNG] -> Vẫn phải báo là đã đổi link để lưu vào JSON
                        process.stdout.write(`${progressStr} ⏭️ Đã có R2 -> Update JSON: ${newFileName}\n`);
                    }

                    // Dù trường hợp 1 hay 2, thì kết quả cuối cùng vẫn là dùng link WebP
                    newImageDetail.push(`${R2_DOMAIN}/${newFileName}`);
                    roomChanged = true; // Đánh dấu là đã thay đổi để tí nữa lưu file

                } catch (err) {
                    process.stdout.write(`${progressStr} ❌ LỖI: ${err.message}\n`);
                    newImageDetail.push(imgUrl); // Giữ link cũ nếu lỗi
                    errorCount++;
                } finally {
                    try { if(fs.existsSync(tempInput)) fs.unlinkSync(tempInput); } catch(e){}
                    try { if(fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput); } catch(e){}
                }
            } else {
                newImageDetail.push(imgUrl);
            }
        }

        if (roomChanged) {
            room.image_detail = newImageDetail;
            if (room.image_collage) {
                room.image_collage = room.image_collage.map(link => {
                    const base = path.basename(link).split('?')[0];
                    return `${R2_DOMAIN}/${base.replace(/\.(jpg|jpeg|png)$/i, '.webp')}`;
                });
            }
            fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
        }
    }

    console.log(`\n🎉 HOÀN TẤT!`);
    if (fs.existsSync(TEMP_DIR)) fs.rmdirSync(TEMP_DIR, { recursive: true });
}

main();