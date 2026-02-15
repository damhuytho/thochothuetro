import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import purgecss from 'astro-purgecss';

export default defineConfig({
  // Domain thật của bạn
  site: 'https://thochothuetro.com',
  base: '/',

  integrations: [
    sitemap(),
    
    // CẤU HÌNH PURGECSS (QUAN TRỌNG)
    purgecss({
      safelist: {
        // 1. Giữ lại các class chuẩn (String match)
        standard: [
          // --- Bootstrap Dynamic Classes (Menu, Tabs, Collapse) ---
          'active', 
          'show', 
          'fade', 
          'collapsing', 
          'collapsed', 
          'dropdown-menu', 
          'dropdown-toggle',
          'd-none', 
          'd-block', 
          'd-flex',
          'invisible',

          // --- Leaflet Map Classes (Rất quan trọng) ---
          'leaflet-pane',
          'leaflet-tile',
          'leaflet-marker-icon',
          'leaflet-marker-shadow',
          'leaflet-tile-container',
          'leaflet-zoom-animated',
          'leaflet-interactive',
          'leaflet-popup-content',
          'leaflet-popup-content-wrapper',
          'leaflet-popup-tip-container',
          'leaflet-popup-tip',
          'leaflet-control',
          
          // --- Marker Clusters (Gom nhóm map) ---
          'my-cluster', 
          'marker-cluster', 
          'marker-cluster-small', 
          'marker-cluster-medium', 
          'marker-cluster-large',

          // --- Custom Marker & Popup (Do file map-search.astro tạo ra bằng JS) ---
          'custom-pin-container',
          'custom-marker-dot',
          'custom-marker-label',
          'view-detailed',
          'spinner-hidden',
          
          // Popup Card Styles
          'map-popup-card',
          'map-popup-img-wrapper',
          'map-popup-badge',
          'map-popup-info',
          'map-popup-title',
          'map-popup-sub',
          'map-popup-footer',
          'map-popup-price',
          'map-popup-action',
          
          // --- Contact Page Animations ---
          'btn-pulse-blue',
          'qr-scan-line'
        ],

        // 2. Giữ lại các class theo quy tắc (Regex)
        deep: [
          /^leaflet-/,      // Giữ tất cả class bắt đầu bằng leaflet-
          /^fa-/,           // Giữ tất cả icon FontAwesome
          /^animate__/,     // Giữ animation library (nếu có)
          /^bg-/,           // Giữ các màu background động
          /^text-/,         // Giữ các màu chữ động
        ],
        
        // 3. Quét cả các class nằm trong attribute (đề phòng)
        greedy: [
            /^leaflet-/,
            /^fa-/
        ]
      },
      // Quét thêm các file JS để tìm class (đề phòng class tạo động)
      content: [
          process.cwd() + '/src/**/*.{astro,html,js,jsx,svelte,ts,tsx,vue}',
          process.cwd() + '/public/**/*.js' 
      ],
      // Vẫn giữ lại các keyframes animation
      keyframes: true,
      fontFace: true,
    })
  ]
});