// =========================================================
// SERVICE WORKER - VERSION 7.1 (FINAL STABLE)
// =========================================================

const CACHE_NAME = 'tho-cho-thue-tro-v7';
const IMG_CACHE_NAME = 'tho-images-v7';
const DATA_CACHE_NAME = 'tho-data-v7'; // Cache riêng cho JSON data

// Danh sách file tĩnh bắt buộc phải có để web chạy nhanh
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

// 2. ACTIVATE: Dọn dẹp cache cũ khi bạn đổi tên version (v7 -> v8...)
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Xóa tất cả cache cũ không trùng tên phiên bản hiện tại
                    if (cacheName !== CACHE_NAME && 
                        cacheName !== IMG_CACHE_NAME && 
                        cacheName !== DATA_CACHE_NAME) {
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

    // A. BỎ QUA: Không cache Admin, API, và các request không phải GET
    if (event.request.method !== 'GET' || url.pathname.startsWith('/admin')) {
        return;
    }

    // B. [RIÊNG CHO MAP] CHIẾN LƯỢC CHO DATA JSON (Stale-While-Revalidate)
    // - Lần đầu vào: Lấy từ cache ngay cho nhanh (nếu có).
    // - Đồng thời: Tải ngầm file mới từ server về để cập nhật cho lần sau.
    // - Chỉ áp dụng cho file .json (Map dùng cái này), các trang khác không bị ảnh hưởng.
    if (url.pathname.endsWith('.json')) {
        event.respondWith(
            caches.open(DATA_CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((cachedResponse) => {
                    const fetchPromise = fetch(event.request).then((networkResponse) => {
                        // Chỉ lưu vào cache nếu tải thành công
                        if (networkResponse.status === 200) {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    });
                    // Trả về cache ngay nếu có, giúp Map hiện ngay lập tức
                    return cachedResponse || fetchPromise;
                });
            })
        );
        return;
    }

    // C. CHIẾN LƯỢC CHO HÌNH ẢNH (Cache First - Ưu tiên tốc độ tuyệt đối)
    // Áp dụng cho ảnh nội bộ, ảnh trên server img.thochothuetro.com và bản đồ nền (OSM/Carto)
    if (event.request.destination === 'image' || 
        url.hostname === 'img.thochothuetro.com' ||
        url.hostname.includes('openstreetmap.org') || // Cache bản đồ nền
        url.hostname.includes('cartocdn.com') ||      // Cache bản đồ nền
        url.pathname.match(/\.(png|jpg|jpeg|webp|gif|svg)$/)) {
        
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                // Nếu đã có ảnh trong máy khách -> Dùng ngay
                if (cachedResponse) return cachedResponse;
                
                // Nếu chưa có -> Tải về và lưu lại
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

    // D. CHIẾN LƯỢC CHO CSS/JS/FONTS (Stale-While-Revalidate)
    // Giúp web tải giao diện nhanh, tự động cập nhật code mới khi F5
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

    // E. [QUAN TRỌNG] CHIẾN LƯỢC CHO HTML (Network First - Ưu tiên mạng)
    // Áp dụng cho Trang chủ, Chi tiết phòng, Quận...
    // - Luôn cố tải mới để lấy GIÁ và TRẠNG THÁI mới nhất.
    // - Chỉ dùng Cache cũ khi mất mạng.
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