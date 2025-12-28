# -*- coding: utf-8 -*-
"""
Mesafe Hesaplama ve Temel Algoritma Servisleri
"""

import logging
from typing import Dict, Optional, Tuple
from geopy.distance import geodesic
from services.supabase_service import mesafe_getir_ve_kaydet

# Logger ayarla
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def kus_ucusu_mesafe_hesapla(nokta1: Dict, nokta2: Dict) -> float:
    """
    İki nokta arası kuş uçuşu mesafe hesaplar.
    Önce veritabanını kontrol eder, yoksa hesaplar ve kaydeder.
    
    Args:
        nokta1: {"id": int, "lat": float, "lon": float, "isim": str}
        nokta2: {"id": int, "lat": float, "lon": float, "isim": str}
    
    Returns:
        float: Kilometre cinsinden mesafe
    
    Raises:
        ValueError: Koordinat bilgileri eksikse
    """
    
    # Input validasyonu
    required_keys = ["id", "lat", "lon"]
    for key in required_keys:
        if key not in nokta1 or key not in nokta2:
            raise ValueError(f"Nokta bilgilerinde '{key}' alanı eksik")
    
    # Aynı nokta kontrolü
    if nokta1["id"] == nokta2["id"]:
        return 0.0
    
    # Önce veritabanından kontrol et
    try:
        db_mesafe = mesafe_getir_ve_kaydet(nokta1["id"], nokta2["id"])
        if db_mesafe and "mesafe_km" in db_mesafe:
            logger.debug(
                f"DB'den mesafe bulundu: {nokta1.get('isim', nokta1['id'])} -> "
                f"{nokta2.get('isim', nokta2['id'])}: {db_mesafe['mesafe_km']} km"
            )
            return float(db_mesafe["mesafe_km"])
    except Exception as e:
        logger.warning(f"Veritabanı sorgusu başarısız: {e}")
    
    # Veritabanında yoksa hesapla
    try:
        hesaplanan = geodesic(
            (nokta1["lat"], nokta1["lon"]),
            (nokta2["lat"], nokta2["lon"])
        ).km
        
        hesaplanan_yuvarlanmis = round(hesaplanan, 2)
        
        logger.info(
            f"Kuş uçuşu mesafe hesaplandı: {nokta1.get('isim', nokta1['id'])} -> "
            f"{nokta2.get('isim', nokta2['id'])}: {hesaplanan_yuvarlanmis} km"
        )
        
        # Veritabanına kaydet
        try:
            mesafe_getir_ve_kaydet(
                nokta1["id"], 
                nokta2["id"], 
                mesafe=hesaplanan_yuvarlanmis
            )
        except Exception as e:
            logger.warning(f"Mesafe veritabanına kaydedilemedi: {e}")
        
        return hesaplanan_yuvarlanmis
        
    except Exception as e:
        logger.error(
            f"Mesafe hesaplama hatası: {nokta1.get('isim')} -> {nokta2.get('isim')}: {e}",
            exc_info=True
        )
        raise ValueError(f"Mesafe hesaplanamadı: {str(e)}")


def mesafe_matrisi_olustur(istasyonlar: list) -> Dict[Tuple[int, int], float]:
    """
    Tüm istasyonlar arası mesafe matrisini oluşturur.
    Performans için kullanılır (tek seferde tüm mesafeleri hesaplar).
    
    Args:
        istasyonlar: İstasyon bilgilerini içeren liste
    
    Returns:
        Dict: {(id1, id2): mesafe_km} formatında sözlük
    """
    matris = {}
    toplam_hesaplama = 0
    cache_hit = 0
    
    logger.info(f"Mesafe matrisi oluşturuluyor... ({len(istasyonlar)} istasyon)")
    
    for i, ist1 in enumerate(istasyonlar):
        for j, ist2 in enumerate(istasyonlar):
            if i <= j:  # Sadece üst üçgeni hesapla (simetrik)
                try:
                    mesafe = kus_ucusu_mesafe_hesapla(ist1, ist2)
                    matris[(ist1["id"], ist2["id"])] = mesafe
                    matris[(ist2["id"], ist1["id"])] = mesafe  # Simetrik
                    
                    toplam_hesaplama += 1
                    
                except Exception as e:
                    logger.error(
                        f"Mesafe hesaplanamadı: {ist1.get('isim')} -> {ist2.get('isim')}: {e}"
                    )
                    # Hata durumunda çok büyük bir değer ata (ulaşılamaz)
                    matris[(ist1["id"], ist2["id"])] = float('inf')
                    matris[(ist2["id"], ist1["id"])] = float('inf')
    
    logger.info(
        f"Mesafe matrisi oluşturuldu: {toplam_hesaplama} hesaplama, "
        f"{cache_hit} cache hit, {len(matris)} kayıt"
    )
    
    return matris


