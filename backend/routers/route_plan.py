# -*- coding: utf-8 -*-
"""
Rota Planlama Router
API endpoint'leri için FastAPI router tanımları
"""

import logging
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Body, Depends
from pydantic import BaseModel, Field, validator

from controllers.route_controller import RouteController
from services.supabase_service import (
    supabase_admin,
    sistem_ayarlarini_getir,
    rota_ozetlerini_getir
)

# Logger ayarla
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Router oluştur
router = APIRouter(
    prefix="/api/routes",
    tags=["Rota Planlama"]
)


# ============================================
# REQUEST/RESPONSE MODELLERİ
# ============================================

class RotaPlanlamaRequest(BaseModel):
    """Rota planlama request modeli"""
    tarih: str = Field(..., description="Planlama tarihi (YYYY-MM-DD)")
    kargo_ids: Optional[List[int]] = Field(None, description="Spesifik kargo ID'leri")
    senaryo_id: Optional[int] = Field(None, description="Senaryo ID (test için)")
    problem_tipi: str = Field(
        default="sinirsiz_arac",
        description="Problem tipi: 'sinirsiz_arac' veya 'belirli_arac'"
    )
    
    @validator('problem_tipi')
    def validate_problem_tipi(cls, v):
        """Problem tipi validasyonu"""
        valid_types = ['sinirsiz_arac', 'belirli_arac']
        if v not in valid_types:
            raise ValueError(f"Problem tipi '{v}' geçersiz. Geçerli tipler: {valid_types}")
        return v
    
    @validator('tarih')
    def validate_tarih(cls, v):
        """Tarih formatı validasyonu"""
        try:
            datetime.strptime(v, "%Y-%m-%d")
        except ValueError:
            raise ValueError("Tarih formatı YYYY-MM-DD olmalıdır")
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "tarih": "2025-12-30",
                "problem_tipi": "sinirsiz_arac",
                "kargo_ids": None,
                "senaryo_id": None
            }
        }


class SistemAyarlariUpdate(BaseModel):
    """Sistem ayarları güncelleme modeli"""
    km_basi_maliyet: Optional[float] = Field(None, ge=0, description="Km başı maliyet")
    kiralama_maliyeti_500kg: Optional[float] = Field(None, ge=0, description="500kg araç kiralama")
    kiralama_maliyeti_750kg: Optional[float] = Field(None, ge=0, description="750kg araç kiralama")
    kiralama_maliyeti_1000kg: Optional[float] = Field(None, ge=0, description="1000kg araç kiralama")
    
    class Config:
        json_schema_extra = {
            "example": {
                "km_basi_maliyet": 1.0,
                "kiralama_maliyeti_500kg": 200.0
            }
        }


class KarsilastirmaRequest(BaseModel):
    """Karşılaştırma request modeli"""
    tarih: str = Field(..., description="Karşılaştırma tarihi (YYYY-MM-DD)")
    kargo_ids: Optional[List[int]] = Field(None, description="Test kargo ID'leri")
    
    @validator('tarih')
    def validate_tarih(cls, v):
        """Tarih formatı validasyonu"""
        try:
            datetime.strptime(v, "%Y-%m-%d")
        except ValueError:
            raise ValueError("Tarih formatı YYYY-MM-DD olmalıdır")
        return v


# ============================================
# YARDIMCI FONKSİYONLAR
# ============================================

def hesapla_kabul_orani(ozet: Dict) -> float:
    """
    Kabul oranını hesaplar.
    
    Args:
        ozet: Rota özet dictionary
    
    Returns:
        float: Kabul oranı (%)
    """
    try:
        tasınan = ozet.get("tasınan_kargo_sayisi", 0)
        toplam = tasınan + ozet.get("reddedilen_kargo_sayisi", 0)
        
        if toplam == 0:
            return 100.0
        
        return round((tasınan / toplam) * 100, 2)
    except Exception as e:
        logger.warning(f"Kabul oranı hesaplanamadı: {e}")
        return 0.0


# ============================================
# ROTA PLANLAMA ENDPOINT'LERİ
# ============================================

