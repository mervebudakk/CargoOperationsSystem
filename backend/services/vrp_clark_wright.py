import math
from typing import List, Dict, Tuple
import osmnx as ox
import networkx as nx 
import pickle
import os

# --- Yapılandırma, Öncelik ve Önbellek ---
CACHE_DIR = "cache"
GRAPH_FILE = os.path.join(CACHE_DIR, "kocaeli_network.graphml")

if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR)

KOCAELI_GRAPH = None

def graki_yukle():
    """Kocaeli yol ağını dosyadan yükler veya internetten indirip kaydeder."""
    global KOCAELI_GRAPH
    if os.path.exists(GRAPH_FILE):
        print("INFO: Kocaeli Yol Ağı yerel dosyadan yükleniyor... (HIZLI)")
        KOCAELI_GRAPH = ox.load_graphml(GRAPH_FILE)
    else:
        print("INFO: Kocaeli Yol Ağı internetten indiriliyor... (BU BİR KEZ SÜRER)")
        KOCAELI_GRAPH = ox.graph_from_place("Kocaeli, Turkey", network_type="drive")
        ox.save_graphml(KOCAELI_GRAPH, GRAPH_FILE)
    print("INFO: Yol Ağı Hazır.")

# Modül yüklendiğinde grafı başlat
try:
    graki_yukle()
except Exception as e:
    print(f"HATA: Kocaeli Yol Ağı yüklenemedi: {e}")

# Kiralama Sabitleri
KIRALIK_ARAC_MALIYET = 200.0
KIRALIK_ARAC_KAPASITE = 500

# 1. Mesafe ve Koordinat Fonksiyonları
def mesafe_hesapla(nokta1, nokta2):
    if not KOCAELI_GRAPH or "node_id" not in nokta1 or "node_id" not in nokta2:
        return mesafe_haversine(nokta1["lat"], nokta1["lon"], nokta2["lat"], nokta2["lon"])
    try:
        mesafe_metres = nx.shortest_path_length(KOCAELI_GRAPH, nokta1["node_id"], nokta2["node_id"], weight="length")
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
        return [[KOCAELI_GRAPH.nodes[u]['y'], KOCAELI_GRAPH.nodes[u]['x']] for u in rotadaki_dugumler]
    except:
        return [[nokta1["lat"], nokta1["lon"]], [nokta2["lat"], nokta2["lon"]]]


