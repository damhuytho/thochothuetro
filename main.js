// =========================================================
// 1. CẤU HÌNH & DỮ LIỆU
// =========================================================
const SHEET_NGUONHANG = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS5G7jESC4agyCYLxQ2aVvcft3DwohZ3yqEhSKpLgEsjZZ-akvLVUYBiHIHX3k_TGfTSxgPsG1LhGJh/pub?gid=0&single=true&output=csv';

// Danh sách tiện ích chuẩn trích xuất từ File 1.txt (Hệ thống nhập liệu)
const KNOWN_AMENITIES = [
    "Ban công", "Cửa sổ", "Thoáng mát", "Thang máy", "Hầm xe", 
    "Khóa vân tay", "Giờ giấc tự do", "Tách bếp", "Máy giặt riêng", 
    "Full nội thất", "Nhà mới", "Duplex", "Camera an ninh 24/7", "Giếng trời",
    "Nuôi Pet", "Free Wifi", "Free Xe", "Free Nước", "Free Dịch vụ", "Free Giặt"
];

let allRooms = [];
let uniqueDistricts = new Set();
let uniqueAmenities = new Set();

// =========================================================
// 2. KHỞI TẠO & TẢI DỮ LIỆU
// =========================================================
window.onload = () => {
    fetchData();
};

async function fetchData() {
    try {
        const response = await fetch(SHEET_NGUONHANG);
        const data = await response.text();
        processData(data);
    } catch (error) {
        console.error('Lỗi tải dữ liệu:', error);
        alert('Không thể tải dữ liệu. Vui lòng thử lại sau.');
    }
}

function processData(csvText) {
    const rows = parseCSV(csvText);
    
    // Bỏ dòng tiêu đề (dòng đầu tiên)
    // Map dữ liệu theo cấu trúc cột file Nguonhang.csv
    // Cột C (Index 2): Quận
    // Cột D (Index 3): Địa chỉ
    // Cột E (Index 4): Mã Composite (P+Mã - Giá)
    // Cột F (Index 5): Điểm Nổi Bật (Tiện ích)
    // Cột G (Index 6): Giá tiền
    // Cột H (Index 7): Đặc điểm (Mô tả)
    // Cột T (Index 19): Hình ảnh (Lấy index 19 vì cột A là 0)
    
    allRooms = rows.slice(1).map(row => {
        // Xử lý giá tiền (chuyển về số để lọc)
        let rawPrice = row[6] ? parseInt(row[6].replace(/\D/g, '')) : 0;
        
        // Xử lý tiện ích (tách dấu phẩy)
        let amenitiesRaw = row[5] ? row[5].split(',').map(s => s.trim()) : [];
        
        return {
            id: row[4] || "Đang cập nhật",            // Mã Composite (Cột E)
            district: row[2] || "",                   // Quận (Cột C)
            fullAddress: row[3] || "",                // Địa chỉ full (Cột D)
            amenities: amenitiesRaw,                  // Tiện ích (Cột F)
            price: rawPrice,                          // Giá (Cột G)
            desc: row[7] || "",                       // Đặc điểm (Cột H)
            images: row[19] ? row[19].split('|') : [] // Hình ảnh (Cột T)
        };
    }).filter(item => item.id !== "Đang cập nhật"); // Lọc bỏ dòng rỗng nếu có

    // 1. Tạo danh sách bộ lọc Quận
    uniqueDistricts = new Set(allRooms.map(r => r.district).filter(d => d));
    
    // 2. Tạo danh sách bộ lọc Tiện ích (Dựa trên File 1 & Dữ liệu thực tế)
    allRooms.forEach(room => {
        room.amenities.forEach(am => {
            if (am) uniqueAmenities.add(am);
        });
    });

    renderFilters();
    renderProducts(allRooms);
    
    // Tắt loading
    const loading = document.getElementById('loading');
    if(loading) loading.style.display = 'none';
}

// =========================================================
// 3. XỬ LÝ HIỂN THỊ (RENDER)
// =========================================================

