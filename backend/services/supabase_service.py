import os
import logging
from typing import List, Dict, Optional, Any
from datetime import datetime
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL:
    logger.error("SUPABASE_URL environment variable'ı eksik!")
    raise ValueError("Supabase URL yapılandırması eksik")

if not SUPABASE_ANON_KEY and not SUPABASE_SERVICE_ROLE_KEY:
    logger.error("SUPABASE_ANON_KEY veya SUPABASE_SERVICE_ROLE_KEY gerekli!")
    raise ValueError("Supabase key yapılandırması eksik")


def _client() -> Client:
    try:
        key = SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY
        if not key:
            raise ValueError("Supabase key bulunamadı")
        return create_client(SUPABASE_URL, key)
    except Exception as e:
        logger.error(f"Supabase client oluşturulamadı: {e}")
        raise


def _admin_client() -> Client:
    try:
        if not SUPABASE_SERVICE_ROLE_KEY:
            logger.warning("Service role key yok, normal client kullanılıyor")
            return _client()
        return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    except Exception as e:
        logger.error(f"Admin client oluşturulamadı: {e}")
        raise


supabase_admin = _admin_client()

def istasyonlari_dbden_cek(sadece_aktif: bool = True) -> List[Dict]:
    try:
        query = supabase_admin.table("istasyonlar").select("*")
        
        if sadece_aktif:
            query = query.eq("aktif", True)
        
        response = query.execute()
        
        if not response.data:
            logger.warning("Veritabanında istasyon bulunamadı!")
            return []
        
        logger.info(f"{len(response.data)} istasyon veritabanından çekildi")
        return response.data
        
    except Exception as e:
        logger.error(f"İstasyonlar çekilemedi: {e}", exc_info=True)
        raise


def istasyon_ekle(isim: str, lat: float, lon: float) -> Dict:
    try:
        if not isim or not isim.strip():
            raise ValueError("İstasyon ismi boş olamaz")
        
        if not (40.0 <= lat <= 41.5) or not (29.0 <= lon <= 31.0):
            logger.warning(f"Koordinatlar Kocaeli dışında: lat={lat}, lon={lon}")
        
        data = {
            "isim": isim.strip(),
            "lat": lat,
            "lon": lon,
            "aktif": True
        }
        
        response = supabase_admin.table("istasyonlar").insert(data).execute()
        
        if response.data:
            logger.info(f"Yeni istasyon eklendi: {isim} (ID: {response.data[0]['id']})")
            return response.data[0]
        else:
            raise Exception("İstasyon eklenemedi")
            
    except Exception as e:
        logger.error(f"İstasyon ekleme hatası: {e}", exc_info=True)
        raise


def istasyon_guncelle(istasyon_id: int, **kwargs) -> Dict:
    try:
        if not kwargs:
            raise ValueError("Güncellenecek alan belirtilmedi")
        
        response = supabase_admin.table("istasyonlar")\
            .update(kwargs)\
            .eq("id", istasyon_id)\
            .execute()
        
        if response.data:
            logger.info(f"İstasyon güncellendi: ID={istasyon_id}, Alanlar={list(kwargs.keys())}")
            return response.data[0]
        else:
            raise Exception(f"İstasyon bulunamadı: ID={istasyon_id}")
            
    except Exception as e:
        logger.error(f"İstasyon güncelleme hatası: {e}", exc_info=True)
        raise

def mesafe_getir_ve_kaydet(
    baslangic_id: int, 
    bitis_id: int, 
    mesafe: Optional[float] = None, 
    koordinatlar: Optional[list] = None
) -> Optional[Dict]:
    try:
        check = supabase_admin.table("istasyon_mesafeleri")\
            .select("*")\
            .eq("baslangic_istasyon_id", baslangic_id)\
            .eq("bitis_istasyon_id", bitis_id)\
            .execute()
        
        if check.data and len(check.data) > 0:
            logger.debug(f"Mesafe DB'den bulundu: {baslangic_id} -> {bitis_id}")
            return check.data[0]
        
        if mesafe is not None:
            data = {
                "baslangic_istasyon_id": baslangic_id,
                "bitis_istasyon_id": bitis_id,
                "mesafe_km": round(mesafe, 2),
                "yol_koordinatlari": koordinatlar or [],
                "son_guncelleme": datetime.utcnow().isoformat()
            }
            
            response = supabase_admin.table("istasyon_mesafeleri")\
                .insert(data)\
                .execute()
            
            if response.data and len(response.data) > 0:
                logger.info(f"Mesafe kaydedildi: {baslangic_id} -> {bitis_id} = {mesafe} km")
                return response.data[0]
        
        return None
        
    except Exception as e:
        logger.error(
            f"Mesafe işlemi hatası: {baslangic_id} -> {bitis_id}: {e}",
            exc_info=True
        )
        return None


