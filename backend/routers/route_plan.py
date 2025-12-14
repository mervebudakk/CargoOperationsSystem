from fastapi import APIRouter
# Türkçe yazdığımız servisleri buraya çağırıyoruz
from services.supabase_service import istasyonlari_veritabanindan_cek
from services.algorithm_service import en_kisa_rotayi_hesapla

router = APIRouter()

@router.get("/stations")
def istasyonlari_getir_endpoint():
    """Frontend bu adrese gelince istasyonları verir."""
    return istasyonlari_veritabanindan_cek()

@router.get("/solve-route")
def rotayi_coz_endpoint():
    """Frontend bu adrese gelince en kısa yolu hesaplar."""
    # 1. Verileri al
    veriler = istasyonlari_veritabanindan_cek()
    # 2. Hesabı yap
    sonuc = en_kisa_rotayi_hesapla(veriler)
    return sonuc