import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Durak numaralarını göstermek için özel ikon oluşturucu
const createNumberIcon = (number, color) => {
  return L.divIcon({
    className: 'custom-number-icon',
    html: `<div style="background-color: ${color}; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border: 2px solid white; font-weight: bold; font-size: 12px;">${number}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

const MapEvents = ({ onMapClick, role }) => {
  useMapEvents({
    click(e) {
      if (role === 'admin' && onMapClick) onMapClick(e.latlng);
    },
  });
  return null;
};

const Harita = ({ istasyonlar, rota, merkezKonum, onMapClick, role }) => {
  // Rotalar için renk paleti
  const colors = ["#2563eb", "#dc2626", "#16a34a", "#ca8a04", "#9333ea", "#0891b2"];

  return (
    <MapContainer center={merkezKonum || [40.7654, 29.9401]} zoom={10} style={{ height: '100%', width: '100%' }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <MapEvents onMapClick={onMapClick} role={role} />

      {/* 1. Tüm İstasyon İşaretçileri (Arka Plan) */}
      {istasyonlar && istasyonlar.map((ist) => (
        <Marker key={`ist-${ist.id}`} position={[ist.lat, ist.lon]} opacity={0.6}>
          <Popup>
            <div style={{ textAlign: 'center' }}>
              <strong>{ist.isim}</strong> <br />
              ID: {ist.id}
            </div>
          </Popup>
        </Marker>
      ))}

      {/* 2. Rota ve Durak Görselleştirme */}
      {rota && rota.length > 0 && rota.map((aracRota, rIndex) => {
        const yolKoordinatlari = aracRota.cizim_koordinatlari || [];
        const rotaRengi = colors[rIndex % colors.length];

        return (
          <div key={`route-group-${rIndex}`}>
            {/* Gerçek Yol Çizimi */}
            {yolKoordinatlari.length > 0 && (
              <Polyline 
                positions={yolKoordinatlari} 
                color={rotaRengi} 
                weight={5} 
                opacity={0.8}
              >
                <Popup>
                  <strong>ARAÇ: {aracRota.arac_isim}</strong> <br/>
                  Kapasite: {aracRota.kapasite_kg} KG <br/>
                  Doluluk: %{aracRota.doluluk_orani} <br/>
                  Toplam Mesafe: {aracRota.toplam_km?.toFixed(2)} KM <br/>
                  Toplam Maliyet: {aracRota.maliyet?.toFixed(2)} TL
                </Popup>
              </Polyline>
            )}

            {/* Rota Üzerindeki Durak Numaraları (Sıralı) */}
            {aracRota.duraklar && aracRota.duraklar.map((durak, dIndex) => (
              <Marker 
                key={`stop-${rIndex}-${durak.istasyon_id}`}
                position={yolKoordinatlari.find(c => c.id === durak.istasyon_id) || 
                          [istasyonlar.find(i => i.id === durak.istasyon_id)?.lat, 
                           istasyonlar.find(i => i.id === durak.istasyon_id)?.lon]}
                icon={createNumberIcon(durak.sira, rotaRengi)}
              >
                <Popup>
                  <div style={{ minWidth: '150px' }}>
                    <strong>{durak.sira}. Durak: {durak.istasyon_isim}</strong> <br/>
                    <hr/>
                    📦 Bu Duraktaki Yük: {durak.yuklu_kargo_kg} kg <br/>
                    📏 Ara Mesafe: {durak.ara_mesafe} km <br/>
                    🚚 Kalan Kapasite: {durak.kalan_kapasite_kg} kg
                  </div>
                </Popup>
              </Marker>
            ))}
          </div>
        );
      })}
    </MapContainer>
  );
};

export default Harita;