@router.post("/plan", summary="Rota Planla")
async def plan_route(
    request: RotaPlanlamaRequest,
    kullanici_id: Optional[str] = Query(None, description="Kullanıcı ID")
):
    """
    Verilen tarih için rota planlaması yapar.
    
    **Problem Tipleri:**
    - `sinirsiz_arac`: Gerektiğinde araç kiralar, tüm kargolar taşınır
    - `belirli_arac`: Sadece mevcut araçları kullanır, kapasiteye göre kargo seçer
    
    **Parametreler:**
    - tarih: YYYY-MM-DD formatında planlama tarihi
    - problem_tipi: Çözüm yaklaşımı
    - kargo_ids: (Opsiyonel) Sadece belirli kargoları planla
    - senaryo_id: (Opsiyonel) Test senaryosu ID'si
    
    **Dönen Değer:**
    ```json
    {
      "basarili": true,
      "mesaj": "X rota başarıyla planlandı",
      "rotalar": [...],
      "ozet": {
        "toplam_km": 250.5,
        "toplam_maliyet": 450.5,
        "kullanilan_arac_sayisi": 3,
        "tasınan_kargo_sayisi": 100,
        "reddedilen_kargo_sayisi": 0,
        "kabul_orani": 100.0
      }
    }
    ```
    """
    try:
        logger.info(f"Rota planlama isteği: {request.tarih}, {request.problem_tipi}")
        
        # Controller'ı çağır
        sonuc = RouteController.solve_route(
            tarih=request.tarih,
            kargo_ids=request.kargo_ids,
            senaryo_id=request.senaryo_id,
            kullanici_id=kullanici_id,
            problem_tipi=request.problem_tipi
        )
        
        # Kabul oranını hesapla ve ekle
        if "ozet" in sonuc:
            sonuc["ozet"]["kabul_orani"] = hesapla_kabul_orani(sonuc["ozet"])
        
        logger.info(
            f"Rota planlama başarılı: {sonuc['ozet']['kullanilan_arac_sayisi']} rota, "
            f"{sonuc['ozet'].get('kabul_orani', 0)}% kabul oranı"
        )
        
        return sonuc
        
    except HTTPException:
        raise
    except ValueError as e:
        # Pydantic validation hataları
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Rota planlama hatası: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Rota planlama başarısız: {str(e)}"
        )


@router.get("/list", summary="Rotaları Listele")
async def list_routes(
    tarih: Optional[str] = Query(None, description="Tarih filtresi (YYYY-MM-DD)"),
    arac_id: Optional[str] = Query(None, description="Araç ID filtresi"),
    limit: int = Query(100, ge=1, le=1000, description="Maksimum kayıt sayısı"),
    offset: int = Query(0, ge=0, description="Atlama sayısı (pagination)")
):
    """
    Kaydedilmiş rotaları listeler.
    
    **Filtreler:**
    - tarih: Belirli bir tarihteki rotalar
    - arac_id: Belirli bir araca ait rotalar
    - limit: Sayfa başına kayıt sayısı
    - offset: Sayfa numarası için
    """
    try:
        rotalar = rota_ozetlerini_getir(tarih=tarih)
        
        # Araç ID filtresi
        if arac_id:
            rotalar = [r for r in rotalar if r.get("arac_id") == arac_id]
        
        # Pagination
        toplam = len(rotalar)
        rotalar = rotalar[offset:offset + limit]
        
        return {
            "basarili": True,
            "toplam": toplam,
            "gosterilen": len(rotalar),
            "offset": offset,
            "limit": limit,
            "rotalar": rotalar
        }
        
    except Exception as e:
        logger.error(f"Rota listeleme hatası: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Rotalar getirilemedi: {str(e)}"
        )


@router.get("/details/{rota_id}", summary="Rota Detayları")
async def get_route_details(rota_id: str):
    """
    Belirli bir rotanın detaylı bilgilerini getirir.
    
    **Dönen bilgiler:**
    - Rota özeti (mesafe, maliyet, duraklar)
    - Durak detayları (sıra, istasyon, yük, mesafe)
    - Çizim koordinatları (harita için)
    """
    try:
        # Rota özetini getir
        ozet = supabase_admin.table("rota_ozetleri")\
            .select("*")\
            .eq("id", rota_id)\
            .execute()
        
        if not ozet.data:
            raise HTTPException(
                status_code=404,
                detail=f"Rota bulunamadı: {rota_id}"
            )
        
        # Detayları getir
        detaylar = supabase_admin.table("rota_detaylari")\
            .select("*, istasyonlar(isim, lat, lon)")\
            .eq("rota_oz_id", rota_id)\
            .order("sira")\
            .execute()
        
        rota_data = ozet.data[0]
        rota_data["detaylar"] = detaylar.data or []
        
        return {
            "basarili": True,
            "rota": rota_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Rota detay hatası: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Rota detayları getirilemedi: {str(e)}"
        )


