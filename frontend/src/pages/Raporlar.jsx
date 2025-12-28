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

// ============================================
// HARITA YÖNETİMİ
// ============================================

// Harita odağını ve boyutunu anlık düzelten bileşen
function RecenterMap({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords && coords.length > 0) {
      // İlk koordinatı merkez al
      const bounds = L.latLngBounds(coords);
      map.fitBounds(bounds, { padding: [50, 50] });
      
      // Haritanın kaybolmasını engelleyen kritik komut
      setTimeout(() => map.invalidateSize(), 100);
    }
  }, [coords, map]);
  return null;
}

// Numaralı Durak İkonu Oluşturucu
const createNumberedIcon = (number, isLast = false, isFirst = false) => {
  const bgColor = isLast ? "#e74c3c" : isFirst ? "#3498db" : "#4caf50";
  const label = isLast ? "🏫" : isFirst ? "🏁" : number;
  
  return L.divIcon({
    html: `
      <div style="
        background: ${bgColor};
        color: white; 
        width: 32px; 
        height: 32px; 
        border-radius: 50%;
        display: flex; 
        align-items: center; 
        justify-content: center;
        font-weight: bold; 
        font-size: ${isLast || isFirst ? "16px" : "14px"};
        border: 3px solid white; 
        box-shadow: 0 3px 8px rgba(0,0,0,0.5);">
        ${label}
      </div>`,
    className: "",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

// ============================================
// ANA COMPONENT
// ============================================

export default function Raporlar() {
  // State yönetimi
  const [seciliTarih, setSeciliTarih] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [rotalar, setRotalar] = useState([]);
  const [seciliRota, setSeciliRota] = useState(null);
  const [rotaKargolari, setRotaKargolari] = useState([]);
  const [rotaDetaylari, setRotaDetaylari] = useState([]);
  const [loading, setLoading] = useState(false);
  const [durakNoktalari, setDurakNoktalari] = useState([]);
  const [istatistikler, setIstatistikler] = useState(null);
  const [istasyonlar, setIstasyonlar] = useState([]);

  // İlk yükleme ve tarih değişiminde rotaları getir
  useEffect(() => {
    rotaOzetleriniGetir();
    istasyonlariGetir();
  }, [seciliTarih]);

  // ============================================
  // VERİ GETİRME FONKSİYONLARI
  // ============================================

  // İstasyonları getir (harita için koordinatlar)
  const istasyonlariGetir = async () => {
    try {
      const { data, error } = await supabase
        .from("istasyonlar")
        .select("*")
        .eq("aktif", true);
      
      if (error) throw error;
      setIstasyonlar(data || []);
    } catch (err) {
      console.error("İstasyon hatası:", err.message);
    }
  };

  // Rota özetlerini getir
  const rotaOzetleriniGetir = async () => {
    setLoading(true);
    setSeciliRota(null);
    setRotaKargolari([]);
    setRotaDetaylari([]);
    
    try {
      // Rotaları getir
      const { data: rotaData, error: rotaError } = await supabase
        .from("rota_ozetleri")
        .select("*")
        .eq("planlanan_tarih", seciliTarih)
        .order("olusturma_tarihi", { ascending: false });
      
      if (rotaError) throw rotaError;
      setRotalar(rotaData || []);

      // İstatistikleri hesapla
      if (rotaData && rotaData.length > 0) {
        const stats = {
          toplam_rota: rotaData.length,
          toplam_km: rotaData.reduce((sum, r) => sum + (r.toplam_km || 0), 0),
          toplam_maliyet: rotaData.reduce((sum, r) => sum + (r.toplam_maliyet || 0), 0),
          ortalama_km: 0,
          ortalama_maliyet: 0,
        };
        
        stats.ortalama_km = stats.toplam_km / stats.toplam_rota;
        stats.ortalama_maliyet = stats.toplam_maliyet / stats.toplam_rota;
        
        setIstatistikler(stats);
      } else {
        setIstatistikler(null);
      }
      
    } catch (err) {
      console.error("Rota getirme hatası:", err.message);
    } finally {
      setLoading(false);
    }
  };

  // Rota detaylarını getir
  const rotaDetayGetir = async (rota) => {
    setSeciliRota(rota);
    setRotaKargolari([]);
    setRotaDetaylari([]);
    setDurakNoktalari([]);
    
    try {
      // 1. Kargo bilgilerini getir
      const { data: kargoData, error: kargoError } = await supabase
        .from("kargolar")
        .select(`
          *,
          istasyon:istasyonlar!cikis_istasyon_id (id, isim, lat, lon),
          gonderen:users!gonderen_id (first_name, last_name, email)
        `)
        .eq("planlanan_tarih", seciliTarih)
        .eq("arac_id", rota.arac_id);

      if (kargoError) throw kargoError;
      setRotaKargolari(kargoData || []);

      // 2. Rota detaylarını getir (durak sırası için)
      const { data: detayData, error: detayError } = await supabase
        .from("rota_detaylari")
        .select(`
          *,
          istasyon:istasyonlar!istasyon_id (id, isim, lat, lon)
        `)
        .eq("rota_oz_id", rota.id)
        .order("sira", { ascending: true });

      if (detayError) throw detayError;
      setRotaDetaylari(detayData || []);

      // 3. Durak noktalarını hazırla
      if (detayData && detayData.length > 0) {
        const duraklar = detayData.map((d, index) => ({
          sira: d.sira,
          isim: d.istasyon.isim,
          coords: [d.istasyon.lat, d.istasyon.lon],
          mesafe_onceki: d.mesafe_onceki_km,
          yuklu_kargo_kg: d.yuklu_kargo_kg,
          kalan_kapasite_kg: d.kalan_kapasite_kg,
          tahmini_varis: d.tahmini_varis_saati,
          isFirst: index === 0,
          isLast: index === detayData.length - 1
        }));
        
        setDurakNoktalari(duraklar);
      }

    } catch (err) {
      console.error("Detay getirme hatası:", err.message);
    }
  };

  // ============================================
  // YARDIMCI FONKSİYONLAR
  // ============================================

  const formatTarih = (tarihStr) => {
    if (!tarihStr) return "-";
    const tarih = new Date(tarihStr);
    return tarih.toLocaleTimeString("tr-TR", { 
      hour: "2-digit", 
      minute: "2-digit" 
    });
  };

  const getDurumRenk = (durum) => {
    const renkler = {
      "Beklemede": "#f39c12",
      "Planlandı": "#3498db",
      "Yola Çıktı": "#9b59b6",
      "Teslim Edildi": "#27ae60",
      "İptal": "#e74c3c",
      "Reddedildi": "#95a5a6"
    };
    return renkler[durum] || "#888";
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div style={styles.container}>
      {/* HEADER */}
      <div style={styles.header}>
        <div>
          <h2 style={{ color: "#4caf50", margin: 0 }}>
            📊 Operasyon Analiz Raporu
          </h2>
          <p style={{ color: "#888", fontSize: "0.9rem", marginTop: "5px" }}>
            Günlük performans ve adım adım rota takibi
          </p>
        </div>
        <div style={styles.dateBox}>
          <label style={{ marginRight: "10px", color: "#ccc" }}>📅 Tarih:</label>
          <input
            type="date"
            value={seciliTarih}
            onChange={(e) => setSeciliTarih(e.target.value)}
            style={styles.dateInput}
          />
          <button 
            onClick={rotaOzetleriniGetir}
            style={{
              marginLeft: "10px",
              padding: "8px 15px",
              background: "#4caf50",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "0.9rem"
            }}
          >
            🔄 Yenile
          </button>
        </div>
      </div>

      {/* İSTATİSTİK KARTLARI */}
      <div style={styles.statsContainer}>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>🚚</div>
          <div>
            <div style={styles.statValue}>
              {istatistikler?.toplam_rota || 0}
            </div>
            <div style={styles.statLabel}>Aktif Rota</div>
          </div>
        </div>
        
        <div style={styles.statCard}>
          <div style={styles.statIcon}>📍</div>
          <div>
            <div style={styles.statValue}>
              {istatistikler?.toplam_km.toFixed(1) || "0.0"} km
            </div>
            <div style={styles.statLabel}>Toplam Mesafe</div>
          </div>
        </div>
        
        <div style={styles.statCard}>
          <div style={styles.statIcon}>💰</div>
          <div>
            <div style={styles.statValue}>
              ₺{istatistikler?.toplam_maliyet.toFixed(2) || "0.00"}
            </div>
            <div style={styles.statLabel}>Toplam Maliyet</div>
          </div>
        </div>
        
        <div style={styles.statCard}>
          <div style={styles.statIcon}>📊</div>
          <div>
            <div style={styles.statValue}>
              {istatistikler?.ortalama_km.toFixed(1) || "0.0"} km
            </div>
            <div style={styles.statLabel}>Ort. Rota Mesafesi</div>
          </div>
        </div>
      </div>

      {/* ANA İÇERİK - SIDEBAR + MAP */}
      <div style={styles.mainLayout}>
        {/* SOL SIDEBAR - ROTA LİSTESİ */}
        <div style={styles.sidebar}>
          <h3 style={styles.sectionTitle}>🚚 Araç Rotaları</h3>
          
          {loading ? (
            <div style={styles.loadingBox}>
              <div style={styles.spinner}></div>
              <p style={{ color: "#888", marginTop: "10px" }}>Yükleniyor...</p>
            </div>
          ) : rotalar.length === 0 ? (
            <div style={styles.emptyBox}>
              <p style={{ color: "#888" }}>
                📭 {seciliTarih} tarihinde rota bulunamadı
              </p>
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
                  cursor: "pointer",
                  transition: "all 0.3s ease"
                }}
                onMouseEnter={(e) => {
                  if (seciliRota?.id !== r.id) {
                    e.currentTarget.style.background = "#222";
                  }
                }}
                onMouseLeave={(e) => {
                  if (seciliRota?.id !== r.id) {
                    e.currentTarget.style.background = "#1a1a1a";
                  }
                }}
              >
                <div style={{ 
                  fontWeight: "bold", 
                  fontSize: "1.1rem",
                  marginBottom: "8px"
                }}>
                  {r.arac_isim}
                </div>
                
                <div style={styles.cardStats}>
                  <span>📍 {r.toplam_km.toFixed(1)} km</span>
                  <span style={{ color: "#4caf50", fontWeight: "bold" }}>
                    💰 ₺{r.toplam_maliyet.toFixed(2)}
                  </span>
                </div>

                {/* DURAK LİSTESİ (Seçili rotada) */}
                {seciliRota?.id === r.id && durakNoktalari.length > 0 && (
                  <div
                    style={{
                      marginTop: "15px",
                      borderTop: "1px solid #333",
                      paddingTop: "10px",
                    }}
                  >
                    <div style={{ 
                      fontSize: "0.85rem", 
                      color: "#4caf50", 
                      marginBottom: "8px",
                      fontWeight: "bold"
                    }}>
                      🗺️ Durak Sırası:
                    </div>
                    
                    {durakNoktalari.map((d, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          marginBottom: "6px",
                          fontSize: "0.8rem",
                          padding: "6px",
                          borderRadius: "4px",
                          background: d.isLast ? "#2c1f1f" : d.isFirst ? "#1f2c3a" : "#1f1f1f"
                        }}
                      >
                        <span style={{ 
                          color: d.isLast ? "#e74c3c" : d.isFirst ? "#3498db" : "#4caf50",
                          fontWeight: "bold",
                          minWidth: "20px"
                        }}>
                          {d.isFirst ? "🏁" : d.isLast ? "🏫" : `${i}.`}
                        </span>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: "#fff" }}>{d.isim}</div>
                          {d.mesafe_onceki > 0 && (
                            <div style={{ color: "#888", fontSize: "0.7rem" }}>
                              ↗️ {d.mesafe_onceki.toFixed(1)} km
                            </div>
                          )}
                        </div>
                        <div style={{ 
                          fontSize: "0.7rem", 
                          color: "#888",
                          textAlign: "right"
                        }}>
                          {d.yuklu_kargo_kg > 0 && (
                            <div>📦 {d.yuklu_kargo_kg.toFixed(0)} kg</div>
                          )}
                          {formatTarih(d.tahmini_varis)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* SAĞ İÇERİK - HARITA VE DETAYLAR */}
        <div style={styles.content}>
          {seciliRota ? (
            <div style={{ 
              display: "flex", 
              flexDirection: "column", 
              height: "100%", 
              gap: "20px" 
            }}>
              {/* ROTA BANNER */}
              <div style={styles.rotaBanner}>
                <div>
                  <h3 style={{ margin: 0, color: "#fff" }}>
                    {seciliRota.arac_isim} - Yol Haritası
                  </h3>
                  <p style={{ 
                    margin: "5px 0 0 0", 
                    color: "#ccc", 
                    fontSize: "0.85rem" 
                  }}>
                    {durakNoktalari.length} durak • {seciliRota.toplam_km.toFixed(1)} km • 
                    ₺{seciliRota.toplam_maliyet.toFixed(2)}
                  </p>
                </div>
                <div style={{ color: "#4caf50", fontSize: "2rem" }}>🚛</div>
              </div>

              {/* HARİTA */}
              <div style={styles.mapWrapper}>
                <MapContainer
                  center={[40.76, 29.95]}
                  zoom={11}
                  style={{ height: "100%", width: "100%", borderRadius: "12px" }}
                >
                  <TileLayer 
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  />
                  
                  {durakNoktalari.length > 0 && (
                    <RecenterMap coords={durakNoktalari.map(d => d.coords)} />
                  )}

                  {/* ROTA ÇİZGİSİ */}
                  {seciliRota.cizim_koordinatlari?.length > 1 && (
                    <Polyline
                      positions={seciliRota.cizim_koordinatlari}
                      color="#4caf50"
                      weight={5}
                      opacity={0.8}
                    />
                  )}

                  {/* DURAK MARKERLAR */}
                  {durakNoktalari.map((d, index) => (
                    <Marker
                      key={index}
                      position={d.coords}
                      icon={createNumberedIcon(
                        d.sira,
                        d.isLast,
                        d.isFirst
                      )}
                    >
                      <Popup>
                        <div style={{ minWidth: "200px" }}>
                          <b style={{ fontSize: "1.1rem" }}>
                            {d.isFirst ? "🏁 Başlangıç" : d.isLast ? "🏫 KOÜ" : `${d.sira}. Durak`}
                          </b>
                          <div style={{ marginTop: "8px" }}>
                            <div><b>📍 İstasyon:</b> {d.isim}</div>
                            {d.mesafe_onceki > 0 && (
                              <div><b>📏 Mesafe:</b> {d.mesafe_onceki.toFixed(1)} km</div>
                            )}
                            {d.yuklu_kargo_kg > 0 && (
                              <div><b>📦 Yük:</b> {d.yuklu_kargo_kg.toFixed(0)} kg</div>
                            )}
                            {d.kalan_kapasite_kg !== undefined && (
                              <div><b>💼 Kalan:</b> {d.kalan_kapasite_kg.toFixed(0)} kg</div>
                            )}
                            {d.tahmini_varis && (
                              <div><b>🕐 Varış:</b> {formatTarih(d.tahmini_varis)}</div>
                            )}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>

              {/* KARGO SAHİPLERİ TABLOSU */}
              <div style={styles.tableWrapper}>
                <h3 style={styles.sectionTitle}>
                  📦 Kargo Sahipleri ({rotaKargolari.length} adet)
                </h3>
                <div style={{ overflowY: "auto", maxHeight: "300px" }}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Gönderen</th>
                        <th style={styles.th}>İstasyon</th>
                        <th style={styles.th}>Ağırlık</th>
                        <th style={styles.th}>Durum</th>
                        <th style={styles.th}>İletişim</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rotaKargolari.length === 0 ? (
                        <tr>
                          <td colSpan="5" style={{ 
                            ...styles.td, 
                            textAlign: "center",
                            color: "#888" 
                          }}>
                            Kargo bilgisi bulunamadı
                          </td>
                        </tr>
                      ) : (
                        rotaKargolari.map((k) => (
                          <tr key={k.id} style={styles.tr}>
                            <td style={styles.td}>
                              <b>
                                {k.gonderen?.first_name} {k.gonderen?.last_name}
                              </b>
                            </td>
                            <td style={styles.td}>
                              📍 {k.istasyon?.isim}
                            </td>
                            <td style={styles.td}>
                              <span style={styles.weightBadge}>
                                {k.agirlik_kg} kg
                              </span>
                            </td>
                            <td style={styles.td}>
                              <span style={{
                                padding: "4px 8px",
                                borderRadius: "4px",
                                fontSize: "0.75rem",
                                fontWeight: "bold",
                                background: getDurumRenk(k.durum) + "33",
                                color: getDurumRenk(k.durum)
                              }}>
                                {k.durum}
                              </span>
                            </td>
                            <td style={styles.td}>
                              <small style={{ color: "#888" }}>
                                {k.gonderen?.email}
                              </small>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div style={styles.emptyState}>
              🗺️
              <br />
              <h3 style={{ color: "#ccc", marginTop: "20px" }}>
                Detaylar için bir rota seçin
              </h3>
              <p style={{ color: "#888", fontSize: "0.9rem" }}>
                Sol panelden bir araç rotası seçerek harita ve detayları görüntüleyin
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}