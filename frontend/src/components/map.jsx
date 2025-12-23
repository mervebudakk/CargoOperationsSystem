import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const MapEvents = ({ onMapClick, role }) => {
  useMapEvents({
    click(e) {
      if (role === 'admin' && onMapClick) onMapClick(e.latlng);
    },
  });
  return null;
};

const Harita = ({ istasyonlar, rota, merkezKonum, onMapClick, role }) => {
  return (
    <MapContainer center={merkezKonum} zoom={10} style={{ height: '100%', width: '100%' }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <MapEvents onMapClick={onMapClick} role={role} />

      {/* İstasyon İşaretçileri */}
      {istasyonlar && istasyonlar.map((ist) => (
        <Marker key={ist.id} position={[ist.lat, ist.lon]}>
          <Popup>
            <div style={{ textAlign: 'center' }}>
              <strong>{ist.isim}</strong> <br />
              📦 Yük: {ist.kargo_agirlik || 0} kg <br />
              🔢 Adet: {ist.kargo_adet || 0}
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Araç Rotaları (Polyline) */}
      {rota && rota.length > 0 && rota.map((aracRota, index) => {
        // Backend'den gelen 'cizim_koordinatlari' anahtarını kullanıyoruz
        const yolKoordinatlari = aracRota.cizim_koordinatlari || [];
        
        // Eğer koordinat yoksa çizim yapma
        if (yolKoordinatlari.length === 0) return null;

        return (
          <Polyline 
            key={index} 
            positions={yolKoordinatlari} 
            color={index === 0 ? "blue" : index === 1 ? "red" : index === 2 ? "green" : "orange"} 
            weight={4} 
            opacity={0.7}
          >
            <Popup>
              {/* Değişken isimlerini yeni backend yapısına göre güncelledik */}
              <strong>ARAÇ: {aracRota.arac_isim}</strong> <br/>
              Mesafe: {aracRota.toplam_km ? aracRota.toplam_km.toFixed(2) : "0.00"} KM <br/>
              Yük: {aracRota.yuk || 0} kg <br/>
              Maliyet: {aracRota.maliyet || 0} TL
            </Popup>
          </Polyline>
        );
      })}
    </MapContainer>
  );
};

export default Harita;