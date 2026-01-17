// =========================================================
// 1. CẤU HÌNH & DỮ LIỆU
// =========================================================
const SHEET_API = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS5G7jESC4agyCYLxQ2aVvcft3DwohZ3yqEhSKpLgEsjZZ-akvLVUYBiHIHX3k_TGfTSxgPsG1LhGJh/pub?gid=0&single=true&output=csv';

const PRIORITY_DISTRICTS = ["Tân Bình", "Phú Nhuận"];
const ROOM_TYPES = ["Studio", "1PN", "2PN", "3PN", "Duplex", "Nguyên căn"];
const AMENITIES_LIST = ["Ban công", "Cửa sổ", "Tách bếp", "Nuôi Pet", "Máy giặt riêng", "Thang máy"];

// --- Biến quản lý Phân trang & Dữ liệu ---
let allRooms = [];
let map = null;
let currentFilteredRooms = []; // Lưu danh sách đang lọc hiện tại
let currentLimit = 6;          // Mặc định hiện 6 căn
const LOAD_MORE_STEP = 9;      // Mỗi lần bấm xem thêm hiện 9 căn

// =========================================================
// 2. KHỞI TẠO & FETCH DATA
// =========================================================
window.addEventListener('DOMContentLoaded', () => {
    fetchData();
    setupStickyFilterBar(); // Cài đặt thanh filter dính
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
    
    // 1. Chuyển CSV thành JSON
    allRooms = rows.slice(1).map(row => {
        let districtRaw = (row[2] || "").trim();
        if (districtRaw.toLowerCase().startsWith("q.") || districtRaw.toLowerCase().startsWith("q ")) {
            districtRaw = districtRaw.replace(/q[\.\s]/i, "Quận ");
        }
        
        // Xử lý keypoint (bỏ icon thừa)
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
            amenities_search: (row[5] || "").toLowerCase() // Dùng để search tiện ích
        };
    }).filter(item => item.id && item.price > 0); 

    // 2. Tắt loading
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'none';

    // 3. Khởi tạo bộ lọc (Dropdowns)
    initFilters();

    // 4. Điều hướng xử lý theo từng trang
    const urlParams = new URLSearchParams(window.location.search);
    const detailId = urlParams.get('id');

    if (detailId) {
        // --- TRANG CHI TIẾT ---
        renderDetailPage(detailId);
    } else {
        // --- TRANG DANH SÁCH / TRANG CHỦ ---
        detectPageAndRender();
    }
}

// =========================================================
// 3. LOGIC ĐIỀU HƯỚNG & RENDER (CORE)
// =========================================================

function detectPageAndRender() {
    const path = window.location.pathname;
    const urlParams = new URLSearchParams(window.location.search);
    
    // Xác định quận mục tiêu dựa trên URL hoặc tên file HTML
    let targetDistrict = null;
    if (path.includes("tan-binh") || path.includes("tanbinh")) targetDistrict = "Tân Bình";
    if (path.includes("phu-nhuan") || path.includes("phunhuan")) targetDistrict = "Phú Nhuận";
    
    // Kiểm tra xem có tham số lọc từ URL truyền sang không (Redirect từ trang chủ)
    const urlType = urlParams.get('type');
    const urlPrice = urlParams.get('price');
    const urlAmenities = urlParams.get('amenities');

    if (targetDistrict) {
        // >> ĐANG Ở TRANG QUẬN (Tân Bình / Phú Nhuận)
        
        // 1. Ẩn dropdown chọn quận (vì đã ở trang quận rồi)
        const districtFilterContainer = document.getElementById('f-district')?.parentElement;
        if(districtFilterContainer) districtFilterContainer.style.display = 'none';
        
        // 2. Điền lại dữ liệu vào bộ lọc nếu có truyền từ URL
        if (urlType) document.getElementById('type-filter').value = urlType;
        if (urlPrice) document.getElementById('f-price').value = urlPrice;
        if (urlAmenities) {
            const ams = urlAmenities.split(',');
            ams.forEach(am => {
                const cb = document.querySelector(`.amenity-check[value="${am}"]`);
                if(cb) cb.checked = true;
            });
        }

        // 3. Set tiêu đề
        const homeContent = document.getElementById('home-content');
        if(homeContent) homeContent.innerHTML = `<h2 class="fw-bold mb-4 border-bottom pb-2">Phòng trọ tại ${targetDistrict}</h2>`;

        // 4. CHẠY LỌC NGAY LẬP TỨC (Fix lỗi trang trắng)
        // Thay vì chờ click, ta gọi hàm lọc nội bộ luôn
        runInternalFilter(targetDistrict); 

    } else {
        // >> ĐANG Ở TRANG CHỦ (index.html)
        renderHomePageGroups();
    }
}

