// =========================================================
// 1. CẤU HÌNH & DỮ LIỆU
// =========================================================
const SHEET_API = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS5G7jESC4agyCYLxQ2aVvcft3DwohZ3yqEhSKpLgEsjZZ-akvLVUYBiHIHX3k_TGfTSxgPsG1LhGJh/pub?gid=0&single=true&output=csv';

// Danh sách ưu tiên hiển thị quận
const PRIORITY_DISTRICTS = ["Tân Bình", "Phú Nhuận"];

// Cấu hình bộ lọc
const ROOM_TYPES = ["Studio", "1PN", "2PN", "3PN", "Duplex", "Nguyên căn"];
const AMENITIES_LIST = ["Ban công", "Cửa sổ", "Tách bếp", "Nuôi Pet", "Máy giặt riêng", "Thang máy"];

let allRooms = [];
let expandedDistricts = new Set(); // Lưu các quận đang mở rộng "Xem thêm"

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
    
    // Bỏ dòng tiêu đề, map dữ liệu
    allRooms = rows.slice(1).map(row => {
        // Index cột dựa trên file CSV của bạn:
        // 2: Quận, 3: Địa chỉ, 4: Mã (ID), 5: Tiện ích (F), 6: Giá, 7: Mô tả, 16: Loại phòng (Q), 19: Ảnh (T)
        return {
            id: row[4] || "", // Dùng cột E làm ID
            district: (row[2] || "").trim(), // Cột C
            address: (row[3] || "").trim(), // Cột D
            amenities: (row[5] || "").toLowerCase(), // Cột F (Chuẩn hóa thường để dễ tìm)
            price: parsePrice(row[6]), // Cột G
            desc: row[7] || "", // Cột H
            type: (row[16] || "").trim(), // Cột Q
            images: row[19] ? row[19].split('|') : [] // Cột T
        };
    }).filter(item => item.id && item.price > 0); // Lọc rác

    // Kiểm tra xem đang ở Trang chủ hay Trang chi tiết
    const urlParams = new URLSearchParams(window.location.search);
    const detailId = urlParams.get('id');

    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'none';

    if (detailId) {
        // >>> LOGIC TRANG CHI TIẾT
        renderDetailPage(detailId);
    } else {
        // >>> LOGIC TRANG CHỦ
        initFilters();
        applyFilters(); // Render lần đầu
    }
}

// =========================================================
// 3. LOGIC TRANG CHỦ (HOMEPAGE)
// =========================================================

