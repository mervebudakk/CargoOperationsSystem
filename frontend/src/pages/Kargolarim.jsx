import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { MapContainer, TileLayer, Marker, Polyline, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const createNumberIcon = (number, isUserCargo = false) => {
  const bgColor = isUserCargo ? "#f39c12" : "#4caf50";
  return L.divIcon({
    className: 'custom-number-icon',
    html: `<div style="
      background: ${bgColor};
      color: white;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 14px;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    ">${number}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
};

function Kargolarim({ userId }) {
  const [kargolar, setKargolar] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [seciliRota, setSeciliRota] = useState(null);
  const [rotaDetaylari, setRotaDetaylari] = useState([]);
  const [modalAcik, setModalAcik] = useState(false);

  useEffect(() => {
    const fetchMyCargos = async () => {
      if (!userId) return;
      
      setYukleniyor(true);
      try {
        const { data, error } = await supabase
          .from("kargolar")
          .select(`
            id,
            agirlik_kg,
            adet,
            durum,
            olusturma_tarihi,
            arac_id,
            planlanan_tarih,
            istasyonlar!cikis_istasyon_id (id, isim)
          `)
          .eq("gonderen_id", userId)
          .order("olusturma_tarihi", { ascending: false });

        if (error) throw error;
        setKargolar(data || []);
      } catch (err) {
        console.error("Kargolar çekilemedi:", err.message);
      } finally {
        setYukleniyor(false);
      }
    };

    fetchMyCargos();
  }, [userId]);

  const getDurumRenk = (durum) => {
    switch (durum) {
      case "Beklemede": return "#ff9800"; 
      case "Planlandı": return "#2196f3";   
      case "Yola Çıktı": return "#9c27b0";  
      case "Teslim Edildi": return "#4caf50"; 
      default: return "#aaa";
    }
  };

  const rotayiGoster = async (kargo) => {
    if (!kargo.arac_id || !kargo.planlanan_tarih) {
      alert("Bu kargo henüz bir rotaya atanmamış.");
      return;
    }

    try {
      const { data: rotaData, error: rotaError } = await supabase
        .from("rota_ozetleri")
        .select("*")
        .eq("arac_id", kargo.arac_id)
        .eq("planlanan_tarih", kargo.planlanan_tarih)
        .single();

      if (rotaError) throw rotaError;

      const { data: detayData, error: detayError } = await supabase
        .from("rota_detaylari")
        .select(`
          *,
          istasyonlar (id, isim, lat, lon)
        `)
        .eq("rota_oz_id", rotaData.id)
        .order("sira");

      if (detayError) throw detayError;

      setSeciliRota({ ...rotaData, userCargoStationId: kargo.istasyonlar.id });
      setRotaDetaylari(detayData || []);
      setModalAcik(true);
    } catch (err) {
      console.error("Rota bilgisi alınamadı:", err);
      alert("Rota bilgisi yüklenirken hata oluştu.");
    }
  };

  return (
    <div style={containerStyle}>
      <div style={headerContainerStyle}>
        <h2 style={{ color: "#2196F3", margin: 0 }}>📦 Gönderdiğim Kargolar</h2>
        <span style={countBadgeStyle}>{kargolar.length} Toplam Kayıt</span>
      </div>

      {yukleniyor ? (
        <div style={messageBoxStyle}>
          <p style={{ color: "#888" }}>Kargo geçmişiniz yükleniyor...</p>
        </div>
      ) : kargolar.length === 0 ? (
        <div style={messageBoxStyle}>
          <p style={{ color: "#aaa" }}>Henüz bir kargo gönderimi yapmadınız.</p>
        </div>
      ) : (
        <div style={tableContainer}>
          <table style={tableStyle}>
            <thead>
              <tr style={headerStyle}>
                <th style={thStyle}>Kalkış İlçesi</th>
                <th style={thStyle}>Ağırlık</th>
                <th style={thStyle}>Adet</th>
                <th style={thStyle}>Durum</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Kayıt Tarihi</th>
                <th style={{ ...thStyle, textAlign: "center" }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {kargolar.map((kargo) => (
                <tr key={kargo.id} style={rowStyle}>
                  <td style={tdStyle}>
                    📍 {kargo.istasyonlar?.isim || "Belirlenmedi"}
                  </td>
                  <td style={tdStyle}>{kargo.agirlik_kg} kg</td>
                  <td style={tdStyle}>{kargo.adet} Adet</td>
                  <td style={tdStyle}>
                    <span style={{ 
                      padding: "5px 12px", 
                      borderRadius: "6px", 
                      fontSize: "11px", 
                      fontWeight: "bold",
                      background: `${getDurumRenk(kargo.durum)}22`, 
                      color: getDurumRenk(kargo.durum),
                      border: `1px solid ${getDurumRenk(kargo.durum)}55`
                    }}>
                      {kargo.durum.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right", color: "#888" }}>
                    {new Date(kargo.olusturma_tarihi).toLocaleDateString("tr-TR")}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    {(kargo.durum === "Planlandı" || kargo.durum === "Yola Çıktı") && (
                      <button
                        onClick={() => rotayiGoster(kargo)}
                        style={{
                          background: "#2196f3",
                          color: "white",
                          border: "none",
                          padding: "6px 12px",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "11px",
                          fontWeight: "bold"
                        }}
                      >
                        🗺️ Rotayı Gör
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalAcik && seciliRota && (
        <div style={modalOverlayStyle} onClick={() => setModalAcik(false)}>
          <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <h3 style={{ margin: 0, color: "#2196f3" }}>
                🚚 {seciliRota.arac_isim} - Rota Detayları
              </h3>
              <button onClick={() => setModalAcik(false)} style={closeButtonStyle}>
                ✕
              </button>
            </div>
            <div style={modalBodyStyle}>
              <div style={{ marginBottom: "15px", padding: "12px", background: "#1a1a1a", borderRadius: "8px" }}>
                <p style={{ margin: "5px 0", color: "#aaa" }}>
                  📅 Tarih: <strong style={{ color: "#fff" }}>{seciliRota.planlanan_tarih}</strong>
                </p>
                <p style={{ margin: "5px 0", color: "#aaa" }}>
                  📏 Toplam Mesafe: <strong style={{ color: "#4caf50" }}>{seciliRota.toplam_km} km</strong>
                </p>
                <p style={{ margin: "5px 0", color: "#aaa" }}>
                  💰 Maliyet: <strong style={{ color: "#f39c12" }}>{seciliRota.toplam_maliyet} ₺</strong>
                </p>
              </div>
              <div style={{ height: "400px", borderRadius: "8px", overflow: "hidden" }}>
                <MapContainer
                  center={[40.76, 29.95]}
                  zoom={10}
                  style={{ height: "100%", width: "100%" }}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  
                  {seciliRota.cizim_koordinatlari?.length > 1 && (
                    <Polyline
                      positions={seciliRota.cizim_koordinatlari}
                      color="#2196f3"
                      weight={4}
                    />
                  )}

                  {rotaDetaylari.map((detay, index) => {
                    const isUserCargo = detay.istasyonlar?.id === seciliRota.userCargoStationId;
                    return (
                      <Marker
                        key={index}
                        position={[detay.istasyonlar.lat, detay.istasyonlar.lon]}
                        icon={createNumberIcon(detay.sira, isUserCargo)}
                      >
                        <Popup>
                          <div style={{ color: "#000" }}>
                            <strong>{detay.sira}. {detay.istasyonlar.isim}</strong>
                            {isUserCargo && <div style={{ color: "#f39c12", fontWeight: "bold" }}>📦 Kargonuz burada!</div>}
                            <div>Yük: {detay.yuklu_kargo_kg} kg</div>
                            <div>Mesafe: {detay.mesafe_onceki_km} km</div>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </MapContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const containerStyle = { padding: "30px", background: "#0a0a0a", minHeight: "100vh" };
const headerContainerStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "25px" };
const countBadgeStyle = { background: "#1a1a1a", color: "#666", padding: "5px 12px", borderRadius: "20px", fontSize: "0.8rem", border: "1px solid #333" };
const tableContainer = { overflowX: "auto", background: "#141414", borderRadius: "12px", padding: "10px", border: "1px solid #222" };
const tableStyle = { width: "100%", borderCollapse: "collapse", color: "#e0e0e0", textAlign: "left" };
const headerStyle = { borderBottom: "1px solid #333" };
const thStyle = { padding: "15px", color: "#2196F3", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "1px" };
const tdStyle = { padding: "18px 15px", borderBottom: "1px solid #1a1a1a", fontSize: "0.95rem" };
const rowStyle = { transition: "background 0.2s" };
const messageBoxStyle = { textAlign: "center", padding: "100px 20px", background: "#141414", borderRadius: "12px", border: "2px dashed #222" };

const modalOverlayStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(0, 0, 0, 0.85)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000
};

const modalContentStyle = {
  background: "#141414",
  borderRadius: "12px",
  width: "90%",
  maxWidth: "800px",
  maxHeight: "90vh",
  overflow: "auto",
  border: "1px solid #333"
};

const modalHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "20px",
  borderBottom: "1px solid #333"
};

const modalBodyStyle = {
  padding: "20px"
};

const closeButtonStyle = {
  background: "#e74c3c",
  color: "white",
  border: "none",
  borderRadius: "50%",
  width: "32px",
  height: "32px",
  cursor: "pointer",
  fontSize: "18px",
  fontWeight: "bold"
};

export default Kargolarim;