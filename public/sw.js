// =========================================================
// SERVICE WORKER - VERSION 5.0 (HIỆU SUẤT CAO)
// =========================================================

const CACHE_NAME = 'tho-cho-thue-tro-v5';
const DATA_CACHE_NAME = 'tho-data-v5';
const IMG_CACHE_NAME = 'tho-images-v5';

const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/detail.html',
    '/logo.png',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js'
];

// 1. INSTALL
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
});

// 2. ACTIVATE (Dọn dẹp cache cũ)
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // LOGIC MỚI: Giữ lại Cache hiện tại + Cache Ảnh + Bất kỳ Cache dữ liệu nào (để main.js tự quản lý)
if (cacheName !== CACHE_NAME && 
    cacheName !== IMG_CACHE_NAME && 
    !cacheName.startsWith('tho-data-')) { // <--- QUAN TRỌNG: Giữ lại tất cả cache bắt đầu bằng 'tho-data-'
    
    console.log('[SW] Xóa cache cũ:', cacheName);
    return caches.delete(cacheName);
}
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 3. FETCH (Xử lý thông minh từng loại file)
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // A. BỎ QUA: Không cache Analytics, GTM, Admin, API lạ
    if (url.hostname.includes('google') || 
        url.hostname.includes('facebook') || 
        url.pathname.endsWith('data.json') || // <--- THÊM DÒNG NÀY: Để main.js tự lo liệu
        event.request.method !== 'GET') {
        return;
    }

    // B. CHIẾN LƯỢC 1: NETWORK FIRST (Chỉ áp dụng cho HTML)
// Đã XÓA 'data.json' khỏi đây để tránh xung đột với main.js
if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                const responseClone = response.clone();
                caches.open(DATA_CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
                return response;
            })
            .catch(() => caches.match(event.request))
    );
    return;
}

    // C. CHIẾN LƯỢC 2: STALE-WHILE-REVALIDATE (Tốc độ bàn thờ)
    // Áp dụng cho: CSS, JS, Font chữ
    if (url.pathname.endsWith('.css') || 
        url.pathname.endsWith('.js') || 
        url.href.includes('fonts.gstatic.com') ||
        url.href.includes('cdn.jsdelivr.net')) {
        
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                const fetchPromise = fetch(event.request).then((networkResponse) => {
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse.clone()));
                    return networkResponse;
                });
                return cachedResponse || fetchPromise;
            })
        );
        return;
    }

    // D. CHIẾN LƯỢC 3: CACHE FIRST (Tiết kiệm băng thông tối đa)
    // Áp dụng cho: Hình ảnh (R2 Domain & Local)
    if (event.request.destination === 'image' || url.hostname === 'img.thochothuetro.com') {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) return cachedResponse;
                
                return fetch(event.request).then((response) => {
                    // Chỉ cache nếu tải thành công (status 200)
                    if(!response || response.status !== 200 || 
                       (response.type !== 'basic' && response.type !== 'cors')) {
                        return response;
                    }
                    
                    const responseClone = response.clone();
                    caches.open(IMG_CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                    return response;
                });
            })
        );
        return;
    }

    // E. Mặc định
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});
