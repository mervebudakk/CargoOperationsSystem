import math
from typing import List, Dict, Tuple
import osmnx as ox
import networkx as nx 
import pickle
import os

# --- YAPILANDIRMA ---
CACHE_DIR = "cache"
DISTANCE_CACHE_FILE = os.path.join(CACHE_DIR, "mesafe_matrisi.pkl")

# Kocaeli Yol Ağını Yükle
try:
    KOCAELI_GRAPH = ox.graph_from_place("Kocaeli, Turkey", network_type="drive")
    print("INFO: Kocaeli Yol Ağı Başarıyla Yüklendi.")
except Exception as e:
    print(f"HATA: Kocaeli Yol Ağı yüklenemedi: {e}")
    KOCAELI_GRAPH = None

# 1. Mesafe Hesaplama Fonksiyonları
def mesafe_hesapla(nokta1, nokta2):
    if not KOCAELI_GRAPH or "node_id" not in nokta1 or "node_id" not in nokta2:
        return mesafe_haversine(nokta1["lat"], nokta1["lon"], nokta2["lat"], nokta2["lon"])
    try:
        rotadaki_dugumler = nx.shortest_path(KOCAELI_GRAPH, nokta1["node_id"], nokta2["node_id"], weight="length")
        mesafe_metres = nx.path_weight(KOCAELI_GRAPH, rotadaki_dugumler, weight="length")
        return mesafe_metres / 1000.0
    except:
        return mesafe_haversine(nokta1["lat"], nokta1["lon"], nokta2["lat"], nokta2["lon"])

def mesafe_haversine(lat1, lon1, lat2, lon2):
    R = 6371  
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    a = math.sin(dLat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dLon / 2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def rota_cizim_koordinatlarini_bul(nokta1, nokta2):
    if not KOCAELI_GRAPH or "node_id" not in nokta1 or "node_id" not in nokta2:
        return [[nokta1["lat"], nokta1["lon"]], [nokta2["lat"], nokta2["lon"]]]
    try:
        rotadaki_dugumler = nx.shortest_path(KOCAELI_GRAPH, nokta1["node_id"], nokta2["node_id"], weight="length")
        unique_coords = []
        for u in rotadaki_dugumler:
            unique_coords.append([KOCAELI_GRAPH.nodes[u]['y'], KOCAELI_GRAPH.nodes[u]['x']])
        return unique_coords
    except:
        return [[nokta1["lat"], nokta1["lon"]], [nokta2["lat"], nokta2["lon"]]]

# 2. Güncellenmiş Rotalama Algoritması
def rotayi_clark_wright_ile_hesapla(istasyonlar: List[Dict], araclar: List[Dict]):
    """
    Dinamik Başlangıçlı VRP: 
    Araçlar kendi 'baslangic_istasyon_id' noktasından kalkar, 
    kargoları toplar ve 'KOU Lojistik Merkezi'nde bitirir.
    """
    # 0. Final (Varış) Noktasını Bul
    varis_noktasi = next((i for i in istasyonlar if i["isim"] == "KOU Lojistik Merkezi"), None)
    if not varis_noktasi:
        return {"hata": "Varış noktası (KOU Lojistik Merkezi) bulunamadı."}

    # Kargo olan müşteriler
    musteriler = [i for i in istasyonlar if i["isim"] != "KOU Lojistik Merkezi" and i.get("kargo_agirlik", 0) > 0]
    
    if not musteriler:
        return {"durum": "Bilgi", "mesaj": "Senaryoda taşınacak kargo bulunmuyor.", "arac_rotalari": []}

    # Tüm ilgili noktaların node_id'lerini hazırla
    tum_noktalar = istasyonlar # Tüm potansiyel duraklar
    if KOCAELI_GRAPH:
        for nokta in tum_noktalar:
            nokta["node_id"] = ox.nearest_nodes(KOCAELI_GRAPH, nokta["lon"], nokta["lat"])

    # 1. Mesafe Matrisi (Önbellekli)
    mesafe_matrisi = {}
    for i in tum_noktalar:
        mesafe_matrisi[i["id"]] = {}
        for j in tum_noktalar:
            mesafe_matrisi[i["id"]][j["id"]] = mesafe_hesapla(i, j)

    # 2. Araç Atama ve Rotalama (Greedy Sezgisel)
    # Clark-Wright tasarruf mantığı yerine 'Dinamik Başlangıç' için her aracı en uygun rotaya atıyoruz
    final_rotalar = []
    ziyaret_edilen_musteri_idleri = set()
    
    # Araçları kapasitelerine göre büyükten küçüğe sıralayalım
    sirali_araclar = sorted(araclar, key=lambda x: x['kapasite_kg'], reverse=True)

    for arac in sirali_araclar:
        current_yuk = 0
        current_rota_duraklari = []
        
        # Aracın başlangıç noktasını bul
        mevcut_konum_id = arac.get("baslangic_istasyon_id")
        if not mevcut_konum_id: continue
        
        mevcut_nokta = next((i for i in istasyonlar if i["id"] == mevcut_konum_id), None)
        
        while True:
            en_yakin_musteri = None
            min_mesafe = float('inf')
            
            # Kapasiteye uygun en yakın müşteriyi bul
            for m in musteriler:
                if m["id"] not in ziyaret_edilen_musteri_idleri:
                    if current_yuk + m["kargo_agirlik"] <= arac["kapasite_kg"]:
                        d = mesafe_matrisi[mevcut_konum_id][m["id"]]
                        if d < min_mesafe:
                            min_mesafe = d
                            en_yakin_musteri = m
            
            if en_yakin_musteri:
                current_rota_duraklari.append(en_yakin_musteri)
                current_yuk += en_yakin_musteri["kargo_agirlik"]
                ziyaret_edilen_musteri_idleri.add(en_yakin_musteri["id"])
                mevcut_konum_id = en_yakin_musteri["id"]
            else:
                break # Daha fazla müşteri eklenemez
        
        if current_rota_duraklari:
            # Rota Koordinatlarını Oluştur: Başlangıç -> Duraklar -> Varis
            cizim_noktalari = []
            toplam_km = 0
            
            yol_noktalari = [mevcut_nokta] + current_rota_duraklari + [varis_noktasi]
            
            for k in range(len(yol_noktalari) - 1):
                p1, p2 = yol_noktalari[k], yol_noktalari[k+1]
                toplam_km += mesafe_matrisi[p1["id"]][p2["id"]]
                cizim_noktalari.extend(rota_cizim_koordinatlarini_bul(p1, p2))

            final_rotalar.append({
                "arac_id": arac["id"],
                "arac_isim": arac["isim"],
                "rota_duraklari": [d["isim"] for d in current_rota_duraklari],
                "yuk": current_yuk,
                "toplam_km": round(toplam_km, 2),
                "maliyet": round(toplam_km * arac.get("km_basi_maliyet", 1), 2),
                "cizim_koordinatlari": cizim_noktalari
            })

    return {
        "durum": "Başarılı",
        "arac_rotalari": final_rotalar,
        "toplam_maliyet": sum(r["maliyet"] for r in final_rotalar),
        "toplam_km": sum(r["toplam_km"] for r in final_rotalar)
    }