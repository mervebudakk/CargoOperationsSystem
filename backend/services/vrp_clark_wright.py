# -*- coding: utf-8 -*-
"""
VRP (Vehicle Routing Problem) Çözümü - Clarke-Wright Savings Algoritması
Kocaeli ilçeleri arası kargo dağıtım optimizasyonu için geliştirilmiş sürüm.

GÜNCELLEMELER:
- Problem tipi ayrımı eklendi (sinirsiz_arac / belirli_arac)
- Kargo seçim algoritması eklendi (kapasite yetersizliğinde)
- Reddedilen kargo takibi eklendi
- Return değeri dict formatına çevrildi (rotalar + özet)
"""

import os
import sys
import pickle
import logging
import time
from typing import List, Dict, Tuple, Optional

# OSMnx ve NetworkX import
try:
    import osmnx as ox
    import networkx as nx
    OSM_AVAILABLE = True
except ImportError:
    OSM_AVAILABLE = False
    logging.warning("OSMnx veya NetworkX yüklü değil. Sadece kuş uçuşu mesafe kullanılacak.")

# Logger ayarla
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Cache dizini oluştur
CACHE_DIR = "cache"
GRAPH_FILE_PICKLE = os.path.join(CACHE_DIR, "kocaeli_network.pickle")

if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR)
    logger.info(f"Cache dizini oluşturuldu: {CACHE_DIR}")

# Global graf değişkeni
KOCAELI_GRAPH = None


# ============================================
# IMPORT YÖNETİMİ
# ============================================

def _import_services():
    """Servisleri dinamik olarak import eder"""
    try:
        from services.supabase_service import mesafe_getir_ve_kaydet
        from services.algorithm_service import kus_ucusu_mesafe_hesapla
        return mesafe_getir_ve_kaydet, kus_ucusu_mesafe_hesapla
    except ImportError:
        parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        if parent_dir not in sys.path:
            sys.path.insert(0, parent_dir)
        
        try:
            from services.supabase_service import mesafe_getir_ve_kaydet
            from services.algorithm_service import kus_ucusu_mesafe_hesapla
            return mesafe_getir_ve_kaydet, kus_ucusu_mesafe_hesapla
        except ImportError as e:
            logger.error(f"Servisler import edilemedi: {e}")
            return _fallback_mesafe_getir, _fallback_kus_ucusu


def _fallback_mesafe_getir(id1, id2, mesafe=None, koordinatlar=None):
    """DB servisi yoksa fallback"""
    return None


def _fallback_kus_ucusu(nokta1, nokta2):
    """Algorithm servisi yoksa fallback"""
    from geopy.distance import geodesic
    return geodesic(
        (nokta1["lat"], nokta1["lon"]),
        (nokta2["lat"], nokta2["lon"])
    ).km


# Servisleri yükle
mesafe_getir_ve_kaydet, kus_ucusu_mesafe_hesapla = _import_services()


# ============================================
# YOL AĞI YÖNETİMİ
# ============================================

def grafi_yukle() -> Optional[object]:
    """
    Kocaeli yol ağını yükler veya indirir.
    Önce pickle cache'den, yoksa OSM'den indirir.
    
    Returns:
        nx.MultiDiGraph veya None: Yol ağı grafiği
    """
    global KOCAELI_GRAPH
    
    if not OSM_AVAILABLE:
        logger.warning("OSMnx mevcut değil, yol ağı yüklenemedi")
        return None
    
    if KOCAELI_GRAPH is not None:
        return KOCAELI_GRAPH
    
    try:
        # Önce cache'den yükle
        if os.path.exists(GRAPH_FILE_PICKLE):
            logger.info("Yol ağı cache'den yükleniyor...")
            with open(GRAPH_FILE_PICKLE, 'rb') as f:
                KOCAELI_GRAPH = pickle.load(f)
            logger.info("✓ Yol ağı başarıyla yüklendi (cache)")
            return KOCAELI_GRAPH
        
        # Cache yoksa OSM'den indir
        logger.info("Yol ağı OSM'den indiriliyor (bu işlem birkaç dakika sürebilir)...")
        KOCAELI_GRAPH = ox.graph_from_place(
            "Kocaeli, Turkey", 
            network_type="drive"
        )
        
        # Cache'e kaydet
        with open(GRAPH_FILE_PICKLE, 'wb') as f:
            pickle.dump(KOCAELI_GRAPH, f)
        
        logger.info(f"✓ Yol ağı indirildi ve cache'e kaydedildi: {GRAPH_FILE_PICKLE}")
        return KOCAELI_GRAPH
        
    except Exception as e:
        logger.error(f"Yol ağı yüklenemedi: {e}", exc_info=True)
        KOCAELI_GRAPH = None
        return None


# İlk yükleme denemesi
if OSM_AVAILABLE:
    try:
        grafi_yukle()
    except Exception as e:
        logger.warning(f"İlk yükleme başarısız, OSM yönlendirme devre dışı: {e}")


# ============================================
# MESAFE HESAPLAMA
# ============================================

