// =========================================================
// 1. CẤU HÌNH & DỮ LIỆU
// =========================================================
const SHEET_API = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS5G7jESC4agyCYLxQ2aVvcft3DwohZ3yqEhSKpLgEsjZZ-akvLVUYBiHIHX3k_TGfTSxgPsG1LhGJh/pub?gid=0&single=true&output=csv';

const PRIORITY_DISTRICTS = ["Tân Bình", "Phú Nhuận"];
const ROOM_TYPES = ["Studio", "1PN", "2PN", "3PN", "Duplex", "Nguyên căn"];
const AMENITIES_LIST = ["Ban công", "Cửa sổ", "Tách bếp", "Nuôi Pet", "Máy giặt riêng", "Thang máy"];

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
            images: row[19] ? row[19].split('|').map(img => img.trim()) : [],
            promotion: (row[23] || "").trim(),
            lat: parseFloat(row[26]) || 10.801646,
            lng: parseFloat(row[27]) || 106.663158,
            video: (row[28] || "").trim(),
            image_detail: row[29] ? row[29].split('|').map(img => img.trim()) : [], // Cột AD
            image_collage: row[30] ? row[30].split('|').map(img => img.trim()) : [], // Cột AE
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

            const districtFilterContainer = document.getElementById('f-district')?.parentElement;
            if(districtFilterContainer) districtFilterContainer.style.display = 'none';

            applyFilters(targetDistrict); 
            
            const homeContent = document.getElementById('home-content');
            if(homeContent) homeContent.innerHTML = `<h2 class="fw-bold mb-4 border-bottom pb-2">Phòng trọ tại ${targetDistrict}</h2>`;
        } else {
            // Trang chủ - hiển thị theo group
            renderHomePage(); 
        }
    }
}

