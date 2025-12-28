from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class SistemAyariBase(BaseModel):
    anahtar: str
    deger: float
    aciklama: Optional[str] = None

class SistemAyariResponse(SistemAyariBase):
    id: int
    guncellenme_tarihi: datetime

    class Config:
        from_attributes = True