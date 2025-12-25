from fastapi import APIRouter, Query
from services.supabase_service import (
    supabase, # Eğer burada hata verirse supabase_admin yazabilirsin
    istasyonlari_dbden_cek,
    senaryolari_dbden_cek,
    senaryo_yuklerini_cek,
    istasyonlari_senaryo_ile_birlestir
)
from services.vrp_clark_wright import rotayi_clark_wright_ile_hesapla
from pydantic import BaseModel
from typing import List

router = APIRouter()

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
    # Bu fonksiyon supabase_service içindeki çalışan fonksiyonu kullanır
    # Haritadaki istasyonların geri gelmesini sağlar
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
        # 1. Veritabanından "Beklemede" ve "Planlandı" kargoları çekiyoruz
        # Senin istediğin gibi; her iki statüyü de alıp sıfırdan planlayacağız
        kargolar_resp = supabase.table("kargolar")\
            .select("cikis_istasyon_id, agirlik_kg, adet")\
            .in_("durum", ["Beklemede", "Planlandı"])\
            .execute()
        
        canli_kargolar = kargolar_resp.data if kargolar_resp.data else []

        # 2. İstasyonları çek ve yükleri ilçelere göre grupla
        istasyonlar = istasyonlari_dbden_cek() # supabase_service'den geliyor
        
        # Her istasyon için toplam ağırlık ve adet hesapla
        istasyon_yuk_haritasi = {}
        for k in canli_kargolar:
            ist_id = k["cikis_istasyon_id"]
            if ist_id not in istasyon_yuk_haritasi:
                istasyon_yuk_haritasi[ist_id] = {"agirlik": 0, "adet": 0}
            istasyon_yuk_haritasi[ist_id]["agirlik"] += k["agirlik_kg"]
            istasyon_yuk_haritasi[ist_id]["adet"] += k["adet"]

        # İstasyon nesnelerini kargo verileriyle birleştir
        veriler = []
        for s in istasyonlar:
            yuk = istasyon_yuk_haritasi.get(s["id"], {"agirlik": 0, "adet": 0})
            veriler.append({
                "id": s["id"],
                "isim": s["isim"],
                "lat": s["lat"],
                "lon": s["lon"],
                "kargo_agirlik": yuk["agirlik"],
                "kargo_adet": yuk["adet"]
            })

        # 3. Araçları çek
        araclar_resp = supabase.table("araclar").select("*").execute()
        araclar = araclar_resp.data if araclar_resp.data else []

        if not araclar:
            return {"hata": "Veritabanında araç bulunamadı."}

        # 4. Algoritmayı çalıştır (Artık canlı verilerle çalışıyor)
        sonuc = rotayi_clark_wright_ile_hesapla(veriler, araclar)
        return sonuc
        
    except Exception as e:
        print(f"HATA: {str(e)}")
        return {"hata": f"Bir iç hata oluştu: {str(e)}"}
    

@router.post("/send-cargo")
def kargo_gonder(payload: CargoCreate, user_id: str = Query(...)):
    try:
        # Tablo yapına (id, gonderen_id, cikis_istasyon_id, agirlik_kg, adet, durum) uygun hale getirdik
        resp = supabase.table("kargolar").insert({
            "gonderen_id": user_id,
            "cikis_istasyon_id": payload.cikis_istasyon_id,
            "agirlik_kg": payload.agirlik_kg,
            "adet": payload.adet,
            "durum": "Beklemede" # Tablondaki durum alanına uygun
        }).execute()
        
        return {"mesaj": "Kargo başarıyla oluşturuldu..."}
    except Exception as e:
        return {"hata": str(e)}

@router.get("/my-cargos")
def kullanici_kargolarini_getir(user_id: str = Query(...)):
    """
    Kullanıcının sadece kendi gönderdiği kargoları listeler.
    """
    resp = supabase.table("kargolar").select("*, istasyonlar(isim)").eq("gonderen_id", user_id).execute()
    return resp.data