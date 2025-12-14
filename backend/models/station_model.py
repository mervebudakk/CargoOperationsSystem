from pydantic import BaseModel

# Veritabanından gelen verinin kalıbı
class IstasyonModel(BaseModel):
    id: int
    isim: str
    lat: float
    lon: float