def mesafe_hesapla(nokta1: Dict, nokta2: Dict) -> float:
    """
    İki nokta arası gerçek yol mesafesini hesaplar.
    Öncelik sırası: DB -> OSM Routing -> Kuş Uçuşu
    
    Args:
        nokta1: Başlangıç noktası (id, lat, lon içermeli)
        nokta2: Bitiş noktası (id, lat, lon içermeli)
    
    Returns:
        float: Kilometre cinsinden mesafe
    """
    
    # Aynı nokta kontrolü
    if nokta1["id"] == nokta2["id"]:
        return 0.0
    
    # 1. ÖNCELİK: Veritabanından kontrol et
    try:
        db_veri = mesafe_getir_ve_kaydet(nokta1["id"], nokta2["id"])
        if db_veri and "mesafe_km" in db_veri:
            logger.debug(
                f"DB'den mesafe: {nokta1.get('isim', nokta1['id'])} -> "
                f"{nokta2.get('isim', nokta2['id'])}: {db_veri['mesafe_km']} km"
            )
            return float(db_veri["mesafe_km"])
    except Exception as e:
        logger.debug(f"DB mesafe sorgusu atlandı: {e}")
    
    # 2. ÖNCELİK: OSM yol ağından hesapla
    if OSM_AVAILABLE and KOCAELI_GRAPH is not None:
        try:
            u = ox.nearest_nodes(KOCAELI_GRAPH, nokta1["lon"], nokta1["lat"])
            v = ox.nearest_nodes(KOCAELI_GRAPH, nokta2["lon"], nokta2["lat"])
            
            mesafe_m = nx.shortest_path_length(
                KOCAELI_GRAPH, 
                u, 
                v, 
                weight="length"
            )
            
            mesafe_km = round(mesafe_m / 1000.0, 2)
            
            logger.info(
                f"OSM yol mesafesi: {nokta1.get('isim', nokta1['id'])} -> "
                f"{nokta2.get('isim', nokta2['id'])}: {mesafe_km} km"
            )
            
            # Veritabanına kaydet
            try:
                mesafe_getir_ve_kaydet(
                    nokta1["id"], 
                    nokta2["id"], 
                    mesafe=mesafe_km
                )
            except Exception as e:
                logger.debug(f"Mesafe DB'ye kaydedilemedi: {e}")
            
            return mesafe_km
            
        except (nx.NetworkXNoPath, nx.NodeNotFound) as e:
            logger.warning(
                f"OSM rotası bulunamadı: {nokta1.get('isim')} -> "
                f"{nokta2.get('isim')}: {e}"
            )
        except Exception as e:
            logger.debug(f"OSM hesaplama hatası: {e}")
    
    # 3. ÖNCELİK: Kuş uçuşu mesafe (fallback)
    logger.info(
        f"Kuş uçuşu mesafe kullanılıyor: {nokta1.get('isim')} -> "
        f"{nokta2.get('isim')}"
    )
    return kus_ucusu_mesafe_hesapla(nokta1, nokta2)


def rota_cizim_koordinatlarini_bul(nokta1: Dict, nokta2: Dict) -> List[List[float]]:
    """
    İki nokta arası yol çizimi için koordinatları döner.
    Gerçek yol ağını kullanır.
    
    Args:
        nokta1: Başlangıç noktası
        nokta2: Bitiş noktası
    
    Returns:
        List[List[float]]: [[lat, lon], [lat, lon], ...] formatında koordinatlar
    """
    
    if nokta1["id"] == nokta2["id"]:
        return [[nokta1["lat"], nokta1["lon"]]]
    
    if OSM_AVAILABLE and KOCAELI_GRAPH is not None:
        try:
            u = ox.nearest_nodes(KOCAELI_GRAPH, nokta1["lon"], nokta1["lat"])
            v = ox.nearest_nodes(KOCAELI_GRAPH, nokta2["lon"], nokta2["lat"])
            
            path = nx.shortest_path(KOCAELI_GRAPH, u, v, weight="length")
            
            koordinatlar = [
                [KOCAELI_GRAPH.nodes[n]['y'], KOCAELI_GRAPH.nodes[n]['x']] 
                for n in path
            ]
            
            logger.debug(
                f"Yol koordinatları: {nokta1.get('isim')} -> "
                f"{nokta2.get('isim')}: {len(koordinatlar)} nokta"
            )
            
            return koordinatlar
            
        except Exception as e:
            logger.debug(f"Yol koordinatları alınamadı, düz çizgi kullanılıyor: {e}")
    
    # Fallback: Düz çizgi
    return [[nokta1["lat"], nokta1["lon"]], [nokta2["lat"], nokta2["lon"]]]


# ============================================
# YENİ: KARGO SEÇİM ALGORİTMALARI
# ============================================