def toplu_mesafe_kaydet(mesafe_listesi: List[Dict]) -> int:
    try:
        if not mesafe_listesi:
            return 0
        
        kayitlar = []
        for item in mesafe_listesi:
            kayitlar.append({
                "baslangic_istasyon_id": item["baslangic_id"],
                "bitis_istasyon_id": item["bitis_id"],
                "mesafe_km": round(item["mesafe"], 2),
                "yol_koordinatlari": item.get("koordinatlar", []),
                "son_guncelleme": datetime.utcnow().isoformat()
            })
        
        response = supabase_admin.table("istasyon_mesafeleri")\
            .upsert(kayitlar)\
            .execute()
        
        kayit_sayisi = len(response.data) if response.data else 0
        logger.info(f"{kayit_sayisi} mesafe kaydı toplu olarak işlendi")
        return kayit_sayisi
        
    except Exception as e:
        logger.error(f"Toplu mesafe kaydetme hatası: {e}", exc_info=True)
        return 0



def sistem_ayarlarini_getir() -> Dict[str, float]:
    try:
        response = supabase_admin.table("sistem_ayarlari")\
            .select("anahtar, deger")\
            .execute()
        
        if not response.data:
            logger.warning("Sistem ayarları bulunamadı, varsayılan değerler kullanılıyor")
            return {
                "km_basi_maliyet": 1.0,
                "kiralama_maliyeti_500kg": 200.0,
                "kiralama_maliyeti_750kg": 250.0,
                "kiralama_maliyeti_1000kg": 300.0
            }
        
        ayarlar = {item['anahtar']: item['deger'] for item in response.data}
        logger.info(f"{len(ayarlar)} sistem ayarı yüklendi")
        return ayarlar
        
    except Exception as e:
        logger.error(f"Sistem ayarları getirilemedi: {e}", exc_info=True)
        return {}


def sistem_ayari_guncelle(anahtar: str, deger: float) -> Dict:
    try:
        response = supabase_admin.table("sistem_ayarlari")\
            .upsert({
                "anahtar": anahtar,
                "deger": deger,
                "guncellenme_tarihi": datetime.utcnow().isoformat()
            })\
            .execute()
        
        if response.data:
            logger.info(f"Sistem ayarı güncellendi: {anahtar} = {deger}")
            return response.data[0]
        else:
            raise Exception("Ayar güncellenemedi")
            
    except Exception as e:
        logger.error(f"Sistem ayarı güncelleme hatası: {e}", exc_info=True)
        raise


def araclari_getir(sadece_aktif: bool = True, sadece_ozmal: bool = False) -> List[Dict]:
    try:
        query = supabase_admin.table("araclar").select("*")
        
        if sadece_aktif:
            query = query.eq("aktif", True)
        
        if sadece_ozmal:
            query = query.eq("kiralanabilir", False)
        
        response = query.execute()
        
        logger.info(f"{len(response.data) if response.data else 0} araç getirildi")
        return response.data or []
        
    except Exception as e:
        logger.error(f"Araçlar getirilemedi: {e}", exc_info=True)
        return []


def kargo_listesi_getir(
    durum: Optional[str] = None,
    tarih: Optional[str] = None,
    kullanici_id: Optional[str] = None
) -> List[Dict]:
    try:
        query = supabase_admin.table("kargolar")\
            .select("*, istasyonlar(isim, lat, lon)")
        
        if durum:
            query = query.eq("durum", durum)
        
        if tarih:
            query = query.eq("planlanan_tarih", tarih)
        
        if kullanici_id:
            query = query.eq("gonderen_id", kullanici_id)
        
        response = query.order("olusturma_tarihi", desc=True).execute()
        
        logger.info(f"{len(response.data) if response.data else 0} kargo getirildi")
        return response.data or []
        
    except Exception as e:
        logger.error(f"Kargo listesi getirilemedi: {e}", exc_info=True)
        return []


