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

      {istasyonlar.map((ist) => (
        <Marker key={ist.id} position={[ist.lat, ist.lon]}>
          <Popup>
            <div style={{ textAlign: 'center' }}>
              <strong>{ist.isim}</strong> <br />
              📦 Yük: {ist.kargo_agirlik} kg <br />
              🔢 Adet: {ist.kargo_adet}
            </div>
          </Popup>
        </Marker>
      ))}

      {rota.length > 0 && rota.map((aracRota, index) => (
        <Polyline key={index} positions={aracRota.yol} color={aracRota.renk} weight={4} opacity={0.7} dashArray="10, 10">
          <Popup>
            <strong>ARAÇ ROTA {aracRota.id + 1}</strong> <br/>
            Durak Sayısı: {aracRota.musteri_sayisi} <br/>
            KM: {aracRota.km.toFixed(2)}
          </Popup>
        </Polyline>
      ))}
    </MapContainer>
  );
};
export default Harita;