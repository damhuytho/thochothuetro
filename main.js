// =========================================================
// 1. CẤU HÌNH & DỮ LIỆU
// =========================================================
const SHEET_API = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS5G7jESC4agyCYLxQ2aVvcft3DwohZ3yqEhSKpLgEsjZZ-akvLVUYBiHIHX3k_TGfTSxgPsG1LhGJh/pub?gid=0&single=true&output=csv';

const PRIORITY_DISTRICTS = ["Tân Bình", "Phú Nhuận", "Bình Thạnh", "Gò Vấp", "Quận 3", "Quận 10"];
const ROOM_TYPES = ["Studio", "1PN", "2PN", "3PN", "Duplex", "Nguyên căn"];
const AMENITIES_LIST = ["Ban công", "Cửa sổ", "Tách bếp", "Nuôi Pet", "Máy giặt riêng", "Thang máy", "Full nội thất", "Giờ giấc tự do"];

let allRooms = [];
let map = null; 

// =========================================================
// 2. KHỞI TẠO
// =========================================================
window.addEventListener('DOMContentLoaded', () => {
    fetchData();
});

async function fetchData() {
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'flex';

    try {
        const response = await fetch(SHEET_API);
        const text = await response.text();
        processData(text);
    } catch (error) {
        console.error("Lỗi tải dữ liệu:", error);
        if (loading) loading.innerHTML = '<p class="text-white">Lỗi kết nối server!</p>';
    }
}

function processData(csvText) {
    const rows = parseCSV(csvText);
    
    // Map dữ liệu
    allRooms = rows.slice(1).map(row => {
        let districtRaw = (row[2] || "").trim();
        // Chuẩn hóa tên quận
        if (districtRaw.toLowerCase().startsWith("q.") || districtRaw.toLowerCase().startsWith("q ")) {
            districtRaw = districtRaw.replace(/q[\.\s]/i, "Quận ");
        }
        
        return {
            id: row[4] || "", 
            district: districtRaw,
            address: (row[3] || "").trim(),
            keypoint: (row[5] || ""), 
            price: parsePrice(row[6]),
            desc: row[7] || "",
            type: (row[16] || "").trim(),
            images: row[19] ? row[19].split('|') : [],
            promotion: (row[23] || "").trim(),
            lat: parseFloat(row[26]) || 10.801646,
            lng: parseFloat(row[27]) || 106.663158,
            video: (row[28] || "").trim(),
            amenities_search: (row[5] || "").toLowerCase()
        };
    }).filter(item => item.id && item.price > 0); 

    const urlParams = new URLSearchParams(window.location.search);
    const detailId = urlParams.get('id');
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'none';

    if (detailId) {
        renderDetailPage(detailId);
    } else {
        initFilters(); 
        
        // --- LOGIC NHẬN DIỆN TRANG ---
        const path = window.location.pathname;
        let targetDistrict = null;

        if (path.includes("tan-binh") || path.includes("tanbinh")) {
            targetDistrict = "Tân Bình";
        } else if (path.includes("phu-nhuan") || path.includes("phunhuan")) {
            targetDistrict = "Phú Nhuận";
        }

        if (targetDistrict) {
            console.log("Phát hiện trang khu vực:", targetDistrict);

            // 1. Ẩn bộ lọc quận đi (FIX: Tìm đúng ID)
            const districtFilterContainer = document.getElementById('f-district')?.parentElement;
            if(districtFilterContainer) districtFilterContainer.style.display = 'none';

            // 2. Áp dụng lọc theo quận
            applyFilters(targetDistrict); 
            
            // 3. Đổi tiêu đề
            const homeContent = document.getElementById('home-content');
            if(homeContent) homeContent.innerHTML = `<h2 class="fw-bold mb-4 border-bottom pb-2">Phòng trọ tại ${targetDistrict}</h2>`;
        } else {
            // Trang chủ
            applyFilters(); 
        }
    }
}

