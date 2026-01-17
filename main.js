// =========================================================
// 1. CẤU HÌNH & DỮ LIỆU
// =========================================================
const SHEET_API = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS5G7jESC4agyCYLxQ2aVvcft3DwohZ3yqEhSKpLgEsjZZ-akvLVUYBiHIHX3k_TGfTSxgPsG1LhGJh/pub?gid=0&single=true&output=csv';

const PRIORITY_DISTRICTS = ["Tân Bình", "Phú Nhuận"];
const ROOM_TYPES = ["Studio", "1PN", "2PN", "3PN", "Duplex", "Nguyên căn"];
const AMENITIES_LIST = ["Ban công", "Cửa sổ", "Tách bếp", "Nuôi Pet", "Máy giặt riêng", "Thang máy"];
const SPECIAL_AMENITIES_OR = ["ban công", "cửa sổ"]; 

let allRooms = [];
let map = null;
let currentFilteredRooms = []; 
let currentLimit = 6;          
const LOAD_MORE_STEP = 9;      

// =========================================================
// 2. KHỞI TẠO & FETCH DATA
// =========================================================
window.addEventListener('DOMContentLoaded', () => {
    fetchData();
    setupStickyFilterBar();
    highlightCurrentMenu();
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
    
    allRooms = rows.slice(1).map(row => {
        let districtRaw = (row[2] || "").trim();
        if (districtRaw.toLowerCase().startsWith("q.") || districtRaw.toLowerCase().startsWith("q ")) {
            districtRaw = districtRaw.replace(/q[\.\s]/i, "Quận ");
        }
        
        let keypointRaw = (row[5] || "");
        let keypointClean = keypointRaw.split(',')
            .map(item => item.trim())
            .filter(item => !item.includes('🎁') && !item.toLowerCase().includes('km '))
            .join(', ');
        
        return {
            id: row[4] || "", 
            room_code: (row[4] || "").trim(),
            district: districtRaw,
            address: (row[3] || "").trim(),
            keypoint: keypointClean, 
            price: parsePrice(row[6]),
            desc: row[7] || "",
            type: (row[16] || "").trim(),
            promotion: (row[23] || "").trim(),
            lat: parseFloat(row[26]) || 10.801646,
            lng: parseFloat(row[27]) || 106.663158,
            video: (row[28] || "").trim(),
            image_detail: row[29] ? row[29].split('|').map(img => img.trim()).filter(img => img.length > 5) : [], 
            image_collage: row[30] ? row[30].split('|').map(img => img.trim()).filter(img => img.length > 5) : [],
            amenities_search: (row[5] || "").toLowerCase()
        };
    }).filter(item => item.id && item.price > 0); 

    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'none';

    initFilters();
    detectPageAndRender();
}

// =========================================================
// 3. LOGIC ĐIỀU HƯỚNG & RENDER
// =========================================================

function detectPageAndRender() {
    const path = window.location.pathname;
    const urlParams = new URLSearchParams(window.location.search);
    const detailId = urlParams.get('id');

    if (detailId) {
        renderDetailPage(detailId);
        return;
    }

    if (path.includes("map-search")) {
        renderHalfMapPage();
        return;
    }
    
    let targetDistrict = null;
    if (path.includes("tan-binh") || path.includes("tanbinh")) targetDistrict = "Tân Bình";
    if (path.includes("phu-nhuan") || path.includes("phunhuan")) targetDistrict = "Phú Nhuận";
    
    if (targetDistrict) {
        const districtSelect = document.getElementById('f-district');
        if (districtSelect) districtSelect.value = targetDistrict;
    }

    const urlType = urlParams.get('type');
    const urlPrice = urlParams.get('price');
    const urlAmenities = urlParams.get('amenities');

    if (targetDistrict) {
        if (urlType) document.getElementById('type-filter').value = urlType;
        if (urlPrice) document.getElementById('f-price').value = urlPrice;
        if (urlAmenities) {
            urlAmenities.split(',').forEach(am => {
                const cb = document.querySelector(`.amenity-check[value="${am}"]`);
                if(cb) cb.checked = true;
            });
        }

        renderPageHeader(`Phòng trọ ${targetDistrict}`, targetDistrict);

        if (urlType || urlPrice || urlAmenities) {
             runInternalFilter(targetDistrict, true); 
        } else {
             runInternalFilter(targetDistrict, false);
        }

    } else {
        renderHomePageGroups();
    }
}

function renderPageHeader(title, breadcrumbLast) {
    const container = document.getElementById('home-content');
    if (!container) return;
    
    const headerHTML = `
        <div class="page-header-block rounded-3">
            <h1 class="page-header-title">${title}</h1>
            <div class="breadcrumb-custom">
                <a href="index.html">Trang chủ</a> 
                <i class="fas fa-chevron-right"></i> 
                <span>${breadcrumbLast}</span>
            </div>
        </div>
        <div id="listing-area"></div>
    `;
    container.innerHTML = headerHTML;
}

function initFilters() {
    const districtSelect = document.getElementById('f-district');
    if (districtSelect) {
        const districts = [...new Set(allRooms.map(r => r.district).filter(d => d))].sort();
        let html = '<option value="all">Tất cả Khu vực</option>';
        districts.forEach(d => html += `<option value="${d}">${d}</option>`);
        districtSelect.innerHTML = html;
    }

    const typeSelect = document.getElementById('type-filter'); 
    if (typeSelect) {
        let html = '<option value="all">Tất cả Loại phòng</option>';
        ROOM_TYPES.forEach(t => html += `<option value="${t}">${t}</option>`);
        typeSelect.innerHTML = html;
    }

    const amenityContainer = document.getElementById('f-amenities-checkboxes');
    if (amenityContainer) {
        let html = '';
        AMENITIES_LIST.forEach((am, index) => {
            html += `
                <div class="form-check">
                    <input class="form-check-input amenity-check" type="checkbox" value="${am.toLowerCase()}" id="am-${index}">
                    <label class="form-check-label small" for="am-${index}">${am}</label>
                </div>`;
        });
        amenityContainer.innerHTML = html;
    }
}

// =========================================================
// 4. XỬ LÝ LỌC & CHUYỂN TRANG
// =========================================================

window.applyFilters = function() {
    const districtVal = document.getElementById('f-district')?.value || 'all';
    const typeVal = document.getElementById('type-filter')?.value || 'all'; 
    const priceVal = document.getElementById('f-price')?.value || 'all';
    const checkedAmenities = Array.from(document.querySelectorAll('.amenity-check:checked')).map(c => c.value);
    const path = window.location.pathname;

    const isMapPage = path.includes("map-search");

    if (!isMapPage) {
        let targetPage = '';
        if (districtVal === 'Tân Bình' && !path.includes('tan-binh')) {
            targetPage = 'tan-binh.html';
        } else if (districtVal === 'Phú Nhuận' && !path.includes('phu-nhuan')) {
            targetPage = 'phu-nhuan.html';
        } else if (districtVal === 'all' && (path.includes('tan-binh') || path.includes('phu-nhuan'))) {
            targetPage = 'index.html'; 
        }

        if (targetPage) {
            const params = new URLSearchParams();
            if (typeVal !== 'all') params.set('type', typeVal);
            if (priceVal !== 'all') params.set('price', priceVal);
            if (checkedAmenities.length > 0) params.set('amenities', checkedAmenities.join(','));
            window.location.href = `${targetPage}?${params.toString()}`;
            return;
        }
    }

    collapseFilterBox();
    
    let finalDistrictVal = districtVal;
    if (path.includes("tan-binh")) finalDistrictVal = "Tân Bình";
    if (path.includes("phu-nhuan")) finalDistrictVal = "Phú Nhuận";

    runInternalFilter(finalDistrictVal, true);
    
    if (window.innerWidth < 992) {
        const resultsTitle = document.getElementById('search-title') || document.getElementById('home-content');
        if(resultsTitle) resultsTitle.scrollIntoView({behavior: 'smooth', block: 'start'});
    }
}

function runInternalFilter(districtVal, isFilteredAction) {
    const typeVal = document.getElementById('type-filter')?.value || 'all'; 
    const priceVal = document.getElementById('f-price')?.value || 'all';
    const checkedAmenities = Array.from(document.querySelectorAll('.amenity-check:checked')).map(c => c.value);

    const specialReqs = checkedAmenities.filter(am => SPECIAL_AMENITIES_OR.includes(am));
    const normalReqs = checkedAmenities.filter(am => !SPECIAL_AMENITIES_OR.includes(am));

    let filtered = allRooms.filter(room => {
        if (districtVal !== 'all' && room.district !== districtVal) return false;
        if (typeVal !== 'all' && !room.type.toLowerCase().includes(typeVal.toLowerCase())) return false;
        
        if (priceVal !== 'all') {
            const [min, max] = priceVal.split('-').map(v => parseInt(v));
            if (room.price < min || room.price > max) return false;
        }
        
        if (normalReqs.length > 0) {
            if (!normalReqs.every(req => room.amenities_search.includes(req))) return false;
        }

        if (specialReqs.length > 0) {
            if (!specialReqs.some(req => room.amenities_search.includes(req))) return false;
        }
        return true;
    });

    // Sắp xếp: Ưu tiên có ảnh -> Ưu tiên có khuyến mãi
    filtered.sort((a, b) => {
        const aHasImage = a.image_detail.length > 0 ? 1 : 0;
        const bHasImage = b.image_detail.length > 0 ? 1 : 0;
        if (bHasImage !== aHasImage) return bHasImage - aHasImage;
        return (b.promotion.length > 0) - (a.promotion.length > 0);
    });

    currentFilteredRooms = filtered;
    currentLimit = 6; // Reset lại số lượng hiển thị ban đầu là 6
    
    const path = window.location.pathname;
    
    if (path.includes("map-search")) {
        renderHalfMapList(filtered);
        renderHalfMapMarkers(filtered);
    } else {
        const isHomePage = !path.includes("tan-binh") && !path.includes("phu-nhuan");
        
        if (isHomePage && districtVal === 'all') {
            document.getElementById('home-content').style.display = 'none';
            document.getElementById('search-results').style.display = 'block';
            document.getElementById('search-title').innerText = `Tìm thấy ${filtered.length} kết quả`;
            renderGridWithPagination(document.getElementById('products-grid'), filtered);
        } else {
            const listingArea = document.getElementById('listing-area') || document.getElementById('home-content');
            renderGridWithPagination(listingArea, filtered);
        }
    }

    // --- LOGIC MỚI: KIỂM TRA ĐỂ ẨN STICKY BAR NẾU TRÙNG QUẬN ---
    let ignoreDistrictInBar = false;
    if (path.includes('tan-binh') && districtVal === 'Tân Bình') ignoreDistrictInBar = true;
    if (path.includes('phu-nhuan') && districtVal === 'Phú Nhuận') ignoreDistrictInBar = true;

    // Chỉ hiện bar nếu có filter khác hoặc district KHÔNG phải là mặc định của trang
    const hasActiveFilter = ((districtVal !== 'all' && !ignoreDistrictInBar) || typeVal !== 'all' || priceVal !== 'all' || checkedAmenities.length > 0);
    
    updateActiveFilterBar(districtVal, typeVal, priceVal, checkedAmenities, hasActiveFilter);
}

// =========================================================
// 5. HALF MAP LOGIC
// =========================================================

function renderHalfMapPage() {
    if (!map) {
        map = L.map('half-map-view').setView([10.801646, 106.663158], 20); // Zoom xa hơn tí cho bao quát
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);
    }
    
    // --- SỬA: Mặc định chọn Phú Nhuận ---
    const defaultDist = "Phú Nhuận";
    const dSelect = document.getElementById('f-district');
    if(dSelect) dSelect.value = defaultDist; // Gán giá trị cho dropdown
    
    runInternalFilter(defaultDist, false); // Chạy lọc theo Phú Nhuận
}