def kargo_sec_agirliga_gore(musteriler: List[Dict], max_kapasite: float) -> Tuple[List[Dict], int]:
    """
    Maksimum ağırlık hedefi: Toplam kg'yi maksimize et
    
    Greedy yaklaşım: Ağır kargoları önceliklendir
    
    Args:
        musteriler: Müşteri (istasyon) listesi
        max_kapasite: Maksimum kapasite (kg)
    
    Returns:
        Tuple[List[Dict], int]: (seçilmiş müşteriler, reddedilen sayısı)
    """
    logger.info("🎯 Kargo Seçimi: Maksimum Ağırlık Stratejisi")
    
    # Ağırlığa göre sırala (büyükten küçüğe)
    sirali = sorted(musteriler, key=lambda x: x.get("kargo_agirlik", 0), reverse=True)
    
    secilmis = []
    toplam_agirlik = 0
    
    for m in sirali:
        m_agirlik = m.get("kargo_agirlik", 0)
        
        if toplam_agirlik + m_agirlik <= max_kapasite:
            secilmis.append(m)
            toplam_agirlik += m_agirlik
            logger.debug(f"  ✅ Kabul: {m['isim']} ({m_agirlik} kg)")
        else:
            logger.info(f"  ❌ Red: {m['isim']} ({m_agirlik} kg) - Kapasite yetersiz")
    
    reddedilen = len(musteriler) - len(secilmis)
    
    logger.info(
        f"📊 Seçim Sonucu: {len(secilmis)}/{len(musteriler)} istasyon, "
        f"{toplam_agirlik:.2f}/{max_kapasite:.2f} kg, "
        f"{reddedilen} reddedildi"
    )
    
    return secilmis, reddedilen


def kargo_sec_adete_gore(musteriler: List[Dict], max_kapasite: float) -> Tuple[List[Dict], int]:
    """
    Maksimum adet hedefi: Kargo sayısını maksimize et
    
    Greedy yaklaşım: Hafif kargoları önceliklendir (daha fazla istasyon)
    
    Args:
        musteriler: Müşteri (istasyon) listesi
        max_kapasite: Maksimum kapasite (kg)
    
    Returns:
        Tuple[List[Dict], int]: (seçilmiş müşteriler, reddedilen sayısı)
    """
    logger.info("🎯 Kargo Seçimi: Maksimum Adet Stratejisi")
    
    # Ağırlığa göre sırala (küçükten büyüğe - hafif önce)
    sirali = sorted(musteriler, key=lambda x: x.get("kargo_agirlik", 0))
    
    secilmis = []
    toplam_agirlik = 0
    
    for m in sirali:
        m_agirlik = m.get("kargo_agirlik", 0)
        
        if toplam_agirlik + m_agirlik <= max_kapasite:
            secilmis.append(m)
            toplam_agirlik += m_agirlik
            logger.debug(f"  ✅ Kabul: {m['isim']} ({m_agirlik} kg)")
        else:
            logger.info(f"  ❌ Red: {m['isim']} ({m_agirlik} kg) - Kapasite yetersiz")
    
    reddedilen = len(musteriler) - len(secilmis)
    
    logger.info(
        f"📊 Seçim Sonucu: {len(secilmis)}/{len(musteriler)} istasyon, "
        f"{toplam_agirlik:.2f}/{max_kapasite:.2f} kg, "
        f"{reddedilen} reddedildi"
    )
    
    return secilmis, reddedilen


# ============================================
# 2-OPT ROTA İYİLEŞTİRME
# ============================================

def rota_tsp_optimize_et(rota: List[Dict], depo: Dict) -> List[Dict]:
    """
    Traveling Salesman Problem (TSP) ile rota sıralama.
    Nearest Neighbor Heuristic kullanır.
    
    Mantık:
    1. Depoya en uzak noktadan başla
    2. Her adımda ziyaret edilmemiş en yakın noktaya git
    3. Tüm noktaları ziyaret et
    
    Args:
        rota: Durak listesi
        depo: Depo bilgisi
    
    Returns:
        List[Dict]: TSP ile optimize edilmiş rota
    """
    
    if not rota or len(rota) <= 2:
        return rota
    
    from math import radians, cos, sin, asin, sqrt
    
    def mesafe_hesapla(p1, p2):
        """İki nokta arası kuş uçuşu mesafe"""
        lat1, lon1 = radians(p1["lat"]), radians(p1["lon"])
        lat2, lon2 = radians(p2["lat"]), radians(p2["lon"])
        dlon = lon2 - lon1
        dlat = lat2 - lat1
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        return 2 * asin(sqrt(a)) * 6371
    
    # 1. Depoya en uzak noktayı bul
    en_uzak = max(rota, key=lambda d: mesafe_hesapla(depo, d))
    
    # 2. Nearest Neighbor ile sıralama
    ziyaret_edilmemis = [d for d in rota if d != en_uzak]
    sirali_rota = [en_uzak]
    mevcut = en_uzak
    
    while ziyaret_edilmemis:
        # En yakın ziyaret edilmemiş noktayı bul
        en_yakin = min(ziyaret_edilmemis, key=lambda d: mesafe_hesapla(mevcut, d))
        sirali_rota.append(en_yakin)
        ziyaret_edilmemis.remove(en_yakin)
        mevcut = en_yakin
    
    logger.debug(
        f"✨ TSP Optimizasyonu: {rota[0]['isim']} → {sirali_rota[0]['isim']}, "
        f"{len(sirali_rota)} durak optimize edildi"
    )
    
    return sirali_rota


