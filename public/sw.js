// =========================================================
// SERVICE WORKER - VERSION 7.2 (SAFE MODE)
// =========================================================

const CACHE_NAME = 'tho-cho-thue-tro-v8';
const IMG_CACHE_NAME = 'tho-images-v8';
const DATA_CACHE_NAME = 'tho-data-v8';

const STATIC_ASSETS = [
    '/logo.png',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css'
];

// 1. INSTALL
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
});

// 2. ACTIVATE
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
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

// 3. FETCH
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // BỎ QUA: Admin, API, Non-GET
    if (event.request.method !== 'GET' || url.pathname.startsWith('/admin')) {
        return;
    }

    // A. [MAP DATA] JSON (Stale-While-Revalidate)
    // Ưu tiên hiện cache ngay lập tức, tải mới ngầm bên dưới
    if (url.pathname.endsWith('.json')) {
        event.respondWith(
            caches.open(DATA_CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((cachedResponse) => {
                    const fetchPromise = fetch(event.request.clone()) // Clone request cho an toàn
                        .then((networkResponse) => {
                            if (networkResponse.status === 200) {
                                cache.put(event.request, networkResponse.clone());
                            }
                            return networkResponse;
                        })
                        .catch(() => cachedResponse); // Nếu mất mạng thì thôi, không lỗi

                    return cachedResponse || fetchPromise;
                });
            })
        );
        return;
    }

    // B. [IMAGES & MAP TILES] (Cache First)
    // Cache ảnh phòng, icon và đặc biệt là bản đồ nền CartoDB/OSM
    if (event.request.destination === 'image' || 
        url.hostname === 'img.thochothuetro.com' ||
        url.hostname.includes('openstreetmap.org') ||
        url.hostname.includes('cartocdn.com') ||
        url.pathname.match(/\.(png|jpg|jpeg|webp|gif|svg)$/)) {
        
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) return cachedResponse;
                
                return fetch(event.request.clone()).then((response) => {
                    // Chỉ cache nếu tải thành công và đúng loại (Basic hoặc CORS)
                    if(!response || response.status !== 200 || (response.type !== 'basic' && response.type !== 'cors')) {
                        return response;
                    }
                    const responseClone = response.clone();
                    caches.open(IMG_CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                    return response;
                }).catch(() => {
                    // [MỚI] Fallback: Nếu mất mạng và không có ảnh cache -> Trả về ảnh rỗng hoặc logo
                    // Để tránh vỡ giao diện web
                    return caches.match('/logo.png'); 
                });
            })
        );
        return;
    }

    // C. [ASSETS] CSS/JS/FONTS (Stale-While-Revalidate)
    if (event.request.destination === 'style' || 
        event.request.destination === 'script' || 
        event.request.destination === 'font') {
        
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                const fetchPromise = fetch(event.request.clone()).then((networkResponse) => {
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse.clone()));
                    return networkResponse;
                }).catch(() => cachedResponse);
                return cachedResponse || fetchPromise;
            })
        );
        return;
    }

    // D. [HTML] TRANG WEB (Network First)
    // Luôn cố tải mới nhất, chỉ dùng cache khi Offline
    if (event.request.headers.get('accept')?.includes('text/html')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
                    return response;
                })
                .catch(() => {
                    // Khi Offline -> Trả về trang đã cache
                    return caches.match(event.request).then(cachedRes => {
                        // Nếu trang chưa từng cache -> Có thể trả về trang "Offline.html" tùy chỉnh
                        if (cachedRes) return cachedRes;
                        return caches.match('/'); // Hoặc quay về trang chủ
                    });
                })
        );
        return;
    }
});