@router.delete("/delete/{tarih}", summary="Rotaları Sil")
async def delete_routes(
    tarih: str,
    kullanici_id: Optional[str] = Query(None, description="Kullanıcı ID"),
    confirm: bool = Query(False, description="Silme onayı")
):
    """
    Belirli bir tarihteki tüm rotaları siler.
    
    **Uyarı:** Bu işlem geri alınamaz!
    
    **Kullanım:**
    - confirm=true parametresi ile çağrılmalıdır
    """
    try:
        # Onay kontrolü
        if not confirm:
            raise HTTPException(
                status_code=400,
                detail="Silme işlemi için confirm=true parametresi gerekli"
            )
        
        # Tarih validasyonu
        try:
            datetime.strptime(tarih, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Geçersiz tarih formatı. YYYY-MM-DD olmalı."
            )
        
        sonuc = RouteController.delete_route(
            tarih=tarih,
            kullanici_id=kullanici_id
        )
        
        logger.info(f"Rotalar silindi: {tarih}, {sonuc['silinen_rota_sayisi']} adet")
        return sonuc
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Rota silme hatası: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Rotalar silinemedi: {str(e)}"
        )


# ============================================
# SİSTEM AYARLARI ENDPOINT'LERİ
# ============================================

@router.get("/settings", summary="Sistem Ayarlarını Getir")
async def get_settings():
    """
    Mevcut sistem ayarlarını getirir.
    
    **Ayarlar:**
    - km_basi_maliyet: Kilometre başına yakıt maliyeti
    - kiralama_maliyeti_XXXkg: Araç kiralama maliyetleri
    """
    try:
        ayarlar = sistem_ayarlarini_getir()
        
        return {
            "basarili": True,
            "ayarlar": ayarlar
        }
        
    except Exception as e:
        logger.error(f"Ayar getirme hatası: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Ayarlar getirilemedi: {str(e)}"
        )


@router.put("/settings", summary="Sistem Ayarlarını Güncelle")
async def update_settings(
    ayarlar: SistemAyarlariUpdate,
    kullanici_id: Optional[str] = Query(None, description="Kullanıcı ID")
):
    """
    Sistem ayarlarını günceller.
    
    **Güncellenebilir ayarlar:**
    - km_basi_maliyet
    - kiralama_maliyeti_500kg
    - kiralama_maliyeti_750kg
    - kiralama_maliyeti_1000kg
    
    **Örnek:**
    ```json
    {
      "km_basi_maliyet": 1.5,
      "kiralama_maliyeti_500kg": 220.0
    }
    ```
    """
    try:
        # Sadece gönderilen alanları güncelle
        payload = ayarlar.model_dump(exclude_none=True)
        
        if not payload:
            raise HTTPException(
                status_code=400,
                detail="Güncellenecek ayar belirtilmedi"
            )
        
        sonuc = RouteController.update_settings(
            payload=payload,
            kullanici_id=kullanici_id
        )
        
        logger.info(f"Ayarlar güncellendi: {list(payload.keys())}")
        return sonuc
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ayar güncelleme hatası: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Ayarlar güncellenemedi: {str(e)}"
        )


# ============================================
# İSTATİSTİK ENDPOINT'LERİ
# ============================================

