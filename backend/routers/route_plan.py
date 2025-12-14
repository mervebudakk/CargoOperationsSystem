from fastapi import APIRouter
from services.supabase_service import istasyonlari_dbden_cek
from services.vrp_clark_wright import rotayi_clark_wright_ile_hesapla

router = APIRouter()

@router.get("/stations")
def istasyonlari_getir_endpoint():
    """Frontend bu adrese gelince istasyonları verir."""
    return istasyonlari_dbden_cek()

@router.get("/solve-route")
def rotayi_coz_endpoint():
    """Frontend bu adrese gelince en kısa yolu hesaplar."""
    # 1. Verileri al
    veriler = istasyonlari_dbden_cek()

    # 2. Vrp Clark Wright algoritmasını çalıştırıp döndür!
    sonuc = rotayi_clark_wright_ile_hesapla(veriler)
    
    return sonuc