function renderHalfMapList(rooms) {
    const container = document.getElementById('half-map-list-content');
    if (!container) return;
    
    if (rooms.length === 0) {
        container.innerHTML = '<div class="p-3 text-center w-100">Không tìm thấy phòng phù hợp</div>';
        return;
    }

    // Cắt danh sách theo limit hiện tại
    const roomsToShow = rooms.slice(0, currentLimit);
    const hasMore = rooms.length > currentLimit;

    // col-6: Mobile 2 cột | col-sm-6: Tablet/PC nhỏ 2 cột
    const htmlItems = roomsToShow.map(room => `
        <div class="col-6 col-sm-6 mb-3">
            ${createCardHTML(room)}
        </div>
    `).join('');
    
    let fullHtml = `<div class="row g-2 p-2">${htmlItems}</div>`;

    // Thêm nút Xem thêm nếu còn phòng
    if (hasMore) {
        fullHtml += `
            <div class="text-center pb-3">
                <button class="btn btn-load-more shadow-sm btn-sm" onclick="loadMoreItems()">
                    Xem thêm ${rooms.length - currentLimit} phòng <i class="fas fa-arrow-down ms-1"></i>
                </button>
            </div>`;
    }

    container.innerHTML = fullHtml;
}

function renderHalfMapMarkers(rooms) {
    map.eachLayer((layer) => {
        if (layer instanceof L.Marker) map.removeLayer(layer);
    });

    const customIcon = L.divIcon({
        className: 'custom-map-marker',
        html: '<div class="marker-pin"><i class="fas fa-home"></i></div>',
        iconSize: [40, 40],
        iconAnchor: [20, 40],
        popupAnchor: [0, -45]
    });

    const bounds = [];
    rooms.forEach(room => {
        const marker = L.marker([room.lat, room.lng], { icon: customIcon }).addTo(map);
        marker.bindPopup(`
            <div style="width: 220px;">
                <img src="${room.image_detail[0] || ''}" style="width:100%; aspect-ratio:4/3; object-fit:cover; border-radius:8px; margin-bottom:8px;">
                <div class="fw-bold text-primary mb-1">${room.room_code}</div>
                <div class="text-muted small mb-2"><i class="fas fa-map-marker-alt me-1"></i>${cleanAddress(room.address)}</div>
                <a href="detail.html?id=${encodeURIComponent(room.id)}" class="btn-popup-custom">Xem chi tiết</a>
            </div>
        `);
        bounds.push([room.lat, room.lng]);
    });

    if (bounds.length > 0) map.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 });
}