function renderProducts(rooms) {
    const grid = document.getElementById('home-content');
    const resultCount = document.getElementById('result-count'); // Nếu bạn muốn hiện số lượng
    grid.innerHTML = '';

    if (rooms.length === 0) {
        grid.innerHTML = '<div class="col-12 text-center py-5"><h5>Không tìm thấy phòng nào phù hợp!</h5></div>';
        return;
    }

    rooms.forEach(room => {
        // Xử lý ảnh
        let imgUrl = "https://placehold.co/600x400?text=Tho+Cho+Thue+Tro";
        if (room.images.length > 0 && room.images[0].trim() !== "") {
            imgUrl = room.images[0].trim();
        }

        // Xử lý Tiêu đề: Mã Code + Tên đường (Giấu số nhà)
        const streetName = getStreetNameOnly(room.fullAddress);
        const displayTitle = `${room.id} - ${streetName}`;

        // Xử lý Giá hiển thị
        const priceText = formatPrice(room.price);

        // Tạo thẻ HTML
        const col = document.createElement('div');
        col.className = 'card mb-3 border-0 shadow-sm room-item';
        col.style.cursor = 'pointer';
        // Khi click vào thẻ sẽ mở trang chi tiết (nếu bạn cần logic này sau)
        // col.onclick = () => window.location.href = `detail.html?id=${encodeURIComponent(room.id)}`;

        col.innerHTML = `
            <div class="row g-0">
                <div class="col-md-4 position-relative">
                    <img src="${imgUrl}" class="img-fluid rounded-start h-100 object-fit-cover" alt="${displayTitle}" style="min-height: 200px; width: 100%;">
                    <div class="position-absolute top-0 start-0 bg-danger text-white px-2 py-1 m-2 rounded fw-bold small">
                        ${priceText}
                    </div>
                </div>
                <div class="col-md-8">
                    <div class="card-body">
                        <h5 class="card-title fw-bold text-primary mb-1">${displayTitle}</h5>
                        <p class="card-text text-muted small mb-2"><i class="fas fa-map-marker-alt me-1"></i> ${room.district}</p>
                        
                        <div class="mb-2">
                            ${room.amenities.slice(0, 4).map(tag => 
                                `<span class="badge bg-light text-dark border me-1 mb-1 fw-normal">${tag}</span>`
                            ).join('')}
                            ${room.amenities.length > 4 ? `<span class="badge bg-light text-dark border me-1 mb-1">+${room.amenities.length - 4}</span>` : ''}
                        </div>
                        
                        <p class="card-text small text-secondary line-clamp-2">${room.desc.replace(/\n/g, '. ')}</p>
                        
                        <div class="d-flex justify-content-between align-items-center mt-3">
                            <small class="text-muted">Mã: ${room.id.split('-')[0]}</small>
                            <button class="btn btn-sm btn-outline-primary rounded-pill px-3">Xem chi tiết</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        grid.appendChild(col);
    });
}

function renderFilters() {
    // 1. Render lọc Quận (Cột C)
    const districtFilter = document.getElementById('district-filter'); // ID bên HTML cần có: <select id="district-filter">
    if (districtFilter) {
        let html = '<option value="all">Tất cả Quận</option>';
        Array.from(uniqueDistricts).sort().forEach(d => {
            html += `<option value="${d}">${d}</option>`;
        });
        districtFilter.innerHTML = html;
        districtFilter.onchange = applyFilters;
    }

    // 2. Render lọc Tiện ích (Cột F - Dựa trên File 1)
    const amenitiesContainer = document.getElementById('f-amenities-checkboxes'); // ID bên HTML
    if (amenitiesContainer) {
        let html = '';
        // Ưu tiên hiển thị các tiện ích có trong danh sách chuẩn KNOWN_AMENITIES trước
        // Lọc giao giữa danh sách chuẩn và danh sách thực tế trong file CSV
        const actualAmenities = Array.from(uniqueAmenities);
        
        // Sắp xếp: Tiện ích chuẩn lên đầu
        actualAmenities.sort((a, b) => {
            const idxA = KNOWN_AMENITIES.indexOf(a);
            const idxB = KNOWN_AMENITIES.indexOf(b);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return a.localeCompare(b);
        });

        actualAmenities.forEach((am, index) => {
            const id = `am-${index}`;
            html += `
                <div class="form-check">
                    <input class="form-check-input amenity-checkbox" type="checkbox" value="${am}" id="${id}" onchange="applyFilters()">
                    <label class="form-check-label small" for="${id}">${am}</label>
                </div>
            `;
        });
        amenitiesContainer.innerHTML = html;
    }
    
    // Xử lý thanh trượt giá hoặc input giá nếu HTML có
    // (Giả sử bạn dùng input đơn giản min-max trong HTML)
}

// =========================================================
// 4. LOGIC LỌC (CORE)
// =========================================================
function applyFilters() {
    // Lấy giá trị lọc Quận
    const districtSelect = document.getElementById('district-filter');
    const selectedDistrict = districtSelect ? districtSelect.value : 'all';

    // Lấy giá trị lọc Giá (nếu có input id="price-min" và "price-max")
    const priceMinInput = document.getElementById('price-min');
    const priceMaxInput = document.getElementById('price-max');
    const minPrice = priceMinInput && priceMinInput.value ? parseInt(priceMinInput.value) * 1000000 : 0;
    const maxPrice = priceMaxInput && priceMaxInput.value ? parseInt(priceMaxInput.value) * 1000000 : 9999999999;

    // Lấy giá trị lọc Tiện ích (các checkbox đã check)
    const checkedAmenities = Array.from(document.querySelectorAll('.amenity-checkbox:checked')).map(cb => cb.value);

    // Thực hiện lọc
    const filtered = allRooms.filter(room => {
        // 1. Lọc Quận
        if (selectedDistrict !== 'all' && room.district !== selectedDistrict) return false;

        // 2. Lọc Giá
        if (room.price < minPrice || room.price > maxPrice) return false;

        // 3. Lọc Tiện ích (Phải chứa TẤT CẢ tiện ích đã chọn)
        if (checkedAmenities.length > 0) {
            const hasAll = checkedAmenities.every(am => room.amenities.includes(am));
            if (!hasAll) return false;
        }

        return true;
    });

    renderProducts(filtered);
}

function resetFilters() {
    const districtSelect = document.getElementById('district-filter');
    if(districtSelect) districtSelect.value = 'all';

    const inputs = document.querySelectorAll('input');
    inputs.forEach(i => {
        if(i.type === 'checkbox') i.checked = false;
        if(i.type === 'number') i.value = '';
    });
    
    applyFilters();
}

// =========================================================
// 5. CÁC HÀM TIỆN ÍCH (HELPER)
// =========================================================

// Hàm cắt CSV chuẩn (xử lý dấu phẩy trong ngoặc kép)
function parseCSV(text) {
    const result = [];
    let row = [];
    let inQuotes = false;
    let currentToken = '';
    
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];
        
        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentToken += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            row.push(currentToken);
            currentToken = '';
        } else if ((char === '\r' || char === '\n') && !inQuotes) {
            if (currentToken || row.length > 0) row.push(currentToken);
            if (row.length > 0) result.push(row);
            row = [];
            currentToken = '';
            if (char === '\r' && nextChar === '\n') i++;
        } else {
            currentToken += char;
        }
    }
    if (currentToken || row.length > 0) row.push(currentToken);
    if (row.length > 0) result.push(row);
    
    return result;
}

// Hàm format giá tiền (5500000 -> 5.5 Tr)
function formatPrice(price) {
    if (!price) return 'Liên hệ';
    if (price >= 1000000) {
        return (price / 1000000).toFixed(1).replace('.0', '') + ' Tr';
    }
    return (price / 1000).toFixed(0) + 'k';
}

// Hàm lấy tên đường và giấu số nhà (Logic quan trọng)
// Input: "71/88/4 Nguyễn Bặc, Tân Bình" -> Output: "Nguyễn Bặc"
function getStreetNameOnly(fullAddress) {
    if (!fullAddress) return "Đang cập nhật";
    
    // 1. Cắt bỏ Quận (thường sau dấu phẩy cuối cùng hoặc chữ Quận/Phường)
    // Lấy phần trước dấu phẩy đầu tiên nếu có, hoặc xử lý chuỗi
    let part1 = fullAddress.split(',')[0]; 
    
    // 2. Dùng Regex để xóa số nhà ở đầu chuỗi
    // Xóa các dạng: "123", "123/45", "123A", "Số 12"
    let street = part1.replace(/^(số\s+)?\d+[\w\/\-]*\s+/i, '');
    
    // 3. Xóa các từ thừa như "Đường" ở đầu nếu muốn gọn hơn
    street = street.replace(/^đường\s+/i, '');
    
    return street.trim();
}
