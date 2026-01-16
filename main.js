// =========================================================
// 1. CẤU HÌNH & DỮ LIỆU
// =========================================================
const SHEET_API = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS5G7jESC4agyCYLxQ2aVvcft3DwohZ3yqEhSKpLgEsjZZ-akvLVUYBiHIHX3k_TGfTSxgPsG1LhGJh/pub?gid=0&single=true&output=csv';

// Danh sách ưu tiên hiển thị quận (Tùy chỉnh nếu cần)
const PRIORITY_DISTRICTS = ["Tân Bình", "Phú Nhuận", "Bình Thạnh", "Gò Vấp", "Quận 3", "Quận 10"];

// Cấu hình bộ lọc Loại phòng & Tiện ích
const ROOM_TYPES = ["Studio", "1PN", "2PN", "3PN", "Duplex", "Nguyên căn"];
const AMENITIES_LIST = ["Ban công", "Cửa sổ", "Tách bếp", "Nuôi Pet", "Máy giặt riêng", "Thang máy"];

let allRooms = [];
let expandedDistricts = new Set(); // Lưu trạng thái "Xem thêm" của từng quận

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
    
    // Bỏ dòng tiêu đề (index 0), map dữ liệu từ dòng 1
    // Cột C (index 2): Quận
    // Cột D (index 3): Địa chỉ
    // Cột E (index 4): Mã
    // Cột F (index 5): Keypoint (Tiện ích nổi bật)
    // Cột G (index 6): Giá
    // Cột H (index 7): Mô tả chi tiết
    // Cột Q (index 16): Loại phòng
    // Cột T (index 19): Hình ảnh
    
    allRooms = rows.slice(1).map(row => {
        let districtRaw = (row[2] || "").trim();
        // Chuẩn hóa tên Quận (VD: "Q.Tân Bình" -> "Tân Bình") để bộ lọc đẹp hơn
        if (districtRaw.toLowerCase().startsWith("q.")) districtRaw = districtRaw.replace(/q\./i, "Quận ");
        
        return {
            id: row[4] || "", 
            district: districtRaw,
            address: (row[3] || "").trim(),
            keypoint: (row[5] || ""), // Cột F: Keypoint hiển thị
            price: parsePrice(row[6]),
            desc: row[7] || "",
            type: (row[16] || "").trim(),
            amenities_search: (row[5] || "").toLowerCase(), // Dùng để search (lowercase)
            images: row[19] ? row[19].split('|') : []
        };
    }).filter(item => item.id && item.price > 0); 

    const urlParams = new URLSearchParams(window.location.search);
    const detailId = urlParams.get('id');

    // Tắt loading
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'none';

    if (detailId) {
        renderDetailPage(detailId);
    } else {
        initFilters(); // Khởi tạo bộ lọc (bao gồm bộ lọc Quận)
        applyFilters(); // Render trang chủ
    }
}

// =========================================================
// 3. LOGIC BỘ LỌC & TRANG CHỦ
// =========================================================

function initFilters() {
    // 1. TẠO BỘ LỌC QUẬN TỪ DỮ LIỆU CỘT C
    const districtSelect = document.getElementById('district-filter');
    if (districtSelect) {
        // Lấy danh sách quận duy nhất từ dữ liệu đã tải
        const uniqueDistricts = [...new Set(allRooms.map(r => r.district))].filter(d => d).sort();
        
        let html = '<option value="all">Tất cả Quận</option>';
        uniqueDistricts.forEach(d => {
            html += `<option value="${d}">${d}</option>`;
        });
        districtSelect.innerHTML = html;
        districtSelect.addEventListener('change', applyFilters);
    }

    // 2. TẠO BỘ LỌC LOẠI PHÒNG
    const typeSelect = document.getElementById('type-filter'); 
    if (typeSelect) {
        let html = '<option value="all">Tất cả Loại phòng</option>';
        ROOM_TYPES.forEach(t => {
            html += `<option value="${t}">${t}</option>`;
        });
        typeSelect.innerHTML = html;
        typeSelect.addEventListener('change', applyFilters);
    }

    // 3. TẠO CHECKBOX TIỆN ÍCH
    const amenityContainer = document.getElementById('f-amenities-checkboxes');
    if (amenityContainer) {
        let html = '';
        AMENITIES_LIST.forEach((am, index) => {
            html += `
                <div class="form-check">
                    <input class="form-check-input amenity-check" type="checkbox" value="${am.toLowerCase()}" id="am-${index}" onchange="applyFilters()">
                    <label class="form-check-label" for="am-${index}">${am}</label>
                </div>
            `;
        });
        amenityContainer.innerHTML = html;
    }
}

