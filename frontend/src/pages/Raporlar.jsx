import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import { styles } from "../styles/Raporlar.styles";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Harita odağını ve boyutunu anlık düzelten bileşen
function RecenterMap({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords && coords.length > 0) {
      map.setView(coords[0], 11);
      // Haritanın kaybolmasını engelleyen kritik komut
      setTimeout(() => map.invalidateSize(), 100);
    }
  }, [coords, map]);
  return null;
}

// Numaralı Durak İkonu Oluşturucu
const createNumberedIcon = (number, isLast = false) => {
  return L.divIcon({
    html: `
      <div style="
        background: ${isLast ? "#e74c3c" : "#4caf50"};
        color: white; width: 28px; height: 28px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-weight: bold; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.4);">
        ${number}
      </div>`,
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
};

export default function Raporlar() {
  const [seciliTarih, setSeciliTarih] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [rotalar, setRotalar] = useState([]);
  const [seciliRota, setSeciliRota] = useState(null);
  const [rotaKargolari, setRotaKargolari] = useState([]);
  const [loading, setLoading] = useState(false);
  const [durakNoktalari, setDurakNoktalari] = useState([]);

  useEffect(() => {
    rotaOzetleriniGetir();
  }, [seciliTarih]);

  const rotaOzetleriniGetir = async () => {
    setLoading(true);
    setSeciliRota(null);
    setRotaKargolari([]);
    try {
      const { data, error } = await supabase
        .from("rota_ozetleri")
        .select("*")
        .eq("planlanan_tarih", seciliTarih);
      if (error) throw error;
      setRotalar(data || []);
    } catch (err) {
      console.error("Hata:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const rotaDetayGetir = async (rota) => {
    setSeciliRota(rota);
    try {
      const { data, error } = await supabase
        .from("kargolar")
        .select(
          `*, istasyon:istasyonlar!cikis_istasyon_id (isim, lat, lon), gonderen:users!gonderen_id (first_name, last_name, email)`
        )
        .eq("planlanan_tarih", seciliTarih)
        .eq("arac_id", rota.arac_id);

      if (error) throw error;
      setRotaKargolari(data || []);

      // Durak sıralamasını ve koordinatlarını eşle
      const koordinatMap = {};
      data.forEach((k) => {
        koordinatMap[k.istasyon.isim] = [k.istasyon.lat, k.istasyon.lon];
      });

      const siraliDuraklar = rota.duraklar
        .map((isim) => ({
          isim,
          coords: koordinatMap[isim],
        }))
        .filter((d) => d.coords);

      // Son durak (Umuttepe Depo)
      siraliDuraklar.push({
        isim: "Kocaeli Üniversitesi (Varış)",
        coords: [40.8219, 29.9217],
      });
      setDurakNoktalari(siraliDuraklar);
    } catch (err) {
      console.error("Hata:", err.message);
    }
  };

  const toplamKm = rotalar.reduce((sum, r) => sum + (r.toplam_km || 0), 0);
  const toplamMaliyet = rotalar.reduce(
    (sum, r) => sum + (r.toplam_maliyet || 0),
    0
  );

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={{ color: "#4caf50", margin: 0 }}>
            📊 Operasyon Analiz Raporu
          </h2>
          <p style={{ color: "#888", fontSize: "0.9rem" }}>
            Günlük performans ve adım adım rota takibi
          </p>
        </div>
        <div style={styles.dateBox}>
          <input
            type="date"
            value={seciliTarih}
            onChange={(e) => setSeciliTarih(e.target.value)}
            style={styles.dateInput}
          />
        </div>
      </div>

      <div style={styles.statsContainer}>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>🚚</div>
          <div>
            <div style={styles.statValue}>{rotalar.length}</div>
            <div style={styles.statLabel}>Aktif Rota</div>
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>📏</div>
          <div>
            <div style={styles.statValue}>{toplamKm.toFixed(1)} km</div>
            <div style={styles.statLabel}>Toplam Mesafe</div>
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>💰</div>
          <div>
            <div style={styles.statValue}>₺{toplamMaliyet.toFixed(2)}</div>
            <div style={styles.statLabel}>Toplam Maliyet</div>
          </div>
        </div>
      </div>

      <div style={styles.mainLayout}>
        <div style={styles.sidebar}>
          <h3 style={styles.sectionTitle}>🚚 Araç Rotaları</h3>
          {loading ? (
            <div style={styles.loadingBox}>
              <div style={styles.spinner}></div>
            </div>
          ) : (
            rotalar.map((r) => (
              <div
                key={r.id}
                onClick={() => rotaDetayGetir(r)}
                style={{
                  ...styles.routeCard,
                  borderLeft:
                    seciliRota?.id === r.id
                      ? "4px solid #4caf50"
                      : "4px solid #333",
                  background: seciliRota?.id === r.id ? "#252525" : "#1a1a1a",
                }}
              >
                <div style={{ fontWeight: "bold" }}>{r.arac_isim}</div>
                <div style={styles.cardStats}>
                  <span>📏 {r.toplam_km} km</span>
                  <span style={{ color: "#4caf50", fontWeight: "bold" }}>
                    💰 ₺{r.toplam_maliyet}
                  </span>
                </div>

                {/* SOL PANEL SIRALAMA LİSTESİ */}
                {seciliRota?.id === r.id && (
                  <div
                    style={{
                      marginTop: "15px",
                      borderTop: "1px solid #333",
                      paddingTop: "10px",
                    }}
                  >
                    {durakNoktalari.map((d, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          gap: "8px",
                          marginBottom: "4px",
                          fontSize: "0.75rem",
                          color: "#ccc",
                        }}
                      >
                        <span style={{ color: "#4caf50", fontWeight: "bold" }}>
                          {i + 1}.
                        </span>
                        <span>{d.isim}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div style={styles.content}>
          {seciliRota ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                gap: "20px",
              }}
            >
              <div style={styles.rotaBanner}>
                <h3 style={{ margin: 0, color: "#fff" }}>
                  {seciliRota.arac_isim} - Yol Haritası
                </h3>
                <div style={{ color: "#4caf50", fontSize: "1.5rem" }}>🚛</div>
              </div>

              <div style={styles.mapWrapper}>
                <MapContainer
                  center={[40.76, 29.95]}
                  zoom={11}
                  style={{ height: "100%", width: "100%" }}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <RecenterMap coords={seciliRota.cizim_koordinatlari} />

                  {seciliRota.cizim_koordinatlari?.length > 0 && (
                    <>
                      <Polyline
                        positions={
    seciliRota.cizim_koordinatlari && seciliRota.cizim_koordinatlari.length > 1
      ? (seciliRota.cizim_koordinatlari[0][0] === seciliRota.cizim_koordinatlari[seciliRota.cizim_koordinatlari.length - 1][0] 
          ? seciliRota.cizim_koordinatlari.slice(0, -1) // Eğer baş ve son aynıysa sonuncuyu at
          : seciliRota.cizim_koordinatlari) 
      : []
  }
  color="#4caf50"
  weight={6}
  opacity={0.8}
                      />

                      {/* Numaralı durakları basan map döngüsü aynı kalıyor */}
                      {durakNoktalari.map((d, index) => (
                        <Marker
                          key={index}
                          position={d.coords}
                          icon={createNumberedIcon(
                            index + 1,
                            index === durakNoktalari.length - 1
                          )}
                        >
                          <Popup>
                            <b>{index + 1}. Durak:</b> {d.isim}
                          </Popup>
                        </Marker>
                      ))}
                    </>
                  )}
                </MapContainer>
              </div>

              <div style={styles.tableWrapper}>
                <h3 style={styles.sectionTitle}>📦 Kargo Sahipleri</h3>
                <div style={{ overflowY: "auto", maxHeight: "250px" }}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Gönderen</th>
                        <th style={styles.th}>İstasyon</th>
                        <th style={styles.th}>Ağırlık</th>
                        <th style={styles.th}>İletişim</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rotaKargolari.map((k) => (
                        <tr key={k.id} style={styles.tr}>
                          <td style={styles.td}>
                            <b>
                              {k.gonderen?.first_name} {k.gonderen?.last_name}
                            </b>
                          </td>
                          <td style={styles.td}>{k.istasyon?.isim}</td>
                          <td style={styles.td}>
                            <span style={styles.weightBadge}>
                              {k.agirlik_kg} kg
                            </span>
                          </td>
                          <td style={styles.td}>
                            <small style={{ color: "#888" }}>
                              {k.gonderen?.email}
                            </small>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div style={styles.emptyState}>
              🗺️
              <br />
              Detaylar için bir rota seçin
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
