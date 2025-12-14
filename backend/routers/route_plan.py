from fastapi import APIRouter, Query
from services.supabase_service import (
    supabase,
    istasyonlari_dbden_cek,
    senaryolari_dbden_cek,
    senaryo_yuklerini_cek,
    istasyonlari_senaryo_ile_birlestir
)
from services.vrp_clark_wright import rotayi_clark_wright_ile_hesapla
from pydantic import BaseModel
from typing import List

router = APIRouter()

class YukItem(BaseModel):
    alim_istasyon_id: int
    adet: int
    agirlik_kg: int

class ScenarioCreate(BaseModel):
    name: str
    aciklama: str = ""
    yukler: List[YukItem]

@router.post("/scenarios")
def senaryo_olustur(payload: ScenarioCreate):
    senaryo = (
        supabase.table("senaryolar")
        .insert({"name": payload.name, "aciklama": payload.aciklama})
        .execute()
        .data[0]
    )

    rows = [{
        "senaryo_id": senaryo["id"],
        "alim_istasyon_id": y.alim_istasyon_id,
        "adet": y.adet,
        "agirlik_kg": y.agirlik_kg
    } for y in payload.yukler]

    supabase.table("senaryo_yukleri").insert(rows).execute()
    return {"id": senaryo["id"]}

@router.get("/stations")
def istasyonlari_getir_endpoint():
    return istasyonlari_dbden_cek()

@router.get("/scenarios")
def senaryolari_getir():
    return senaryolari_dbden_cek()

@router.get("/scenarios/{senaryo_id}")
def senaryo_detay(senaryo_id: int):
    return senaryo_yuklerini_cek(senaryo_id)

@router.get("/solve-route")
def rotayi_coz_endpoint(senaryo_id: int = Query(1)):
    veriler = istasyonlari_senaryo_ile_birlestir(senaryo_id)
    sonuc = rotayi_clark_wright_ile_hesapla(veriler)
    return sonuc
