import fs from 'node:fs';
import path from 'node:path';

const SITE_URL = "https://thochothuetro.com";

export async function GET() {
  // 1. Định nghĩa các trang Tĩnh (Static Pages)
  const staticPages = [
    { url: '', changefreq: 'daily', priority: 1.0 },          // Trang chủ
    { url: 'tan-binh', changefreq: 'daily', priority: 0.8 },  // Quận Tân Bình
    { url: 'phu-nhuan', changefreq: 'daily', priority: 0.8 }, // Quận Phú Nhuận
    { url: 'map-search', changefreq: 'weekly', priority: 0.8 }, // Bản đồ
    { url: 'contact', changefreq: 'monthly', priority: 0.5 },   // Liên hệ
  ];

  // 2. Lấy dữ liệu Phòng từ data.json (Dynamic Pages)
  let dynamicPages = [];
  try {
    const dataPath = path.join(process.cwd(), 'public', 'data.json');
    const jsonData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    
    // Lấy danh sách phòng Active và Rented (giống logic trang [district].astro)
    const validRooms = jsonData.rooms.filter(r => r.status === 'active' || r.status === 'rented');

    dynamicPages = validRooms.map(room => {
      // Logic slug giống hệt file [id].astro 
      const districtSlug = room.district === 'Tân Bình' ? 'tan-binh' : 'phu-nhuan';
      return {
        url: `${districtSlug}/${room.id}`,
        changefreq: 'weekly',
        priority: 0.6,
        lastmod: room.updated_at || new Date().toISOString() // Nếu data.json có ngày update thì dùng, ko thì dùng ngày build
      };
    });
  } catch (e) {
    console.error("Lỗi tạo sitemap động:", e);
  }

  // 3. Tạo nội dung XML
  const allPages = [...staticPages, ...dynamicPages];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${allPages.map((page) => `
  <url>
    <loc>${SITE_URL}/${page.url}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>
  `).join('')}
</urlset>`;

  // 4. Trả về response dạng XML
  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
    },
  });
}