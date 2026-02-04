import fs from 'node:fs';
import path from 'node:path';

const SITE_URL = "https://thochothuetro.com";

// Hàm tạo slug chuẩn
function createSlug(str) {
    if (!str) return '';
    return str.toString().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .replace(/[^a-z0-9\s]/g, '')
        .trim()
        .replace(/\s+/g, '-');
}

// Hàm chuyển đổi city code sang slug trên URL
function getCitySlug(cityCode) {
    if (cityCode === 'hanoi') return 'ha-noi';
    return 'ho-chi-minh';
}

export async function GET() {
  // 1. Các trang Cố định (Landing, Trang chủ Hà Nội, Trang chủ HCM...)
  const basePages = [
    { url: '', changefreq: 'daily', priority: 1.0 },            // Trang chủ chung
    { url: 'ha-noi', changefreq: 'daily', priority: 0.9 },      // Trang Hà Nội
    { url: 'ho-chi-minh', changefreq: 'daily', priority: 0.9 }, // Trang HCM
    { url: 'map-search', changefreq: 'weekly', priority: 0.8 }, // Trang bản đồ
    { url: 'contact', changefreq: 'monthly', priority: 0.5 },   // Trang liên hệ
  ];

  let districtPages = [];
  let roomPages = [];

  try {
    // --- ĐỌC DỮ LIỆU TỪ CẢ 2 FILE JSON ---
    const hanoiPath = path.join(process.cwd(), 'public', 'data_hanoi.json');
    const hcmPath = path.join(process.cwd(), 'public', 'data_hochiminh.json');

    let roomsHanoi = [];
    let roomsHCM = [];

    // Kiểm tra và đọc file Hà Nội
    if (fs.existsSync(hanoiPath)) {
        const dataHN = JSON.parse(fs.readFileSync(hanoiPath, 'utf-8'));
        roomsHanoi = dataHN.rooms || [];
    }

    // Kiểm tra và đọc file HCM
    if (fs.existsSync(hcmPath)) {
        const dataHCM = JSON.parse(fs.readFileSync(hcmPath, 'utf-8'));
        roomsHCM = dataHCM.rooms || [];
    }

    // Gộp tất cả phòng lại để xử lý chung
    const allRooms = [...roomsHanoi, ...roomsHCM];
    
    // Lấy danh sách phòng hợp lệ (active hoặc rented)
    const validRooms = allRooms.filter(r => r.status === 'active' || r.status === 'rented');

    // 2. [TỰ ĐỘNG] Tạo trang Quận (Cấu trúc: /city-slug/district-slug)
    const uniqueDistKeys = new Set();
    
    validRooms.forEach(r => {
        const citySlug = getCitySlug(r.city); // r.city giờ là 'hanoi' hoặc 'hochiminh'
        const distSlug = createSlug(r.district);
        const fullPath = `${citySlug}/${distSlug}`;

        // Chỉ thêm nếu chưa có trong danh sách để tránh trùng lặp
        if (!uniqueDistKeys.has(fullPath)) {
            uniqueDistKeys.add(fullPath);
            districtPages.push({
                url: fullPath,
                changefreq: 'daily',
                priority: 0.8
            });
        }
    });

    // 3. [TỰ ĐỘNG] Tạo trang Chi tiết phòng (Cấu trúc: /city-slug/district-slug/id)
    roomPages = validRooms.map(room => {
      const citySlug = getCitySlug(room.city);
      const districtSlug = createSlug(room.district);
      
      return {
        url: `${citySlug}/${districtSlug}/${room.id}`,
        changefreq: 'weekly',
        priority: 0.6,
        lastmod: room.updated_at || new Date().toISOString()
      };
    });

  } catch (e) {
    console.error("⚠️ Lỗi tạo sitemap:", e);
  }

  // 4. Gộp tất cả lại thành danh sách cuối cùng
  const allPages = [...basePages, ...districtPages, ...roomPages];

  // 5. Tạo chuỗi XML
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${allPages.map((page) => `
  <url>
    <loc>${SITE_URL}/${page.url}</loc>
    <lastmod>${page.lastmod || new Date().toISOString()}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>
  `).join('')}
</urlset>`;

  return new Response(sitemap, {
    status: 200,
    headers: {
      "Content-Type": "application/xml"
    }
  });
}