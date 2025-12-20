import os
from dotenv import load_dotenv
from supabase import create_client, Client
from pathlib import Path

# .env dosyasını bulma
mevcut_klasor = Path(__file__).resolve().parent.parent  # backend/
env_yolu = mevcut_klasor / ".env"
load_dotenv(dotenv_path=env_yolu)

# Supabase env
url: str = os.environ.get("SUPABASE_URL")
anon_key: str = os.environ.get("SUPABASE_ANON_KEY")
service_key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

supabase: Client | None = None
supabase_admin: Client | None = None

if not url:
    print("HATA: SUPABASE_URL eksik!")
else:
    if anon_key:
        supabase = create_client(url, anon_key)
    else:
        print("UYARI: SUPABASE_ANON_KEY eksik (anon client oluşturulmadı).")

    if service_key:
        supabase_admin = create_client(url, service_key)
        print("Supabase key type: service_role")
    else:
        print("UYARI: SUPABASE_SERVICE_ROLE_KEY eksik (admin client oluşturulmadı).")

def _client() -> Client | None:
    # Backend için öncelik service_role
    return supabase_admin or supabase


def istasyonlari_dbden_cek():
    """Tüm istasyonları getirir."""
    client = _client()
    if not client:
        print("UYARI: Veritabanı bağlantısı yok.")
        return []

    resp = client.table("istasyonlar").select("id,isim,lat,lon").order("id").execute()
    if getattr(resp, "error", None):
        print("istasyonlari_dbden_cek ERROR:", resp.error)
        return []
    return resp.data or []


def senaryolari_dbden_cek():
    """Senaryo listesini getirir."""
    client = _client()
    if not client:
        print("UYARI: Veritabanı bağlantısı yok.")
        return []

    resp = client.table("senaryolar").select("id,name,aciklama,created_at").order("id").execute()
    if getattr(resp, "error", None):
        print("senaryolari_dbden_cek ERROR:", resp.error)
        return []
    return resp.data or []


def senaryo_yuklerini_cek(senaryo_id: int):
    """Bir senaryonun ilçe bazlı yüklerini getirir."""
    client = _client()
    if not client:
        print("UYARI: Veritabanı bağlantısı yok.")
        return []

    resp = (
        client.table("senaryo_yukleri")
        .select("alim_istasyon_id,adet,agirlik_kg")
        .eq("senaryo_id", senaryo_id)
        .order("alim_istasyon_id")
        .execute()
    )
    if getattr(resp, "error", None):
        print("senaryo_yuklerini_cek ERROR:", resp.error)
        return []
    return resp.data or []


def istasyonlari_senaryo_ile_birlestir(senaryo_id: int):
    """
    Algoritma ve harita için: istasyonları çek + senaryo_yukleri ile birleştir.
    """
    istasyonlar = istasyonlari_dbden_cek()
    yukler = senaryo_yuklerini_cek(senaryo_id)

    yuk_map = {y["alim_istasyon_id"]: y for y in yukler}

    sonuc = []
    for s in istasyonlar:
        y = yuk_map.get(s["id"], {"agirlik_kg": 0, "adet": 0})
        sonuc.append({
            "id": s["id"],
            "isim": s["isim"],
            "lat": s["lat"],
            "lon": s["lon"],
            "kargo_agirlik": y.get("agirlik_kg", 0),
            "kargo_adet": y.get("adet", 0),
        })
    return sonuc