function initFilters() {
    // 1. Tạo bộ lọc Quận (Lấy từ dữ liệu thực tế)
    const districtSelect = document.getElementById('district-filter');
    if (districtSelect) {
        const uniqueDistricts = [...new Set(allRooms.map(r => r.district))].sort();
        let html = '<option value="all">Tất cả Quận</option>';
        uniqueDistricts.forEach(d => {
            html += `<option value="${d}">${d}</option>`;
        });
        districtSelect.innerHTML = html;
        districtSelect.addEventListener('change', applyFilters);
    }

    // 2. Tạo bộ lọc Loại Phòng (Hardcode theo yêu cầu)
    // Bạn cần thêm thẻ <select id="type-filter"> trong HTML nếu chưa có
    const typeSelect = document.getElementById('type-filter'); 
    if (typeSelect) {
        let html = '<option value="all">Tất cả Loại phòng</option>';
        ROOM_TYPES.forEach(t => {
            html += `<option value="${t}">${t}</option>`;
        });
        typeSelect.innerHTML = html;
        typeSelect.addEventListener('change', applyFilters);
    }

    // 3. Tạo bộ lọc Tiện ích (Checkbox)
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
    
    // Nếu HTML chưa có id="type-filter", code sẽ bỏ qua lọc loại
    const typeVal = document.getElementById('type-filter')?.value || 'all'; 

    // Lấy danh sách tiện ích đang tích
    const checkedAmenities = Array.from(document.querySelectorAll('.amenity-check:checked')).map(c => c.value);

    // Lọc dữ liệu
    const filtered = allRooms.filter(room => {
        // Lọc Quận
        if (districtVal !== 'all' && room.district !== districtVal) return false;
        
        // Lọc Loại phòng (So sánh tương đối vì cột Q có thể nhập "Căn hộ 1PN")
        if (typeVal !== 'all' && !room.type.toLowerCase().includes(typeVal.toLowerCase())) return false;

        // Lọc Tiện ích (Phải chứa TẤT CẢ cái đã chọn)
        if (checkedAmenities.length > 0) {
            const hasAll = checkedAmenities.every(req => room.amenities.includes(req));
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
        if (!grouped[room.district]) grouped[room.district] = [];
        grouped[room.district].push(room);
    });

    // Sắp xếp thứ tự Quận: Tân Bình -> Phú Nhuận -> Các quận khác A-Z
    const sortedDistricts = Object.keys(grouped).sort((a, b) => {
        const idxA = PRIORITY_DISTRICTS.indexOf(a);
        const idxB = PRIORITY_DISTRICTS.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
    });

    // Render từng nhóm
    sortedDistricts.forEach(district => {
        const districtRooms = grouped[district];
        const isExpanded = expandedDistricts.has(district);
        const displayRooms = isExpanded ? districtRooms : districtRooms.slice(0, 6);

        // Tạo Section HTML
        const section = document.createElement('div');
        section.className = 'mb-5 district-section';
        
        // Header Quận
        let html = `
            <h3 class="fw-bold mb-3 border-start border-4 border-warning ps-3 text-uppercase">
                ${district} <small class="text-muted fs-6 fw-normal">(${districtRooms.length} căn)</small>
            </h3>
            <div class="row g-3">
        `;

        // Danh sách Card
        displayRooms.forEach(room => {
            html += createCardHTML(room);
        });

        html += `</div>`;

        // Nút Xem thêm
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
    applyFilters(); // Render lại để hiện full
}

function createCardHTML(room) {
    const imgUrl = (room.images.length > 0 && room.images[0].length > 5) 
        ? room.images[0] 
        : "https://placehold.co/600x400?text=Phong+Tro+Tho";
        
    const street = getStreetName(room.address);
    const title = `${room.id} - ${street}`;
    const priceText = formatMoney(room.price);

    // Chuyển sang detail.html khi click
    const detailLink = `detail.html?id=${encodeURIComponent(room.id)}`;

    return `
        <div class="col-6 col-md-4 col-lg-4">
            <div class="card h-100 shadow-sm border-0 room-card" onclick="window.location.href='${detailLink}'" style="cursor:pointer;">
                <div class="position-relative">
                    <img src="${imgUrl}" class="card-img-top object-fit-cover" alt="${title}" style="height: 200px;">
                    <span class="position-absolute top-0 start-0 bg-danger text-white px-2 py-1 m-2 rounded fw-bold small">
                        ${priceText}
                    </span>
                </div>
                <div class="card-body p-3">
                    <h6 class="card-title fw-bold text-truncate mb-1 text-primary">${title}</h6>
                    <p class="card-text small text-muted mb-2"><i class="fas fa-map-marker-alt text-warning me-1"></i> ${room.district}</p>
                    <div class="small text-secondary mb-2">
                         <span class="badge bg-light text-dark border">${room.type}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// =========================================================
// 4. LOGIC TRANG CHI TIẾT (DETAIL PAGE)
// =========================================================

function renderDetailPage(id) {
    // Tìm phòng theo ID (Cột E)
    // Lưu ý: Decode URI để xử lý các ký tự đặc biệt
    const roomId = decodeURIComponent(id);
    const room = allRooms.find(r => r.id === roomId);

    if (!room) {
        document.body.innerHTML = '<div class="container py-5 text-center"><h3>Không tìm thấy phòng này!</h3><a href="index.html" class="btn btn-primary">Về trang chủ</a></div>';
        return;
    }

    // Điền dữ liệu vào các ID trong file detail.html
    // Tiêu đề
    const titleEl = document.querySelector('h1') || document.getElementById('detail-title');
    if (titleEl) titleEl.textContent = `${room.id} - ${getStreetName(room.address)}`;

    // Giá
    const priceEl = document.getElementById('detail-price') || document.querySelector('.text-danger.fw-bold');
    if (priceEl) priceEl.textContent = formatMoney(room.price);

    // Địa chỉ
    const addrEl = document.getElementById('detail-address');
    if (addrEl) addrEl.textContent = room.address;

    // Mô tả
    const descEl = document.getElementById('detail-desc');
    if (descEl) descEl.innerHTML = room.desc.replace(/\n/g, '<br>');

    // Hình ảnh (Slider / Grid)
    const galleryContainer = document.getElementById('detail-gallery') || document.querySelector('.row.g-2');
    if (galleryContainer && room.images.length > 0) {
        let html = '';
        // Ảnh lớn
        html += `<div class="col-12 mb-2"><img src="${room.images[0]}" class="img-fluid rounded shadow-sm w-100" style="max-height:400px; object-fit:cover;"></div>`;
        // Ảnh nhỏ
        html += '<div class="d-flex gap-2 overflow-auto">';
        for (let i = 1; i < room.images.length; i++) {
            html += `<img src="${room.images[i]}" class="rounded" style="width:100px; height:80px; object-fit:cover; cursor:pointer;" onclick="window.open('${room.images[i]}', '_blank')">`;
        }
        html += '</div>';
        galleryContainer.innerHTML = html;
    }

    // Tiện ích (Badge)
    const featureContainer = document.getElementById('detail-features');
    if (featureContainer) {
        const items = room.amenities.split(',').filter(i => i.trim());
        featureContainer.innerHTML = items.map(i => `<span class="badge bg-success me-2 mb-2 p-2">${i.trim().toUpperCase()}</span>`).join('');
    }
}


// =========================================================
// 5. CÁC HÀM TIỆN ÍCH (HELPER)
// =========================================================

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

function getStreetName(fullAddr) {
    if (!fullAddr) return "";
    let parts = fullAddr.split(',');
    // Lấy phần đầu tiên (thường là Số nhà + Đường)
    let streetPart = parts[0];
    // Xóa số nhà: "123/4 Cách Mạng" -> "Cách Mạng"
    return streetPart.replace(/^(số\s+)?\d+[\w\/\-]*\s+/i, '').trim();
}

function resetFilters() {
    document.getElementById('district-filter').value = 'all';
    if(document.getElementById('type-filter')) document.getElementById('type-filter').value = 'all';
    document.querySelectorAll('.amenity-check').forEach(c => c.checked = false);
    applyFilters();
}
