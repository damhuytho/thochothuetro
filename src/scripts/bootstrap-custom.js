// src/scripts/bootstrap-custom.js

// Import các thành phần: Collapse (Menu dọc), Modal (Popup), Dropdown, và Offcanvas (Menu trượt mobile)
import Collapse from 'bootstrap/js/dist/collapse';
import Modal from 'bootstrap/js/dist/modal';
import Dropdown from 'bootstrap/js/dist/dropdown';
import Offcanvas from 'bootstrap/js/dist/offcanvas'; // <--- MỚI THÊM

// 1. Hàm khởi tạo tự động các thành phần UI
const initBootstrap = () => {
    // A. Khởi tạo Collapse
    const collapseEls = document.querySelectorAll('.collapse');
    collapseEls.forEach(el => {
        if (!Collapse.getInstance(el)) {
            new Collapse(el, { toggle: false });
        }
    });

    // B. Khởi tạo Dropdown
    const dropdownEls = document.querySelectorAll('[data-bs-toggle="dropdown"]');
    dropdownEls.forEach(el => {
        if (!Dropdown.getInstance(el)) {
            new Dropdown(el);
        }
    });

    // C. Khởi tạo Offcanvas (Quan trọng cho Mobile Menu) <--- MỚI THÊM
    // Tìm tất cả phần tử có class .offcanvas để khởi tạo
    const offcanvasEls = document.querySelectorAll('.offcanvas');
    offcanvasEls.forEach(el => {
        if (!Offcanvas.getInstance(el)) {
            new Offcanvas(el);
        }
    });
};

// 2. Đưa các hàm điều khiển ra Window để gọi (nếu cần xử lý bằng JS thủ công)

// --- ĐIỀU KHIỂN COLLAPSE ---
window.bsCollapse = (id, action = 'toggle') => {
    const el = document.getElementById(id);
    if (!el) return;
    const instance = Collapse.getInstance(el) || new Collapse(el, { toggle: false });
    
    if (action === 'show') instance.show();
    else if (action === 'hide') instance.hide();
    else instance.toggle();
};

// --- ĐIỀU KHIỂN OFFCCANVAS (Menu Mobile) --- <--- MỚI THÊM
window.bsOffcanvas = (id, action = 'toggle') => {
    const el = document.getElementById(id);
    if (!el) return;
    const instance = Offcanvas.getInstance(el) || new Offcanvas(el);
    
    if (action === 'show') instance.show();
    else if (action === 'hide') instance.hide();
    else instance.toggle();
};

// --- ĐIỀU KHIỂN MODAL ---
window.bsModal = (id, action = 'show') => {
    const el = document.getElementById(id);
    if (!el) return;
    const instance = Modal.getInstance(el) || new Modal(el);
    
    if (action === 'show') instance.show();
    else if (action === 'hide') instance.hide();
    else instance.toggle();
    return instance;
};

// --- ĐIỀU KHIỂN DROPDOWN ---
window.bsDropdown = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    return Dropdown.getInstance(el) || new Dropdown(el);
}

// 3. Kích hoạt
// Sử dụng 'astro:page-load' thay vì DOMContentLoaded để đảm bảo chạy đúng cả khi tải lần đầu và khi chuyển trang (View Transitions)
document.addEventListener('astro:page-load', initBootstrap);