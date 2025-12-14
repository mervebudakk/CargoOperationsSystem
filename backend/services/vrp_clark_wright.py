import math
from typing import List, Dict, Tuple
import osmnx as ox
import networkx as nx 
import random # Renk ataması için
import pickle
import os
# Haversine'i yedeğe alıyoruz
# from OSRM import OSRM 

# Önceden hesaplanmış mesafeleri kaydetmek için dosya yolu
CACHE_DIR = "cache"
DISTANCE_CACHE_FILE = os.path.join(CACHE_DIR, "mesafe_matrisi.pkl")

# Kocaeli Yol Ağını (Graph) Global Olarak Tanımla (Sadece bir kere yüklenmeli)
try:
    # Kocaeli'nin tamamının yol ağını indir
    # 'drive' (araba yolları), 'bike' (bisiklet) gibi seçenekler var.
    KOCAELI_GRAPH = ox.graph_from_place("Kocaeli, Turkey", network_type="drive")
    print("INFO: Kocaeli Yol Ağı (Graph) Başarıyla Yüklendi.")
    # Kenar ağırlığı (weight) olarak mesafeyi (length) kullan
    #KOCAELI_GRAPH = ox.add_edge_speeds(KOCAELI_GRAPH)
    #KOCAELI_GRAPH = ox.add_travel_times(KOCAELI_GRAPH)

except Exception as e:
    # Eğer indirme başarısız olursa (internet sorunu vb.), Graph'ı None yap
    print(f"HATA: Kocaeli Yol Ağı yüklenemedi. Haversine yedeği kullanılacak. Hata: {e}")
    KOCAELI_GRAPH = None

# Araç Kapasiteleri (PDF'e göre)
ARACLAR = [
    {"id": 1, "kapasite": 500}, 
    {"id": 2, "kapasite": 750}, 
    {"id": 3, "kapasite": 1000}
]

# 1. Mesafe Hesaplama Fonksiyonu (Dijkstra/A* Yolu)
def mesafe_hesapla(nokta1, nokta2): # Fonksiyon artık nokta objelerini alıyor!
    """
    İki nokta arasındaki GERÇEK KARAYOLU mesafesini (km) Dijkstra/A* ile hesaplar.
    """
    if not KOCAELI_GRAPH or "node_id" not in nokta1 or "node_id" not in nokta2:
        # Eğer Graph yüklü değilse VEYA node_id önbelleğe alınamamışsa, Haversine'a geri dön
        return mesafe_haversine(nokta1["lat"], nokta1["lon"], nokta2["lat"], nokta2["lon"])

    try:
        orig_node = nokta1["node_id"]
        dest_node = nokta2["node_id"]
        
        # 2. NetworkX'in shortest_path (A*) algoritmasını kullanarak en kısa yolu bul
        rotadaki_dugumler = nx.shortest_path(
            KOCAELI_GRAPH, 
            orig_node, 
            dest_node, 
            weight="length" # 'length' (metre) ağırlığına göre hesapla
        )

        # 3. Bulunan yolun toplam uzunluğunu (metre) hesapla
        mesafe_metres = nx.path_weight(
            KOCAELI_GRAPH, 
            rotadaki_dugumler, 
            weight="length"
        )
        
        # Kilometreye çevir ve döndür
        return mesafe_metres / 1000.0

    except Exception as e:
        # Eğer bir ilçe çok uzaktaysa veya yol ağı bulunamazsa, Haversine'a geri dön.
        print(f"Dijkstra/A* Hatası: {e}. Haversine yedeği kullanılıyor.")
        return mesafe_haversine(nokta1["lat"], nokta1["lon"], nokta2["lat"], nokta2["lon"])

