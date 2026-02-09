// src/scripts/bootstrap-custom.js

// Import đầy đủ các thành phần
import Collapse from 'bootstrap/js/dist/collapse';
import Modal from 'bootstrap/js/dist/modal';
import Dropdown from 'bootstrap/js/dist/dropdown';
import Offcanvas from 'bootstrap/js/dist/offcanvas';

// 1. Hàm khởi tạo tự động các thành phần UI
const initBootstrap = () => {
    // A. Khởi tạo Collapse (Menu dọc / Accordion)
    const collapseEls = document.querySelectorAll('.collapse');
    collapseEls.forEach(el => {
        // Hủy instance cũ để tránh lỗi khi chuyển trang (Astro)
        const instance = Collapse.getInstance(el);
        if (instance) instance.dispose();
        new Collapse(el, { toggle: false });
    });

    // B. Khởi tạo Dropdown
    const dropdownEls = document.querySelectorAll('[data-bs-toggle="dropdown"]');
    dropdownEls.forEach(el => {
        const instance = Dropdown.getInstance(el);
        if (instance) instance.dispose();
        new Dropdown(el);
    });

    // C. Khởi tạo Offcanvas (Menu Mobile) - ĐÃ TỐI ƯU
    const offcanvasEls = document.querySelectorAll('.offcanvas');
    offcanvasEls.forEach(el => {
        // Dọn dẹp instance cũ
        const oldInstance = Offcanvas.getInstance(el);
        if (oldInstance) oldInstance.dispose();

        // Tạo mới
        const myOffcanvas = new Offcanvas(el);

        // TÍNH NĂNG MỚI: Tự động đóng menu khi click vào link bên trong
        // Giúp trải nghiệm người dùng tốt hơn, chọn xong là menu trượt vào
        const menuLinks = el.querySelectorAll('.nav-link, .dropdown-item');
        menuLinks.forEach(link => {
            link.addEventListener('click', () => {
                // Chỉ đóng nếu không phải là nút mở dropdown con
                if (!link.classList.contains('dropdown-toggle')) {
                    myOffcanvas.hide();
                }
            });
        });
    });
};

// 2. Hàm dọn dẹp khi rời trang (QUAN TRỌNG CHO ASTRO)
// Giúp xóa lớp màn đen (backdrop) nếu bị kẹt khi chuyển trang
const cleanupBootstrap = () => {
    const backdrop = document.querySelector('.offcanvas-backdrop');
    if (backdrop) backdrop.remove();
    
    document.body.classList.remove('offcanvas-open');
    document.body.classList.remove('modal-open');
    document.body.style = '';
};

// 3. Đưa các hàm điều khiển ra Window (GIỮ NGUYÊN CỦA BẠN)

// --- ĐIỀU KHIỂN COLLAPSE ---
window.bsCollapse = (id, action = 'toggle') => {
    const el = document.getElementById(id);
    if (!el) return;
    const instance = Collapse.getInstance(el) || new Collapse(el, { toggle: false });
    
    if (action === 'show') instance.show();
    else if (action === 'hide') instance.hide();
    else instance.toggle();
};

// --- ĐIỀU KHIỂN OFFCANVAS ---
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

// 4. Kích hoạt sự kiện
// Chạy khi tải trang và sau mỗi lần chuyển trang (View Transitions)
document.addEventListener('astro:page-load', initBootstrap);

// Dọn dẹp trước khi đổi trang
document.addEventListener('astro:before-swap', cleanupBootstrap);