function applyFilters() {
    const districtVal = document.getElementById('district-filter')?.value || 'all';
    const typeVal = document.getElementById('type-filter')?.value || 'all'; 
    const checkedAmenities = Array.from(document.querySelectorAll('.amenity-check:checked')).map(c => c.value);

    const filtered = allRooms.filter(room => {
        // Lọc Quận
        if (districtVal !== 'all' && room.district !== districtVal) return false;
        
        // Lọc Loại phòng
        if (typeVal !== 'all' && !room.type.toLowerCase().includes(typeVal.toLowerCase())) return false;

        // Lọc Tiện ích (Checkbox tìm trong cột F)
        if (checkedAmenities.length > 0) {
            const hasAll = checkedAmenities.every(req => room.amenities_search.includes(req));
            if (!hasAll) return false;
        }

        return true;
    });

    renderGroupedByDistrict(filtered);
}

function renderGroupedByDistrict(rooms) {
    const container = document.getElementById('home-content');
    if (!container) return;
    container.innerHTML = '';

    if (rooms.length === 0) {
        container.innerHTML = '<div class="alert alert-warning text-center">Không tìm thấy phòng phù hợp!</div>';
        return;
    }

    // Gom nhóm theo Quận
    const grouped = {};
    rooms.forEach(room => {
        const dName = room.district || "Khác";
        if (!grouped[dName]) grouped[dName] = [];
        grouped[dName].push(room);
    });

    // Sắp xếp thứ tự hiển thị Quận
    const sortedDistricts = Object.keys(grouped).sort((a, b) => {
        const idxA = PRIORITY_DISTRICTS.indexOf(a);
        const idxB = PRIORITY_DISTRICTS.indexOf(b);
        // Quận ưu tiên đưa lên trước
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
    });

    sortedDistricts.forEach(district => {
        const districtRooms = grouped[district];
        const isExpanded = expandedDistricts.has(district);
        const displayRooms = isExpanded ? districtRooms : districtRooms.slice(0, 6);

        const section = document.createElement('div');
        section.className = 'mb-5 district-section';
        
        let html = `
            <h3 class="fw-bold mb-3 border-start border-4 border-primary ps-3 text-uppercase">
                ${district} <small class="text-muted fs-6 fw-normal">(${districtRooms.length} căn)</small>
            </h3>
            <div class="row g-3">
        `;

        displayRooms.forEach(room => {
            html += createCardHTML(room);
        });

        html += `</div>`;

        if (!isExpanded && districtRooms.length > 6) {
            html += `
                <div class="text-center mt-3">
                    <button class="btn btn-outline-primary rounded-pill px-4" onclick="expandDistrict('${district}')">
                        Xem thêm ${districtRooms.length - 6} căn tại ${district} <i class="fas fa-chevron-down ms-1"></i>
                    </button>
                </div>
            `;
        }
        section.innerHTML = html;
        container.appendChild(section);
    });
}

function expandDistrict(districtName) {
    expandedDistricts.add(districtName);
    applyFilters(); 
}

