import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'; // Polyline eklendi
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import './App.css';

function App() {
  const [stations, setStations] = useState([]); 
  const [routePath, setRoutePath] = useState([]); // Çizilecek yolun koordinatları
  const [info, setInfo] = useState("Rotayı Hesaplamak için Butona Basın");

  const centerPosition = [40.8222, 29.9217]; 

  // 1. İstasyonları Çek
  useEffect(() => {
    axios.get('http://127.0.0.1:8000/stations')
      .then((res) => setStations(res.data))
      .catch((err) => console.error(err));
  }, []);

  // 2. Rotayı Hesapla Butonu Fonksiyonu
  const handleCalculateRoute = () => {
    setInfo("Hesaplanıyor...");
    axios.get('http://127.0.0.1:8000/solve-route')
      .then((response) => {
        const routeData = response.data.route;
        const totalKm = response.data.total_km;

        // Backend'den gelen sıralı istasyonları çizgi formatına çevir
        const pathCoordinates = routeData.map(st => [st.lat, st.lon]);
        
        setRoutePath(pathCoordinates);
        setInfo(`Rota Oluşturuldu! Toplam Mesafe: ${totalKm} km`);
      })
      .catch((error) => {
        console.error("Rota hatası:", error);
        setInfo("Hata oluştu!");
      });
  };

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column' }}>
      
      {/* --- KONTROL PANELİ --- */}
      <div style={{ padding: '15px', backgroundColor: '#333', color: 'white', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <h2 style={{ margin: 0 }}>Kargo Rota Sistemi</h2>
        
        <div>
          <span style={{ marginRight: '15px', fontWeight:'bold', color: '#4caf50' }}>{info}</span>
          <button 
            onClick={handleCalculateRoute}
            style={{ padding: '10px 20px', cursor: 'pointer', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold' }}>
            ROTAYI HESAPLA 🚀
          </button>
        </div>
      </div>

      {/* --- HARİTA --- */}
      <div style={{ flex: 1 }}>
        <MapContainer center={centerPosition} zoom={10} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* İstasyonlar (Noktalar) */}
          {stations.map((station) => (
            <Marker key={station.id} position={[station.lat, station.lon]}>
              <Popup>{station.name}</Popup>
            </Marker>
          ))}

          {/* HESAPLANAN ROTA (Çizgi) */}
          {routePath.length > 0 && (
            <Polyline positions={routePath} color="red" weight={4} dashArray="10, 10" />
          )}

        </MapContainer>
      </div>
    </div>
  );
}

export default App;