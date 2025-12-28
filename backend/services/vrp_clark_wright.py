import os
import sys
import pickle
import logging
import time
from typing import List, Dict, Tuple, Optional

try:
    import osmnx as ox
    import networkx as nx
    OSM_AVAILABLE = True
except ImportError:
    OSM_AVAILABLE = False
    logging.warning("OSMnx veya NetworkX yüklü değil. Sadece kuş uçuşu mesafe kullanılacak.")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

CACHE_DIR = "cache"
GRAPH_FILE_PICKLE = os.path.join(CACHE_DIR, "kocaeli_network.pickle")

if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR)
    logger.info(f"Cache dizini oluşturuldu: {CACHE_DIR}")

KOCAELI_GRAPH = None

def _import_services():
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
    return None


def _fallback_kus_ucusu(nokta1, nokta2):
    from geopy.distance import geodesic
    return geodesic(
        (nokta1["lat"], nokta1["lon"]),
        (nokta2["lat"], nokta2["lon"])
    ).km


mesafe_getir_ve_kaydet, kus_ucusu_mesafe_hesapla = _import_services()


def grafi_yukle() -> Optional[object]:
    global KOCAELI_GRAPH
    
    if not OSM_AVAILABLE:
        logger.warning("OSMnx mevcut değil, yol ağı yüklenemedi")
        return None
    
    if KOCAELI_GRAPH is not None:
        return KOCAELI_GRAPH
    
    try:
        if os.path.exists(GRAPH_FILE_PICKLE):
            logger.info("Yol ağı cache'den yükleniyor...")
            with open(GRAPH_FILE_PICKLE, 'rb') as f:
                KOCAELI_GRAPH = pickle.load(f)
            logger.info("✓ Yol ağı başarıyla yüklendi (cache)")
            return KOCAELI_GRAPH
        
        logger.info("Yol ağı OSM'den indiriliyor (bu işlem birkaç dakika sürebilir)...")
        KOCAELI_GRAPH = ox.graph_from_place(
            "Kocaeli, Turkey", 
            network_type="drive"
        )
        
        with open(GRAPH_FILE_PICKLE, 'wb') as f:
            pickle.dump(KOCAELI_GRAPH, f)
        
        logger.info(f"✓ Yol ağı indirildi ve cache'e kaydedildi: {GRAPH_FILE_PICKLE}")
        return KOCAELI_GRAPH
        
    except Exception as e:
        logger.error(f"Yol ağı yüklenemedi: {e}", exc_info=True)
        KOCAELI_GRAPH = None
        return None


if OSM_AVAILABLE:
    try:
        grafi_yukle()
    except Exception as e:
        logger.warning(f"İlk yükleme başarısız, OSM yönlendirme devre dışı: {e}")


def mesafe_hesapla(nokta1: Dict, nokta2: Dict) -> float:
    if nokta1["id"] == nokta2["id"]:
        return 0.0
    
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
    
    logger.info(
        f"Kuş uçuşu mesafe kullanılıyor: {nokta1.get('isim')} -> "
        f"{nokta2.get('isim')}"
    )
    return kus_ucusu_mesafe_hesapla(nokta1, nokta2)


def rota_cizim_koordinatlarini_bul(nokta1: Dict, nokta2: Dict) -> List[List[float]]:
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
    
    return [[nokta1["lat"], nokta1["lon"]], [nokta2["lat"], nokta2["lon"]]]


def kargo_sec_agirliga_gore(musteriler: List[Dict], max_kapasite: float) -> Tuple[List[Dict], int]:
    logger.info("🎯 Kargo Seçimi: Maksimum Ağırlık Stratejisi")
    
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
    logger.info("🎯 Kargo Seçimi: Maksimum Adet Stratejisi")
    
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


def rota_tsp_optimize_et(rota: List[Dict], depo: Dict) -> List[Dict]:
    
    if not rota or len(rota) <= 2:
        return rota
    
    from math import radians, cos, sin, asin, sqrt
    
    def mesafe_hesapla(p1, p2):
        lat1, lon1 = radians(p1["lat"]), radians(p1["lon"])
        lat2, lon2 = radians(p2["lat"]), radians(p2["lon"])
        dlon = lon2 - lon1
        dlat = lat2 - lat1
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        return 2 * asin(sqrt(a)) * 6371
    
    en_uzak = max(rota, key=lambda d: mesafe_hesapla(depo, d))
    ziyaret_edilmemis = [d for d in rota if d != en_uzak]
    sirali_rota = [en_uzak]
    mevcut = en_uzak
    
    while ziyaret_edilmemis:
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
    
    if len(rota) < 4:
        return rota  
    
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
                
                eski_mesafe = (
                    mesafe_hesapla(rota[i-1], rota[i]) +
                    mesafe_hesapla(rota[j-1], rota[j])
                )
                
                yeni_mesafe = (
                    mesafe_hesapla(rota[i-1], rota[j-1]) +
                    mesafe_hesapla(rota[i], rota[j] if j < len(rota) else rota[i])
                )
                
                if yeni_mesafe < eski_mesafe - 0.01:  
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


