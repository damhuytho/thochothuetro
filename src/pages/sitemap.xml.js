import fs from 'node:fs';
import path from 'node:path';

const SITE_URL = "https://thochothuetro.com";

// Hàm tạo slug chuẩn (Giống các file khác)
function createSlug(str) {
    if (!str) return '';
    return str.toString().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .replace(/[^a-z0-9\s]/g, '')
        .trim()
        .replace(/\s+/g, '-');
}

// Hàm lấy slug thành phố
function getCitySlug(cityCode) {
    if (cityCode === 'hanoi') return 'ha-noi';
    return 'ho-chi-minh'; // Mặc định là HCM
}

export async function GET() {
  // 1. Các trang Cố định (Home, Map, Contact)
  const basePages = [
    { url: '', changefreq: 'daily', priority: 1.0 },            // Trang chủ (Landing)
    { url: 'ha-noi', changefreq: 'daily', priority: 0.9 },      // Trang chủ Hà Nội
    { url: 'ho-chi-minh', changefreq: 'daily', priority: 0.9 }, // Trang chủ HCM
    { url: 'map-search', changefreq: 'weekly', priority: 0.8 }, 
    { url: 'contact', changefreq: 'monthly', priority: 0.5 },   
  ];

  let districtPages = [];
  let roomPages = [];

  try {
    const dataPath = path.join(process.cwd(), 'public', 'data.json');
    const jsonData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    
    // Lấy danh sách phòng hợp lệ (active hoặc rented)
    const validRooms = jsonData.rooms.filter(r => r.status === 'active' || r.status === 'rented');

    // 2. [TỰ ĐỘNG] Tạo trang Quận từ data (Theo cấu trúc /city/district)
    const uniqueDistKeys = new Set();
    
    validRooms.forEach(r => {
        const cityCode = r.city ? r.city : 'hochiminh';
        const citySlug = getCitySlug(cityCode);
        const distSlug = createSlug(r.district);
        const fullPath = `${citySlug}/${distSlug}`;

        // Chỉ thêm nếu chưa có trong danh sách
        if (!uniqueDistKeys.has(fullPath)) {
            uniqueDistKeys.add(fullPath);
            districtPages.push({
                url: fullPath,
                changefreq: 'daily',
                priority: 0.8
            });
        }
    });

    // 3. [TỰ ĐỘNG] Tạo trang Chi tiết phòng (Theo cấu trúc /city/district/id)
    roomPages = validRooms.map(room => {
      const cityCode = room.city ? room.city : 'hochiminh';
      const citySlug = getCitySlug(cityCode);
      const districtSlug = createSlug(room.district);
      
      return {
        url: `${citySlug}/${districtSlug}/${room.id}`,
        changefreq: 'weekly',
        priority: 0.6,
        lastmod: room.updated_at || new Date().toISOString()
      };
    });

  } catch (e) {
    console.error("Lỗi tạo sitemap động:", e);
  }

  // 4. Gộp tất cả lại
  const allPages = [...basePages, ...districtPages, ...roomPages];

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