// =========================================================
// 6. UI & HELPERS
// =========================================================
window.collapseFilterBox = function() {
    const box = document.getElementById('main-filter-box');
    if (box) box.classList.add('filter-box-collapsed');
}

window.expandFilterBox = function() {
    const box = document.getElementById('main-filter-box');
    if (box) box.classList.remove('filter-box-collapsed');
    if (window.innerWidth < 992) box.scrollIntoView({behavior: 'smooth', block: 'center'});
}

window.toggleFilterSidebar = function() {
    const box = document.getElementById('main-filter-box');
    if (box) box.classList.contains('filter-box-collapsed') ? expandFilterBox() : collapseFilterBox();
}

function highlightCurrentMenu() {
    const path = window.location.pathname;
    const navLinks = document.querySelectorAll('.navbar-nav .nav-link');
    
    navLinks.forEach(link => {
        link.classList.remove('active');
        const href = link.getAttribute('href');
        if (path.includes(href) && href !== 'index.html') {
            link.classList.add('active');
        } else if ((path === '/' || path.endsWith('index.html') || path === '') && href === 'index.html') {
            link.classList.add('active');
        }
    });
}

function setupStickyFilterBar() {
    if (!document.getElementById('active-filter-bar')) {
        const bar = document.createElement('div');
        bar.id = 'active-filter-bar';
        bar.className = 'active-filter-bar';
        bar.innerHTML = `
            <div class="container d-flex align-items-center justify-content-between">
                <div class="d-flex align-items-center overflow-auto" style="flex:1; padding-right: 15px;">
                    <span class="me-3 fw-bold small text-muted text-uppercase flex-shrink-0"><i class="fas fa-filter me-1"></i>Đang lọc:</span>
                    <div id="filter-tags-content" class="filter-tags-container"></div>
                </div>
                <button class="btn btn-sm btn-outline-danger fw-bold flex-shrink-0" onclick="resetFilters()">Xóa lọc</button>
            </div>`;
        document.body.appendChild(bar);
    }
    
    window.addEventListener('scroll', () => {
        const bar = document.getElementById('active-filter-bar');
        if (bar.classList.contains('show')) {
             if (window.scrollY > 150) bar.style.display = 'block';
             else bar.style.display = 'none';
        } else {
             bar.style.display = 'none';
        }
    });
}