// =========================================================
// 3. LOGIC TRANG CHỦ & BỘ LỌC
// =========================================================
function initFilters() {
    // FIX: Sử dụng đúng ID 'f-district' thay vì 'district-filter'
    const districtSelect = document.getElementById('f-district');
    if (districtSelect) {
        const districts = allRooms.map(r => r.district).filter(d => d && d !== "");
        const uniqueDistricts = [...new Set(districts)].sort();
        let html = '<option value="all">Tất cả Khu vực</option>';
        uniqueDistricts.forEach(d => html += `<option value="${d}">${d}</option>`);
        districtSelect.innerHTML = html;
        
        districtSelect.addEventListener('change', function() {
            const val = this.value;
            if (val === "Tân Bình") { window.location.href = "tan-binh.html"; return; }
            if (val === "Phú Nhuận") { window.location.href = "phu-nhuan.html"; return; }
            applyFilters();
        });
    }

    const typeSelect = document.getElementById('type-filter'); 
    if (typeSelect) {
        let html = '<option value="all">Tất cả Loại phòng</option>';
        ROOM_TYPES.forEach(t => html += `<option value="${t}">${t}</option>`);
        typeSelect.innerHTML = html;
        typeSelect.addEventListener('change', () => applyFilters()); 
    }

    // FIX: Thêm filter giá
    const priceSelect = document.getElementById('f-price');
    if (priceSelect) {
        priceSelect.addEventListener('change', () => applyFilters());
    }

    const amenityContainer = document.getElementById('f-amenities-checkboxes');
    if (amenityContainer) {
        let html = '';
        AMENITIES_LIST.forEach((am, index) => {
            html += `
                <div class="form-check">
                    <input class="form-check-input amenity-check" type="checkbox" value="${am.toLowerCase()}" id="am-${index}" onchange="applyFilters()">
                    <label class="form-check-label small" for="am-${index}">${am}</label>
                </div>`;
        });
        amenityContainer.innerHTML = html;
    }
}

function applyFilters(forcedDistrict = null) {
    // FIX: Sử dụng đúng ID
    let districtVal = forcedDistrict || document.getElementById('f-district')?.value || 'all';
    
    // Check lại lần nữa phòng hờ
    const path = window.location.pathname;
    if (path.includes("tan-binh") || path.includes("tanbinh")) districtVal = "Tân Bình";
    if (path.includes("phu-nhuan") || path.includes("phunhuan")) districtVal = "Phú Nhuận";

    const typeVal = document.getElementById('type-filter')?.value || 'all'; 
    const priceVal = document.getElementById('f-price')?.value || 'all';
    const checkedAmenities = Array.from(document.querySelectorAll('.amenity-check:checked')).map(c => c.value);

    let filtered = allRooms.filter(room => {
        // Lọc quận
        if (districtVal !== 'all' && room.district !== districtVal) return false;
        
        // Lọc loại phòng
        if (typeVal !== 'all' && !room.type.toLowerCase().includes(typeVal.toLowerCase())) return false;
        
        // FIX: Lọc giá
        if (priceVal !== 'all') {
            const [min, max] = priceVal.split('-').map(v => parseInt(v));
            if (room.price < min || room.price > max) return false;
        }
        
        // Lọc tiện ích
        if (checkedAmenities.length > 0) {
            const hasAll = checkedAmenities.every(req => room.amenities_search.includes(req));
            if (!hasAll) return false;
        }
        return true;
    });

    // Sắp xếp ưu tiên phòng có khuyến mãi
    filtered.sort((a, b) => (b.promotion.length > 0) - (a.promotion.length > 0));
    renderGroupedByDistrict(filtered);
}

// FIX: Thêm hàm resetFilters
window.resetFilters = function() {
    // Reset tất cả dropdown
    const districtSelect = document.getElementById('f-district');
    const typeSelect = document.getElementById('type-filter');
    const priceSelect = document.getElementById('f-price');
    
    if (districtSelect) districtSelect.value = 'all';
    if (typeSelect) typeSelect.value = 'all';
    if (priceSelect) priceSelect.value = 'all';
    
    // Bỏ check tất cả amenities
    document.querySelectorAll('.amenity-check').forEach(cb => cb.checked = false);
    
    // Áp dụng lại filters
    applyFilters();
}

