from pydantic import BaseModel, Field
from typing import Optional

class VehicleBase(BaseModel):
    isim: str 
    kapasite_kg: int = Field(..., gt=0) 
    kapasite_adet: Optional[int] = None 
    baslangic_istasyon_id: int 
    km_basi_maliyet: float = 1.0 
    kiralama_maliyeti: float = 0.0 
    kiralanabilir: bool = False 
    aktif: bool = True 

class VehicleResponse(VehicleBase):
    id: int 