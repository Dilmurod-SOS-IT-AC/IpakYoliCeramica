export const demoTiles = [
  { id: 1, code: 'IPK-60120-WH', supplier_name: 'Foshan Ceramics Co.', width_mm: 600, height_mm: 1200, size_label: '600 × 1200', pieces_per_box: 2, m2_per_box: 1.44, price_usd_per_m2: 12.8, min_stock_pieces: 40, stock_pieces: 146, stock_m2: 105.12, is_active: true, tint: 'stone' },
  { id: 2, code: 'IPK-6060-SD', supplier_name: 'Guangdong Tile Group', width_mm: 600, height_mm: 600, size_label: '600 × 600', pieces_per_box: 4, m2_per_box: 1.44, price_usd_per_m2: 8.5, min_stock_pieces: 60, stock_pieces: 28, stock_m2: 10.08, is_active: true, tint: 'sand' },
  { id: 3, code: 'IPK-3060-MB', supplier_name: 'Foshan Ceramics Co.', width_mm: 300, height_mm: 600, size_label: '300 × 600', pieces_per_box: 8, m2_per_box: 1.44, price_usd_per_m2: 7.4, min_stock_pieces: 50, stock_pieces: 95, stock_m2: 17.1, is_active: true, tint: 'marble' },
  { id: 4, code: 'IPK-8080-GR', supplier_name: 'Oriental Surface Ltd.', width_mm: 800, height_mm: 800, size_label: '800 × 800', pieces_per_box: 2, m2_per_box: 1.28, price_usd_per_m2: 14.2, min_stock_pieces: 32, stock_pieces: 18, stock_m2: 11.52, is_active: true, tint: 'green' },
  { id: 5, code: 'IPK-3030-CL', supplier_name: 'Guangdong Tile Group', width_mm: 300, height_mm: 300, size_label: '300 × 300', pieces_per_box: 11, m2_per_box: 0.99, price_usd_per_m2: 5.6, min_stock_pieces: 70, stock_pieces: 220, stock_m2: 19.8, is_active: true, tint: 'clay' },
  { id: 6, code: 'IPK-60120-BG', supplier_name: 'Oriental Surface Ltd.', width_mm: 600, height_mm: 1200, size_label: '600 × 1200', pieces_per_box: 2, m2_per_box: 1.44, price_usd_per_m2: 13.6, min_stock_pieces: 40, stock_pieces: 35, stock_m2: 25.2, is_active: true, tint: 'beige' },
  { id: 7, code: 'IPK-6060-AN', supplier_name: 'Foshan Ceramics Co.', width_mm: 600, height_mm: 600, size_label: '600 × 600', pieces_per_box: 4, m2_per_box: 1.44, price_usd_per_m2: 9.9, min_stock_pieces: 60, stock_pieces: 84, stock_m2: 30.24, is_active: true, tint: 'anthracite' },
  { id: 8, code: 'IPK-3030-WH', supplier_name: 'Oriental Surface Ltd.', width_mm: 300, height_mm: 300, size_label: '300 × 300', pieces_per_box: 11, m2_per_box: 0.99, price_usd_per_m2: 4.8, min_stock_pieces: 70, stock_pieces: 13, stock_m2: 1.17, is_active: true, tint: 'white' }
];

