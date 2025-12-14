from pydantic import BaseModel

class IstasyonModel(BaseModel):
    id: int
    isim: str
    lat: float
    lon: float
    kargo_agirlik: int = 0  
    kargo_adet: int = 0     