function updateActiveFilterBar(district, type, price, amenities, isActive) {
    const bar = document.getElementById('active-filter-bar');
    if (!bar) return;

    if (!isActive) {
        bar.classList.remove('show');
        bar.style.display = 'none';
        return;
    }

    bar.classList.add('show');
    const content = document.getElementById('filter-tags-content');
    
    let html = '';
    
    if (district !== 'all') {
        html += `<span class="filter-tag" onclick="expandFilterBox()">${district}</span>`;
    }

    if (type !== 'all') html += `<span class="filter-tag" onclick="expandFilterBox()">${type}</span>`;
    if (price !== 'all') {
        const label = document.querySelector(`#f-price option[value="${price}"]`)?.innerText || price;
        html += `<span class="filter-tag" onclick="expandFilterBox()">${label}</span>`;
    }
    amenities.forEach(am => {
        const displayAm = am.charAt(0).toUpperCase() + am.slice(1);
        html += `<span class="filter-tag" onclick="expandFilterBox()">${displayAm}</span>`;
    });
    content.innerHTML = html;
}

function renderGridWithPagination(container, rooms) {
    if (!container) return;
    
    const existingHeader = container.querySelector('.page-header-block');
    const existingList = container.querySelector('#listing-area');
    
    let targetContainer = container;
    
    if (existingHeader && existingList) {
        targetContainer = existingList;
    } else if (existingHeader && !existingList) {
        const listDiv = document.createElement('div');
        listDiv.id = 'listing-area';
        container.appendChild(listDiv);
        targetContainer = listDiv;
    } else {
        container.innerHTML = ''; 
    }
    
    targetContainer.innerHTML = ''; 
    
    if (rooms.length === 0) {
        targetContainer.innerHTML = '<div class="alert alert-warning text-center mt-3">Không tìm thấy phòng phù hợp!</div>';
        return;
    }

    const roomsToShow = rooms.slice(0, currentLimit);
    const hasMore = rooms.length > currentLimit;

    // Bọc trong Row để Grid hoạt động đúng ở Trang chủ
    let html = `<div class="row g-3">`;
    roomsToShow.forEach(room => {
        html += `<div class="col-6 col-md-4 col-lg-4">${createCardHTML(room)}</div>`;
    });
    html += `</div>`;

    if (hasMore) {
        html += `<div class="text-center mt-4"><button class="btn btn-load-more shadow-sm" onclick="loadMoreItems()">Xem thêm ${rooms.length - currentLimit} phòng nữa <i class="fas fa-arrow-down ms-1"></i></button></div>`;
    }
    targetContainer.innerHTML = html;
}

