// =========================================================
// CẤU HÌNH LIÊN KẾT (GIỮ NGUYÊN)
// =========================================================
const SHEET_NGUONHANG = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS5G7jESC4agyCYLxQ2aVvcft3DwohZ3yqEhSKpLgEsjZZ-akvLVUYBiHIHX3k_TGfTSxgPsG1LhGJh/pub?gid=0&single=true&output=csv';
const SHEET_TIENICH   = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS5G7jESC4agyCYLxQ2aVvcft3DwohZ3yqEhSKpLgEsjZZ-akvLVUYBiHIHX3k_TGfTSxgPsG1LhGJh/pub?gid=2072224303&single=true&output=csv';
const NO_IMAGE_URL    = "https://placehold.co/600x400?text=Tho+Cho+Thue+Tro";

let allRooms = [];
let allAmenities = [];
let map = null;

// TỰ ĐỘNG CHẠY KHI TẢI XONG
window.onload = () => {
    setTimeout(() => { 
        const loading = document.getElementById('loading');
        if(loading) loading.style.display = 'none'; 
    }, 1500); // Tắt loading sau 1.5s
    loadData();
};

function loadData() {
    // LƯU Ý: header: false để đọc theo vị trí cột (A, B, C...) chính xác 100%
    Promise.all([
        new Promise(resolve => Papa.parse(SHEET_TIENICH, { download: true, header: true, complete: res => resolve(res.data) })),
        new Promise(resolve => Papa.parse(SHEET_NGUONHANG, { download: true, header: false, complete: res => resolve(res.data) }))
    ]).then(([amenities, rooms]) => {
        allAmenities = amenities;
        // Loại bỏ dòng tiêu đề đầu tiên (Dòng 0) của nguồn hàng
        allRooms = rooms.slice(1).filter(r => r[0] && r[0] !== ''); 
        
        // Điều hướng chạy code theo trang
        if(document.getElementById('home-page-container')) {
            initHomePage();
        } else if(document.getElementById('detail-page-container')) {
            initDetailPage();
        }
    });
}

// =========================================================
// HÀM ĐỌC DỮ LIỆU CHUẨN (THEO CỘT EXCEL)
// =========================================================
function getData(row, field) {
    if (!row) return '';
    // A=0, B=1, C=2, D=3, E=4, F=5, G=6, H=7...
    switch(field) {
        case 'ID': return row[0];        // Cột A
        case 'Title': return row[1];     // Cột B
        case 'Type': return row[2];      // Cột C (Loại phòng)
        case 'District': return row[3];  // Cột D (Quận)
        case 'Address': return row[4];   // Cột E
        case 'Features': return row[5];  // Cột F (Tiện ích/Điểm nổi bật)
        case 'Price':                    // Cột G (Giá) - Xử lý dấu chấm/phẩy
            let p = row[6] ? row[6].toString().replace(/\./g, '').replace(/,/g, '').replace(/\D/g,'') : 0;
            return parseInt(p) || 0;
        case 'Desc': return row[7];      // Cột H (Đặc điểm/Mô tả)
        case 'Image': return row[11];    // Cột L
        case 'Promo': return row[23];    // Cột X (Khuyến mại) - Index 23
        case 'Lat': return parseFloat(row[26]) || 0; // Cột AA (26)
        case 'Lng': return parseFloat(row[27]) || 0; // Cột AB (27)
        case 'Video': return row[28];    // Cột AC (28)
        default: return '';
    }
}

// =========================================================
// TRANG CHỦ
// =========================================================
function initHomePage() {
    setupFilters();
    renderHomeGroups();
}

function setupFilters() {
    let districts = new Set();
    let types = new Set();
    let featureSet = new Set();

    allRooms.forEach(r => {
        let d = getData(r, 'District');
        let t = getData(r, 'Type');
        let f = getData(r, 'Features');

        if(d) districts.add(d.trim());
        if(t) types.add(t.trim());
        
        // Tách tiện ích từ Cột F (ví dụ: "Ban công, Thang máy")
        if(f) {
            f.split(',').forEach(tag => {
                let cleanTag = tag.trim();
                if(cleanTag.length > 2) featureSet.add(cleanTag);
            });
        }
    });

    // Điền Menu & Select
    const fill = (set, menuId, selectId) => {
        const menu = document.getElementById(menuId);
        const select = document.getElementById(selectId);
        if(!menu || !select) return;
        
        [...set].sort().forEach(item => {
            menu.innerHTML += `<li><a class="dropdown-item" href="#" onclick="quickFilter('${selectId}', '${item}')">${item}</a></li>`;
            select.innerHTML += `<option value="${item}">${item}</option>`;
        });
    };
    fill(districts, 'menu-districts', 'f-district');
    fill(types, 'menu-types', 'f-type');

    // Điền Checkbox Tiện ích
    const amContainer = document.getElementById('f-amenities-checkboxes');
    if(amContainer) {
        amContainer.innerHTML = '';
        [...featureSet].sort().forEach((am, idx) => {
            amContainer.innerHTML += `
                <div class="form-check">
                    <input class="form-check-input f-am-check" type="checkbox" value="${am.toLowerCase()}" id="chk-${idx}">
                    <label class="form-check-label small" style="cursor:pointer;" for="chk-${idx}">${am}</label>
                </div>`;
        });
    }
}