export const demoSuppliers = [
  { id: 1, name: 'Foshan Ceramics Co.', country: 'China' },
  { id: 2, name: 'Guangdong Tile Group', country: 'China' },
  { id: 3, name: 'Oriental Surface Ltd.', country: 'China' }
];
export const demoWarehouses = [
  { code: 'MAIN', name: 'Главный склад' },
  { code: 'SHOWROOM', name: 'Шоурум' }
];
export const demoCustomers = [
  { id: 1, name: 'Build House MChJ', type: 'construction', phone: '+998 90 123 45 67' },
  { id: 2, name: 'Aziz Karimov', type: 'retail', phone: '+998 93 234 56 78' },
  { id: 3, name: 'Premium Stroy', type: 'dealer', phone: '+998 97 345 67 89' }
];
export const demoShipments = [
  { id: 11, number: 'SH-2026-018', supplier_name: 'Foshan Ceramics Co.', warehouse_code: 'MAIN', status: 'in_transit', arrival_date: '2026-10-16', items_count: 8, shipping_cost_usd: 940, customs_cost_usd: 1200, items: [{ tile_id: 1, tile_code: 'IPK-60120-WH', quantity_pieces: 48 }], created_at: '2026-10-03T10:30:00Z' },
  { id: 12, number: 'SH-2026-017', supplier_name: 'Oriental Surface Ltd.', warehouse_code: 'MAIN', status: 'arrived', arrival_date: '2026-10-07', items_count: 5, shipping_cost_usd: 760, customs_cost_usd: 890, items: [{ tile_id: 6, tile_code: 'IPK-60120-BG', quantity_pieces: 40 }], created_at: '2026-09-22T10:30:00Z' },
  { id: 13, number: 'SH-2026-016', supplier_name: 'Guangdong Tile Group', warehouse_code: 'SHOWROOM', status: 'ordered', arrival_date: '2026-10-24', items_count: 6, shipping_cost_usd: 1100, customs_cost_usd: 0, items: [{ tile_id: 3, tile_code: 'IPK-3060-MB', quantity_pieces: 24 }], created_at: '2026-09-20T10:30:00Z' }
];
export const demoSales = [
  { id: 21, number: 'S-20261010-001', customer_name: 'Build House MChJ', warehouse_code: 'MAIN', items_count: 4, total_usd: 2840.5, total_uzs: 35899500, created_at: '2026-10-10T08:50:00Z', created_by_name: 'admin' },
  { id: 22, number: 'S-20261009-004', customer_name: 'Aziz Karimov', warehouse_code: 'MAIN', items_count: 2, total_usd: 690, total_uzs: 8715600, created_at: '2026-10-09T14:12:00Z', created_by_name: 'seller' },
  { id: 23, number: 'S-20261009-003', customer_name: 'Premium Stroy', warehouse_code: 'SHOWROOM', items_count: 7, total_usd: 4150, total_uzs: 52434000, created_at: '2026-10-09T09:06:00Z', created_by_name: 'seller' },
  { id: 24, number: 'S-20261008-002', customer_name: 'Розничный покупатель', warehouse_code: 'MAIN', items_count: 1, total_usd: 125, total_uzs: 1579500, created_at: '2026-10-08T12:20:00Z', created_by_name: 'seller' },
  { id: 25, number: 'S-20261007-008', customer_name: 'Build House MChJ', warehouse_code: 'MAIN', items_count: 5, total_usd: 1920, total_uzs: 24259200, created_at: '2026-10-07T11:20:00Z', created_by_name: 'admin' }
];
export const demoMovements = [
  { id: 301, type: 'incoming', tile_code: 'IPK-60120-WH', warehouse_code: 'MAIN', quantity_pieces: 48, note: 'Поступление SH-2026-017', created_at: '2026-10-10T08:10:00Z', created_by_name: 'admin' },
  { id: 302, type: 'sale', tile_code: 'IPK-6060-SD', warehouse_code: 'MAIN', quantity_pieces: -16, note: 'Продажа S-20261010-001', created_at: '2026-10-10T08:50:00Z', created_by_name: 'seller' },
  { id: 303, type: 'return', tile_code: 'IPK-3030-CL', warehouse_code: 'MAIN', quantity_pieces: 11, note: 'Возврат товара', created_at: '2026-10-09T16:15:00Z', created_by_name: 'admin' },
  { id: 304, type: 'sale', tile_code: 'IPK-8080-GR', warehouse_code: 'SHOWROOM', quantity_pieces: -4, note: 'Продажа S-20261009-003', created_at: '2026-10-09T09:06:00Z', created_by_name: 'seller' },
  { id: 305, type: 'incoming', tile_code: 'IPK-60120-BG', warehouse_code: 'MAIN', quantity_pieces: 40, note: 'Поступление SH-2026-017', created_at: '2026-10-07T10:20:00Z', created_by_name: 'admin' }
];
export const demoDashboard = {
  kpis: { tile_count: 8, total_pieces: 639, low_stock_count: 4, month_sales_count: 42, month_revenue_uzs: 684500000, shipments_in_transit: 2, suppliers_count: 3 },
  sales_week: [
    { date: '2026-10-04', label: 'Вс', total_uzs: 28900000 },
    { date: '2026-10-05', label: 'Пн', total_uzs: 41300000 },
    { date: '2026-10-06', label: 'Вт', total_uzs: 35600000 },
    { date: '2026-10-07', label: 'Ср', total_uzs: 52400000 },
    { date: '2026-10-08', label: 'Чт', total_uzs: 39800000 },
    { date: '2026-10-09', label: 'Пт', total_uzs: 74100000 },
    { date: '2026-10-10', label: 'Сб', total_uzs: 35900000 }
  ]
};