window.loadMoreItems = function() {
    currentLimit += LOAD_MORE_STEP; // Tăng thêm 9
    const path = window.location.pathname;
    
    if (path.includes("map-search")) {
        // Gọi lại hàm render Map List với limit mới
        renderHalfMapList(currentFilteredRooms);
    } else if (!path.includes("tan-binh") && !path.includes("phu-nhuan")) {
         // Trang chủ đang ở chế độ tìm kiếm
         if (document.getElementById('search-results').style.display === 'block') {
             renderGridWithPagination(document.getElementById('products-grid'), currentFilteredRooms);
         }
    } else {
        // Trang Quận hoặc Trang chủ mặc định
        const listingArea = document.getElementById('listing-area') || document.getElementById('home-content');
        renderGridWithPagination(listingArea, currentFilteredRooms);
    }
}

function renderHomePageGroups() {
    const container = document.getElementById('home-content');
    if (!container) return;
    container.innerHTML = '';
    
    // --- SỬA LOGIC SẮP XẾP ---
    // 1. Ưu tiên có Khuyến mại (Promotion) xếp trước
    // 2. Sau đó ưu tiên có Ảnh chi tiết
    const sortedRooms = [...allRooms].sort((a, b) => {
        const aPromo = a.promotion && a.promotion.trim().length > 0 ? 1 : 0;
        const bPromo = b.promotion && b.promotion.trim().length > 0 ? 1 : 0;
        
        // Nếu một bên có khuyến mại, bên kia không -> xếp bên có lên trước
        if (aPromo !== bPromo) return bPromo - aPromo;
        
        // Nếu cả hai cùng có hoặc cùng không -> xếp bên nào có ảnh lên trước
        const aHasImage = a.image_detail.length > 0 ? 1 : 0;
        const bHasImage = b.image_detail.length > 0 ? 1 : 0;
        return bHasImage - aHasImage;
    });
    
    // --- GOM NHÓM THEO QUẬN ---
    const grouped = {};
    sortedRooms.forEach(room => {
        const dName = room.district || "Khu vực khác";
        if (!grouped[dName]) grouped[dName] = [];
        grouped[dName].push(room);
    });
    
    // Sắp xếp thứ tự quận ưu tiên (Tân Bình -> Phú Nhuận -> ...)
    const sortedDistricts = Object.keys(grouped).sort((a, b) => {
        const aIdx = PRIORITY_DISTRICTS.indexOf(a);
        const bIdx = PRIORITY_DISTRICTS.indexOf(b);
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        return aIdx !== -1 ? -1 : (bIdx !== -1 ? 1 : a.localeCompare(b));
    });
    
    // --- HIỂN THỊ RA MÀN HÌNH ---
    sortedDistricts.forEach(district => {
        const districtRooms = grouped[district];
        const displayRooms = districtRooms.slice(0, 6); // Chỉ hiện 6 căn đầu tiên mỗi quận
        
        // Tạo HTML cho từng nhóm quận
        let html = `
            <div class="district-group mb-5">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h3 class="fw-bold">${district} <span class="text-muted fs-6">(${districtRooms.length} phòng)</span></h3>
                    <a href="#" onclick="viewAllDistrict('${district}'); return false;" class="btn btn-outline-primary btn-sm rounded-pill">Xem tất cả <i class="fas fa-arrow-right ms-1"></i></a>
                </div>
                <div class="row g-3">
                    ${displayRooms.map(room => `<div class="col-6 col-md-4 col-lg-4">${createCardHTML(room)}</div>`).join('')}
                </div>
            </div>
        `;
        container.innerHTML += html;
    });
}
window.viewAllDistrict = function(district) {
    if (district === "Tân Bình") window.location.href = "tan-binh.html";
    else if (district === "Phú Nhuận") window.location.href = "phu-nhuan.html";
    else {
        const dSelect = document.getElementById('f-district');
        if(dSelect) dSelect.value = district;
        window.applyFilters();
    }
}

