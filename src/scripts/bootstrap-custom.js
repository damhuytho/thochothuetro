// src/scripts/bootstrap-custom.js

// Import các thành phần cần thiết: Menu, Bộ lọc, Cửa sổ bật lên (QC), Menu thả xuống
import Collapse from 'bootstrap/js/dist/collapse';
import Modal from 'bootstrap/js/dist/modal';
import Dropdown from 'bootstrap/js/dist/dropdown';

// 1. Hàm khởi tạo tự động các thành phần UI
const initBootstrap = () => {
    // A. Khởi tạo Collapse (Menu & Filter)
    const collapseEls = document.querySelectorAll('.collapse');
    collapseEls.forEach(el => {
        if (!Collapse.getInstance(el)) {
            new Collapse(el, { toggle: false });
        }
    });

    // B. Khởi tạo Dropdown (Menu thả xuống) - Tăng trải nghiệm mượt mà
    const dropdownEls = document.querySelectorAll('[data-bs-toggle="dropdown"]');
    dropdownEls.forEach(el => {
        if (!Dropdown.getInstance(el)) {
            new Dropdown(el);
        }
    });

    // C. Khởi tạo Tooltip/Popover nếu sau này cần (Hiện tại để trống để tiết kiệm)
};

// 2. Đưa các hàm điều khiển ra Window để gọi từ bất cứ đâu

// --- ĐIỀU KHIỂN COLLAPSE (Sidebar, Mobile Menu) ---
window.bsCollapse = (id, action = 'toggle') => {
    const el = document.getElementById(id);
    if (!el) return;
    const instance = Collapse.getInstance(el) || new Collapse(el, { toggle: false });
    
    if (action === 'show') instance.show();
    else if (action === 'hide') instance.hide();
    else instance.toggle();
};

// --- ĐIỀU KHIỂN MODAL (Dùng cho Quảng cáo / Thông báo Popup) ---
// Cách dùng: window.bsModal('id-modal-quang-cao', 'show');
window.bsModal = (id, action = 'show') => {
    const el = document.getElementById(id);
    if (!el) return;
    const instance = Modal.getInstance(el) || new Modal(el); // Mặc định click ra ngoài sẽ đóng
    
    if (action === 'show') instance.show();
    else if (action === 'hide') instance.hide();
    else instance.toggle();
    
    return instance;
};

// --- ĐIỀU KHIỂN DROPDOWN (Nếu cần mở bằng code) ---
window.bsDropdown = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    return Dropdown.getInstance(el) || new Dropdown(el);
}

// 3. Kích hoạt khi trang tải xong
document.addEventListener('DOMContentLoaded', initBootstrap);
document.addEventListener('astro:after-swap', initBootstrap); // Hỗ trợ Astro chuyển trang mượt