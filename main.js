// =========================================================
// 1. CẤU HÌNH & DỮ LIỆU
// =========================================================
const SHEET_API = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS5G7jESC4agyCYLxQ2aVvcft3DwohZ3yqEhSKpLgEsjZZ-akvLVUYBiHIHX3k_TGfTSxgPsG1LhGJh/pub?gid=0&single=true&output=csv';

// Danh sách ưu tiên hiển thị quận
const PRIORITY_DISTRICTS = ["Tân Bình", "Phú Nhuận", "Bình Thạnh", "Gò Vấp", "Quận 3", "Quận 10"];

const ROOM_TYPES = ["Studio", "1PN", "2PN", "3PN", "Duplex", "Nguyên căn"];
const AMENITIES_LIST = ["Ban công", "Cửa sổ", "Tách bếp", "Nuôi Pet", "Máy giặt riêng", "Thang máy"];

let allRooms = [];
let expandedDistricts = new Set();

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
    
    // Map dữ liệu (Lưu ý: Index bắt đầu từ 0)
    // Col C (2): Quận | Col D (3): Địa chỉ | Col E (4): ID | Col F (5): Tiện ích
    // Col G (6): Giá | Col H (7): Mô tả | Col Q (16): Loại | Col T (19): Ảnh | Col X (23): Khuyến Mại
    
    allRooms = rows.slice(1).map(row => {
        let districtRaw = (row[2] || "").trim();
        // Chuẩn hóa tên Quận
        if (districtRaw.toLowerCase().startsWith("q.") || districtRaw.toLowerCase().startsWith("q ")) {
            districtRaw = districtRaw.replace(/q[\.\s]/i, "Quận ");
        }
        
        return {
            id: row[4] || "", 
            district: districtRaw,
            address: (row[3] || "").trim(),
            keypoint: (row[5] || ""), 
            price: parsePrice(row[6]), // Xử lý giá kỹ càng hơn
            desc: row[7] || "",
            type: (row[16] || "").trim(),
            images: row[19] ? row[19].split('|') : [],
            promotion: (row[23] || "").trim(), // Cột X - Khuyến mại
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
        applyFilters(); 
    }
}

// =========================================================
// 3. LOGIC BỘ LỌC & TRANG CHỦ
// =========================================================

function initFilters() {
    // 1. TẠO BỘ LỌC QUẬN (Quét sạch dữ liệu)
    const districtSelect = document.getElementById('district-filter');
    if (districtSelect) {
        // Lấy danh sách quận, loại bỏ rỗng
        const districts = allRooms.map(r => r.district).filter(d => d && d !== "");
        const uniqueDistricts = [...new Set(districts)].sort();
        
        let html = '<option value="all">Tất cả Khu vực</option>';
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

    // 3. CHECKBOX TIỆN ÍCH
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

    // Filter Logic
    let filtered = allRooms.filter(room => {
        if (districtVal !== 'all' && room.district !== districtVal) return false;
        if (typeVal !== 'all' && !room.type.toLowerCase().includes(typeVal.toLowerCase())) return false;
        if (checkedAmenities.length > 0) {
            const hasAll = checkedAmenities.every(req => room.amenities_search.includes(req));
            if (!hasAll) return false;
        }
        return true;
    });

    // === LOGIC SẮP XẾP ƯU TIÊN ===
    // 1. Căn có Khuyến Mại (Cột X) lên đầu
    // 2. Sau đó mới đến các căn thường
    filtered.sort((a, b) => {
        const hasPromoA = a.promotion.length > 0;
        const hasPromoB = b.promotion.length > 0;
        
        if (hasPromoA && !hasPromoB) return -1; // A lên trước
        if (!hasPromoA && hasPromoB) return 1;  // B lên trước
        return 0;
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

    const grouped = {};
    rooms.forEach(room => {
        const dName = room.district || "Khu vực khác";
        if (!grouped[dName]) grouped[dName] = [];
        grouped[dName].push(room);
    });

    const sortedDistricts = Object.keys(grouped).sort((a, b) => {
        const idxA = PRIORITY_DISTRICTS.indexOf(a);
        const idxB = PRIORITY_DISTRICTS.indexOf(b);
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
            <h3 class="fw-bold mb-3 border-start border-4 border-primary ps-3 text-uppercase d-flex align-items-center">
                ${district} <span class="badge bg-light text-dark border ms-2 rounded-pill fs-6">${districtRooms.length}</span>
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

// === HÀM TẠO CARD (ĐÃ SỬA UI) ===
function createCardHTML(room) {
    const imgUrl = (room.images.length > 0 && room.images[0].length > 5) 
        ? room.images[0] 
        : "https://placehold.co/600x400?text=Phong+Tro";
        
    const cleanAddr = cleanAddress(room.address);
    const title = `${room.id} - ${cleanAddr}`;
    
    // Keypoint (Cột F)
    const keypointHTML = room.keypoint ? `<div class="mb-2 text-secondary fst-italic small text-truncate"><i class="fas fa-star text-warning me-1"></i>${room.keypoint}</div>` : '';
    
    // Badge Khuyến mại (Nếu có) - Hiển thị góc ảnh
    const promoBadge = room.promotion 
        ? `<span class="position-absolute top-0 end-0 bg-warning text-dark px-2 py-1 m-2 rounded fw-bold small shadow"><i class="fas fa-gift me-1"></i>Ưu đãi</span>` 
        : '';

    const detailLink = `detail.html?id=${encodeURIComponent(room.id)}`;

    return `
        <div class="col-6 col-md-4 col-lg-4">
            <div class="card h-100 shadow-sm border-0 room-card" onclick="window.location.href='${detailLink}'" style="cursor:pointer;">
                <div class="position-relative">
                    <img src="${imgUrl}" class="card-img-top object-fit-cover" alt="${title}" style="height: 205px;">
                    ${promoBadge}
                </div>
                
                <div class="card-body p-3 d-flex flex-column">
                    <h6 class="card-title fw-bold text-primary mb-1 line-clamp-2" style="min-height: 2.5em;">
                        ${title}
                    </h6>

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

    const titleEl = document.querySelector('h1') || document.getElementById('detail-title');
    if (titleEl) titleEl.textContent = `${room.id} - ${cleanAddress(room.address)}`;

    const priceEl = document.getElementById('detail-price');
    if (priceEl) priceEl.textContent = formatMoney(room.price);

    const addrEl = document.getElementById('detail-address');
    if (addrEl) addrEl.textContent = room.address; 

    const descEl = document.getElementById('detail-desc');
    // Nếu có khuyến mại thì hiện thêm dòng khuyến mại trong mô tả
    let promoHtml = room.promotion ? `<div class="alert alert-warning mt-3"><i class="fas fa-gift me-2"></i><strong>Ưu đãi:</strong> ${room.promotion}</div>` : '';
    if (descEl) descEl.innerHTML = room.desc.replace(/\n/g, '<br>') + promoHtml;

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

    const featureContainer = document.getElementById('detail-features');
    if (featureContainer) {
        const items = room.keypoint.split(',').filter(i => i.trim());
        featureContainer.innerHTML = items.map(i => `<span class="badge bg-success bg-opacity-75 me-2 mb-2 p-2 fw-normal"><i class="fas fa-check me-1"></i>${i.trim()}</span>`).join('');
    }
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

// Hàm xử lý giá mạnh mẽ hơn
function parsePrice(str) {
    if (!str) return 0;
    // Chuyển về string, xóa hết ký tự không phải số
    // VD: "5.500.000" -> "5500000", "5,5 tr" -> "55" (cần cẩn thận logic này)
    // Nhưng vì file excel của bạn là số nguyên 5500000, nên xóa hết ký tự lạ là OK
    const clean = String(str).replace(/\D/g, '');
    return parseInt(clean) || 0;
}

function formatMoney(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace('.0', '') + ' Tr';
    return (num / 1000).toFixed(0) + 'k';
}
