-- Onay Bekleyen Kargolar (Beklemede durumunda)
-- 3 farklı kullanıcıdan, farklı istasyonlara, farklı ağırlıklarda

INSERT INTO "public"."kargolar" 
("gonderen_id", "cikis_istasyon_id", "agirlik_kg", "adet", "durum", "olusturma_tarihi", "planlanan_tarih", "arac_id") 
VALUES 
-- Merve Karabulut'tan 3 kargo
('30576761-e7e0-4abb-b90c-71315c144e71', 3, 150, 1, 'Beklemede', NOW(), NULL, NULL),  -- Darıca
('30576761-e7e0-4abb-b90c-71315c144e71', 7, 80, 1, 'Beklemede', NOW(), NULL, NULL),   -- Gölcük
('30576761-e7e0-4abb-b90c-71315c144e71', 1, 100, 1, 'Beklemede', NOW(), NULL, NULL),  -- İzmit

-- Hüseyin Aslan'dan 3 kargo
('0c91fe37-78d2-45a7-a3d9-6fddeaf72f25', 12, 200, 1, 'Beklemede', NOW(), NULL, NULL), -- Karamürsel
('0c91fe37-78d2-45a7-a3d9-6fddeaf72f25', 3, 50, 1, 'Beklemede', NOW(), NULL, NULL),  -- Darıca
('0c91fe37-78d2-45a7-a3d9-6fddeaf72f25', 6, 120, 1, 'Beklemede', NOW(), NULL, NULL), -- Gebze

-- Dilay Dikbıyık'tan 2 kargo
('3fb14eac-3f02-46bb-9f72-543e40bf58fa', 4, 90, 1, 'Beklemede', NOW(), NULL, NULL),  -- Derince
('3fb14eac-3f02-46bb-9f72-543e40bf58fa', 1, 60, 1, 'Beklemede', NOW(), NULL, NULL);  -- İzmit