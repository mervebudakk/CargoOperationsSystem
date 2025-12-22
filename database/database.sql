-- -----------------------------------------------------------
-- 1) DROP (Bağımlılık sırası önemli)
-- -----------------------------------------------------------
DROP TABLE IF EXISTS rota_kargolar;
DROP TABLE IF EXISTS rota_duraklar;
DROP TABLE IF EXISTS rota_araclar;
DROP TABLE IF EXISTS rotalar;
DROP TABLE IF EXISTS gonderiler;
DROP TABLE IF EXISTS senaryo_yukleri;
DROP TABLE IF EXISTS araclar;
DROP TABLE IF EXISTS senaryolar;
DROP TABLE IF EXISTS istasyonlar;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS roles;

-- -----------------------------------------------------------
-- 2) RBAC (Roles / Users)
-- -----------------------------------------------------------
CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);
INSERT INTO roles (name) VALUES ('admin'), ('user');

CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role_id INT NOT NULL REFERENCES roles(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- -----------------------------------------------------------
-- 3) İstasyonlar (Statik veri)
-- -----------------------------------------------------------
CREATE TABLE istasyonlar (
  id BIGINT PRIMARY KEY,
  isim TEXT UNIQUE NOT NULL,
  lat DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lon DOUBLE PRECISION NOT NULL CHECK (lon BETWEEN -180 AND 180),
  aktif BOOLEAN DEFAULT TRUE
);

INSERT INTO istasyonlar (id, isim, lat, lon) VALUES
  (0, 'KOU Lojistik Merkezi', 40.8198997, 29.9226879),
  (1, 'Basiskele', 40.7135, 29.9284),
  (2, 'Cayirova', 40.8338788, 29.3812750),
  (3, 'Darica', 40.7574953, 29.3840004),
  (4, 'Derince', 40.7579779, 29.8306985),
  (5, 'Dilovasi', 40.7759471, 29.5260492),
  (6, 'Gebze', 40.8015220, 29.4313766),
  (7, 'Golcuk', 40.7170762, 29.8196354),
  (8, 'Kandira', 41.0708, 30.1520),
  (9, 'Karamursel', 40.6924, 29.6159),
  (10, 'Kartepe', 40.7458640, 30.0112819),
  (11, 'Korfez', 40.7611, 29.7836),
  (12, 'Izmit', 40.7724095, 29.9505554);

-- -----------------------------------------------------------
-- 4) Senaryolar + Senaryo Yükleri (Senaryo giriş ekranının DB ayağı)
-- -----------------------------------------------------------
CREATE TABLE senaryolar (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  aciklama TEXT,
  created_by UUID REFERENCES users(id), -- giriş yapan kullanıcıya bağlamak için (opsiyonel)
  created_at TIMESTAMP DEFAULT NOW()
);

-- Her senaryoda her ilçe için toplam adet + toplam kg tutulur (3NF uyumlu)
CREATE TABLE senaryo_yukleri (
  senaryo_id INT NOT NULL REFERENCES senaryolar(id) ON DELETE CASCADE,
  alim_istasyon_id BIGINT NOT NULL REFERENCES istasyonlar(id),
  adet INT NOT NULL CHECK (adet >= 0),
  agirlik_kg INT NOT NULL CHECK (agirlik_kg >= 0),
  PRIMARY KEY (senaryo_id, alim_istasyon_id)
);
CREATE INDEX idx_senario_yukleri_senaryo ON senaryo_yukleri (senaryo_id);

-- 4 Senaryo seed (PDF tablosuna göre)
INSERT INTO senaryolar (name, aciklama) VALUES
  ('Senaryo 1', 'PDF Senaryo 1 seed'),
  ('Senaryo 2', 'PDF Senaryo 2 seed'),
  ('Senaryo 3', 'PDF Senaryo 3 seed'),
  ('Senaryo 4', 'PDF Senaryo 4 seed');

