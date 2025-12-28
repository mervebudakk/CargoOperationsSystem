from fastapi import HTTPException
from typing import List
from services.supabase_service import supabase_admin, senaryo_yuklerini_cek
from models.cargo_model import CargoCreate, ScenarioCreate, KargoDurum

class CargoController:
    @staticmethod
    def create_scenario(payload: ScenarioCreate):
        """Yeni bir senaryo ve bu senaryoya ait yükleri DB'ye kaydeder."""
        try:
            senaryo = supabase_admin.table("senaryolar")\
                .insert({"name": payload.name, "aciklama": payload.aciklama})\
                .execute().data[0]
            
            rows = [{
                "senaryo_id": senaryo["id"],
                "alim_istasyon_id": y.alim_istasyon_id,
                "adet": y.adet,
                "agirlik_kg": y.agirlik_kg
            } for y in payload.yukler]
            
            supabase_admin.table("senaryo_yukleri").insert(rows).execute()
            return {"id": senaryo["id"], "mesaj": "Senaryo başarıyla oluşturuldu."}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Senaryo oluşturulamadı: {str(e)}")

    @staticmethod
    def send_cargo(payload: CargoCreate, user_id: str):
        try:
            result = supabase_admin.table("kargolar").insert({
                "gonderen_id": user_id,
                "cikis_istasyon_id": payload.cikis_istasyon_id,
                "agirlik_kg": payload.agirlik_kg,
                "adet": payload.adet,
                "durum": KargoDurum.BEKLEMEDE.value 
            }).execute()
            return {"mesaj": "Kargo talebi başarıyla iletildi.", "data": result.data}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Kargo gönderilemedi: {str(e)}")

    @staticmethod
    def get_user_cargos(user_id: str):
        try:
            resp = supabase_admin.table("kargolar")\
                .select("*, istasyonlar(isim)")\
                .eq("gonderen_id", user_id)\
                .execute()
            return resp.data
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
        
    @staticmethod
    def plan_iptal_et(kargo_id: int):
        try:
            return supabase_admin.table("kargolar").update({
                "durum": KargoDurum.BEKLEMEDE.value,
                "arac_id": None,
                "planlanan_tarih": None
            }).eq("id", kargo_id).execute()
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))