@router.get("/statistics", summary="Rota İstatistikleri")
async def get_statistics(
    baslangic_tarih: Optional[str] = Query(None, description="Başlangıç tarihi (YYYY-MM-DD)"),
    bitis_tarih: Optional[str] = Query(None, description="Bitiş tarihi (YYYY-MM-DD)")
):
    """
    Genel rota istatistiklerini getirir.
    
    **İstatistikler:**
    - Toplam rota sayısı
    - Toplam mesafe
    - Toplam maliyet
    - Ortalama doluluk oranı
    - Araç kullanım dağılımı
    """
    try:
        # Tarih validasyonu
        if baslangic_tarih:
            try:
                datetime.strptime(baslangic_tarih, "%Y-%m-%d")
            except ValueError:
                raise HTTPException(400, "Geçersiz başlangıç tarihi formatı")
        
        if bitis_tarih:
            try:
                datetime.strptime(bitis_tarih, "%Y-%m-%d")
            except ValueError:
                raise HTTPException(400, "Geçersiz bitiş tarihi formatı")
        
        # Rota verilerini getir
        query = supabase_admin.table("rota_ozetleri").select("*")
        
        if baslangic_tarih:
            query = query.gte("planlanan_tarih", baslangic_tarih)
        if bitis_tarih:
            query = query.lte("planlanan_tarih", bitis_tarih)
        
        rotalar = query.execute().data
        
        if not rotalar:
            return {
                "basarili": True,
                "mesaj": "Veri bulunamadı",
                "istatistikler": {
                    "toplam_rota_sayisi": 0,
                    "baslangic_tarih": baslangic_tarih,
                    "bitis_tarih": bitis_tarih
                }
            }
        
        # İstatistikleri hesapla
        toplam_rota = len(rotalar)
        toplam_km = sum(r.get("toplam_km", 0) for r in rotalar)
        toplam_maliyet = sum(r.get("toplam_maliyet", 0) for r in rotalar)
        
        # Araç kullanımı
        arac_kullanim = {}
        for r in rotalar:
            arac_id = r.get("arac_id", "bilinmeyen")
            if arac_id not in arac_kullanim:
                arac_kullanim[arac_id] = {
                    "isim": r.get("arac_isim", "Bilinmeyen"),
                    "sefer_sayisi": 0,
                    "toplam_km": 0,
                    "toplam_maliyet": 0
                }
            arac_kullanim[arac_id]["sefer_sayisi"] += 1
            arac_kullanim[arac_id]["toplam_km"] += r.get("toplam_km", 0)
            arac_kullanim[arac_id]["toplam_maliyet"] += r.get("toplam_maliyet", 0)
        
        return {
            "basarili": True,
            "istatistikler": {
                "toplam_rota_sayisi": toplam_rota,
                "toplam_mesafe_km": round(toplam_km, 2),
                "toplam_maliyet": round(toplam_maliyet, 2),
                "ortalama_rota_km": round(toplam_km / toplam_rota, 2),
                "ortalama_rota_maliyet": round(toplam_maliyet / toplam_rota, 2),
                "arac_kullanim_detay": arac_kullanim,
                "baslangic_tarih": baslangic_tarih,
                "bitis_tarih": bitis_tarih
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"İstatistik hatası: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"İstatistikler getirilemedi: {str(e)}"
        )


# ============================================
# KARŞILAŞTIRMA ENDPOINT'İ
# ============================================

@router.post("/compare", summary="Problem Tipi Karşılaştırması")
async def compare_problem_types(request: KarsilastirmaRequest):
    """
    Aynı kargolar için her iki problem tipini de çözer ve karşılaştırır.
    
    **Kullanım:** Hangi yaklaşımın daha iyi olduğunu görmek için
    
    **Dönen Değer:**
    ```json
    {
      "sinirsiz_arac": {özet},
      "belirli_arac": {özet},
      "karsilastirma": {
        "maliyet_farki": 150.0,
        "km_farki": 50.0,
        "kabul_orani_farki": 5.0,
        "arac_sayisi_farki": 2
      },
      "tavsiye": "Sınırsız araç"
    }
    ```
    """
    try:
        logger.info(f"Karşılaştırma başlatıldı: {request.tarih}")
        
        # Sınırsız araç çözümü
        sinirsiz_sonuc = RouteController.solve_route(
            tarih=request.tarih,
            kargo_ids=request.kargo_ids,
            problem_tipi="sinirsiz_arac"
        )
        
        # Kabul oranını hesapla
        sinirsiz_sonuc["ozet"]["kabul_orani"] = hesapla_kabul_orani(
            sinirsiz_sonuc["ozet"]
        )
        
        # Eski rotaları temizle (belirli araç için)
        try:
            RouteController.delete_route(request.tarih)
        except Exception as e:
            logger.warning(f"Eski rotalar temizlenemedi: {e}")
        
        # Belirli araç çözümü
        belirli_sonuc = RouteController.solve_route(
            tarih=request.tarih,
            kargo_ids=request.kargo_ids,
            problem_tipi="belirli_arac"
        )
        
        # Kabul oranını hesapla
        belirli_sonuc["ozet"]["kabul_orani"] = hesapla_kabul_orani(
            belirli_sonuc["ozet"]
        )
        
        # Karşılaştırma yap
        karsilastirma = {
            "maliyet_farki": round(
                sinirsiz_sonuc["ozet"]["toplam_maliyet"] - 
                belirli_sonuc["ozet"]["toplam_maliyet"],
                2
            ),
            "km_farki": round(
                sinirsiz_sonuc["ozet"]["toplam_km"] - 
                belirli_sonuc["ozet"]["toplam_km"],
                2
            ),
            "kabul_orani_farki": round(
                sinirsiz_sonuc["ozet"]["kabul_orani"] - 
                belirli_sonuc["ozet"]["kabul_orani"],
                2
            ),
            "arac_sayisi_farki": (
                sinirsiz_sonuc["ozet"]["kullanilan_arac_sayisi"] -
                belirli_sonuc["ozet"]["kullanilan_arac_sayisi"]
            )
        }
        
        # Tavsiye mantığı
        if karsilastirma["kabul_orani_farki"] > 10:
            tavsiye = "Sınırsız araç (Daha fazla kargo taşınıyor)"
            tavsiye_neden = "Kabul oranı %10'dan fazla yüksek"
        elif karsilastirma["maliyet_farki"] < -50:
            tavsiye = "Belirli araç (Daha ekonomik)"
            tavsiye_neden = "Maliyet 50 birimden fazla düşük"
        elif abs(karsilastirma["kabul_orani_farki"]) < 5:
            tavsiye = "Belirli araç (Eşit kabul oranı, kiralama yok)"
            tavsiye_neden = "Kabul oranları neredeyse eşit"
        else:
            tavsiye = "Sınırsız araç"
            tavsiye_neden = "Genel performans daha iyi"
        
        return {
            "basarili": True,
            "sinirsiz_arac": sinirsiz_sonuc["ozet"],
            "belirli_arac": belirli_sonuc["ozet"],
            "karsilastirma": karsilastirma,
            "tavsiye": tavsiye,
            "tavsiye_neden": tavsiye_neden
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Karşılaştırma hatası: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Karşılaştırma yapılamadı: {str(e)}"
        )


# ============================================
# SAĞLIK KONTROLÜ
# ============================================

@router.get("/health", summary="Sistem Sağlık Kontrolü")
async def health_check():
    """
    Rota planlama sisteminin sağlık durumunu kontrol eder.
    """
    try:
        # Sistem ayarlarını kontrol et
        ayarlar = sistem_ayarlarini_getir()
        
        # OSMnx durumunu kontrol et
        from services.vrp_clark_wright import KOCAELI_GRAPH, OSM_AVAILABLE
        
        # Veritabanı bağlantısını test et
        try:
            test_query = supabase_admin.table("istasyonlar").select("count").limit(1).execute()
            db_baglanti = True
        except Exception as e:
            logger.error(f"Veritabanı bağlantı hatası: {e}")
            db_baglanti = False
        
        return {
            "basarili": True,
            "durum": "Sistem aktif",
            "bilesenler": {
                "veritabani_baglanti": db_baglanti,
                "sistem_ayarlari": len(ayarlar) > 0,
                "osm_graf_yuklendi": KOCAELI_GRAPH is not None,
                "osm_kutuphane_mevcut": OSM_AVAILABLE
            },
            "detay": {
                "sistem_ayarlari_sayisi": len(ayarlar),
                "osm_durum": "Yüklü" if KOCAELI_GRAPH else "Yüklenmemiş"
            }
        }
        
    except Exception as e:
        logger.error(f"Sağlık kontrolü hatası: {e}", exc_info=True)
        return {
            "basarili": False,
            "durum": "Sistem hatalı",
            "hata": str(e)
        }