def rota_detaylarini_kaydet(detaylar: List[Any], rota_ozet_id: str) -> bool:
    try:
        if not detaylar:
            logger.warning("Kaydedilecek rota detayı yok")
            return False
        
        kayitlar = []
        for detay in detaylar:
            if hasattr(detay, 'dict'):
                kayit = detay.dict()
            elif isinstance(detay, dict):
                kayit = detay.copy()
            else:
                logger.error(f"Geçersiz detay tipi: {type(detay)}")
                continue
            
            kayit["rota_oz_id"] = rota_ozet_id
            kayitlar.append(kayit)
        
        response = supabase_admin.table("rota_detaylari")\
            .insert(kayitlar)\
            .execute()
        
        kayit_sayisi = len(response.data) if response.data else 0
        logger.info(f"{kayit_sayisi} rota detayı kaydedildi (Rota ID: {rota_ozet_id})")
        return True
        
    except Exception as e:
        logger.error(f"Rota detayları kaydedilemedi: {e}", exc_info=True)
        return False


def rota_ozetlerini_getir(tarih: Optional[str] = None) -> List[Dict]:
    try:
        query = supabase_admin.table("rota_ozetleri").select("*")
        
        if tarih:
            query = query.eq("planlanan_tarih", tarih)
        
        response = query.order("olusturma_tarihi", desc=True).execute()
        
        logger.info(f"{len(response.data) if response.data else 0} rota özeti getirildi")
        return response.data or []
        
    except Exception as e:
        logger.error(f"Rota özetleri getirilemedi: {e}", exc_info=True)
        return []


def optimizasyon_sonucunu_kaydet(sonuc_data: Any) -> bool:
    try:
        kayit = sonuc_data.dict() if hasattr(sonuc_data, 'dict') else sonuc_data
        
        response = supabase_admin.table("optimizasyon_sonuclari")\
            .insert(kayit)\
            .execute()
        
        if response.data:
            logger.info(f"Optimizasyon sonucu kaydedildi: {kayit.get('algoritma_adi')}")
            return True
        return False
        
    except Exception as e:
        logger.error(f"Optimizasyon sonucu kaydedilemedi: {e}", exc_info=True)
        return False


def senaryo_yuklerini_cek(senaryo_id: int) -> List[Dict]:
    try:
        response = supabase_admin.table("senaryo_yukleri")\
            .select("*, istasyonlar(isim, lat, lon)")\
            .eq("senaryo_id", senaryo_id)\
            .execute()
        
        logger.info(f"Senaryo {senaryo_id} için {len(response.data) if response.data else 0} yük getirildi")
        return response.data or []
        
    except Exception as e:
        logger.error(f"Senaryo yükleri getirilemedi: {e}", exc_info=True)
        return []


def sistem_logu_kaydet(
    kullanici_id: Optional[str],
    islem_tipi: str,
    tablo_adi: str,
    kayit_id: Optional[str] = None,
    eski_deger: Optional[Dict] = None,
    yeni_deger: Optional[Dict] = None
) -> bool:
    try:
        log_data = {
            "kullanici_id": kullanici_id,
            "islem_tipi": islem_tipi,
            "tablo_adi": tablo_adi,
            "kayit_id": kayit_id,
            "eski_deger": eski_deger,
            "yeni_deger": yeni_deger,
            "islem_zamani": datetime.utcnow().isoformat()
        }
        
        response = supabase_admin.table("sistem_loglari")\
            .insert(log_data)\
            .execute()
        
        return bool(response.data)
        
    except Exception as e:
        logger.error(f"Sistem logu kaydedilemedi: {e}", exc_info=True)
        return False


if __name__ == "__main__":
    print("=== Supabase Bağlantı Testi ===")
    
    try:
        istasyonlar = istasyonlari_dbden_cek()
        print(f"✅ {len(istasyonlar)} istasyon bulundu")
        
        ayarlar = sistem_ayarlarini_getir()
        print(f"✅ {len(ayarlar)} sistem ayarı yüklendi")
        
        araclar = araclari_getir()
        print(f"✅ {len(araclar)} araç bulundu")
        
        print("\n✅ Tüm bağlantı testleri başarılı!")
        
    except Exception as e:
        print(f"❌ Test başarısız: {e}")