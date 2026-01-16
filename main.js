// CẤU HÌNH LIÊN KẾT
const SHEET_NGUONHANG = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS5G7jESC4agyCYLxQ2aVvcft3DwohZ3yqEhSKpLgEsjZZ-akvLVUYBiHIHX3k_TGfTSxgPsG1LhGJh/pub?gid=0&single=true&output=csv';
const SHEET_TIENICH   = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS5G7jESC4agyCYLxQ2aVvcft3DwohZ3yqEhSKpLgEsjZZ-akvLVUYBiHIHX3k_TGfTSxgPsG1LhGJh/pub?gid=2072224303&single=true&output=csv';
const NO_IMAGE_URL    = "https://placehold.co/600x400?text=Tho+Cho+Thue+Tro";

let allRooms = [];
let allAmenities = [];
let map = null;

// TỰ ĐỘNG CHẠY KHI TRANG WEB TẢI XONG
window.onload = () => {
    // Tắt loading sau 2s đề phòng mạng chậm
    setTimeout(() => { 
        const loading = document.getElementById('loading');
        if(loading) loading.style.display = 'none'; 
    }, 2000);
    loadData();
};

function loadData() {
    Promise.all([
        new Promise(resolve => Papa.parse(SHEET_TIENICH, { download: true, header: true, complete: res => resolve(res.data) })),
        new Promise(resolve => Papa.parse(SHEET_NGUONHANG, { download: true, header: true, complete: res => resolve(res.data) }))
    ]).then(([amenities, rooms]) => {
        allAmenities = amenities;
        allRooms = rooms;
        
        // Kiểm tra xem đang ở trang nào để chạy code tương ứng
        if(document.getElementById('home-page-container')) {
            initHomePage();
        } else if(document.getElementById('detail-page-container')) {
            initDetailPage();
        }
    });
}

// --- LOGIC TRANG CHỦ ---
function initHomePage() {
    document.getElementById('loading').style.display = 'none';
    setupMenusAndFilters();
    renderHomeGroups();
}

function setupMenusAndFilters() {
    let districts = new Set();
    let types = new Set();
    let amenities = new Set();

    allRooms.forEach(r => {
        if(r['Quận']) districts.add(r['Quận'].trim());
        if(r['Loại Phòng']) types.add(r['Loại Phòng'].trim());
        if(r['Điểm Nổi Bật']) {
            r['Điểm Nổi Bật'].split(',').forEach(tag => amenities.add(tag.trim()));
        }
    });

    // Render Menu & Select
    const render = (set, menuId, selectId) => {
        const menu = document.getElementById(menuId);
        const select = document.getElementById(selectId);
        if(!menu || !select) return;
        
        [...set].sort().forEach(item => {
            menu.innerHTML += `<li><a class="dropdown-item" href="#" onclick="quickFilter('${selectId}', '${item}')">${item}</a></li>`;
            select.innerHTML += `<option value="${item}">${item}</option>`;
        });
    };

    render(districts, 'menu-districts', 'f-district');
    render(types, 'menu-types', 'f-type');

    // Render Checkbox Tiện ích
    const amContainer = document.getElementById('f-amenities-checkboxes');
    if(amContainer) {
        [...amenities].sort().forEach((am, idx) => {
            amContainer.innerHTML += `
                <div class="form-check">
                    <input class="form-check-input f-am-check" type="checkbox" value="${am}" id="chk-${idx}">
                    <label class="form-check-label small" for="chk-${idx}">${am}</label>
                </div>
            `;
        });
    }
}

function renderHomeGroups() {
    const container = document.getElementById('home-content');
    if(!container) return;
    container.innerHTML = '';
    
    document.getElementById('search-results').style.display = 'none';
    document.getElementById('home-content').style.display = 'block';

    // 1. Lấy tất cả quận
    let allDistricts = [...new Set(allRooms.map(r => r['Quận']).filter(d => d))];
    
    // 2. Sắp xếp thứ tự ưu tiên: Tân Bình -> Phú Nhuận -> Còn lại (A-Z)
    let priority = ['Quận Tân Bình', 'Quận Phú Nhuận'];
    let others = allDistricts.filter(d => !priority.includes(d)).sort();
    let sortedDistricts = [...priority.filter(d => allDistricts.includes(d)), ...others];

    sortedDistricts.forEach(d => {
        let rooms = allRooms.filter(r => r['Quận'] === d);
        // Ưu tiên Khuyến mại lên đầu
        rooms.sort((a,b) => (b['Khuyến Mại']?.length || 0) - (a['Khuyến Mại']?.length || 0));
        
        if(rooms.length > 0) {
            let section = document.createElement('div');
            // Giao diện Section Header kiểu Housa
            section.innerHTML = `
                <div class="d-flex justify-content-between align-items-end mb-4 mt-5">
                    <div>
                        <span class="text-primary fw-bold text-uppercase small">Khu vực</span>
                        <h2 class="fw-bold mb-0">${d}</h2>
                    </div>
                    <a href="#" onclick="quickFilter('f-district', '${d}')" class="btn btn-outline-dark rounded-pill px-4 btn-sm fw-bold">Xem tất cả</a>
                </div>
                <div class="row g-4">
                    ${rooms.slice(0, 6).map(r => createCardHTML(r)).join('')}
                </div>
            `;
            container.appendChild(section);
        }
    });
}