// HÀM TẠO HTML CHO CARD (Đã cập nhật theo yêu cầu mới)
function createCardHTML(room) {
    const imgUrl = (room.images.length > 0 && room.images[0].length > 5) 
        ? room.images[0] 
        : "https://placehold.co/600x400?text=Phong+Tro";
        
    // 1. Xử lý Địa chỉ (Bỏ số nhà, giữ Đường, Phường, Quận)
    const cleanAddr = cleanAddress(room.address);
    
    // 2. Tạo Tiêu đề: Mã E + Địa chỉ sạch (Cho phép hiện 2 dòng)
    const title = `${room.id} - ${cleanAddr}`;
    
    // 3. Keypoint (Cột F) in nghiêng
    const keypointHTML = room.keypoint ? `<div class="mb-2 text-secondary fst-italic small line-clamp-1"><i class="fas fa-star text-warning me-1"></i>${room.keypoint}</div>` : '';

    const priceText = formatMoney(room.price);
    const detailLink = `detail.html?id=${encodeURIComponent(room.id)}`;

    return `
        <div class="col-6 col-md-4 col-lg-4">
            <div class="card h-100 shadow-sm border-0 room-card" onclick="window.location.href='${detailLink}'" style="cursor:pointer;">
                <div class="position-relative">
                    <img src="${imgUrl}" class="card-img-top object-fit-cover" alt="${title}" style="height: 200px;">
                    <span class="position-absolute top-0 start-0 bg-danger text-white px-2 py-1 m-2 rounded fw-bold small shadow">
                        ${priceText}
                    </span>
                </div>
                <div class="card-body p-3 d-flex flex-column">
                    <h6 class="card-title fw-bold text-primary mb-1 line-clamp-2" style="min-height: 2.5em;">
                        ${title}
                    </h6>
                    
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

    // Tiêu đề chi tiết: Mã + Địa chỉ sạch
    const titleEl = document.querySelector('h1') || document.getElementById('detail-title');
    if (titleEl) titleEl.textContent = `${room.id} - ${cleanAddress(room.address)}`;

    const priceEl = document.getElementById('detail-price');
    if (priceEl) priceEl.textContent = formatMoney(room.price);

    const addrEl = document.getElementById('detail-address');
    if (addrEl) addrEl.textContent = room.address; // Trang chi tiết giữ nguyên địa chỉ gốc (có số nhà)

    const descEl = document.getElementById('detail-desc');
    if (descEl) descEl.innerHTML = room.desc.replace(/\n/g, '<br>');

    // Gallery
    const galleryContainer = document.getElementById('detail-gallery');
    if (galleryContainer && room.images.length > 0) {
        let html = `<div class="col-12 mb-2"><img src="${room.images[0]}" class="img-fluid rounded shadow-sm w-100" style="max-height:450px; object-fit:cover;"></div>`;
        html += '<div class="d-flex gap-2 overflow-auto pb-2">';
        for (let i = 1; i < room.images.length; i++) {
            html += `<img src="${room.images[i]}" class="rounded border" style="width:100px; height:80px; object-fit:cover; cursor:pointer;" onclick="window.open('${room.images[i]}', '_blank')">`;
        }
        html += '</div>';
        galleryContainer.innerHTML = html;
    }

    // Tiện ích chi tiết
    const featureContainer = document.getElementById('detail-features');
    if (featureContainer) {
        const items = room.keypoint.split(',').filter(i => i.trim());
        featureContainer.innerHTML = items.map(i => `<span class="badge bg-success bg-opacity-75 me-2 mb-2 p-2 fw-normal"><i class="fas fa-check me-1"></i>${i.trim()}</span>`).join('');
    }
}

// =========================================================
// 5. CÁC HÀM TIỆN ÍCH (HELPER)
// =========================================================

// Hàm loại bỏ số nhà ở đầu, giữ lại phần sau
// VD: "71/88/4 Nguyễn Bặc, Phường 3, Tân Bình" -> "Nguyễn Bặc, Phường 3, Tân Bình"
function cleanAddress(fullAddr) {
    if (!fullAddr) return "";
    // Regex tìm phần số nhà (bắt đầu bằng số, có thể có /, k, bis... và kết thúc bằng khoảng trắng)
    // Sau đó lấy phần còn lại
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
    return parseInt(str.replace(/\D/g, '')) || 0;
}

function formatMoney(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace('.0', '') + ' Tr';
    return (num / 1000).toFixed(0) + 'k';
}
