import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Bu bileşen sadece "göstermekten" sorumludur. Veriyi (props) dışarıdan alır.
const Harita = ({ istasyonlar, rota, merkezKonum }) => {
  return (
    <MapContainer center={merkezKonum} zoom={10} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* İstasyon Noktaları */}
      {istasyonlar.map((istasyon) => (
        <Marker key={istasyon.id} position={[istasyon.lat, istasyon.lon]}>
          <Popup>{istasyon.isim}</Popup>
        </Marker>
      ))}

      {/* Kırmızı Rota Çizgisi */}
      {rota.length > 0 && (
        <Polyline positions={rota} color="red" weight={4} dashArray="10, 10" />
      )}
    </MapContainer>
  );
};

export default Harita;