def clarke_wright_tasarruf_hesapla(
    depo: Dict,
    musteri_listesi: List[Dict]
) -> List[Tuple[float, Dict, Dict]]:
    tasarruflar = []
    n = len(musteri_listesi)
    
    logger.info(f"Clarke-Wright tasarrufları hesaplanıyor ({n} müşteri)...")
    
    for i in range(n):
        for j in range(i + 1, n):
            m1, m2 = musteri_listesi[i], musteri_listesi[j]
            
            d_0_i = mesafe_hesapla(depo, m1)
            d_0_j = mesafe_hesapla(depo, m2)
            d_i_j = mesafe_hesapla(m1, m2)
            
            tasarruf = d_0_i + d_0_j - d_i_j
            
            tasarruflar.append((tasarruf, m1, m2))
    
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
    
    for tasarruf, m1, m2 in tasarruflar:
        r1 = next((r for r in ham_rotalar if r[0] == m1 or r[-1] == m1), None)
        r2 = next((r for r in ham_rotalar if r[0] == m2 or r[-1] == m2), None)
        
        if r1 and r2 and r1 != r2:
            toplam_yuk = sum(m.get("kargo_agirlik", 0) for m in r1 + r2)
            
            if toplam_yuk <= kapasite_limiti:
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
                
                ham_rotalar.remove(r1)
                ham_rotalar.remove(r2)
                ham_rotalar.append(yeni_rota)
                
                logger.debug(
                    f"Rotalar birleştirildi: {len(r1)} + {len(r2)} = "
                    f"{len(yeni_rota)} durak, Yük: {toplam_yuk:.1f} kg"
                )
    
    return ham_rotalar

