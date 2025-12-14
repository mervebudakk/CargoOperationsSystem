import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Bu bileşen sadece "göstermekten" sorumludur. Veriyi (props) dışarıdan alır.
const Harita = ({ istasyonlar, rota, merkezKonum }) => {
  return (
    <MapContainer center={merkezKonum} zoom={10} style={{ height: '100%', width: '100vw' }}>
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* İstasyon Noktaları */}
      {istasyonlar.map((istasyon) => (
        <Marker key={istasyon.id} position={[istasyon.lat, istasyon.lon]}>
          <Popup>
            <div style={{ textAlign: 'center' }}>
              <strong>{istasyon.isim}</strong> <br />
              📦 Yük: {istasyon.kargo_agirlik} kg <br />
              🔢 Adet: {istasyon.kargo_adet}
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Çoklu Rota Çizgileri (Artık birden fazla olabilir) */}
      {rota.length > 0 && rota.map((aracRota, index) => (
        <Polyline 
          key={index} 
          positions={aracRota.yol} // Yol koordinatları
          color={aracRota.renk} // Rota ID'sine göre renk (Mavi veya Kırmızı)
          weight={4} 
          opacity={0.7}
          dashArray="10, 10" 
        >
          <Popup>
            <strong>ARAÇ ROTA {aracRota.id + 1}</strong> <br/>
            Durak Sayısı: {aracRota.musteri_sayisi} <br/>
            Toplam KM: {aracRota.km.toFixed(2)}
          </Popup>
        </Polyline>
      ))}
    </MapContainer>
  );
};

export default Harita;