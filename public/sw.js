// =========================================================
// SERVICE WORKER - VERSION 6.0 (OPTIMIZED FOR ASTRO)
// =========================================================

const CACHE_NAME = 'tho-cho-thue-tro-v6';
const IMG_CACHE_NAME = 'tho-images-v6';

// Chỉ cache những file tĩnh cốt lõi, KHÔNG cache file html cụ thể để tránh lỗi
const STATIC_ASSETS = [
    '/logo.png',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css'
];

// 1. INSTALL: Cài đặt và cache file tĩnh
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
});

// 2. ACTIVATE: Dọn dẹp cache cũ khi lên version mới
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Xóa tất cả cache cũ không trùng tên phiên bản hiện tại
                    if (cacheName !== CACHE_NAME && cacheName !== IMG_CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 3. FETCH: Chiến lược cache thông minh
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // A. BỎ QUA: Không cache Admin, API, các method không phải GET
    if (event.request.method !== 'GET' || url.pathname.startsWith('/admin')) {
        return;
    }

    // B. CHIẾN LƯỢC CHO HÌNH ẢNH (Cache First - Quan trọng nhất)
    // Áp dụng cho ảnh nội bộ và ảnh CDN
    if (event.request.destination === 'image' || 
        url.hostname === 'img.thochothuetro.com' ||
        url.pathname.match(/\.(png|jpg|jpeg|webp|gif|svg)$/)) {
        
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                // Nếu có trong cache thì lấy ra dùng ngay -> Cực nhanh
                if (cachedResponse) return cachedResponse;
                
                // Nếu chưa có thì tải từ mạng về rồi lưu vào cache
                return fetch(event.request).then((response) => {
                    if(!response || response.status !== 200 || response.type !== 'basic' && response.type !== 'cors') {
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

    // C. CHIẾN LƯỢC CHO CSS/JS/FONTS (Stale-While-Revalidate)
    // Dùng cái cũ cho nhanh, đồng thời tải cái mới ngầm để lần sau dùng
    if (event.request.destination === 'style' || 
        event.request.destination === 'script' || 
        event.request.destination === 'font') {
        
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

    // D. CHIẾN LƯỢC CHO HTML (Network First)
    // Luôn ưu tiên tải mới để khách thấy giá/trạng thái phòng mới nhất.
    // Nếu mất mạng mới dùng cache cũ.
    if (event.request.headers.get('accept')?.includes('text/html')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
                    return response;
                })
                .catch(() => caches.match(event.request)) // Fallback khi offline
        );
        return;
    }
});
