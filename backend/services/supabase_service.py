import os
from dotenv import load_dotenv
from supabase import create_client, Client
from pathlib import Path

# .env dosyasını bulma işlemleri
mevcut_klasor = Path(__file__).resolve().parent.parent # backend klasörüne çıkar
env_yolu = mevcut_klasor / ".env"
load_dotenv(dotenv_path=env_yolu)

# Supabase Bağlantı Ayarları
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")

supabase: Client = None

if not url or not key:
    print("HATA: .env dosyası bulunamadı veya anahtarlar eksik!")
else:
    supabase = create_client(url, key)

def istasyonlari_dbden_cek():
    """Tüm istasyonları getirir (kargo bilgisi içermez)."""
    if not supabase:
        print("UYARI: Veritabanı bağlantısı yok.")
        return []

    yanit = supabase.table("istasyonlar").select("id,isim,lat,lon").order("id").execute()
    return yanit.data or []


def senaryolari_dbden_cek():
    """Senaryo listesini getirir."""
    if not supabase:
        return []
    yanit = supabase.table("senaryolar").select("id,name,aciklama,created_at").order("id").execute()
    return yanit.data or []


def senaryo_yuklerini_cek(senaryo_id: int):
    """Bir senaryonun ilçe bazlı yüklerini getirir."""
    if not supabase:
        return []
    yanit = (
        supabase.table("senaryo_yukleri")
        .select("alim_istasyon_id,adet,agirlik_kg")
        .eq("senaryo_id", senaryo_id)
        .execute()
    )
    return yanit.data or []


def istasyonlari_senaryo_ile_birlestir(senaryo_id: int):
    """
    Algoritma ve harita için: istasyonları çek + senaryo_yukleri ile birleştir
    ve eski formatta kargo_agirlik/kargo_adet alanlarını üret.
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
            # algoritmanın ve popup’ın beklediği eski alan adları:
            "kargo_agirlik": y.get("agirlik_kg", 0),
            "kargo_adet": y.get("adet", 0)
        })
    return sonuc

    """Veritabanına bağlanır ve tüm istasyonları getirir."""
    if not supabase:
        print("UYARI: Veritabanı bağlantısı yok.")
        return []
    
    # 'istasyonlar' tablosundan veriyi çek
    yanit = supabase.table("istasyonlar").select("*").order("id").execute()
    
    # Gelen veriyi düzenle ve listeye at
    istasyon_listesi = []
    for satir in yanit.data:
        istasyon_listesi.append({
            "id": satir["id"],
            "isim": satir["isim"],
            "lat": satir["lat"],
            "lon": satir["lon"],
            # Yeni verileri ekliyoruz:
            "kargo_agirlik": satir.get("kargo_agirlik", 0),
            "kargo_adet": satir.get("kargo_adet", 0)
        })
    return istasyon_listesi