function renderHomeGroups() {
    const container = document.getElementById('home-content');
    if(!container) return;
    
    document.getElementById('search-results').style.display = 'none';
    document.getElementById('home-content').style.display = 'block';
    container.innerHTML = '';

    // Lấy danh sách quận
    let allDistricts = [...new Set(allRooms.map(r => getData(r, 'District')).filter(d => d))];

    // SẮP XẾP ƯU TIÊN: Tân Bình -> Phú Nhuận -> Còn lại
    let priority = ["Quận Tân Bình", "Quận Phú Nhuận"];
    let others = allDistricts.filter(d => !priority.includes(d)).sort();
    let sortedDistricts = [...priority.filter(d => allDistricts.includes(d)), ...others];

    sortedDistricts.forEach(d => {
        let rooms = allRooms.filter(r => getData(r, 'District') === d);
        // Ưu tiên Khuyến mại lên đầu
        rooms.sort((a,b) => (getData(b, 'Promo').length > 2 ? 1 : 0) - (getData(a, 'Promo').length > 2 ? 1 : 0));

        let displayRooms = rooms.slice(0, 6); // Lấy 6 phòng mỗi quận

        if(displayRooms.length > 0) {
            let section = document.createElement('div');
            section.innerHTML = `
                <div class="d-flex justify-content-between align-items-end mb-4 mt-5">
                    <div>
                        <span class="text-primary fw-bold text-uppercase small">Khu vực</span>
                        <h2 class="fw-bold mb-0 text-dark">${d}</h2>
                    </div>
                    <a href="#" onclick="quickFilter('f-district', '${d}')" class="btn btn-outline-dark rounded-pill px-4 btn-sm fw-bold">Xem thêm</a>
                </div>
                <div class="row g-4">
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
    
    // Lấy checkbox tiện ích
    const checkedAms = Array.from(document.querySelectorAll('.f-am-check:checked')).map(c => c.value);

    let filtered = allRooms.filter(r => {
        if(sDistrict !== 'all' && getData(r, 'District') !== sDistrict) return false;
        if(sType !== 'all' && getData(r, 'Type') !== sType) return false;
        
        let p = getData(r, 'Price');
        if(sPrice !== 'all') {
            let [min, max] = sPrice.split('-').map(Number);
            if(p < min || p > max) return false;
        }

        // Lọc Tiện ích (Cột F)
        if(checkedAms.length > 0) {
            let feats = getData(r, 'Features').toLowerCase();
            let hasAll = checkedAms.every(am => feats.includes(am));
            if(!hasAll) return false;
        }
        return true;
    });

    document.getElementById('home-content').style.display = 'none';
    document.getElementById('search-results').style.display = 'block';
    
    const grid = document.getElementById('products-grid');
    grid.innerHTML = filtered.length ? filtered.map(r => createCardHTML(r)).join('') 
        : '<div class="col-12 text-center py-5 text-muted">Không tìm thấy phòng nào phù hợp.</div>';
    
    document.getElementById('search-title').innerText = `Tìm thấy ${filtered.length} kết quả`;
}

function quickFilter(id, val) {
    document.getElementById(id).value = val;
    applyFilters();
    window.scrollTo({ top: 100, behavior: 'smooth' });
}

function resetFilters() {
    document.getElementById('f-district').value = 'all';
    document.getElementById('f-type').value = 'all';
    document.getElementById('f-price').value = 'all';
    document.querySelectorAll('.f-am-check').forEach(c => c.checked = false);
    renderHomeGroups();
}

// =========================================================
// TRANG CHI TIẾT
// =========================================================
function initDetailPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');

    if(!id) {
        alert("Không tìm thấy mã phòng!");
        return;
    }

    // Tìm phòng theo ID (Cột A)
    let room = allRooms.find(r => getData(r, 'ID') == id);
    if(!room) {
        document.getElementById('detail-page-container').innerHTML = '<div class="text-center p-5"><h3>Không tìm thấy phòng này!</h3><a href="index.html">Về trang chủ</a></div>';
        return;
    }

    // 1. Ảnh
    let img = getData(room, 'Image');
    if(!img || !img.startsWith('http')) img = NO_IMAGE_URL;
    document.getElementById('d-img').src = img;

    // 2. Thông tin
    document.getElementById('d-title').innerText = getData(room, 'Title');
    document.getElementById('d-address').innerText = hideHouseNumber(getData(room, 'Address'));
    
    let price = getData(room, 'Price');
    let priceText = price ? (price/1000000).toFixed(1) + " Triệu/tháng" : "Liên hệ";
    document.getElementById('d-price-sidebar').innerText = priceText; // Cập nhật Sidebar

    // 3. Khuyến mại (Cột X)
    let promo = getData(room, 'Promo');
    if(promo && promo.length > 2) {
        document.getElementById('d-promo-box').style.display = 'block';
        document.getElementById('d-promo-content').innerText = promo;
    }

    // 4. Mô tả & Tiện ích
    document.getElementById('d-desc').innerText = getData(room, 'Desc') || 'Đang cập nhật...';
    
    // Cột F (Tiện ích)
    let features = getData(room, 'Features');
    if(features) {
        let tagsHtml = features.split(',').map(tag => 
            `<div class="col-6 col-md-4"><div class="feature-item"><i class="fas fa-check-circle text-success"></i> ${tag.trim()}</div></div>`
        ).join('');
        document.getElementById('d-features').innerHTML = tagsHtml;
    }

    // 5. VIDEO (Cột AC)
    let videoUrl = getData(room, 'Video');
    const videoBox = document.getElementById('video-section');
    if(videoUrl && videoUrl.includes('http')) {
        videoBox.style.display = 'block';
        // Chuyển link Youtube thường thành Embed
        if(videoUrl.includes("watch?v=")) videoUrl = videoUrl.replace("watch?v=", "embed/");
        else if(videoUrl.includes("youtu.be/")) videoUrl = videoUrl.replace("youtu.be/", "youtube.com/embed/");
        document.getElementById('d-video').src = videoUrl;
    } else {
        videoBox.style.display = 'none';
    }

    // 6. Gợi ý & Map
    renderRelated(room, price);
    setTimeout(() => initMap(room), 500);
}

function renderRelated(currentRoom, currentPrice) {
    const grid = document.getElementById('related-grid');
    let currentDist = getData(currentRoom, 'District');
    let currentId = getData(currentRoom, 'ID');

    let related = allRooms.filter(r => 
        getData(r, 'District') === currentDist && 
        getData(r, 'ID') !== currentId
    );
    
    // Lọc giá +- 20%
    if(currentPrice > 0) {
        related = related.filter(r => {
            let p = getData(r, 'Price');
            return p >= currentPrice * 0.8 && p <= currentPrice * 1.2;
        });
    }

    let display = related.sort(() => 0.5 - Math.random()).slice(0, 4);
    grid.innerHTML = display.map(r => createCardHTML(r)).join('');
}

// =========================================================
// MAP & UTILS
// =========================================================
function initMap(room) {
    let lat = getData(room, 'Lat');
    let lng = getData(room, 'Lng');

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

function createCardHTML(room) {
    let id = getData(room, 'ID');
    let price = getData(room, 'Price');
    let priceText = price ? (price/1000000).toFixed(1) + " Tr" : "Thỏa thuận";
    let img = getData(room, 'Image');
    if(!img || !img.startsWith('http')) img = NO_IMAGE_URL;
    let safeAddr = hideHouseNumber(getData(room, 'Address'));
    let promo = getData(room, 'Promo');
    let promoTag = (promo && promo.length > 2) ? `<span class="housa-tag"><i class="fas fa-gift"></i> KM</span>` : '';

    return `
        <div class="col-12 col-md-6 col-lg-4">
            <div class="room-card" onclick="window.location.href='detail.html?id=${id}'">
                <div class="img-housa-wrapper">
                    <img src="${img}" class="img-housa" onerror="this.src='${NO_IMAGE_URL}'">
                    ${promoTag}
                    <div class="housa-price">${priceText}</div>
                </div>
                <div class="p-3">
                    <div class="text-muted small mb-1"><i class="fas fa-map-marker-alt text-warning me-1"></i> ${getData(room, 'District')}</div>
                    <h6 class="fw-bold text-dark text-truncate mb-2" style="font-size:1.1rem">${getData(room, 'Title')}</h6>
                    <div class="d-flex align-items-center text-secondary small border-top pt-2 mt-2">
                        <span class="me-3"><i class="fas fa-bed me-1"></i> ${getData(room, 'Type')}</span>
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