def validate_nokta_bilgisi(nokta: Dict) -> bool:
    """
    Nokta bilgisinin geçerliliğini kontrol eder.
    
    Args:
        nokta: Kontrol edilecek nokta dictionary
    
    Returns:
        bool: Geçerli ise True
    """
    required_keys = ["id", "lat", "lon"]
    
    for key in required_keys:
        if key not in nokta:
            logger.error(f"Nokta bilgisinde '{key}' alanı eksik: {nokta}")
            return False
    
    # Koordinat sınırları kontrolü (Kocaeli yaklaşık)
    if not (40.0 <= nokta["lat"] <= 41.5):
        logger.warning(f"Şüpheli latitude değeri: {nokta['lat']} (beklenen: 40-41.5)")
    
    if not (29.0 <= nokta["lon"] <= 31.0):
        logger.warning(f"Şüpheli longitude değeri: {nokta['lon']} (beklenen: 29-31)")
    
    return True


def hesapla_toplam_rota_mesafesi(rota: list) -> float:
    """
    Bir rota için toplam mesafeyi hesaplar.
    
    Args:
        rota: İstasyon listesi (sıralı)
    
    Returns:
        float: Toplam mesafe (km)
    """
    if len(rota) < 2:
        return 0.0
    
    toplam = 0.0
    
    for i in range(len(rota) - 1):
        try:
            mesafe = kus_ucusu_mesafe_hesapla(rota[i], rota[i + 1])
            toplam += mesafe
        except Exception as e:
            logger.error(f"Rota mesafesi hesaplanamadı: segment {i} -> {i+1}: {e}")
            # Hata durumunda büyük ceza ekle
            toplam += 9999.0
    
    return round(toplam, 2)


def en_yakin_istasyon_bul(
    kaynak: Dict, 
    hedef_istasyonlar: list, 
    hariç_tutulacaklar: Optional[list] = None
) -> Optional[Dict]:
    """
    Kaynak noktaya en yakın istasyonu bulur.
    
    Args:
        kaynak: Kaynak nokta
        hedef_istasyonlar: Aday istasyon listesi
        hariç_tutulacaklar: Hariç tutulacak istasyon id'leri
    
    Returns:
        Dict veya None: En yakın istasyon bilgisi
    """
    if not hedef_istasyonlar:
        return None
    
    hariç_ids = set(hariç_tutulacaklar or [])
    
    en_yakin = None
    min_mesafe = float('inf')
    
    for hedef in hedef_istasyonlar:
        if hedef["id"] in hariç_ids or hedef["id"] == kaynak["id"]:
            continue
        
        try:
            mesafe = kus_ucusu_mesafe_hesapla(kaynak, hedef)
            if mesafe < min_mesafe:
                min_mesafe = mesafe
                en_yakin = hedef
        except Exception as e:
            logger.warning(f"Mesafe hesaplanamadı: {kaynak.get('isim')} -> {hedef.get('isim')}: {e}")
    
    return en_yakin


def rota_maliyet_hesapla(
    rota: list, 
    km_basi_maliyet: float = 1.0,
    ek_sabit_maliyet: float = 0.0
) -> float:
    """
    Bir rotanın toplam maliyetini hesaplar.
    
    Args:
        rota: İstasyon listesi
        km_basi_maliyet: Kilometre başına maliyet
        ek_sabit_maliyet: Ek sabit maliyet (kiralama vb.)
    
    Returns:
        float: Toplam maliyet
    """
    toplam_km = hesapla_toplam_rota_mesafesi(rota)
    yol_maliyeti = toplam_km * km_basi_maliyet
    toplam_maliyet = yol_maliyeti + ek_sabit_maliyet
    
    return round(toplam_maliyet, 2)


# Test fonksiyonu (geliştirme için)
if __name__ == "__main__":
    # Test verileri
    test_nokta1 = {
        "id": 1,
        "isim": "İzmit",
        "lat": 40.7654,
        "lon": 29.9401
    }
    
    test_nokta2 = {
        "id": 6,
        "isim": "Gebze",
        "lat": 40.8027,
        "lon": 29.4308
    }
    
    # Mesafe hesaplama testi
    print("=== Mesafe Hesaplama Testi ===")
    mesafe = kus_ucusu_mesafe_hesapla(test_nokta1, test_nokta2)
    print(f"{test_nokta1['isim']} -> {test_nokta2['isim']}: {mesafe} km")
    
    # Rota mesafesi testi
    print("\n=== Rota Mesafesi Testi ===")
    test_rota = [test_nokta1, test_nokta2, test_nokta1]
    toplam = hesapla_toplam_rota_mesafesi(test_rota)
    print(f"Toplam rota mesafesi: {toplam} km")
    
    # Maliyet hesaplama testi
    print("\n=== Maliyet Hesaplama Testi ===")
    maliyet = rota_maliyet_hesapla(test_rota, km_basi_maliyet=1.5, ek_sabit_maliyet=200)
    print(f"Toplam maliyet: {maliyet} birim")