function applyFilters() {
    const sDistrict = document.getElementById('f-district').value;
    const sType = document.getElementById('f-type').value;
    const sPrice = document.getElementById('f-price').value;
    const checkedAms = Array.from(document.querySelectorAll('.f-am-check:checked')).map(c => c.value);

    let filtered = allRooms.filter(r => {
        if(sDistrict !== 'all' && r['Quận'] !== sDistrict) return false;
        if(sType !== 'all' && r['Loại Phòng'] !== sType) return false;
        
        let p = parseInt(r['Giá tiền']) || 0;
        if(sPrice !== 'all') {
            let [min, max] = sPrice.split('-').map(Number);
            if(p < min || p > max) return false;
        }

        if(checkedAms.length > 0) {
            let roomAms = (r['Điểm Nổi Bật'] || '');
            let hasAll = checkedAms.every(am => roomAms.includes(am));
            if(!hasAll) return false;
        }
        return true;
    });

    document.getElementById('home-content').style.display = 'none';
    document.getElementById('search-results').style.display = 'block';
    
    const grid = document.getElementById('products-grid');
    grid.innerHTML = filtered.length ? filtered.map(r => createCardHTML(r)).join('') : '<div class="col-12 text-center py-5 text-muted">Không tìm thấy phòng nào.</div>';
    document.getElementById('search-title').innerText = `Tìm thấy ${filtered.length} kết quả`;
}

function quickFilter(elementId, value) {
    document.getElementById(elementId).value = value;
    applyFilters();
    document.getElementById('listing-view').scrollIntoView({behavior:'smooth'});
}

function resetFilters() {
    document.getElementById('f-district').value = 'all';
    document.getElementById('f-type').value = 'all';
    document.getElementById('f-price').value = 'all';
    document.querySelectorAll('.f-am-check').forEach(c => c.checked = false);
    renderHomeGroups();
}

// --- LOGIC TRANG CHI TIẾT ---
function initDetailPage() {
    document.getElementById('loading').style.display = 'none';
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    if(!id) return;

    let room = allRooms.find(r => (r['ID'] || Object.values(r)[0]) == id);
    if(!room) return;

    // 1. Fill ảnh chính (Cover)
    let img = room['Hình ảnh'];
    if(!img || !img.startsWith('http')) img = NO_IMAGE_URL;
    document.getElementById('d-img').src = img;

    // 2. Fill thông tin cơ bản
    document.getElementById('d-title').innerText = room['Phòng (P+Mã - Giá)'];
    document.getElementById('d-address').innerText = hideHouseNumber(room['Địa chỉ']);
    
    // 3. SIDEBAR: Giá tiền & Bộ lọc mini
    let price = parseInt(room['Giá tiền']) || 0;
    let priceText = price ? (price/1000000).toFixed(1) + " Triệu/tháng" : "Liên hệ";
    document.getElementById('d-price-sidebar').innerText = priceText; // Hiển thị giá ở sidebar

    // 4. VIDEO (Cột AC)
    let videoUrl = room['Video'] || room['video']; // Cột AC
    const videoBox = document.getElementById('video-section');
    if(videoUrl && videoUrl.includes('http')) {
        videoBox.style.display = 'block';
        // Chuyển link Youtube thường thành link Embed nếu cần
        let embedUrl = videoUrl.replace("watch?v=", "embed/"); 
        document.getElementById('d-video').src = embedUrl;
    } else {
        videoBox.style.display = 'none';
    }

    // 5. Nội dung & Tiện ích
    document.getElementById('d-desc').innerText = room['Đặc điểm'] || 'Đang cập nhật...';
    
    // Render Tiện ích (Tags)
    if(room['Điểm Nổi Bật']) {
        let tagsHtml = room['Điểm Nổi Bật'].split(',').map(tag => 
            `<div class="col-6 col-md-4"><div class="feature-item"><i class="fas fa-check-circle"></i> ${tag.trim()}</div></div>`
        ).join('');
        document.getElementById('d-features').innerHTML = tagsHtml;
    }

    // 6. Căn hộ tương tự (Cùng Quận, Giá +- 20%)
    renderRelatedHousa(room, price);

    // 7. Map
    setTimeout(() => initMap(room), 500);
}