# Yedek: Kuş Uçuşu (Haversine)
def mesafe_haversine(lat1, lon1, lat2, lon2):
    """Hata durumunda kullanılacak yedek Haversine hesaplaması (Kuş Uçuşu)"""
    R = 6371  
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    a = math.sin(dLat / 2) * math.sin(dLat / 2) + \
        math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * \
        math.sin(dLon / 2) * math.sin(dLon / 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

# Rota Çizim Koordinatlarını Hesaplama (GERÇEK YOL)
def rota_cizim_koordinatlarini_bul(nokta1, nokta2):
    """
    İki nokta arasındaki en kısa karayolu üzerindeki tüm koordinatları döndürür.
    """
    if not KOCAELI_GRAPH or "node_id" not in nokta1 or "node_id" not in nokta2:
        # Eğer Graph yüklü değilse, basitçe düz çizgiyi döndürürüz (Yedek)
        return [[nokta1["lat"], nokta1["lon"]], [nokta2["lat"], nokta2["lon"]]]

    try:
        orig_node = nokta1["node_id"]
        dest_node = nokta2["node_id"]
        
        # 1. Dijkstra/A* ile yol üzerindeki düğüm ID'lerini bul
        rotadaki_dugumler = nx.shortest_path(
            KOCAELI_GRAPH, 
            orig_node, 
            dest_node, 
            weight="length"
        )
        
        # 2. Rota düğümlerinin geometrik objelerini al (koordinatları içeren)
        # 'route_to_gdf' fonksiyonu rota üzerindeki her bir kenarı (edge) bir coğrafi veri çerçevesi olarak döndürür.
        edges, nodes = ox.graph_to_gdfs(KOCAELI_GRAPH)
        
        # 3. Yol üzerindeki tüm kenar koordinatlarını topla
        cizim_koordinatlari = []
        
        for u, v in zip(rotadaki_dugumler[:-1], rotadaki_dugumler[1:]):
            # Kenar verisini al (birden fazla olabilir)
            kenar_verisi = KOCAELI_GRAPH.get_edge_data(u, v)
            
            # En kısa kenarı al (Genellikle tek kenar vardır)
            if kenar_verisi:
                data = kenar_verisi[0]
                
                # Eğer kenarda geometri (koordinat listesi) varsa:
                if 'geometry' in data:
                    # Shapely objesini listeye çeviriyoruz (GeoJSON formatında)
                    for lon, lat in data['geometry'].coords:
                        cizim_koordinatlari.append([lat, lon])
                else:
                    # Geometri yoksa, sadece düğüm koordinatlarını kullan (yedek)
                    u_lat = KOCAELI_GRAPH.nodes[u]['y']
                    u_lon = KOCAELI_GRAPH.nodes[u]['x']
                    v_lat = KOCAELI_GRAPH.nodes[v]['y']
                    v_lon = KOCAELI_GRAPH.nodes[v]['x']
                    cizim_koordinatlari.append([u_lat, u_lon])
                    cizim_koordinatlari.append([v_lat, v_lon])
        
        # 4. Çiftleri temizle (bazı noktalar üst üste gelebilir) ve döndür
        # Benzersiz koordinat listesini almak, çizimi temizler
        unique_coords = []
        seen = set()
        for lat, lon in cizim_koordinatlari:
            coord_tuple = (lat, lon)
            if coord_tuple not in seen:
                seen.add(coord_tuple)
                unique_coords.append([lat, lon])
                
        return unique_coords
        
    except Exception as e:
        print(f"Rota Çizim Hatası: {e}. Düz çizgi yedeği kullanılıyor.")
        return [[nokta1["lat"], nokta1["lon"]], [nokta2["lat"], nokta2["lon"]]]

# 2. Clark-Wright Saving Algorithm'u Uygulama
def rotayi_clark_wright_ile_hesapla(istasyonlar: List[Dict]):
    
    # 0. Başlangıç (Depo) noktasını bulalım
    depo = next((i for i in istasyonlar if i["isim"] == "KOU Lojistik Merkezi"), None)
    if not depo:
        return {"hata": "Depo (KOU Lojistik Merkezi) bulunamadı."}

    # Kargo olan tüm istasyonları müşteri olarak alıyoruz
    musteriler = [i for i in istasyonlar if i["isim"] != "KOU Lojistik Merkezi" and i["kargo_agirlik"] > 0]
    
    # Eğer hiç kargo yoksa
    if not musteriler:
        return {"rota": [], "toplam_km": 0, "mesaj": "Hiç kargo yükü yok."}

    tum_noktalar = [depo] + musteriler
    
    # Graph yüklüyse, tüm noktaların en yakın yol düğümlerini bul ve önbelleğe al
    if KOCAELI_GRAPH:
        print("INFO: Nokta koordinatları Graph düğümlerine çevriliyor...")
        for nokta in tum_noktalar:
            # osmnx ile en yakın düğüm ID'sini bul
            nokta["node_id"] = ox.nearest_nodes(KOCAELI_GRAPH, nokta["lon"], nokta["lat"])

    # 1. Mesafeleri Hesapla 
    mesafe_matrisi = {}
    tum_noktalar = [depo] + musteriler
    
    # 🔴 Önbellek Kontrolü: Daha önce hesaplandı mı?
    if os.path.exists(DISTANCE_CACHE_FILE):
        print("INFO: Mesafe matrisi önbellekten yükleniyor...")
        with open(DISTANCE_CACHE_FILE, 'rb') as f:
            mesafe_matrisi = pickle.load(f)
        
        # Kontrol: Önbellekteki matris mevcut müşteri setini içeriyor mu?
        if all(i["isim"] in mesafe_matrisi for i in tum_noktalar):
             print("INFO: Önbellek geçerli. Dijkstra yeniden çalışmayacak.")
             # Eğer önbellek geçerliyse, bu kısmı atla ve 2. adıma geç
             pass
        else:
             print("UYARI: Önbellekteki müşteri seti değişmiş. Yeniden hesaplanıyor.")
             mesafe_matrisi = {} # Yeniden hesaplamayı zorla
    
    # Eğer önbellek yoksa veya geçersizse: YENİDEN HESAPLA (Dijkstra/A*)
    if not mesafe_matrisi:
        print("INFO: Mesafe matrisi Dijkstra/A* ile hesaplanıyor...")
        if not os.path.exists(CACHE_DIR):
            os.makedirs(CACHE_DIR)
            
        for i in tum_noktalar:
            mesafe_matrisi[i["isim"]] = {}
            for j in tum_noktalar:
                mesafe_matrisi[i["isim"]][j["isim"]] = mesafe_hesapla(i, j)

        # Hata vermemek için sadece mesafe matrisi başarıyla hesaplandıysa kaydet
        if mesafe_matrisi:
             # 🔴 Önbelleğe Kaydetme
            with open(DISTANCE_CACHE_FILE, 'wb') as f:
                pickle.dump(mesafe_matrisi, f)
            print("INFO: Mesafe matrisi başarıyla önbelleğe kaydedildi.")

    # 2. Tasarruf Hesaplama (S[i, j] = D[0, i] + D[0, j] - D[i, j])
    tasarruf_listesi = []
    
    # Tüm müşteri çiftlerini deneyelim
    for i in musteriler:
        for j in musteriler:
            
            # 1. Aynı istasyon olmamalı (Basiskele-Basiskele gibi)
            if i["isim"] == j["isim"]:
                continue
                
            # 2. (i, j) çiftini (j, i) olarak tekrar hesaplamamak için basit bir kontrol
            # Bu, rotaların birleştirilmesi sırasında problem çıkarabilir ama şimdilik tasarruf listesi için yeterli
            if i["isim"] > j["isim"]: 
                continue

            # Tasarruf sadece i ve j farklıyken hesaplanır
            tasarruf = (mesafe_matrisi[depo["isim"]][i["isim"]] +
                        mesafe_matrisi[depo["isim"]][j["isim"]] -
                        mesafe_matrisi[i["isim"]][j["isim"]])
            
            tasarruf_listesi.append({
                "i": i["isim"],
                "j": j["isim"],
                "tasarruf": tasarruf,
                "toplam_yuk": i["kargo_agirlik"] + j["kargo_agirlik"]
            })
    
    # Tasarrufu en yüksek olandan en düşüğe sırala
    tasarruf_listesi.sort(key=lambda x: x["tasarruf"], reverse=True)

    # 3. Başlangıç Rotaları (Her müşteri için Depo -> Müşteri -> Depo rotası)
    # Rota yapısı: {RotaID: {musteriler: ['Basiskele'], yuk: 120, arac_id: None}}
    rotalar = {}
    rota_id_sayaci = 1
    
    for m in musteriler:
        rotalar[rota_id_sayaci] = {
            "musteriler": [m["isim"]],
            "yuk": m["kargo_agirlik"],
            "arac_id": None
        }
        rota_id_sayaci += 1

    # 4. Tasarrufa Göre Rotaları Birleştirme (Merging)
    
    # Rota: {RotaID: {musteriler: ['Basiskele'], yuk: 120, arac_id: None}}
    # Birleştirme: Tasarrufu en yüksek olan (i, j) çiftini al
    for tasarruf_obj in tasarruf_listesi:
        i, j = tasarruf_obj["i"], tasarruf_obj["j"]
        toplam_yuk = tasarruf_obj["toplam_yuk"]
        
        # Hangi rotalar i ve j'yi içeriyor?
        rota_i_id = next((rid for rid, rdata in rotalar.items() if i in rdata["musteriler"]), None)
        rota_j_id = next((rid for rid, rdata in rotalar.items() if j in rdata["musteriler"]), None)

        # 1. Farklı rotalarda olmalılar (Kendisiyle birleşemez)
        if rota_i_id and rota_j_id and rota_i_id != rota_j_id:
            
            rota_i = rotalar[rota_i_id]
            rota_j = rotalar[rota_j_id]
            
            yeni_yuk = rota_i["yuk"] + rota_j["yuk"]
            
            # 2. Kapasite Kontrolü: En büyük aracın (1000 kg) kapasitesini aşıyor mu?
            # NOT: Sınırsız araç problemi için, kapasiteyi aşarsa bile yeni araç kiralanır.
            # Şimdilik en büyük mevcut kapasiteye göre (1000kg) kontrol ediyoruz.
            if yeni_yuk <= ARACLAR[-1]["kapasite"]: 
                
                # 3. Geçerli Birleştirme Kontrolü (i veya j rotanın başlangıcı/sonu olmalı)
                
                i_sonda = rota_i["musteriler"][-1] == i
                i_basta = rota_i["musteriler"][0] == i
                j_sonda = rota_j["musteriler"][-1] == j
                j_basta = rota_j["musteriler"][0] == j
                
                # Birleştirme 4 olası şekilde gerçekleşebilir (Clark-Wright Kuralları):
                # Kural 1: i rotanın sonu, j rotanın başı -> [A, i] + [j, B] = [A, i, j, B]
                if i_sonda and j_basta:
                    birlesmis_musteriler = rota_i["musteriler"] + rota_j["musteriler"]
                
                # Kural 2: j rotanın sonu, i rotanın başı -> [A, j] + [i, B] = [A, j, i, B]
                elif j_sonda and i_basta:
                    birlesmis_musteriler = rota_j["musteriler"] + rota_i["musteriler"]
                    
                # Kural 3: i rotanın sonu, j rotanın sonu -> [A, i] + [B, j] (Ters çevir)
                elif i_sonda and j_sonda:
                    birlesmis_musteriler = rota_i["musteriler"] + list(reversed(rota_j["musteriler"]))
                    
                # Kural 4: i rotanın başı, j rotanın başı -> [i, A] + [j, B] (Ters çevir)
                elif i_basta and j_basta:
                    birlesmis_musteriler = list(reversed(rota_i["musteriler"])) + rota_j["musteriler"]

                else:
                    # Rota içi birleştirme (Clark-Wright'ta yapılmaz)
                    continue

                # Birleşme gerçekleşti!
                yeni_rota_id = rota_i_id # Eski ID'yi kullan
                rotalar[yeni_rota_id]["musteriler"] = birlesmis_musteriler
                rotalar[yeni_rota_id]["yuk"] = yeni_yuk
                
                # Eski rotayı (j'yi içeren) siliyoruz
                del rotalar[rota_j_id]

    # 5. Rota Kilometre ve Koordinat Hesaplama
    final_rotalar_listesi = []
    tum_istasyonlar_map = {i["isim"]: i for i in istasyonlar}
    # Yeni ekleme: Nokta objelerini isimleriyle eşleştirelim
    noktalar_obj_map = {nokta["isim"]: nokta for nokta in tum_noktalar} 

    for rid, rdata in rotalar.items():
        toplam_km = 0
        ana_rota_cizim_koordinatlari = [] # Bu, rotanın tamamının koordinatları olacak
        
        # Başlangıç: Depo objesi
        onceki_isim = depo["isim"]
        
        # Geçici koordinat listesi: Depo ve müşterilerin koordinat objeleri
        rota_objeleri = [noktalar_obj_map[depo["isim"]]] + [noktalar_obj_map[isim] for isim in rdata["musteriler"]] + [noktalar_obj_map[depo["isim"]]]
        
        # Tüm durak çiftlerini döngüye al
        for k in range(len(rota_objeleri) - 1):
            nokta_A = rota_objeleri[k]
            nokta_B = rota_objeleri[k+1]
            
            # KM Hesapla (Daha önce yaptığımız, doğru çalışan kısım)
            toplam_km += mesafe_matrisi[nokta_A["isim"]][nokta_B["isim"]]
            
            # 🔴 KRİTİK DEĞİŞİKLİK: Rota Koordinatlarını Çek
            aradaki_cizim = rota_cizim_koordinatlarini_bul(nokta_A, nokta_B)
            
            # İlk nokta hariç (çünkü önceki rotanın son noktası), tüm yeni koordinatları ekle
            if ana_rota_cizim_koordinatlari:
                # Rotayı birbirine bağlarken son noktayı tekrar eklemeyi önle
                ana_rota_cizim_koordinatlari.extend(aradaki_cizim[1:]) 
            else:
                # İlk başlangıç için tüm koordinatları ekle
                ana_rota_cizim_koordinatlari.extend(aradaki_cizim)


        # Final rotası oluştur
        final_rotalar_listesi.append({
            "rota_id": rid,
            "musteriler": rdata["musteriler"],
            "toplam_km": toplam_km,
            "yuk": rdata["yuk"],
            "cizim_koordinatlari": ana_rota_cizim_koordinatlari # Buraya GERÇEK YOL koordinatları geldi!
        })
        
    # 6. Sonuçları döndür (Frontend'in anlayacağı format)
    return {
        "durum": "VRP Rotalama Tamamlandı",
        "arac_rotalari": final_rotalar_listesi,
        "arac_sayisi": len(final_rotalar_listesi),
        "genel_toplam_km": sum(r["toplam_km"] for r in final_rotalar_listesi)
    }