def two_opt_iyilestirme(rota: List[Dict], max_iterasyon: int = 50) -> List[Dict]:
    """
    2-opt algoritması ile rotayı iyileştirir.
    Rotanın toplam mesafesini azaltmaya çalışır.
    
    Args:
        rota: İyileştirilecek rota (istasyon listesi)
        max_iterasyon: Maksimum iterasyon sayısı
    
    Returns:
        List[Dict]: İyileştirilmiş rota
    """
    
    if len(rota) < 4:
        return rota  # Çok kısa rotalar için gerek yok
    
    iyilestirme_yapildi = True
    iterasyon = 0
    
    logger.debug(f"2-opt iyileştirme başlatılıyor: {len(rota)} durak")
    
    while iyilestirme_yapildi and iterasyon < max_iterasyon:
        iyilestirme_yapildi = False
        iterasyon += 1
        
        for i in range(1, len(rota) - 2):
            for j in range(i + 1, len(rota)):
                if j - i == 1:
                    continue
                
                # Mevcut mesafe
                eski_mesafe = (
                    mesafe_hesapla(rota[i-1], rota[i]) +
                    mesafe_hesapla(rota[j-1], rota[j])
                )
                
                # Yeni mesafe (swap sonrası)
                yeni_mesafe = (
                    mesafe_hesapla(rota[i-1], rota[j-1]) +
                    mesafe_hesapla(rota[i], rota[j] if j < len(rota) else rota[i])
                )
                
                # İyileştirme varsa swap yap
                if yeni_mesafe < eski_mesafe - 0.01:  # Küçük tolerans
                    rota[i:j] = reversed(rota[i:j])
                    iyilestirme_yapildi = True
                    logger.debug(
                        f"2-opt iyileştirme: {eski_mesafe:.2f} -> {yeni_mesafe:.2f} km "
                        f"(tasarruf: {eski_mesafe - yeni_mesafe:.2f} km)"
                    )
                    break
            
            if iyilestirme_yapildi:
                break
    
    if iterasyon > 1:
        logger.info(f"2-opt tamamlandı: {iterasyon} iterasyon")
    
    return rota


# ============================================
# CLARKE-WRIGHT SAVINGS ALGORİTMASI
# ============================================

def clarke_wright_tasarruf_hesapla(
    depo: Dict,
    musteri_listesi: List[Dict]
) -> List[Tuple[float, Dict, Dict]]:
    """
    Clarke-Wright tasarruf değerlerini hesaplar.
    
    Args:
        depo: Depo noktası bilgisi
        musteri_listesi: Müşteri (istasyon) listesi
    
    Returns:
        List[Tuple]: (tasarruf, musteri1, musteri2) listesi (büyükten küçüğe)
    """
    tasarruflar = []
    n = len(musteri_listesi)
    
    logger.info(f"Clarke-Wright tasarrufları hesaplanıyor ({n} müşteri)...")
    
    for i in range(n):
        for j in range(i + 1, n):
            m1, m2 = musteri_listesi[i], musteri_listesi[j]
            
            # Tasarruf = d(0,i) + d(0,j) - d(i,j)
            d_0_i = mesafe_hesapla(depo, m1)
            d_0_j = mesafe_hesapla(depo, m2)
            d_i_j = mesafe_hesapla(m1, m2)
            
            tasarruf = d_0_i + d_0_j - d_i_j
            
            tasarruflar.append((tasarruf, m1, m2))
    
    # Büyükten küçüğe sırala
    tasarruflar.sort(key=lambda x: x[0], reverse=True)
    
    if tasarruflar:
        logger.info(
            f"✓ {len(tasarruflar)} tasarruf değeri hesaplandı. "
            f"En yüksek: {tasarruflar[0][0]:.2f} km"
        )
    else:
        logger.warning("⚠️  Tasarruf hesaplanamadı - Yetersiz müşteri sayısı (en az 2 gerekli)")
    
    return tasarruflar


def rotalari_birlestir(
    ham_rotalar: List[List[Dict]],
    tasarruflar: List[Tuple[float, Dict, Dict]],
    kapasite_limiti: float
) -> List[List[Dict]]:
    """
    Clarke-Wright algoritmasına göre rotaları birleştirir.
    
    Args:
        ham_rotalar: Başlangıç rotaları (her müşteri ayrı rotada)
        tasarruflar: Tasarruf değerleri listesi
        kapasite_limiti: Maksimum araç kapasitesi
    
    Returns:
        List[List[Dict]]: Birleştirilmiş rotalar
    """
    
    for tasarruf, m1, m2 in tasarruflar:
        # m1 ve m2'nin bulunduğu rotaları bul
        r1 = next((r for r in ham_rotalar if r[0] == m1 or r[-1] == m1), None)
        r2 = next((r for r in ham_rotalar if r[0] == m2 or r[-1] == m2), None)
        
        # Farklı rotalarda olmalı
        if r1 and r2 and r1 != r2:
            # Toplam yük kontrolü
            toplam_yuk = sum(m.get("kargo_agirlik", 0) for m in r1 + r2)
            
            if toplam_yuk <= kapasite_limiti:
                # Rotaları birleştir (sıra önemli)
                if r1[-1] == m1 and r2[0] == m2:
                    yeni_rota = r1 + r2
                elif r1[0] == m1 and r2[-1] == m2:
                    yeni_rota = r2 + r1
                elif r1[-1] == m1 and r2[-1] == m2:
                    yeni_rota = r1 + r2[::-1]
                elif r1[0] == m1 and r2[0] == m2:
                    yeni_rota = r1[::-1] + r2
                else:
                    continue
                
                # Eski rotaları kaldır, yeni rotayı ekle
                ham_rotalar.remove(r1)
                ham_rotalar.remove(r2)
                ham_rotalar.append(yeni_rota)
                
                logger.debug(
                    f"Rotalar birleştirildi: {len(r1)} + {len(r2)} = "
                    f"{len(yeni_rota)} durak, Yük: {toplam_yuk:.1f} kg"
                )
    
    return ham_rotalar