-- Senaryo 1 (id=1)
INSERT INTO senaryo_yukleri (senaryo_id, alim_istasyon_id, adet, agirlik_kg) VALUES
(1, 1, 10, 120),
(1, 2,  8,  80),
(1, 3, 15, 200),
(1, 4, 10, 150),
(1, 5, 12, 180),
(1, 6,  5,  70),
(1, 7,  7,  90),
(1, 8,  6,  60),
(1, 9,  9, 110),
(1,10, 11, 130),
(1,11,  6,  75),
(1,12, 14, 160);

-- Senaryo 2 (id=2)
INSERT INTO senaryo_yukleri (senaryo_id, alim_istasyon_id, adet, agirlik_kg) VALUES
(2, 1, 40, 200),
(2, 2, 35, 175),
(2, 3, 10, 150),
(2, 4,  5, 100),
(2, 5,  0,   0),
(2, 6,  8, 120),
(2, 7,  0,   0),
(2, 8,  0,   0),
(2, 9,  0,   0),
(2,10,  0,   0),
(2,11,  0,   0),
(2,12, 20, 160);

-- Senaryo 3 (id=3)
INSERT INTO senaryo_yukleri (senaryo_id, alim_istasyon_id, adet, agirlik_kg) VALUES
(3, 1, 0,   0),
(3, 2, 3, 700),
(3, 3, 0,   0),
(3, 4, 0,   0),
(3, 5, 4, 800),
(3, 6, 5, 900),
(3, 7, 0,   0),
(3, 8, 0,   0),
(3, 9, 0,   0),
(3,10, 0,   0),
(3,11, 0,   0),
(3,12, 5, 300);

-- Senaryo 4 (id=4)
INSERT INTO senaryo_yukleri (senaryo_id, alim_istasyon_id, adet, agirlik_kg) VALUES
(4, 1, 30, 300),
(4, 2,  0,   0),
(4, 3,  0,   0),
(4, 4,  0,   0),
(4, 5,  0,   0),
(4, 6,  0,   0),
(4, 7, 15, 220),
(4, 8,  5, 250),
(4, 9, 20, 180),
(4,10, 10, 200),
(4,11,  8, 400),
(4,12,  0,   0);

-- -----------------------------------------------------------
-- 5) Araçlar (şimdilik seed)
-- -----------------------------------------------------------
CREATE TABLE araclar (
  id SERIAL PRIMARY KEY,
  isim TEXT,
  kapasite_kg INT NOT NULL CHECK (kapasite_kg > 0),
  kapasite_adet INT,
  aktif BOOLEAN DEFAULT TRUE,
  kiralanabilir BOOLEAN NOT NULL DEFAULT FALSE,
  kiralama_maliyeti DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (kiralama_maliyeti >= 0),
  km_basi_maliyet DOUBLE PRECISION NOT NULL DEFAULT 1 CHECK (km_basi_maliyet >= 0)
);

INSERT INTO araclar (isim, kapasite_kg, kiralama_maliyeti, kiralanabilir) VALUES
('Araç 1 (500 kg)', 500, 0, FALSE),
('Araç 2 (750 kg)', 750, 0, FALSE),
('Araç 3 (1000 kg)', 1000, 0, FALSE),
('Kiralanabilir Araç (500 kg)', 500, 200, TRUE);


CREATE TABLE IF NOT EXISTS gonderiler (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  senaryo_id INT REFERENCES senaryolar(id) ON DELETE CASCADE,
  alim_istasyon_id BIGINT REFERENCES istasyonlar(id),
  teslim_istasyon_id BIGINT REFERENCES istasyonlar(id) DEFAULT 0, -- 0: KOU Lojistik Merkezi
  agirlik_kg NUMERIC NOT NULL CHECK (agirlik_kg > 0),
  hacim_desi NUMERIC NOT NULL CHECK (hacim_desi > 0),
  durum TEXT DEFAULT 'beklemede', -- beklemede, rotalandı, yolda, teslim edildi
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

