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
    
    // Ẩn kết quả tìm kiếm
    document.getElementById('search-results').style.display = 'none';
    document.getElementById('home-content').style.display = 'block';

    let districts = [...new Set(allRooms.map(r => r['Quận']).filter(d => d))].sort();

    districts.forEach(d => {
        let rooms = allRooms.filter(r => r['Quận'] === d);
        // Ưu tiên khuyến mại lên đầu
        rooms.sort((a,b) => (b['Khuyến Mại']?.length || 0) - (a['Khuyến Mại']?.length || 0));
        let displayRooms = rooms.slice(0, 6); // Lấy 6 phòng

        if(displayRooms.length > 0) {
            let section = document.createElement('div');
            section.innerHTML = `
                <div class="section-header">
                    <h3 class="section-title">${d}</h3>
                    <span class="view-more-btn" onclick="quickFilter('f-district', '${d}')">Xem tất cả ${rooms.length} phòng <i class="fas fa-arrow-right small"></i></span>
                </div>
                <div class="row g-3">
                    ${displayRooms.map(r => createCardHTML(r)).join('')}
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

    if(!id) {
        alert("Không tìm thấy mã phòng!");
        window.location.href = 'index.html';
        return;
    }

    let room = allRooms.find(r => (r['ID'] || Object.values(r)[0]) == id);
    if(!room) return;

    // Fill thông tin
    let img = room['Hình ảnh'];
    if(!img || !img.startsWith('http')) img = NO_IMAGE_URL;
    document.getElementById('d-img').src = img;

    document.getElementById('d-title').innerText = room['Phòng (P+Mã - Giá)'];
    document.getElementById('d-type').innerText = room['Loại Phòng'];
    document.getElementById('d-district').innerText = room['Quận'];
    
    let price = parseInt(room['Giá tiền']) || 0;
    document.getElementById('d-price').innerText = price ? (price/1000000).toFixed(1) + " Triệu/tháng" : "Liên hệ";
    document.getElementById('d-address').innerText = hideHouseNumber(room['Địa chỉ']);
    
    // Khuyến mại
    let promo = room['Khuyến Mại'];
    if(promo && promo.length > 2) {
        document.getElementById('d-promo-box').style.display = 'block';
        document.getElementById('d-promo-label').style.display = 'block';
        document.getElementById('d-promo-content').innerText = promo;
    }

    document.getElementById('d-desc').innerText = room['Đặc điểm'] || 'Liên hệ để biết thêm chi tiết.';

    // Gợi ý phòng
    renderRelated(room, price);
    
    // Map
    setTimeout(() => initMap(room), 300);
}

function renderRelated(currentRoom, currentPrice) {
    const grid = document.getElementById('related-grid');
    let related = allRooms.filter(r => 
        r['Quận'] === currentRoom['Quận'] && 
        (r['ID'] || Object.values(r)[0]) !== (currentRoom['ID'] || Object.values(currentRoom)[0])
    );
    
    if(currentPrice > 0) {
        related = related.filter(r => Math.abs((parseInt(r['Giá tiền'])||0) - currentPrice) <= 2000000);
    }
    
    let display = related.sort(() => 0.5 - Math.random()).slice(0, 3);
    grid.innerHTML = display.map(r => createCardHTML(r, true)).join('');
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
function createCardHTML(room, isRelated = false) {
    let id = room['ID'] || Object.values(room)[0];
    let price = parseInt(room['Giá tiền']) || 0;
    let priceText = price ? (price/1000000).toFixed(1) + " Tr" : "Liên hệ";
    let img = room['Hình ảnh'];
    if(!img || !img.startsWith('http')) img = NO_IMAGE_URL;
    let safeAddr = hideHouseNumber(room['Địa chỉ']);
    let promoBadge = (room['Khuyến Mại'] && room['Khuyến Mại'].length > 2) ? `<div class="promo-badge-mini"><i class="fas fa-gift"></i> KM</div>` : '';
    
    // Link tới file detail.html thay vì #detail
    return `
        <div class="${isRelated ? 'col-12 col-md-4' : 'col-12 col-md-6 col-lg-4'}">
            <div class="room-card" onclick="window.location.href='detail.html?id=${id}'">
                <div class="card-img-wrapper">
                    <img src="${img}" class="card-img-top" onerror="this.src='${NO_IMAGE_URL}'">
                    <div class="price-badge">${priceText}</div>
                    ${promoBadge}
                </div>
                <div class="card-body">
                    <div class="text-uppercase text-muted small fw-bold mb-1" style="font-size:0.7rem">${room['Loại Phòng']} &bull; ${room['Quận']}</div>
                    <h6 class="fw-bold text-dark text-truncate mb-1">${room['Phòng (P+Mã - Giá)']}</h6>
                    <div class="small text-secondary text-truncate"><i class="fas fa-map-marker-alt me-1 text-warning"></i> ${safeAddr}</div>
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