# ============================================
# ANA OPTİMİZASYON FONKSİYONU
# ============================================

def rotayi_optimize_et(
    istasyonlar: List[Dict],
    araclar: List[Dict],
    ayarlar: Dict,
    problem_tipi: str = "sinirsiz_arac"
) -> Dict:
    """
    VRP çözümü için Clarke-Wright algoritmasını uygular.
    
    **YENİ: Problem tipi ayrımı eklendi!**
    
    Args:
        istasyonlar: İstasyon listesi (id, isim, lat, lon, kargo_agirlik)
        araclar: Araç listesi (id, isim, kapasite_kg, kiralanabilir)
        ayarlar: Sistem ayarları (km_basi_maliyet, kiralama_maliyeti)
        problem_tipi: "sinirsiz_arac" veya "belirli_arac"
    
    Returns:
        Dict: {
            "rotalar": List[Dict],  # Rota detayları
            "ozet": Dict  # Özet istatistikler
        }
    """
    
    baslangic = time.time()
    
    logger.info("=" * 60)
    logger.info("CLARKE-WRIGHT ROTA OPTİMİZASYONU BAŞLIYOR")
    logger.info("=" * 60)
    logger.info(f"Problem Tipi: {problem_tipi}")
    logger.info(f"İstasyon Sayısı: {len(istasyonlar)}")
    logger.info(f"Araç Sayısı: {len(araclar)}")
    
    # Depo noktasını bul (KOÜ)
    depo = next(
        (i for i in istasyonlar if i["id"] == 0 or "üniversite" in i["isim"].lower()),
        istasyonlar[0]
    )
    
    logger.info(f"Depo (KOÜ): {depo['isim']} (ID: {depo['id']})")
    
    # Kargo olan müşterileri bul
    musteriler = [
        i for i in istasyonlar 
        if i["id"] != depo["id"] and i.get("kargo_agirlik", 0) > 0
    ]
    
    if not musteriler:
        logger.warning("Kargo olan istasyon bulunamadı!")
        return {
            "rotalar": [],
            "ozet": {
                "toplam_kargo_sayisi": 0,
                "kabul_edilen_kargo_sayisi": 0,
                "reddedilen_kargo_sayisi": 0,
                "tasınan_kargo_kg": 0,
                "toplam_km": 0,
                "toplam_maliyet": 0,
                "kullanilan_arac_sayisi": 0,
                "calisma_suresi_ms": 0
            }
        }
    
    logger.info(f"Kargolu İstasyon Sayısı: {len(musteriler)}")
    
    # Toplam yük
    toplam_yuk = sum(m.get("kargo_agirlik", 0) for m in musteriler)
    toplam_musteri_sayisi = len(musteriler)
    logger.info(f"Toplam Kargo: {toplam_yuk:.2f} kg")
    
    # Araç ayırma
    ozmal_araclar = [a for a in araclar if not a.get("kiralanabilir", False)]
    kiralik_sablon = next(
        (a for a in araclar if a.get("kiralanabilir", False)),
        {"kapasite_kg": 500, "kiralama_maliyeti": 200}
    )
    
    logger.info(f"Öz Mal Araç: {len(ozmal_araclar)}")
    
    # Sistem ayarları
    km_maliyeti = ayarlar.get("km_basi_maliyet", 1.0)
    kiralama_sabiti = ayarlar.get("kiralama_maliyeti_500kg", 200.0)
    
    # ============================================
    # YENİ: PROBLEM TİPİ AYRIMI
    # ============================================
    reddedilen_sayisi = 0
    
    if problem_tipi == "belirli_arac":
        logger.info("")
        logger.info("=" * 60)
        logger.info("🚚 BELİRLİ ARAÇ PROBLEMİ")
        logger.info("=" * 60)
        
        # Sadece öz mal araçları kullan
        musait_araclar = sorted(ozmal_araclar, key=lambda x: x["kapasite_kg"], reverse=True)
        toplam_kapasite = sum(a["kapasite_kg"] for a in musait_araclar)
        
        logger.info(f"Mevcut Araç Sayısı: {len(musait_araclar)}")
        logger.info(f"Toplam Kapasite: {toplam_kapasite} kg")
        logger.info(f"Gerekli Yük: {toplam_yuk} kg")
        
        if toplam_yuk > toplam_kapasite:
            logger.warning("")
            logger.warning("⚠️  KAPASİTE YETERSİZ! KARGO SEÇİMİ YAPILIYOR...")
            logger.warning(f"    Eksik Kapasite: {toplam_yuk - toplam_kapasite:.2f} kg")
            logger.warning("")
            
            # KARGO SEÇİMİ: Ağırlığa göre (maksimum kg hedefi)
            musteriler, reddedilen_sayisi = kargo_sec_agirliga_gore(musteriler, toplam_kapasite)
            
            logger.info(f"✅ Kargo seçimi tamamlandı: {len(musteriler)}/{toplam_musteri_sayisi} istasyon kabul edildi")
            logger.info(f"❌ Reddedilen istasyon sayısı: {reddedilen_sayisi}")
        else:
            logger.info("✅ Kapasite yeterli - Tüm kargolar taşınabilir")
            reddedilen_sayisi = 0
        
        # Kiralama yasak!
        kiralik_sablon = None
        logger.info("🚫 Araç kiralama: KAPALI")
        logger.info("=" * 60)
        logger.info("")
    
    else:  # "sinirsiz_arac"
        logger.info("")
        logger.info("=" * 60)
        logger.info("♾️  SINIRSIZ ARAÇ PROBLEMİ")
        logger.info("=" * 60)
        logger.info("✅ Tüm kargolar taşınacak")
        logger.info("✅ Gerekirse araç kiralanacak")
        logger.info(f"💰 Kiralama maliyeti: {kiralama_sabiti} birim/araç")
        logger.info("=" * 60)
        logger.info("")
        reddedilen_sayisi = 0
        musait_araclar = ozmal_araclar
    
    # ============================================
    # ÖZEL DURUM: TEK MÜŞTERİ
    # ============================================
    if len(musteriler) == 1:
        logger.warning("⚠️  Sadece 1 müşteri bulundu - Basit rota oluşturuluyor")
        
        musteri = musteriler[0]
        yuk = musteri.get("kargo_agirlik", 0)
        
        # Uygun aracı bul
        uygun_arac = next(
            (a for a in sorted(musait_araclar, key=lambda x: x["kapasite_kg"]) if a["kapasite_kg"] >= yuk),
            None
        )
        
        if not uygun_arac and problem_tipi == "sinirsiz_arac" and kiralik_sablon:
            kiralama_kapasitesi = max(kiralik_sablon["kapasite_kg"], yuk)
            uygun_arac = {
                "id": "KIRALIK_1",
                "isim": f"Kiralık Araç 1 ({kiralama_kapasitesi:.0f}kg)",
                "kapasite_kg": kiralama_kapasitesi,
                "kiralama_maliyeti": kiralama_sabiti
            }
            is_kiralik = True
        elif not uygun_arac:
            logger.error(f"Tek müşteri için uygun araç bulunamadı! Yük: {yuk} kg")
            return {
                "rotalar": [],
                "ozet": {
                    "toplam_kargo_sayisi": 1,
                    "kabul_edilen_kargo_sayisi": 0,
                    "reddedilen_kargo_sayisi": 1,
                    "tasınan_kargo_kg": 0,
                    "toplam_km": 0,
                    "toplam_maliyet": 0,
                    "kullanilan_arac_sayisi": 0,
                    "calisma_suresi_ms": int((time.time() - baslangic) * 1000)
                }
            }
        else:
            is_kiralik = False
        
        # Basit rota: Depo -> Müşteri -> Depo
        gidis_mesafe = mesafe_hesapla(depo, musteri)
        donus_mesafe = mesafe_hesapla(musteri, depo)
        toplam_km = gidis_mesafe + donus_mesafe
        
        yol_maliyeti = toplam_km * km_maliyeti
        kiralama_maliyeti = kiralama_sabiti if is_kiralik else uygun_arac.get("kiralama_maliyeti", 0)
        toplam_maliyet = yol_maliyeti + kiralama_maliyeti
        
        gidis_coords = rota_cizim_koordinatlarini_bul(depo, musteri)
        donus_coords = rota_cizim_koordinatlarini_bul(musteri, depo)
        
        basit_rota = {
            "arac_id": uygun_arac["id"],
            "arac_isim": uygun_arac["isim"],
            "toplam_km": round(toplam_km, 2),
            "maliyet": round(toplam_maliyet, 2),
            "duraklar": [
                {
                    "sira": 1,
                    "istasyon_id": musteri["id"],
                    "istasyon_isim": musteri["isim"],
                    "ara_mesafe": round(gidis_mesafe, 2),
                    "yuklu_kargo_kg": yuk,
                    "kalan_kapasite_kg": round(uygun_arac["kapasite_kg"] - yuk, 2)
                },
                {
                    "sira": 2,
                    "istasyon_id": depo["id"],
                    "istasyon_isim": depo["isim"],
                    "ara_mesafe": round(donus_mesafe, 2),
                    "yuklu_kargo_kg": yuk,
                    "kalan_kapasite_kg": round(uygun_arac["kapasite_kg"] - yuk, 2)
                }
            ],
            "cizim_koordinatlari": gidis_coords + donus_coords,
            "yuk_kg": yuk,
            "kapasite_kg": uygun_arac["kapasite_kg"],
            "doluluk_orani": round((yuk / uygun_arac["kapasite_kg"]) * 100, 1)
        }
        
        sure = time.time() - baslangic
        
        logger.info(f"✅ Basit rota oluşturuldu: {toplam_km:.2f} km, {toplam_maliyet:.2f} birim")
        
        return {
            "rotalar": [basit_rota],
            "ozet": {
                "toplam_kargo_sayisi": 1,
                "kabul_edilen_kargo_sayisi": 1,
                "reddedilen_kargo_sayisi": 0,
                "tasınan_kargo_kg": yuk,
                "toplam_km": round(toplam_km, 2),
                "toplam_maliyet": round(toplam_maliyet, 2),
                "kullanilan_arac_sayisi": 1,
                "calisma_suresi_ms": int(sure * 1000)
            }
        }
    
    # Tasarrufları hesapla
    tasarruflar = clarke_wright_tasarruf_hesapla(depo, musteriler)
    
    # Başlangıç rotaları
    ham_rotalar = [[m] for m in musteriler]
    
    # Kapasite limiti - AKILLI SEÇIM
    if problem_tipi == "sinirsiz_arac":
        # Sınırsız araçta: Ortalama araç kapasitesi (daha fazla rota için)
        toplam_kapasite = sum(a["kapasite_kg"] for a in musait_araclar)
        ortalama_kapasite = toplam_kapasite / len(musait_araclar) if musait_araclar else 500
        max_kapasite = ortalama_kapasite * 1.2  # %20 esneklik
        logger.debug(f"Sınırsız araç: Ortalama kapasite limit {max_kapasite:.0f} kg")
    else:
        # Belirli araçta: En büyük araç kapasitesi
        max_kapasite = max(
            [a["kapasite_kg"] for a in musait_araclar] + 
            ([kiralik_sablon["kapasite_kg"]] if kiralik_sablon else [0])
        )
        logger.debug(f"Belirli araç: Maksimum kapasite limit {max_kapasite:.0f} kg")
    
    # Rotaları birleştir
    birlesik_rotalar = rotalari_birlestir(ham_rotalar, tasarruflar, max_kapasite)
    logger.info(f"Birleştirme Sonrası Rota Sayısı: {len(birlesik_rotalar)}")
    
    # YENİ: TSP ile rota sıralamasını optimize et
    for idx, rota in enumerate(birlesik_rotalar):
        if len(rota) >= 2:
            birlesik_rotalar[idx] = rota_tsp_optimize_et(rota, depo)
    
    # Her rotaya 2-opt uygula
    for idx, rota in enumerate(birlesik_rotalar):
        if len(rota) >= 4:
            birlesik_rotalar[idx] = two_opt_iyilestirme(rota)
    
    # Araç atama ve detay hesaplama
    final_rotalar = []
    # ✅ YENİ: Küçükten büyüğe sırala (önce küçük araçları kullan)
    musait_ozmal = sorted(musait_araclar, key=lambda x: x["kapasite_kg"]).copy()
    kiralik_sayaci = 1
    
    for rota_idx, rota in enumerate(birlesik_rotalar, 1):
        rota_yuku = sum(m.get("kargo_agirlik", 0) for m in rota)
        
        # ✅ YENİ: En küçük uygun aracı bul (önce küçük araçları tüket)
        uygun_arac = next(
            (a for a in musait_ozmal if a["kapasite_kg"] >= rota_yuku), 
            None
        )
        
        if uygun_arac:
            musait_ozmal.remove(uygun_arac)
            current_arac = uygun_arac
            is_kiralik = False
        
        elif problem_tipi == "sinirsiz_arac" and kiralik_sablon:
            # ✅ Sadece sınırsız araç probleminde kirala
            # ⚠️  Kiralık araç kapasitesi kontrolü
            kiralama_kapasitesi = kiralik_sablon["kapasite_kg"]
            
            
            
            current_arac = {
                "id": f"KIRALIK_{kiralik_sayaci}",
                "isim": f"Kiralık Araç {kiralik_sayaci} ({kiralama_kapasitesi:.0f}kg)",
                "kapasite_kg": kiralama_kapasitesi,
                "kiralama_maliyeti": kiralama_sabiti
            }
            kiralik_sayaci += 1
            is_kiralik = True
            logger.info(f"💰 Kiralık araç eklendi: {current_arac['isim']}")
        
        else:
            # ❌ Belirli araç probleminde araç bulunamadı
            logger.error(
                f"⚠️  Rota #{rota_idx} için araç bulunamadı! "
                f"Yük: {rota_yuku:.2f} kg. Rota atlanıyor."
            )
            logger.error("    Bu hata kargo seçim algoritmasından kaynaklanıyor olabilir.")
            continue  # Bu rotayı atla
        
        # Tam yol: Müşteriler + KOÜ (bitiş)
        tam_yol = list(rota)
        if tam_yol[-1]["id"] != depo["id"]:
            tam_yol.append(depo)
        
        # Durak detayları
        durak_listesi = []
        toplam_km = 0.0
        cizim_koordinatlari = []
        anlik_yuk_kg = 0.0
        
        for idx in range(len(tam_yol)):
            if idx == 0:
                ara_mesafe = 0.0
                coords = []
            else:
                ara_mesafe = mesafe_hesapla(tam_yol[idx-1], tam_yol[idx])
                coords = rota_cizim_koordinatlarini_bul(tam_yol[idx-1], tam_yol[idx])
            
            toplam_km += ara_mesafe
            cizim_koordinatlari.extend(coords)
            anlik_yuk_kg += tam_yol[idx].get("kargo_agirlik", 0)
            
            durak_listesi.append({
                "sira": idx + 1,
                "istasyon_id": tam_yol[idx]["id"],
                "istasyon_isim": tam_yol[idx]["isim"],
                "ara_mesafe": round(ara_mesafe, 2),
                "yuklu_kargo_kg": round(anlik_yuk_kg, 2),
                "kalan_kapasite_kg": round(current_arac["kapasite_kg"] - anlik_yuk_kg, 2)
            })
        
        # Maliyet
        yol_maliyeti = toplam_km * km_maliyeti
        kiralama_maliyeti = kiralama_sabiti if is_kiralik else current_arac.get("kiralama_maliyeti", 0)
        toplam_maliyet = yol_maliyeti + kiralama_maliyeti
        
        logger.info(
            f"Rota {rota_idx}: {current_arac['isim']}, "
            f"{len(durak_listesi)} durak, {toplam_km:.2f} km, "
            f"{rota_yuku:.2f} kg, {toplam_maliyet:.2f} birim"
        )
        
        final_rotalar.append({
            "arac_id": current_arac["id"],
            "arac_isim": current_arac["isim"],
            "toplam_km": round(toplam_km, 2),
            "maliyet": round(toplam_maliyet, 2),
            "duraklar": durak_listesi,
            "cizim_koordinatlari": cizim_koordinatlari,
            "yuk_kg": round(rota_yuku, 2),
            "kapasite_kg": current_arac["kapasite_kg"],
            "doluluk_orani": round((rota_yuku / current_arac["kapasite_kg"]) * 100, 1)
        })
    
    # Özet
    sure = time.time() - baslangic
    toplam_mesafe = sum(r["toplam_km"] for r in final_rotalar)
    toplam_maliyet_genel = sum(r["maliyet"] for r in final_rotalar)
    tasınan_kg = sum(r["yuk_kg"] for r in final_rotalar)
    
    logger.info("")
    logger.info("=" * 60)
    logger.info("✅ OPTİMİZASYON TAMAMLANDI")
    logger.info("=" * 60)
    logger.info(f"Oluşturulan Rota Sayısı: {len(final_rotalar)}")
    logger.info(f"Toplam Mesafe: {toplam_mesafe:.2f} km")
    logger.info(f"Toplam Maliyet: {toplam_maliyet_genel:.2f} birim")
    logger.info(f"Taşınan Kargo: {tasınan_kg:.2f} kg")
    logger.info(f"Kabul Edilen: {len(musteriler)}/{toplam_musteri_sayisi} istasyon")
    logger.info(f"Reddedilen: {reddedilen_sayisi} istasyon")
    logger.info(f"Çalışma Süresi: {sure:.2f} saniye")
    logger.info("=" * 60)
    logger.info("")
    
    # YENİ: Dict formatında dön (rotalar + özet)
    return {
        "rotalar": final_rotalar,
        "ozet": {
            "toplam_kargo_sayisi": toplam_musteri_sayisi,
            "kabul_edilen_kargo_sayisi": len(musteriler),
            "reddedilen_kargo_sayisi": reddedilen_sayisi,
            "tasınan_kargo_kg": round(tasınan_kg, 2),
            "toplam_km": round(toplam_mesafe, 2),
            "toplam_maliyet": round(toplam_maliyet_genel, 2),
            "kullanilan_arac_sayisi": len(final_rotalar),
            "calisma_suresi_ms": int(sure * 1000)
        }
    }


