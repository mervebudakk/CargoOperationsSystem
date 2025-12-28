from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum
from datetime import date, datetime

class KargoDurum(str, Enum):
    BEKLEMEDE = "Beklemede"
    PLANLANDI = "Planlandı"
    YOLA_CIKTI = "Yola Çıktı"
    TESLIM_EDILDI = "Teslim Edildi"
    IPTAL = "İptal"
    REDDEDILDI = "Reddedildi"

class CargoBase(BaseModel):
    gonderen_id: str 
    cikis_istasyon_id: int 
    agirlik_kg: float = Field(..., gt=0) 
    adet: int = Field(default=1, ge=1)
    planlanan_tarih: Optional[date] = None
    durum: KargoDurum = KargoDurum.BEKLEMEDE

class CargoCreate(CargoBase):
    pass

class CargoResponse(CargoBase):
    id: int 
    olusturma_tarihi: datetime 

class YukItem(BaseModel):
    alim_istasyon_id: int
    adet: int
    agirlik_kg: float

class ScenarioCreate(BaseModel):
    name: str
    aciklama: Optional[str] = ""
    yukler: List[YukItem]