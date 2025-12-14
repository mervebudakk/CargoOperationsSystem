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
    # 0. BAŞLANGIÇ: KOÜ 
    {"id": 0, "name": "KOU Lojistik Merkezi", "lat": 40.8198997, "lon": 29.9226879},
    # 1. Başiskele: Yazının tam üstü 
    {"id": 1, "name": "Basiskele", "lat":40.7135,"lon":29.9284},
    # 2. Çayırova: Haritadaki "Çayırova" yazısının merkezi 
    {"id": 2, "name": "Cayirova", "lat": 40.8338788, "lon": 29.3812750},
    # 3. Darıca: "Darıca" yazısının tam olduğu yer 
    {"id": 3, "name": "Darica", "lat": 40.7574953, "lon": 29.3840004},
    # 4. Derince: Harita etiketinin olduğu nokta
    {"id": 4, "name": "Derince", "lat": 40.7579779, "lon": 29.8306985},
    # 5. Dilovası: "Dilovası" yazısının göbeği 
    {"id": 5, "name": "Dilovasi", "lat": 40.7759471, "lon": 29.5260492},
    # 6. Gebze: Tam merkez yazı üzeri
    {"id": 6, "name": "Gebze", "lat": 40.8020, "lon": 29.4310},
    # 7. Gölcük: Yazının olduğu merkez
    {"id": 7, "name": "Golcuk", "lat": 40.7170762, "lon": 29.8196354},
    # 8. Kandıra: Haritadaki kavşak noktası
    {"id": 8, "name": "Kandira", "lat": 41.0708, "lon": 30.1520},
    # 9. Karamürsel: Sahil şeridindeki yazı
    {"id": 9, "name": "Karamursel", "lat": 40.6924, "lon": 29.6159},
    # 10. Kartepe: Haritadaki "Kartepe" yazısının yeri 
    {"id": 10, "name": "Kartepe", "lat": 40.7458640, "lon": 30.0112819},
    # 11. Körfez: "Körfez" yazısının tam ortası 
    {"id": 11, "name": "Korfez", "lat": 40.7611, "lon": 29.7836},
    # 12. İzmit: Merkez yazı
    {"id": 12, "name": "Izmit", "lat": 40.7724095, "lon": 29.9505554}
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