# 2. Clark-Wright Savings Algoritması
def rotayi_clark_wright_ile_hesapla(istasyonlar: List[Dict], araclar: List[Dict]):
    depo = next((i for i in istasyonlar if i["isim"] == "Kocaeli Universitesi"), None)
    if not depo:
        return {"hata": "Varış noktası (Kocaeli Universitesi) bulunamadı."}

    musteriler = [i for i in istasyonlar if i["isim"] != "Kocaeli Universitesi" and i.get("kargo_agirlik", 0) > 0]
    if not musteriler:
        return {"durum": "Bilgi", "mesaj": "Taşınacak kargo bulunmuyor.", "arac_rotalari": []}

    if KOCAELI_GRAPH:
        depo["node_id"] = ox.nearest_nodes(KOCAELI_GRAPH, depo["lon"], depo["lat"])
        for m in musteriler:
            m["node_id"] = ox.nearest_nodes(KOCAELI_GRAPH, m["lon"], m["lat"])

    # --- 1. Tasarruf Hesaplama ve Birleştirme ---
    tasarruflar = []
    for i in range(len(musteriler)):
        for j in range(i + 1, len(musteriler)):
            m1, m2 = musteriler[i], musteriler[j]
            s = mesafe_hesapla(depo, m1) + mesafe_hesapla(depo, m2) - mesafe_hesapla(m1, m2)
            tasarruflar.append((s, m1, m2))
    tasarruflar.sort(key=lambda x: x[0], reverse=True)

    rotalar = [[m] for m in musteriler]
    max_kapasite_siniri = max([a["kapasite_kg"] for a in araclar] + [KIRALIK_ARAC_KAPASITE])

    for s, m1, m2 in tasarruflar:
        r1 = next((r for r in rotalar if r[0] == m1 or r[-1] == m1), None)
        r2 = next((r for r in rotalar if r[0] == m2 or r[-1] == m2), None)
        if r1 and r2 and r1 != r2:
            toplam_yuk = sum(m["kargo_agirlik"] for m in r1 + r2)
            if toplam_yuk <= max_kapasite_siniri:
                if r1[-1] == m1 and r2[0] == m2: new_route = r1 + r2
                elif r1[0] == m1 and r2[-1] == m2: new_route = r2 + r1
                elif r1[-1] == m1 and r2[-1] == m2: new_route = r1 + r2[::-1]
                elif r1[0] == m1 and r2[0] == m2: new_route = r1[::-1] + r2
                else: continue
                rotalar.remove(r1); rotalar.remove(r2); rotalar.append(new_route)

    # --- 3. DÜZELTİLMİŞ ARAÇ ATAMA VE ZİNCİRLEME OPTİMİZASYONU ---
    final_rotalar = []
    mevcut_ozmal_araclar = sorted([a for a in araclar if not a.get("kiralanabilir", False)], key=lambda x: x['kapasite_kg'], reverse=True)
    kullanilan_arac_ids = set()
    kiralik_sayaci = 1

    for ham_rota_duraklari in rotalar:
        # ZİKZAK ÖNLEME: En uzak noktadan başlayıp her adımda en yakın komşuya giden zincir kur
        en_uzak = max(ham_rota_duraklari, key=lambda x: mesafe_hesapla(depo, x))
        sirali_duraklar = [en_uzak]
        kalanlar = [d for d in ham_rota_duraklari if d != en_uzak]
        
        while kalanlar:
            mevcut_konum = sirali_duraklar[-1]
            en_yakin = min(kalanlar, key=lambda x: mesafe_hesapla(mevcut_konum, x))
            sirali_duraklar.append(en_yakin)
            kalanlar.remove(en_yakin)
            
        rota_duraklari = sirali_duraklar
        rota_yuku = sum(m["kargo_agirlik"] for m in rota_duraklari)
        en_iyi_secenek = None
        min_maliyet = float('inf')

        # SEÇENEK A: ÖZMAL ARAÇLAR
        for arac in mevcut_ozmal_araclar:
            if arac["id"] not in kullanilan_arac_ids and rota_yuku <= arac["kapasite_kg"]:
                # Başlangıç istasyonu optimizasyonu
                baslangic_ist = next((ist for ist in istasyonlar if ist["id"] == arac.get("baslangic_istasyon_id")), rota_duraklari[0])
                
                if baslangic_ist == rota_duraklari[0]:
                    yol = rota_duraklari + [depo]
                else:
                    yol = [baslangic_ist] + rota_duraklari + [depo]
                
                km = sum(mesafe_hesapla(yol[k], yol[k+1]) for k in range(len(yol)-1))
                maliyet = arac.get("kiralama_maliyeti", 0) + (km * arac.get("km_basi_maliyet", 1.5))
                
                if maliyet < min_maliyet:
                    min_maliyet = maliyet
                    en_iyi_secenek = {"arac": arac, "km": km, "maliyet": maliyet, "yol": yol, "kiralik": False}

        # SEÇENEK B: KİRALIK ARAÇLAR
        if rota_yuku <= KIRALIK_ARAC_KAPASITE:
            yol_kiralik = rota_duraklari + [depo]
            km_kiralik = sum(mesafe_hesapla(yol_kiralik[k], yol_kiralik[k+1]) for k in range(len(yol_kiralik)-1))
            maliyet_kiralik = KIRALIK_ARAC_MALIYET + (km_kiralik * 1.2)
            
            if maliyet_kiralik < min_maliyet:
                min_maliyet = maliyet_kiralik
                en_iyi_secenek = {
                    "arac": {"id": f"KIRALIK_{kiralik_sayaci}", "isim": f"Kiralık Araç {kiralik_sayaci}"},
                    "km": km_kiralik, "maliyet": maliyet_kiralik, "yol": yol_kiralik, "kiralik": True
                }

        if en_iyi_secenek:
            if not en_iyi_secenek["kiralik"]:
                kullanilan_arac_ids.add(en_iyi_secenek["arac"]["id"])
            else:
                kiralik_sayaci += 1
            
            cizim_koordinatlari = []
            for k in range(len(en_iyi_secenek["yol"]) - 1):
                cizim_koordinatlari.extend(rota_cizim_koordinatlarini_bul(en_iyi_secenek["yol"][k], en_iyi_secenek["yol"][k+1]))

            final_rotalar.append({
                "arac_id": en_iyi_secenek["arac"]["id"],
                "arac_isim": en_iyi_secenek["arac"]["isim"],
                "rota_duraklari": [d["isim"] for d in rota_duraklari],
                "yuk": rota_yuku,
                "toplam_km": round(en_iyi_secenek["km"], 2),
                "maliyet": round(en_iyi_secenek["maliyet"], 2),
                "cizim_koordinatlari": cizim_koordinatlari
            })

    return {
        "durum": "Başarılı",
        "arac_rotalari": final_rotalar,
        "toplam_maliyet": sum(r["maliyet"] for r in final_rotalar),
        "toplam_km": sum(r["toplam_km"] for r in final_rotalar)
    }