// Hàm khởi tạo các Dropdown bộ lọc
function initFilters() {
    // 1. Quận
    const districtSelect = document.getElementById('f-district');
    if (districtSelect) {
        const districts = [...new Set(allRooms.map(r => r.district).filter(d => d))].sort();
        let html = '<option value="all">Tất cả Khu vực</option>';
        districts.forEach(d => html += `<option value="${d}">${d}</option>`);
        districtSelect.innerHTML = html;
    }
    // 2. Loại phòng
    const typeSelect = document.getElementById('type-filter'); 
    if (typeSelect) {
        let html = '<option value="all">Tất cả Loại phòng</option>';
        ROOM_TYPES.forEach(t => html += `<option value="${t}">${t}</option>`);
        typeSelect.innerHTML = html;
    }
    // 3. Tiện ích
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
// 4. XỬ LÝ LỌC VÀ CHUYỂN HƯỚNG THÔNG MINH
// =========================================================

// Hàm này được gọi khi bấm nút "ÁP DỤNG"
window.applyFilters = function() {
    const districtVal = document.getElementById('f-district')?.value || 'all';
    const typeVal = document.getElementById('type-filter')?.value || 'all'; 
    const priceVal = document.getElementById('f-price')?.value || 'all';
    const checkedAmenities = Array.from(document.querySelectorAll('.amenity-check:checked')).map(c => c.value);

    const path = window.location.pathname;
    const isHomePage = !path.includes("tan-binh") && !path.includes("phu-nhuan");

    // --- LOGIC CHUYỂN HƯỚNG TỪ TRANG CHỦ ---
    if (isHomePage && districtVal !== 'all') {
        // Nếu ở trang chủ mà chọn quận cụ thể -> Chuyển sang trang quận đó
        let targetPage = '';
        if (districtVal === 'Tân Bình') targetPage = 'tan-binh.html';
        else if (districtVal === 'Phú Nhuận') targetPage = 'phu-nhuan.html';
        
        if (targetPage) {
            const params = new URLSearchParams();
            if (typeVal !== 'all') params.set('type', typeVal);
            if (priceVal !== 'all') params.set('price', priceVal);
            if (checkedAmenities.length > 0) params.set('amenities', checkedAmenities.join(','));
            
            // Thực hiện chuyển trang
            window.location.href = `${targetPage}?${params.toString()}`;
            return; // Dừng hàm tại đây
        }
    }

    // Nếu không chuyển trang (đang ở trang quận, hoặc chọn "Tất cả" ở trang chủ)
    // Thì lọc tại chỗ
    let targetDistrictForFilter = districtVal;
    
    // Nếu đang ở trang quận, ép buộc quận theo trang
    if (path.includes("tan-binh")) targetDistrictForFilter = "Tân Bình";
    if (path.includes("phu-nhuan")) targetDistrictForFilter = "Phú Nhuận";

    runInternalFilter(targetDistrictForFilter);
    
    // Scroll lên đầu Mobile để thấy kết quả
    if (window.innerWidth < 992) {
        const resultsTitle = document.getElementById('search-title') || document.getElementById('home-content');
        if(resultsTitle) resultsTitle.scrollIntoView({behavior: 'smooth', block: 'start'});
    }
}

// Hàm lọc nội bộ (Dùng chung cho cả Apply và Init)
function runInternalFilter(districtVal) {
    const typeVal = document.getElementById('type-filter')?.value || 'all'; 
    const priceVal = document.getElementById('f-price')?.value || 'all';
    const checkedAmenities = Array.from(document.querySelectorAll('.amenity-check:checked')).map(c => c.value);

    // 1. Lọc dữ liệu
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

    // 2. Sắp xếp: Ưu tiên có ảnh -> Có khuyến mãi
    filtered.sort((a, b) => {
        const aHasImage = a.image_detail.length > 0 ? 1 : 0;
        const bHasImage = b.image_detail.length > 0 ? 1 : 0;
        if (bHasImage !== aHasImage) return bHasImage - aHasImage;
        return (b.promotion.length > 0) - (a.promotion.length > 0);
    });

    // 3. Reset limit về 6 và hiển thị
    currentFilteredRooms = filtered;
    currentLimit = 6; 
    
    // Xác định nơi hiển thị
    const homeContent = document.getElementById('home-content');
    const searchResults = document.getElementById('search-results');
    const searchGrid = document.getElementById('products-grid');

    // Nếu đang ở trang chủ mà lọc "Tất cả" -> Dùng chế độ Search
    // Nếu ở trang quận -> Dùng home-content
    const path = window.location.pathname;
    if (!path.includes("tan-binh") && !path.includes("phu-nhuan")) {
        // Trang chủ
        homeContent.style.display = 'none';
        searchResults.style.display = 'block';
        document.getElementById('search-title').innerText = `Tìm thấy ${filtered.length} kết quả`;
        renderGridWithPagination(searchGrid, filtered);
    } else {
        // Trang quận
        renderGridWithPagination(homeContent, filtered);
    }

    // 4. Cập nhật thanh Active Filter Bar
    updateActiveFilterBar(typeVal, priceVal, checkedAmenities);
}

// =========================================================
// 5. PHÂN TRANG (LOAD MORE) & RENDER
// =========================================================

function renderGridWithPagination(container, rooms) {
    if (!container) return;
    
    // Nếu không có kết quả
    if (rooms.length === 0) {
        container.innerHTML = '<div class="alert alert-warning text-center mt-3">Không tìm thấy phòng phù hợp!</div>';
        return;
    }

    // Cắt dữ liệu theo limit hiện tại
    const roomsToShow = rooms.slice(0, currentLimit);
    const hasMore = rooms.length > currentLimit;

    // Tạo HTML Grid
    let html = `<div class="row g-3">`;
    roomsToShow.forEach(room => html += createCardHTML(room));
    html += `</div>`;

    // Nút Xem thêm
    if (hasMore) {
        html += `
            <div class="text-center mt-4">
                <button class="btn btn-load-more shadow-sm" onclick="loadMoreItems()">
                    Xem thêm ${rooms.length - currentLimit} phòng nữa <i class="fas fa-arrow-down ms-1"></i>
                </button>
            </div>
        `;
    }

    container.innerHTML = html;
}

window.loadMoreItems = function() {
    currentLimit += LOAD_MORE_STEP; // Tăng thêm 9
    
    // Render lại đúng container đang hiển thị
    const path = window.location.pathname;
    if (!path.includes("tan-binh") && !path.includes("phu-nhuan")) {
        const searchGrid = document.getElementById('products-grid');
        renderGridWithPagination(searchGrid, currentFilteredRooms);
    } else {
        const homeContent = document.getElementById('home-content');
        renderGridWithPagination(homeContent, currentFilteredRooms);
    }
}

// Render trang chủ (Mặc định khi chưa lọc)
function renderHomePageGroups() {
    const container = document.getElementById('home-content');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Sắp xếp dữ liệu gốc
    const sortedRooms = [...allRooms].sort((a, b) => {
        const aHasImage = a.image_detail.length > 0 ? 1 : 0;
        const bHasImage = b.image_detail.length > 0 ? 1 : 0;
        return bHasImage - aHasImage;
    });
    
    // Group theo quận
    const grouped = {};
    sortedRooms.forEach(room => {
        const dName = room.district || "Khu vực khác";
        if (!grouped[dName]) grouped[dName] = [];
        grouped[dName].push(room);
    });
    
    const sortedDistricts = Object.keys(grouped).sort((a, b) => {
        const aIdx = PRIORITY_DISTRICTS.indexOf(a);
        const bIdx = PRIORITY_DISTRICTS.indexOf(b);
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        return aIdx !== -1 ? -1 : (bIdx !== -1 ? 1 : a.localeCompare(b));
    });
    
    sortedDistricts.forEach(district => {
        const districtRooms = grouped[district];
        const displayRooms = districtRooms.slice(0, 6); // Chỉ lấy 6 căn đầu mỗi quận
        
        let html = `
            <div class="district-group mb-5">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h3 class="fw-bold">${district} <span class="text-muted fs-6">(${districtRooms.length} phòng)</span></h3>
                    <a href="#" onclick="viewAllDistrict('${district}'); return false;" class="btn btn-outline-primary btn-sm rounded-pill">Xem tất cả <i class="fas fa-arrow-right ms-1"></i></a>
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
    if (district === "Tân Bình") window.location.href = "tan-binh.html";
    else if (district === "Phú Nhuận") window.location.href = "phu-nhuan.html";
    else {
        // Quận khác -> Lọc tại trang chủ
        const dSelect = document.getElementById('f-district');
        if(dSelect) dSelect.value = district;
        window.applyFilters();
    }
}

window.resetFilters = function() {
    window.location.href = window.location.pathname; // Reload trang là cách clean nhất
}

// =========================================================
// 6. STICKY FILTER BAR (UI/UX Mới)
// =========================================================
function setupStickyFilterBar() {
    // Tạo phần tử Bar nếu chưa có
    if (!document.getElementById('active-filter-bar')) {
        const bar = document.createElement('div');
        bar.id = 'active-filter-bar';
        bar.className = 'active-filter-bar';
        bar.innerHTML = '<div class="container d-flex align-items-center"><span class="me-3 fw-bold small text-muted text-uppercase">Đang lọc:</span><div id="filter-tags-content" class="flex-grow-1"></div><button class="btn btn-sm text-danger fw-bold" onclick="resetFilters()">Xóa lọc</button></div>';
        document.body.appendChild(bar);
    }
    
    // Sự kiện cuộn
    window.addEventListener('scroll', () => {
        const bar = document.getElementById('active-filter-bar');
        const filterBox = document.querySelector('.position-sticky'); // Box lọc bên trái
        
        // Hiện bar khi cuộn qua box lọc (Mobile) hoặc luôn hiện khi có lọc (Desktop)
        if (currentFilteredRooms.length > 0 && currentFilteredRooms.length < allRooms.length) {
            if (window.scrollY > 200) bar.style.display = 'block';
            else bar.style.display = 'none';
        } else {
            bar.style.display = 'none';
        }
    });
}

function updateActiveFilterBar(type, price, amenities) {
    const content = document.getElementById('filter-tags-content');
    if (!content) return;
    
    let html = '';
    if (type !== 'all') html += `<span class="filter-tag" onclick="scrollToFilter()">${type}</span>`;
    if (price !== 'all') {
        const label = document.querySelector(`#f-price option[value="${price}"]`)?.innerText || price;
        html += `<span class="filter-tag" onclick="scrollToFilter()">${label}</span>`;
    }
    amenities.forEach(am => {
        // Viết hoa chữ cái đầu
        const displayAm = am.charAt(0).toUpperCase() + am.slice(1);
        html += `<span class="filter-tag" onclick="scrollToFilter()">${displayAm}</span>`;
    });
    
    content.innerHTML = html;
}

window.scrollToFilter = function() {
    // Cuộn lên chỗ bộ lọc
    const filterCol = document.querySelector('.col-lg-3');
    if (filterCol) filterCol.scrollIntoView({behavior: 'smooth'});
}

// =========================================================
// 7. CÁC HÀM HỖ TRỢ (Giữ nguyên logic cũ nhưng clean hơn)
// =========================================================
function createCardHTML(room) {
    let imgUrl = room.image_detail[0] || "https://placehold.co/600x400?text=Phong+Tro";
    const cleanAddr = cleanAddress(room.address);
    const title = `Cho thuê căn ${room.type} ${cleanAddr}`;
    const keypointHTML = room.keypoint ? `<div class="mb-2 text-secondary fst-italic small" style="line-height: 1.4;"><i class="fas fa-star text-warning me-1"></i>${room.keypoint}</div>` : '';
    const promoBadge = room.promotion ? `<span class="position-absolute top-0 end-0 bg-warning text-dark px-2 py-1 m-2 rounded fw-bold small shadow"><i class="fas fa-gift me-1"></i> Ưu đãi</span>` : '';

    return `
        <div class="col-6 col-md-4 col-lg-4">
            <div class="card h-100 shadow-sm border-0 room-card" onclick="window.location.href='detail.html?id=${encodeURIComponent(room.id)}'" style="cursor:pointer;">
                <div class="position-relative">
                    <img src="${imgUrl}" class="card-img-top object-fit-cover" alt="${title}" loading="lazy" style="height: 220px;">
                    ${promoBadge}
                    <div class="housa-tag bg-primary text-white">${room.type}</div>
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
                        <div class="d-flex justify-content-between align-items-center small text-muted">
                            <span><i class="fas fa-map-marker-alt me-1"></i> ${room.district}</span>
                            <span class="text-muted"><i class="fas fa-eye me-1"></i> Xem ngay</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderDetailPage(id) {
    const roomId = decodeURIComponent(id);
    const room = allRooms.find(r => r.id === roomId);

    if (!room) {
        document.body.innerHTML = '<div class="container py-5 text-center"><h3>Không tìm thấy phòng này!</h3><a href="index.html" class="btn btn-primary">Về trang chủ</a></div>';
        return;
    }

    // Điền dữ liệu cơ bản
    if(document.getElementById('detail-title')) document.getElementById('detail-title').textContent = `Cho thuê căn ${room.type} ${cleanAddress(room.address)}`;
    if(document.getElementById('detail-address')) document.getElementById('detail-address').textContent = cleanAddress(room.address);
    if(document.getElementById('d-type')) document.getElementById('d-type').textContent = room.type;
    if(document.getElementById('detail-price')) document.getElementById('detail-price').textContent = formatMoney(room.price);
    
    // Khuyến mãi
    if (room.promotion && document.getElementById('promo-section')) {
        document.getElementById('promo-section').style.display = 'block';
        document.getElementById('detail-promo').textContent = room.promotion;
    }

    // Keypoints
    if (document.getElementById('detail-keypoints') && room.keypoint) {
        document.getElementById('detail-keypoints').innerHTML = room.keypoint.split(',').map(i => `<div class="col-6"><i class="fas fa-check-circle"></i> ${i.trim()}</div>`).join('');
    }

    // Render Gallery (Giữ nguyên hàm bạn thích)
    renderProfessionalGallery(room);
    renderCollageImage(room); // Ảnh ghép

    // Mô tả
    if(document.getElementById('detail-desc')) document.getElementById('detail-desc').innerHTML = room.desc.replace(/\n/g, '<br>');

    // Video
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

    // Map & Related
    initMap(room.lat, room.lng, cleanAddress(room.address));
    renderRelatedApartments(room);
}

// --- GIỮ LẠI CÁC HÀM GALLERY CŨ CỦA BẠN ---
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
    if (document.querySelector('.collage-block')) return; // Tránh trùng lặp

    const collageBlock = document.createElement('div');
    collageBlock.className = 'collage-block mb-4';
    collageBlock.innerHTML = `<div class="rounded-4 overflow-hidden shadow-sm" style="max-width: 100%; aspect-ratio: 1700/1450;"><img src="${room.image_collage[0]}" class="w-100 h-100 object-fit-cover" loading="lazy"></div>`;
    highlightBox.parentNode.insertBefore(collageBlock, descBlock);
}

function renderRelatedApartments(currentRoom) {
    const grid = document.getElementById('related-grid');
    if (!grid) return;
    const related = allRooms.filter(r => r.district === currentRoom.district && r.id !== currentRoom.id && r.image_detail.length > 0 && Math.abs(r.price - currentRoom.price) <= 1500000).slice(0, 4);
    if (related.length === 0) { grid.innerHTML = '<div class="col-12 text-center text-muted">Chưa có căn tương tự.</div>'; return; }
    grid.innerHTML = related.map(room => createCardHTML(room)).join('');
}

function initMap(lat, lng, label) {
    if (map) { map.remove(); map = null; }
    const mapContainer = document.getElementById('detail-map');
    if (!mapContainer) return;
    map = L.map('detail-map').setView([lat, lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);
    L.marker([lat, lng]).addTo(map).bindPopup(`<b>${label}</b>`).openPopup();
}

// Helpers
function cleanAddress(fullAddr) { return fullAddr ? fullAddr.replace(/^[\d\/a-zA-Z]+\s+(?:đường\s+)?/i, '').trim() : ""; }
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