def rotayi_optimize_et(
    istasyonlar: List[Dict],
    araclar: List[Dict],
    ayarlar: Dict,
    problem_tipi: str = "sinirsiz_arac"
) -> Dict:
    baslangic = time.time()
    
    logger.info("=" * 60)
    logger.info("CLARKE-WRIGHT ROTA OPTİMİZASYONU BAŞLIYOR")
    logger.info("=" * 60)
    logger.info(f"Problem Tipi: {problem_tipi}")
    logger.info(f"İstasyon Sayısı: {len(istasyonlar)}")
    logger.info(f"Araç Sayısı: {len(araclar)}")
    
    depo = next(
        (i for i in istasyonlar if i["id"] == 0 or "üniversite" in i["isim"].lower()),
        istasyonlar[0]
    )
    
    logger.info(f"Depo (KOÜ): {depo['isim']} (ID: {depo['id']})")
    
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
    
    toplam_yuk = sum(m.get("kargo_agirlik", 0) for m in musteriler)
    toplam_musteri_sayisi = len(musteriler)
    logger.info(f"Toplam Kargo: {toplam_yuk:.2f} kg")
    
    ozmal_araclar = [a for a in araclar if not a.get("kiralanabilir", False)]
    kiralik_sablon = next(
        (a for a in araclar if a.get("kiralanabilir", False)),
        {"kapasite_kg": 500, "kiralama_maliyeti": 200}
    )
    
    logger.info(f"Öz Mal Araç: {len(ozmal_araclar)}")
    
    km_maliyeti = ayarlar.get("km_basi_maliyet", 1.0)
    kiralama_sabiti = ayarlar.get("kiralama_maliyeti_500kg", 200.0)
    
    reddedilen_sayisi = 0
    
    if problem_tipi == "belirli_arac":
        logger.info("")
        logger.info("=" * 60)
        logger.info("🚚 BELİRLİ ARAÇ PROBLEMİ")
        logger.info("=" * 60)
        
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
            
            musteriler, reddedilen_sayisi = kargo_sec_agirliga_gore(musteriler, toplam_kapasite)
            
            logger.info(f"✅ Kargo seçimi tamamlandı: {len(musteriler)}/{toplam_musteri_sayisi} istasyon kabul edildi")
            logger.info(f"❌ Reddedilen istasyon sayısı: {reddedilen_sayisi}")
        else:
            logger.info("✅ Kapasite yeterli - Tüm kargolar taşınabilir")
            reddedilen_sayisi = 0
        
        kiralik_sablon = None
        logger.info("🚫 Araç kiralama: KAPALI")
        logger.info("=" * 60)
        logger.info("")
    
    else: 
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
    
    if len(musteriler) == 1:
        logger.warning("⚠️  Sadece 1 müşteri bulundu - Basit rota oluşturuluyor")
        
        musteri = musteriler[0]
        yuk = musteri.get("kargo_agirlik", 0)
        
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
    
    tasarruflar = clarke_wright_tasarruf_hesapla(depo, musteriler)
    
    ham_rotalar = [[m] for m in musteriler]
    
    if problem_tipi == "sinirsiz_arac":
        toplam_kapasite = sum(a["kapasite_kg"] for a in musait_araclar)
        ortalama_kapasite = toplam_kapasite / len(musait_araclar) if musait_araclar else 500
        max_kapasite = ortalama_kapasite * 1.2  # %20 esneklik
        logger.debug(f"Sınırsız araç: Ortalama kapasite limit {max_kapasite:.0f} kg")
    else:
        max_kapasite = max(
            [a["kapasite_kg"] for a in musait_araclar] + 
            ([kiralik_sablon["kapasite_kg"]] if kiralik_sablon else [0])
        )
        logger.debug(f"Belirli araç: Maksimum kapasite limit {max_kapasite:.0f} kg")
    
    birlesik_rotalar = rotalari_birlestir(ham_rotalar, tasarruflar, max_kapasite)
    logger.info(f"Birleştirme Sonrası Rota Sayısı: {len(birlesik_rotalar)}")
    
    for idx, rota in enumerate(birlesik_rotalar):
        if len(rota) >= 2:
            birlesik_rotalar[idx] = rota_tsp_optimize_et(rota, depo)
    
    for idx, rota in enumerate(birlesik_rotalar):
        if len(rota) >= 4:
            birlesik_rotalar[idx] = two_opt_iyilestirme(rota)
    
    final_rotalar = []
    musait_ozmal = sorted(musait_araclar, key=lambda x: x["kapasite_kg"]).copy()
    kiralik_sayaci = 1
    
    for rota_idx, rota in enumerate(birlesik_rotalar, 1):
        rota_yuku = sum(m.get("kargo_agirlik", 0) for m in rota)
        
        uygun_arac = next(
            (a for a in musait_ozmal if a["kapasite_kg"] >= rota_yuku), 
            None
        )
        
        if uygun_arac:
            musait_ozmal.remove(uygun_arac)
            current_arac = uygun_arac
            is_kiralik = False
        
        elif problem_tipi == "sinirsiz_arac" and kiralik_sablon:
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
            logger.error(
                f"⚠️  Rota #{rota_idx} için araç bulunamadı! "
                f"Yük: {rota_yuku:.2f} kg. Rota atlanıyor."
            )
            logger.error("    Bu hata kargo seçim algoritmasından kaynaklanıyor olabilir.")
            continue  
        
        tam_yol = list(rota)
        if tam_yol[-1]["id"] != depo["id"]:
            tam_yol.append(depo)
        
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

if __name__ == "__main__":
    print("=== Clarke-Wright Algoritma Testi ===\n")
    
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
    
    print("\n" + "="*60)
    print("TEST 1: SINIRSIZ ARAÇ PROBLEMİ")
    print("="*60)
    sonuc1 = rotayi_optimize_et(test_istasyonlar, test_araclar, test_ayarlar, "sinirsiz_arac")
    print(f"\nRotalar: {len(sonuc1['rotalar'])}")
    print(f"Maliyet: {sonuc1['ozet']['toplam_maliyet']} birim")
    
    print("\n" + "="*60)
    print("TEST 2: BELİRLİ ARAÇ PROBLEMİ")
    print("="*60)
    sonuc2 = rotayi_optimize_et(test_istasyonlar, test_araclar, test_ayarlar, "belirli_arac")
    print(f"\nRotalar: {len(sonuc2['rotalar'])}")
    print(f"Maliyet: {sonuc2['ozet']['toplam_maliyet']} birim")
    print(f"Reddedilen: {sonuc2['ozet']['reddedilen_kargo_sayisi']} istasyon")