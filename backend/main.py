from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from geopy.distance import geodesic
import math

app = FastAPI()

# --- AYARLAR ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- VERİLER ---
stations = [
# BAŞLANGIÇ: Kocaeli Üniversitesi (Rektörlük Binası Önü)
    {"id": 0, "name": "KOU Lojistik Merkezi", "lat": 40.8222, "lon": 29.9217},
    # 1. Başiskele (Belediye Binası ve Merkez) - Dağda değil, sahile yakın merkezde
    {"id": 1, "name": "Basiskele", "lat": 40.7155, "lon": 29.9276},
    # 2. Çayırova (Fatih Caddesi - Tam Çarşı)
    {"id": 2, "name": "Cayirova", "lat": 40.8164, "lon": 29.3734},
    # 3. Darıca (Çınaraltı / Merkez) - Denize kaymaz, tam çarşı içi
    {"id": 3, "name": "Darica", "lat": 40.7745, "lon": 29.4009},
    # 4. Derince (Kent Meydanı / Liman Yolu Girişi)
    {"id": 4, "name": "Derince", "lat": 40.7562, "lon": 29.8318},
    # 5. Dilovası (Belediye Önü)
    {"id": 5, "name": "Dilovasi", "lat": 40.7877, "lon": 29.5432},
    # 6. Gebze (Tarihi Kent Meydanı - Çoban Mustafa Paşa)
    {"id": 6, "name": "Gebze", "lat": 40.8025, "lon": 29.4399},
    # 7. Gölcük (Anıtpark Meydanı)
    {"id": 7, "name": "Golcuk", "lat": 40.7170, "lon": 29.8242},
    # 8. Kandıra (Çarşı Merkezi)
    {"id": 8, "name": "Kandira", "lat": 41.0708, "lon": 30.1520},
    # 9. Karamürsel (Sahil Parkı ve Terminal Alanı)
    {"id": 9, "name": "Karamursel", "lat": 40.6924, "lon": 29.6159},
    # 10. Kartepe (Köseköy Merkezi / Kaymakamlık) - Dağ zirvesi değil, ilçe merkezi
    {"id": 10, "name": "Kartepe", "lat": 40.7550, "lon": 30.0210},
    # 11. Körfez (Tütünçiftlik Ağadere Caddesi - Merkez)
    {"id": 11, "name": "Korfez", "lat": 40.7744, "lon": 29.7366},
    # 12. İzmit (Belsa Plaza / Yürüyüş Yolu)
    {"id": 12, "name": "Izmit", "lat": 40.7659, "lon": 29.9416}
]

@app.get("/stations")
def get_stations():
    return stations

# --- ALGORİTMA: EN YAKIN KOMŞU (Greedy) ---
@app.get("/solve-route")
def solve_route():
    # 1. Başlangıç noktası (Kampüs)
    route = [stations[0]] 
    unvisited = stations[1:] # Diğer tüm ilçeler
    current_location = stations[0]

    total_distance = 0

    # 2. Döngü: Her seferinde en yakındakini bul
    while unvisited:
        nearest_station = None
        min_dist = float('inf')

        for station in unvisited:
            # İki nokta arası mesafe (km)
            dist = geodesic(
                (current_location["lat"], current_location["lon"]),
                (station["lat"], station["lon"])
            ).km

            if dist < min_dist:
                min_dist = dist
                nearest_station = station

        # En yakını rotaya ekle ve listeden çıkar
        route.append(nearest_station)
        unvisited.remove(nearest_station)
        current_location = nearest_station
        total_distance += min_dist

    # 3. Son işlem: Merkeze geri dön (Opsiyonel ama mantıklı)
    # route.append(stations[0]) 
    
    return {"route": route, "total_km": round(total_distance, 2)}