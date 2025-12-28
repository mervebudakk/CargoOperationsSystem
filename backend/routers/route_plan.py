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

# --- MODELLER ---
class CargoCreate(BaseModel):
    cikis_istasyon_id: int
    agirlik_kg: float
    adet: int

class YukItem(BaseModel):
    alim_istasyon_id: int
    adet: int
    agirlik_kg: int

class ScenarioCreate(BaseModel):
    name: str
    aciklama: str = ""
    yukler: List[YukItem]

# --- AYARLARI GÜNCELLEME ENDPOINT'İ ---
@router.post("/update-settings")
def ayarlarini_guncelle(payload: dict):
    """
    Frontend'den gelen km_maliyet ve kiralama_ucreti bilgilerini veritabanına işler.
    """
    try:
        for anahtar, deger in payload.items():
            supabase.table("sistem_ayarlari")\
                .update({"deger": float(deger)})\
                .eq("anahtar", anahtar)\
                .execute()
        return {"mesaj": "Sistem ayarları başarıyla güncellendi!"}
    except Exception as e:
        return {"hata": str(e)}

# --- MEVCUT ENDPOINT'LER ---

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
def rotayi_coz_endpoint(tarih: str = Query(...)):
    try:
        # 1. Sistem Ayarlarını Çek
        ayarlar_resp = supabase.table("sistem_ayarlari").select("*").execute()
        ayarlar_dict = {item['anahtar']: item['deger'] for item in ayarlar_resp.data} if ayarlar_resp.data else {}
        
        km_maliyeti = ayarlar_dict.get('km_maliyet', 1.0)
        kiralama_ucreti = ayarlar_dict.get('kiralama_ucreti', 200.0)

        # 2. Kargoları Çek
        kargolar_resp = supabase.table("kargolar").select("cikis_istasyon_id, agirlik_kg, adet").in_("durum", ["Beklemede", "Planlandı"]).execute()
        canli_kargolar = kargolar_resp.data if kargolar_resp.data else []

        # 3. İstasyonları Hazırla
        istasyonlar = istasyonlari_dbden_cek()
        istasyon_yuk_haritasi = {}
        for k in canli_kargolar:
            ist_id = k["cikis_istasyon_id"]
            if ist_id not in istasyon_yuk_haritasi:
                istasyon_yuk_haritasi[ist_id] = {"agirlik": 0, "adet": 0}
            istasyon_yuk_haritasi[ist_id]["agirlik"] += k["agirlik_kg"]
            istasyon_yuk_haritasi[ist_id]["adet"] += k["adet"]

        veriler = []
        for s in istasyonlar:
            yuk = istasyon_yuk_haritasi.get(s["id"], {"agirlik": 0, "adet": 0})
            veriler.append({
                "id": s["id"], "isim": s["isim"], "lat": s["lat"], "lon": s["lon"],
                "kargo_agirlik": yuk["agirlik"], "kargo_adet": yuk["adet"]
            })

        araclar_resp = supabase.table("araclar").select("*").execute()
        araclar = araclar_resp.data if araclar_resp.data else [] 

        if not araclar:
            return {"hata": "Veritabanında araç bulunamadı."}

        # 4. Algoritmayı Çalıştır (Dinamik maliyetlerle)
        sonuc = rotayi_clark_wright_ile_hesapla(
            veriler, 
            araclar, 
            yakit_maliyeti=km_maliyeti, 
            kiralama_bedeli=kiralama_ucreti
        )
        return sonuc
        
    except Exception as e:
        print(f"HATA: {str(e)}")
        return {"hata": f"Bir iç hata oluştu: {str(e)}"}

@router.post("/send-cargo")
def kargo_gonder(payload: CargoCreate, user_id: str = Query(...)):
    try:
        resp = supabase.table("kargolar").insert({
            "gonderen_id": user_id,
            "cikis_istasyon_id": payload.cikis_istasyon_id,
            "agirlik_kg": payload.agirlik_kg,
            "adet": payload.adet,
            "durum": "Beklemede"
        }).execute()
        return {"mesaj": "Kargo başarıyla oluşturuldu..."}
    except Exception as e:
        return {"hata": str(e)}

@router.get("/my-cargos")
def kullanici_kargolarini_getir(user_id: str = Query(...)):
    resp = supabase.table("kargolar").select("*, istasyonlar(isim)").eq("gonderen_id", user_id).execute()
    return resp.data