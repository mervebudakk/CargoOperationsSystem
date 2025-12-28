from pydantic import BaseModel
from typing import List, Optional, Any
from datetime import date, datetime

class RotaDetayBase(BaseModel):
    sira: int
    istasyon_id: int
    mesafe_onceki_km: float
    yuklu_kargo_sayisi: int
    yuklu_kargo_kg: float
    kalan_kapasite_kg: float
    tahmini_varis_saati: Optional[datetime] = None

class RotaOzetResponse(BaseModel):
    id: str 
    arac_id: str 
    arac_isim: Optional[str] = None 
    planlanan_tarih: date 
    toplam_km: float 
    toplam_maliyet: float 
    duraklar: List[str] 

class OptimizasyonSonucCreate(BaseModel):
    senaryo_id: int
    algoritma_adi: str
    problem_tipi: str
    calisma_suresi_ms: int
    toplam_maliyet: float
    toplam_km: float
    kullanilan_arac_sayisi: int
    tasinan_kargo_sayisi: int
    tasinan_kargo_kg: float
    kabul_edilen_kargo_sayisi: int
    reddedilen_kargo_sayisi: int
    cozum_detaylari: dict