# ============================================
# TEST FONKSİYONU
# ============================================

if __name__ == "__main__":
    print("=== Clarke-Wright Algoritma Testi ===\n")
    
    # Test verileri
    test_istasyonlar = [
        {"id": 0, "isim": "Kocaeli Üniversitesi", "lat": 40.8199, "lon": 29.9227, "kargo_agirlik": 0},
        {"id": 6, "isim": "Gebze", "lat": 40.8015, "lon": 29.4314, "kargo_agirlik": 150},
        {"id": 3, "isim": "Darıca", "lat": 40.7575, "lon": 29.3840, "kargo_agirlik": 200},
        {"id": 7, "isim": "Gölcük", "lat": 40.7171, "lon": 29.8196, "kargo_agirlik": 90}
    ]
    
    test_araclar = [
        {"id": 1, "isim": "Araç-1", "kapasite_kg": 500, "kiralanabilir": False},
        {"id": 2, "isim": "Araç-2", "kapasite_kg": 750, "kiralanabilir": False},
        {"id": 3, "isim": "Kiralık Şablon", "kapasite_kg": 500, "kiralanabilir": True, "kiralama_maliyeti": 200}
    ]
    
    test_ayarlar = {
        "km_basi_maliyet": 1.0,
        "kiralama_maliyeti_500kg": 200.0
    }
    
    # Test 1: Sınırsız Araç
    print("\n" + "="*60)
    print("TEST 1: SINIRSIZ ARAÇ PROBLEMİ")
    print("="*60)
    sonuc1 = rotayi_optimize_et(test_istasyonlar, test_araclar, test_ayarlar, "sinirsiz_arac")
    print(f"\nRotalar: {len(sonuc1['rotalar'])}")
    print(f"Maliyet: {sonuc1['ozet']['toplam_maliyet']} birim")
    
    # Test 2: Belirli Araç
    print("\n" + "="*60)
    print("TEST 2: BELİRLİ ARAÇ PROBLEMİ")
    print("="*60)
    sonuc2 = rotayi_optimize_et(test_istasyonlar, test_araclar, test_ayarlar, "belirli_arac")
    print(f"\nRotalar: {len(sonuc2['rotalar'])}")
    print(f"Maliyet: {sonuc2['ozet']['toplam_maliyet']} birim")
    print(f"Reddedilen: {sonuc2['ozet']['reddedilen_kargo_sayisi']} istasyon")