// =========================================================
// 3. LOGIC TRANG CHỦ & BỘ LỌC
// =========================================================
function initFilters() {
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

// Render trang chủ với group theo quận
function renderHomePage() {
    const container = document.getElementById('home-content');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Group theo quận
    const grouped = {};
    allRooms.forEach(room => {
        const dName = room.district || "Khu vực khác";
        if (!grouped[dName]) grouped[dName] = [];
        grouped[dName].push(room);
    });
    
    // Sắp xếp: Tân Bình, Phú Nhuận lên trước, các quận khác theo alphabet
    const sortedDistricts = Object.keys(grouped).sort((a, b) => {
        const aIdx = PRIORITY_DISTRICTS.indexOf(a);
        const bIdx = PRIORITY_DISTRICTS.indexOf(b);
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        if (aIdx !== -1) return -1;
        if (bIdx !== -1) return 1;
        return a.localeCompare(b);
    });
    
    sortedDistricts.forEach(district => {
        const districtRooms = grouped[district];
        
        // Sắp xếp ưu tiên có khuyến mãi
        districtRooms.sort((a, b) => (b.promotion.length > 0) - (a.promotion.length > 0));
        
        // Lấy 6 phòng đầu
        const displayRooms = districtRooms.slice(0, 6);
        const hasMore = districtRooms.length > 6;
        
        let html = `
            <div class="district-group mb-5">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h3 class="fw-bold">${district} <span class="text-muted fs-6">(${districtRooms.length} phòng)</span></h3>
                    ${hasMore ? `<a href="#" onclick="viewAllDistrict('${district}'); return false;" class="btn btn-outline-primary btn-sm rounded-pill">Xem thêm <i class="fas fa-arrow-right ms-1"></i></a>` : ''}
                </div>
                <div class="row g-3">
                    ${displayRooms.map(room => createCardHTML(room)).join('')}
                </div>
            </div>
        `;
        
        container.innerHTML += html;
    });
}

window.viewAllDistrict = function(district) {
    if (district === "Tân Bình") { window.location.href = "tan-binh.html"; return; }
    if (district === "Phú Nhuận") { window.location.href = "phu-nhuan.html"; return; }
    
    // Chọn quận trong dropdown và apply filter
    const districtSelect = document.getElementById('f-district');
    if (districtSelect) {
        districtSelect.value = district;
        applyFilters();
    }
}

function applyFilters(forcedDistrict = null) {
    let districtVal = forcedDistrict || document.getElementById('f-district')?.value || 'all';
    
    const path = window.location.pathname;
    if (path.includes("tan-binh") || path.includes("tanbinh")) districtVal = "Tân Bình";
    if (path.includes("phu-nhuan") || path.includes("phunhuan")) districtVal = "Phú Nhuận";

    const typeVal = document.getElementById('type-filter')?.value || 'all'; 
    const priceVal = document.getElementById('f-price')?.value || 'all';
    const checkedAmenities = Array.from(document.querySelectorAll('.amenity-check:checked')).map(c => c.value);

    let filtered = allRooms.filter(room => {
        if (districtVal !== 'all' && room.district !== districtVal) return false;
        if (typeVal !== 'all' && !room.type.toLowerCase().includes(typeVal.toLowerCase())) return false;
        
        if (priceVal !== 'all') {
            const [min, max] = priceVal.split('-').map(v => parseInt(v));
            if (room.price < min || room.price > max) return false;
        }
        
        if (checkedAmenities.length > 0) {
            const hasAll = checkedAmenities.every(req => room.amenities_search.includes(req));
            if (!hasAll) return false;
        }
        return true;
    });

    filtered.sort((a, b) => (b.promotion.length > 0) - (a.promotion.length > 0));
    renderGroupedByDistrict(filtered);
}

window.resetFilters = function() {
    const districtSelect = document.getElementById('f-district');
    const typeSelect = document.getElementById('type-filter');
    const priceSelect = document.getElementById('f-price');
    
    if (districtSelect) districtSelect.value = 'all';
    if (typeSelect) typeSelect.value = 'all';
    if (priceSelect) priceSelect.value = 'all';
    
    document.querySelectorAll('.amenity-check').forEach(cb => cb.checked = false);
    
    const path = window.location.pathname;
    if (!path.includes("tan-binh") && !path.includes("phu-nhuan")) {
        renderHomePage();
    } else {
        applyFilters();
    }
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
    // Lấy ảnh từ cột AD (image_detail) - ảnh đầu tiên
    let imgUrl = "https://placehold.co/600x400?text=Phong+Tro";
    if (room.image_detail.length > 0 && room.image_detail[0].length > 5) {
        imgUrl = room.image_detail[0];
    }
    
    // SEO Title: Cho thuê căn + Loại phòng + Địa chỉ (bỏ số nhà)
    const cleanAddr = cleanAddress(room.address);
    const title = `Cho thuê căn ${room.type} ${cleanAddr}`;
    
    const keypointHTML = room.keypoint ? `<div class="mb-2 text-secondary fst-italic small text-truncate"><i class="fas fa-star text-warning me-1"></i>${room.keypoint}</div>` : '';
    const promoBadge = room.promotion ? `<span class="position-absolute top-0 end-0 bg-warning text-dark px-2 py-1 m-2 rounded fw-bold small shadow"><i class="fas fa-gift me-1"></i> Ưu đãi</span>` : '';

    return `
        <div class="col-6 col-md-4 col-lg-4">
            <div class="card h-100 shadow-sm border-0 room-card" onclick="window.location.href='detail.html?id=${encodeURIComponent(room.id)}'" style="cursor:pointer;">
                <div class="position-relative">
                    <img src="${imgUrl}" class="card-img-top object-fit-cover" alt="${title}" loading="lazy" style="height: 205px;">
                    ${promoBadge}
                </div>
                <div class="card-body p-3 d-flex flex-column">
                    <h6 class="card-title fw-bold text-primary mb-1 line-clamp-2" style="min-height: 2.5em;">${title}</h6>
                    <div class="mb-2">
                        <span class="text-danger fw-bold fs-6">${formatMoney(room.price)}/tháng</span>
                        <span class="text-muted small ms-1">- Có thương lượng</span>
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

    const titleEl = document.getElementById('detail-title'); 
    if (titleEl) titleEl.textContent = `Cho thuê căn ${room.type} ${cleanAddress(room.address)}`;
    
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

    // Render Gallery chuyên nghiệp (4 ảnh từ cột AD)
    renderProfessionalGallery(room);
    
    // Render ảnh Collage (từ cột AE) - chèn giữa giá và mô tả
    renderCollageImage(room);

    const descEl = document.getElementById('detail-desc');
    if (descEl) descEl.innerHTML = room.desc.replace(/\n/g, '<br>');

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

function renderProfessionalGallery(room) {
    const galleryContainer = document.getElementById('detail-gallery');
    if (!galleryContainer) return;
    
    // Lấy 4 ảnh đầu từ image_detail (cột AD)
    const images = room.image_detail.slice(0, 4);
    
    if (images.length === 0) {
        galleryContainer.innerHTML = '<div class="bg-secondary bg-opacity-10 rounded d-flex align-items-center justify-content-center" style="height: 450px;">Chưa có ảnh</div>';
        return;
    }
    
    const mainImg = images[0];
    const thumbs = images.slice(1, 4);
    
    let html = `
        <div class="professional-gallery">
            <div class="main-image-wrapper mb-2" style="height: 450px; border-radius: 12px; overflow: hidden;">
                <img src="${mainImg}" 
                     id="main-gallery-img" 
                     class="w-100 h-100 object-fit-cover" 
                     alt="Ảnh chính căn hộ ${room.id}"
                     loading="eager"
                     style="cursor: default;">
            </div>
            ${thumbs.length > 0 ? `
            <div class="row g-2">
                ${thumbs.map((img, idx) => `
                    <div class="col-4">
                        <img src="${img}" 
                             class="w-100 gallery-thumb-pro" 
                             alt="Ảnh ${idx + 2} căn hộ ${room.id}"
                             loading="lazy"
                             onclick="changeMainGalleryImage('${img}')"
                             style="height: 130px; object-fit: cover; border-radius: 8px; cursor: pointer; opacity: 0.8; transition: 0.3s;"
                             onmouseover="this.style.opacity='1'; this.style.borderColor='#f1c40f'"
                             onmouseout="this.style.opacity='0.8'; this.style.borderColor='transparent'">
                    </div>
                `).join('')}
            </div>
            ` : ''}
        </div>
    `;
    
    galleryContainer.innerHTML = html;
}

window.changeMainGalleryImage = function(src) {
    const mainImg = document.getElementById('main-gallery-img');
    if (mainImg) {
        mainImg.style.opacity = '0.5';
        setTimeout(() => {
            mainImg.src = src;
            mainImg.style.opacity = '1';
        }, 150);
    }
}

function renderCollageImage(room) {
    // Tìm container để chèn ảnh collage (giữa highlight-box và mô tả)
    const highlightBox = document.querySelector('.highlight-box');
    const descBlock = document.querySelector('.bg-white.p-4.rounded-4.shadow-sm.border');
    
    if (!highlightBox || !descBlock) return;
    
    // Lấy 1 ảnh collage từ cột AE
    if (room.image_collage.length > 0 && room.image_collage[0].length > 5) {
        const collageImg = room.image_collage[0];
        
        // Tạo block ảnh collage
        const collageBlock = document.createElement('div');
        collageBlock.className = 'collage-block mb-4';
        collageBlock.innerHTML = `
            <div class="rounded-4 overflow-hidden shadow-sm" style="aspect-ratio: 1700/1450;">
                <img src="${collageImg}" 
                     class="w-100 h-100 object-fit-cover" 
                     alt="Hình ảnh tổng quan căn ${room.type} tại ${room.district}"
                     loading="lazy">
            </div>
        `;
        
        // Chèn vào giữa highlight-box và desc
        highlightBox.parentNode.insertBefore(collageBlock, descBlock);
    }
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
    // Xóa số nhà và "đường" ở đầu
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