window.resetFilters = function() { window.location.reload(); }

// [QUAN TRỌNG] Hàm này giờ chỉ trả về Card trần, các hàm render sẽ tự bọc col- tương ứng
function createCardHTML(room) {
    let imgUrl = room.image_detail[0] || "https://placehold.co/600x400?text=Phong+Tro";
    const cleanAddr = cleanAddress(room.address);
    const title = `Cho thuê căn ${room.type} ${cleanAddr}`;
    const keypointHTML = room.keypoint ? `<div class="mb-2 text-secondary fst-italic small" style="line-height: 1.4;"><i class="fas fa-star text-warning me-1"></i>${room.keypoint}</div>` : '';
    const promoBadge = room.promotion ? `<span class="position-absolute top-0 end-0 bg-warning text-dark px-2 py-1 m-2 rounded fw-bold small shadow"><i class="fas fa-gift me-1"></i> Ưu đãi</span>` : '';

    return `
        <div class="card h-100 shadow-sm border-0 room-card" onclick="window.location.href='detail.html?id=${encodeURIComponent(room.id)}'" style="cursor:pointer;">
            <div class="position-relative">
                <img src="${imgUrl}" class="card-img-top object-fit-cover" alt="${title}" loading="lazy">
                ${promoBadge}
            </div>
            <div class="card-body p-3 d-flex flex-column">
                <h6 class="card-title fw-bold text-primary mb-1" style="font-size: 0.95rem; line-height: 1.4; min-height: 2.8em; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${title}</h6>
                <div class="mb-2">
                    <span class="badge bg-light text-dark border small">${room.room_code}</span>
                </div>
                <div class="mb-2">
                    <span class="text-danger fw-bold fs-6">${formatMoney(room.price)}/tháng</span>
                </div>
                ${keypointHTML}
                <div class="mt-auto pt-2 border-top">
                    <div class="text-muted small">
                        <i class="fas fa-map-marker-alt me-1"></i> ${room.district}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderDetailPage(id) {
    const roomId = decodeURIComponent(id);
    const room = allRooms.find(r => r.id === roomId);
    if (!room) return;

    const headerContainer = document.querySelector('.property-header');
    if (headerContainer) {
        headerContainer.innerHTML = `
        <div class="container">
            <div class="page-header-block rounded-3" style="padding: 40px 0; margin-bottom:0;">
                <h1 class="page-header-title h2">${room.type} ${cleanAddress(room.address)}</h1>
                <div class="breadcrumb-custom">
                    <a href="index.html">Trang chủ</a> 
                    <i class="fas fa-chevron-right"></i> 
                    <a href="#" class="text-white">${room.district}</a>
                    <i class="fas fa-chevron-right"></i>
                    <span>${room.room_code}</span>
                </div>
            </div>
        </div>`;
    }

    if(document.getElementById('detail-address')) document.getElementById('detail-address').textContent = cleanAddress(room.address);
    if(document.getElementById('d-type')) document.getElementById('d-type').textContent = room.type;
    if(document.getElementById('detail-price')) document.getElementById('detail-price').textContent = formatMoney(room.price);
    
    if (room.promotion && document.getElementById('promo-section')) {
        document.getElementById('promo-section').style.display = 'block';
        document.getElementById('detail-promo').textContent = room.promotion;
    }
    if (document.getElementById('detail-keypoints') && room.keypoint) {
        document.getElementById('detail-keypoints').innerHTML = room.keypoint.split(',').map(i => `<div class="col-6"><i class="fas fa-check-circle"></i> ${i.trim()}</div>`).join('');
    }
    
    renderProfessionalGallery(room);
    
    const galleryContainer = document.getElementById('detail-gallery');
    if (galleryContainer) {
        const existingTitle = document.getElementById('content-title-below-gallery');
        if (existingTitle) existingTitle.remove();

        const titleEl = document.createElement('h2');
        titleEl.id = 'content-title-below-gallery';
        titleEl.className = 'fw-bold mb-3 mt-4 text-primary';
        titleEl.style.fontSize = '1.5rem';
        titleEl.textContent = `Cho thuê căn ${room.type} ${cleanAddress(room.address)}`;
        
        galleryContainer.parentNode.insertBefore(titleEl, galleryContainer.nextSibling);
    }

    renderCollageImage(room);
    if(document.getElementById('detail-desc')) document.getElementById('detail-desc').innerHTML = room.desc.replace(/\n/g, '<br>');
    
    const videoSection = document.getElementById('video-section');
    const videoEmbed = document.getElementById('video-embed');
    if (room.video && room.video.length > 5 && videoSection) {
        videoSection.style.display = 'block';
        if (room.video.includes('youtube.com') || room.video.includes('youtu.be')) {
            const videoId = room.video.split('v=')[1]?.split('&')[0] || room.video.split('/').pop();
            videoEmbed.innerHTML = `<iframe src="https://www.youtube.com/embed/${videoId}" allowfullscreen></iframe>`;
        } else {
            videoEmbed.innerHTML = `<a href="${room.video}" target="_blank" class="btn btn-danger btn-lg rounded-pill">Xem Video</a>`;
        }
    }
    initMap(room.lat, room.lng, cleanAddress(room.address));
    renderRelatedApartments(room);
}

function renderProfessionalGallery(room) {
    const galleryContainer = document.getElementById('detail-gallery');
    if (!galleryContainer) return;
    const images = room.image_detail.slice(0, 4);
    if (images.length === 0) {
        galleryContainer.innerHTML = '<div class="bg-secondary bg-opacity-10 rounded d-flex align-items-center justify-content-center" style="height: 400px;">Đang cập nhật hình ảnh</div>';
        return;
    }
    const mainImg = images[0];
    const thumbs = images.slice(1, 4);
    let html = `
        <div class="gallery-container">
            <div class="gallery-main-frame">
                <img src="${mainImg}" id="main-gallery-img" class="img-smart-fill" alt="Ảnh chi tiết">
                <div class="position-absolute bottom-0 end-0 m-3 px-3 py-1 bg-dark bg-opacity-75 text-white rounded-pill small"><i class="fas fa-expand me-1"></i> ${room.image_detail.length} ảnh</div>
            </div>
            ${thumbs.length > 0 ? `<div class="gallery-thumbs-grid">${thumbs.map((img, idx) => `<div class="gallery-sub-frame" onclick="changeMainGalleryImage('${img}')"><img src="${img}" class="img-smart-fill" loading="lazy"></div>`).join('')}</div>` : ''}
        </div>`;
    galleryContainer.innerHTML = html;
}
window.changeMainGalleryImage = function(src) {
    const mainImg = document.getElementById('main-gallery-img');
    if (mainImg) { mainImg.style.opacity = '0.5'; setTimeout(() => { mainImg.src = src; mainImg.style.opacity = '1'; }, 150); }
}
function renderCollageImage(room) {
    const highlightBox = document.querySelector('.highlight-box');
    const descBlock = document.querySelector('.bg-white.p-4.rounded-4.shadow-sm.border');
    if (!highlightBox || !descBlock || room.image_collage.length === 0) return;
    if (document.querySelector('.collage-block')) return;
    const collageBlock = document.createElement('div');
    collageBlock.className = 'collage-block mb-4';
    collageBlock.innerHTML = `<div class="rounded-4 overflow-hidden shadow-sm" style="max-width: 100%; aspect-ratio: 1700/1450;"><img src="${room.image_collage[0]}" class="w-100 h-100 object-fit-cover" loading="lazy"></div>`;
    highlightBox.parentNode.insertBefore(collageBlock, descBlock);
}

function renderRelatedApartments(currentRoom) {
    const grid = document.getElementById('related-grid');
    if (!grid) return;
    const related = allRooms.filter(r => r.district === currentRoom.district && r.id !== currentRoom.id && r.image_detail.length > 0 && Math.abs(r.price - currentRoom.price) <= 1500000).slice(0, 6);
    if (related.length === 0) { grid.innerHTML = '<div class="col-12 text-center text-muted">Chưa có căn tương tự.</div>'; return; }
    // Wrapper col- cho danh sách liên quan
    grid.innerHTML = related.map(room => `<div class="col-6 col-md-4 col-lg-4">${createCardHTML(room)}</div>`).join('');
}

function initMap(lat, lng, label) {
    if (map) { map.remove(); map = null; }
    const mapContainer = document.getElementById('detail-map');
    if (!mapContainer) return;
    map = L.map('detail-map').setView([lat, lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);
    L.marker([lat, lng]).addTo(map).bindPopup(`<b>${label}</b>`).openPopup();
}

function cleanAddress(fullAddr) { return fullAddr ? fullAddr.replace(/^[\d\/a-zA-Z]+\s+(?:đường\s+)?/i, '').trim() : ""; }

// [FIX LỖI] Đã sửa lại hàm parseCSV để xử lý đúng ký tự xuống dòng
function parseCSV(text) {
    const result = []; let row = []; let inQuotes = false; let currentToken = '';
    for (let i = 0; i < text.length; i++) {
        const char = text[i]; const nextChar = text[i + 1];
        if (char === '"') { if (inQuotes && nextChar === '"') { currentToken += '"'; i++; } else { inQuotes = !inQuotes; } }
        else if (char === ',' && !inQuotes) { row.push(currentToken); currentToken = ''; }
        else if ((char === '\r' || char === '\n') && !inQuotes) { if (currentToken || row.length > 0) row.push(currentToken); if (row.length > 0) result.push(row); row = []; currentToken = ''; if (char === '\r' && nextChar === '\n') i++; }
        else { currentToken += char; }
    }
    if (currentToken || row.length > 0) row.push(currentToken); if (row.length > 0) result.push(row); return result;
}
function parsePrice(str) { return str ? parseInt(String(str).replace(/\D/g, '')) || 0 : 0; }
function formatMoney(num) { if (num >= 1000000) return (num / 1000000).toFixed(1).replace('.0', '') + ' Tr'; return (num / 1000).toFixed(0) + 'k'; }






