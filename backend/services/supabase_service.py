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