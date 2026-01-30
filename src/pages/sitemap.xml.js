import fs from 'node:fs';
import path from 'node:path';

const SITE_URL = "https://thochothuetro.com";

// Hàm tạo slug chuẩn (Giống các file khác để link khớp nhau 100%)
function createSlug(str) {
    if (!str) return '';
    return str.toString().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .replace(/[^a-z0-9\s]/g, '')
        .trim()
        .replace(/\s+/g, '-');
}

export async function GET() {
  // 1. Các trang Cố định (Home, Map, Contact)
  const basePages = [
    { url: '', changefreq: 'daily', priority: 1.0 },          // Trang chủ
    { url: 'map-search', changefreq: 'weekly', priority: 0.8 }, // Bản đồ
    { url: 'contact', changefreq: 'monthly', priority: 0.5 },   // Liên hệ
  ];

  let districtPages = [];
  let roomPages = [];

  try {
    const dataPath = path.join(process.cwd(), 'public', 'data.json');
    const jsonData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    
    // Lấy danh sách phòng hợp lệ
    const validRooms = jsonData.rooms.filter(r => r.status === 'active' || r.status === 'rented');

    // 2. [TỰ ĐỘNG] Tạo trang Quận từ data
    // Lấy danh sách các quận duy nhất có trong file data
    const uniqueDistricts = [...new Set(validRooms.map(r => r.district))];
    
    districtPages = uniqueDistricts.map(dist => ({
        url: createSlug(dist), // Tự động: "Bình Thạnh" -> "binh-thanh"
        changefreq: 'daily',
        priority: 0.8
    }));

    // 3. [TỰ ĐỘNG] Tạo trang Chi tiết phòng
    roomPages = validRooms.map(room => {
      // Tự động tạo slug quận dựa trên tên quận của phòng đó
      const districtSlug = createSlug(room.district);
      return {
        url: `${districtSlug}/${room.id}`,
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
    headers: {
      'Content-Type': 'application/xml',
    },
  });
}