function renderRelatedHousa(currentRoom, currentPrice) {
    const grid = document.getElementById('related-grid');
    let related = allRooms.filter(r => 
        r['Quận'] === currentRoom['Quận'] && 
        (r['ID'] || Object.values(r)[0]) !== (currentRoom['ID'] || Object.values(currentRoom)[0])
    );
    
    // Lọc giá biên độ 20%
    if(currentPrice > 0) {
        related = related.filter(r => {
            let p = parseInt(r['Giá tiền']) || 0;
            return p >= currentPrice * 0.8 && p <= currentPrice * 1.2;
        });
    }

    // Lấy 4 căn
    let display = related.sort(() => 0.5 - Math.random()).slice(0, 4);
    grid.innerHTML = display.map(r => createCardHTML(r)).join('');
}



function initMap(room) {
    let lat = parseFloat(room['Latitude'] || room['Lat'] || Object.values(room)[26]);
    let lng = parseFloat(room['Longitude'] || room['Lng'] || Object.values(room)[27]);

    if (isNaN(lat) || isNaN(lng) || lat === 0) {
        document.getElementById('map-detail').innerHTML = '<div class="d-flex h-100 justify-content-center align-items-center bg-light text-muted">Chưa có tọa độ chính xác</div>';
        return;
    }

    if(map) map.remove();
    map = L.map('map-detail').setView([lat, lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {attribution:'&copy; OpenStreetMap'}).addTo(map);

    L.marker([lat, lng], {
        icon: L.divIcon({ html: '<div style="background:#e74c3c; width:20px; height:20px; border-radius:50%; border:2px solid white;"></div>', className: 'dummy' })
    }).addTo(map).bindPopup("<b>Vị trí phòng</b>").openPopup();

    allAmenities.forEach(am => {
        let aLat = parseFloat(am['Lat'] || Object.values(am)[7]);
        let aLng = parseFloat(am['Lng'] || Object.values(am)[8]);
        if(!isNaN(aLat)) {
            let dist = Math.sqrt(Math.pow(aLat-lat, 2) + Math.pow(aLng-lng, 2));
            if(dist < 0.015) {
                let type = (am['Loại dữ liệu'] || '').toLowerCase();
                let color = type.includes('trường') ? '#3498db' : '#e67e22';
                L.circleMarker([aLat, aLng], {radius: 6, color: color, fillOpacity: 0.8}).addTo(map).bindPopup(am['Tên địa điểm']);
            }
        }
    });
}

// --- TIỆN ÍCH CHUNG ---
function createCardHTML(room) {
    let id = room['ID'] || Object.values(room)[0];
    let price = parseInt(room['Giá tiền']) || 0;
    let priceText = price ? (price/1000000).toFixed(1) + " Tr" : "Thỏa thuận";
    let img = room['Hình ảnh'];
    if(!img || !img.startsWith('http')) img = NO_IMAGE_URL;
    let safeAddr = hideHouseNumber(room['Địa chỉ']);
    
    let promoTag = (room['Khuyến Mại'] && room['Khuyến Mại'].length > 2) 
        ? `<span class="housa-tag"><i class="fas fa-gift"></i> KM</span>` 
        : `<span class="housa-tag" style="background:#2c3e50">${room['Loại Phòng']}</span>`;

    return `
        <div class="col-12 col-md-6 col-lg-4">
            <div class="room-card" onclick="window.location.href='detail.html?id=${id}'">
                <div class="img-housa-wrapper">
                    <img src="${img}" class="img-housa" onerror="this.src='${NO_IMAGE_URL}'">
                    ${promoTag}
                    <div class="housa-price">${priceText}</div>
                </div>
                <div class="p-3">
                    <div class="text-muted small mb-1"><i class="fas fa-map-marker-alt text-warning me-1"></i> ${room['Quận']}</div>
                    <h6 class="fw-bold text-dark text-truncate mb-2" style="font-size:1.1rem">${room['Phòng (P+Mã - Giá)']}</h6>
                    <div class="d-flex align-items-center text-secondary small border-top pt-2 mt-2">
                        <span class="me-3"><i class="fas fa-bed me-1"></i> ${room['Loại Phòng']}</span>
                        <span><i class="fas fa-road me-1"></i> ${safeAddr}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function hideHouseNumber(fullAddress) {
    if(!fullAddress) return "Đang cập nhật";
    if(fullAddress.includes(',')) {
        let parts = fullAddress.split(',');
        let streetPart = parts[0].trim().replace(/^[0-9\/a-zA-Z]+\s+/, ""); 
        return "Đường " + streetPart + ", " + parts.slice(1).join(', ');
    }
    return fullAddress;

}