function renderGroupedByDistrict(rooms) {
    const container = document.getElementById('home-content');
    if (!container) return;
    
    const existingTitle = container.querySelector('h2'); 
    container.innerHTML = '';
    if(existingTitle) container.appendChild(existingTitle);

    if (rooms.length === 0) {
        container.innerHTML += '<div class="alert alert-warning text-center mt-3">Hiện chưa có phòng nào phù hợp tiêu chí này!</div>';
        return;
    }

    const grouped = {};
    rooms.forEach(room => {
        const dName = room.district || "Khu vực khác";
        if (!grouped[dName]) grouped[dName] = [];
        grouped[dName].push(room);
    });

    const sortedDistricts = Object.keys(grouped).sort();

    sortedDistricts.forEach(district => {
        const districtRooms = grouped[district];
        let html = `<div class="row g-3 mt-2">`;
        districtRooms.forEach(room => html += createCardHTML(room));
        html += `</div>`;
        container.innerHTML += html;
    });
}

function createCardHTML(room) {
    const imgUrl = (room.images.length > 0 && room.images[0].length > 5) ? room.images[0] : "https://placehold.co/600x400?text=Phong+Tro";
    const cleanAddr = cleanAddress(room.address);
    const title = `${room.id} - ${cleanAddr}`;
    const keypointHTML = room.keypoint ? `<div class="mb-2 text-secondary fst-italic small text-truncate"><i class="fas fa-star text-warning me-1"></i>${room.keypoint}</div>` : '';
    const promoBadge = room.promotion ? `<span class="position-absolute top-0 end-0 bg-warning text-dark px-2 py-1 m-2 rounded fw-bold small shadow"><i class="fas fa-gift me-1"></i> Ưu đãi</span>` : '';

    return `
        <div class="col-6 col-md-4 col-lg-4">
            <div class="card h-100 shadow-sm border-0 room-card" onclick="window.location.href='detail.html?id=${encodeURIComponent(room.id)}'" style="cursor:pointer;">
                <div class="position-relative">
                    <img src="${imgUrl}" class="card-img-top object-fit-cover" alt="${title}" style="height: 205px;">
                    ${promoBadge}
                </div>
                <div class="card-body p-3 d-flex flex-column">
                    <h6 class="card-title fw-bold text-primary mb-1 line-clamp-2" style="min-height: 2.5em;">${title}</h6>
                    <div class="mb-2">
                        <span class="text-danger fw-bold fs-6">${formatMoney(room.price)}/tháng</span>
                        <span class="text-muted small ms-1">- Có TL</span>
                    </div>
                    ${keypointHTML}
                    <div class="mt-auto pt-2 border-top">
                        <div class="d-flex justify-content-between align-items-center small text-muted">
                            <span><i class="fas fa-map-marker-alt me-1"></i> ${room.district}</span>
                            <span class="badge bg-light text-dark border">${room.type}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// =========================================================
// 4. LOGIC TRANG CHI TIẾT
// =========================================================
function renderDetailPage(id) {
    const roomId = decodeURIComponent(id);
    const room = allRooms.find(r => r.id === roomId);

    if (!room) {
        document.body.innerHTML = '<div class="container py-5 text-center"><h3>Không tìm thấy phòng này!</h3><a href="index.html" class="btn btn-primary">Về trang chủ</a></div>';
        return;
    }

    const titleEl = document.getElementById('detail-title'); if (titleEl) titleEl.textContent = `${room.id} - ${cleanAddress(room.address)}`;
    const addrEl = document.getElementById('detail-address'); if (addrEl) addrEl.textContent = room.address;
    const typeEl = document.getElementById('d-type'); if (typeEl) typeEl.textContent = room.type || "Căn hộ";
    const priceEl = document.getElementById('detail-price'); if (priceEl) priceEl.textContent = formatMoney(room.price);
    
    const promoSection = document.getElementById('promo-section');
    const promoText = document.getElementById('detail-promo');
    if (room.promotion && promoSection && promoText) {
        promoSection.style.display = 'block';
        promoText.textContent = room.promotion;
    }

    const keypointContainer = document.getElementById('detail-keypoints');
    if (keypointContainer && room.keypoint) {
        const items = room.keypoint.split(',').filter(i => i.trim());
        keypointContainer.innerHTML = items.map(i => `
            <div class="col-6 col-md-6">
                <i class="fas fa-check-circle"></i> ${i.trim()}
            </div>`).join('');
    }

    const descEl = document.getElementById('detail-desc');
    if (descEl) descEl.innerHTML = room.desc.replace(/\n/g, '<br>');

    const galleryContainer = document.getElementById('detail-gallery');
    if (galleryContainer && room.images.length > 0) {
        let html = `<img src="${room.images[0]}" class="gallery-main-img mb-2 shadow-sm" id="main-img" onclick="window.open('${room.images[0]}', '_blank')">`;
        html += '<div class="row g-2">';
        room.images.forEach((img, idx) => {
            if(idx < 5) { 
                html += `<div class="col"><img src="${img}" class="gallery-thumb" onclick="changeMainImage('${img}')"></div>`;
            }
        });
        html += '</div>';
        galleryContainer.innerHTML = html;
    }

    const videoSection = document.getElementById('video-section');
    const videoEmbed = document.getElementById('video-embed');
    if (room.video && room.video.length > 5 && videoSection) {
        videoSection.style.display = 'block';
        if (room.video.includes('youtube.com') || room.video.includes('youtu.be')) {
            const videoId = room.video.split('v=')[1]?.split('&')[0] || room.video.split('/').pop();
            videoEmbed.innerHTML = `<iframe src="https://www.youtube.com/embed/${videoId}" allowfullscreen></iframe>`;
        } else {
            videoEmbed.style.height = 'auto';
            videoEmbed.style.padding = '40px';
            videoEmbed.className = 'text-center bg-dark rounded-3';
            videoEmbed.innerHTML = `<a href="${room.video}" target="_blank" class="btn btn-danger btn-lg rounded-pill"><i class="fas fa-play-circle me-2"></i> Xem Video Tại Đây</a>`;
        }
    }

    initMap(room.lat, room.lng, room.address);
    renderRelatedApartments(room);
}

function renderRelatedApartments(currentRoom) {
    const grid = document.getElementById('related-grid');
    if (!grid) return;

    const related = allRooms.filter(r => 
        r.district === currentRoom.district && 
        r.id !== currentRoom.id &&
        Math.abs(r.price - currentRoom.price) <= 1500000 
    ).slice(0, 3); 

    if (related.length === 0) {
        grid.innerHTML = '<div class="col-12 text-center text-muted">Chưa có căn tương tự cùng khu vực.</div>';
        return;
    }

    grid.innerHTML = related.map(room => createCardHTML(room)).join('');
}

window.changeMainImage = function(src) {
    const mainImg = document.getElementById('main-img');
    if(mainImg) mainImg.src = src;
}

function initMap(lat, lng, label) {
    const mapContainer = document.getElementById('detail-map');
    if (!mapContainer) return;
    
    if (map) { map.remove(); map = null; }

    map = L.map('detail-map').setView([lat, lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    L.marker([lat, lng]).addTo(map).bindPopup(`<b>${label}</b>`).openPopup();
}

// =========================================================
// 5. HELPER FUNCTIONS
// =========================================================
function cleanAddress(fullAddr) {
    if (!fullAddr) return "";
    return fullAddr.replace(/^[\d\/a-zA-Z]+\s+(?:đường\s+)?/i, '').trim();
}

function parseCSV(text) {
    const result = [];
    let row = [];
    let inQuotes = false;
    let currentToken = '';
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];
        if (char === '"') {
            if (inQuotes && nextChar === '"') { currentToken += '"'; i++; }
            else { inQuotes = !inQuotes; }
        } else if (char === ',' && !inQuotes) {
            row.push(currentToken); currentToken = '';
        } else if ((char === '\r' || char === '\n') && !inQuotes) {
            if (currentToken || row.length > 0) row.push(currentToken);
            if (row.length > 0) result.push(row);
            row = []; currentToken = '';
            if (char === '\r' && nextChar === '\n') i++;
        } else { currentToken += char; }
    }
    if (currentToken || row.length > 0) row.push(currentToken);
    if (row.length > 0) result.push(row);
    return result;
}

function parsePrice(str) {
    if (!str) return 0;
    const clean = String(str).replace(/\D/g, '');
    return parseInt(clean) || 0;
}

function formatMoney(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace('.0', '') + ' Tr';
    return (num / 1000).toFixed(0) + 'k';
}
