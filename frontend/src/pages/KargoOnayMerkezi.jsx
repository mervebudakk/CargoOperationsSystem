import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { styles } from "../styles/KargoOnayMerkezi.styles";
import { routeService } from "../services/api"; // Yeni API servisi eklendi

export default function KargoOnayMerkezi() {
  const [kargolar, setKargolar] = useState([]);
  const [tab, setTab] = useState("onay_bekleyen");
  const [seciliTarih, setSeciliTarih] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [loading, setLoading] = useState(false);
  const [seciliKargolar, setSeciliKargolar] = useState(new Set());
  const [operasyonModu, setOperasyonModu] = useState("sinirsiz_arac"); // Backend değerleriyle eşitledik

  // --- 1. OTOMATİK YOLA ÇIKIŞ KONTROLÜ ---
  const otomatikYolaCikar = async () => {
    const bugun = new Date().toISOString().split('T')[0];
    const suAn = new Date();
    
    if (suAn.getHours() >= 8) {
      const { data, error } = await supabase
        .from("kargolar")
        .update({ durum: "Yola Çıktı" })
        .eq("durum", "Planlandı")
        .lt("planlanan_tarih", bugun) 
        .select();

      if (!error && data && data.length > 0) {
        console.log(`✅ Geçmişe dönük ${data.length} kargo yola çıktı.`);
        verileriGetir();
      }
    }
  };

  useEffect(() => {
    const baslat = async () => {
      await otomatikYolaCikar();
      await verileriGetir();
    };
    baslat();
  }, [tab, seciliTarih]);

  const verileriGetir = async () => {
    setLoading(true);
    try {
      let query = supabase.from("kargolar").select(`
          *,
          gonderen:users!gonderen_id (email, first_name, last_name),
          istasyon:istasyonlar!cikis_istasyon_id (isim)
        `);

      if (tab === "onay_bekleyen") {
        query = query.eq("durum", "Beklemede");
      } else {
        query = query
          .eq("durum", tab === "planlanan" ? "Planlandı" : "Yola Çıktı")
          .eq("planlanan_tarih", seciliTarih);
      }

      const { data, error } = await query;
      if (error) throw error;
      setKargolar(data || []);
      setSeciliKargolar(new Set());
    } catch (err) {
      console.error("Veri hatası:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const planIptalEt = async (id) => {
    if (!window.confirm("⚠️ Bu kargonun planlamasını iptal edip onay havuzuna geri göndermek istiyor musunuz?")) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("kargolar")
        .update({ durum: "Beklemede", arac_id: null, planlanan_tarih: null })
        .eq("id", id);

      if (error) throw error;
      alert("✅ Planlama iptal edildi.");
      verileriGetir();
    } catch (err) {
      alert("Hata: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- 2. GÜNCELLENMİŞ ROTA HESAPLAMA (FastAPI Entegrasyonu) ---
  const rotaHesapla = async (isReplan = false) => {
    if (!isReplan && seciliKargolar.size === 0)
      return alert("⚠️ Lütfen kargo seçin!");

    setLoading(true);
    try {
      // Backend Pydantic modeline uygun veri hazırlama
      const planRequest = {
        tarih: seciliTarih,
        problem_tipi: operasyonModu, // "sinirsiz_arac" veya "belirli_arac"
        kargo_ids: isReplan ? null : Array.from(seciliKargolar)
      };

      // routeService üzerinden FastAPI çağrısı
      const result = await routeService.planRoute(planRequest);
      
      if (!result.basarili) throw new Error(result.mesaj || "Hesaplama hatası");

      // Rota özetlerini Supabase'e kaydetme (Backend'den gelen yeni yapıya göre)
      for (const rota of result.rotalar) {
        const { error: summaryError } = await supabase.from("rota_ozetleri").upsert([
          {
            planlanan_tarih: seciliTarih,
            arac_id: rota.arac_id.toString(),
            arac_isim: rota.arac_isim,
            toplam_km: rota.toplam_km,
            toplam_maliyet: rota.maliyet,
            cizim_koordinatlari: rota.cizim_koordinatlari,
            duraklar: rota.duraklar.map(d => d.istasyon_isim), // Eski yapı uyumu için isim listesi
          },
        ]);
        if (summaryError) throw summaryError;

        // Kargo durumlarını güncelleme
        const istasyonIsimleri = rota.duraklar.map(d => d.istasyon_isim);
        
        const { error: kargoError } = await supabase
          .from("kargolar")
          .update({
            durum: "Planlandı",
            planlanan_tarih: seciliTarih,
            arac_id: rota.arac_id.toString(),
          })
          .in("id", kargolar
            .filter(k => (isReplan || seciliKargolar.has(k.id)) && istasyonIsimleri.includes(k.istasyon.isim))
            .map(k => k.id)
          );

        if (kargoError) throw kargoError;
      }

      alert(`✅ Rota başarıyla planlandı! ${result.rotalar.length} araç görevlendirildi.`);
      verileriGetir();
    } catch (err) {
      alert("Hata: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleKargo = (id) => {
    const yeni = new Set(seciliKargolar);
    yeni.has(id) ? yeni.delete(id) : yeni.add(id);
    setSeciliKargolar(yeni);
  };

  const tumunuSec = () => {
    if (seciliKargolar.size === kargolar.length && kargolar.length > 0) {
      setSeciliKargolar(new Set());
    } else {
      setSeciliKargolar(new Set(kargolar.map((k) => k.id)));
    }
  };

  // Stats hesaplamaları
  const seciliToplamAgirlik = kargolar
    .filter((k) => seciliKargolar.has(k.id))
    .reduce((sum, k) => sum + k.agirlik_kg, 0);

  const kullanılanAraclar = [...new Set(kargolar.map((k) => k.arac_id).filter(Boolean))];
  const kiralikSayisi = kullanılanAraclar.filter((id) => id.toString().startsWith("KIRALIK")).length;
  const ozmalSayisi = kullanılanAraclar.length - kiralikSayisi;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>🚚 Kargo Operasyon Merkezi</h1>
          <p style={styles.subtitle}>Gerçek zamanlı kargo takip ve rota optimizasyonu</p>
        </div>
        <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
          <div style={styles.datePickerContainer}>
            <div style={styles.dateLabel}><span>⚙️ Operasyon Modu</span></div>
            <select value={operasyonModu} onChange={(e) => setOperasyonModu(e.target.value)} style={{ ...styles.dateInput, padding: "8px 12px", minWidth: "180px" }}>
              <option value="sinirsiz_arac">♾️ Sınırsız Araç (Kiralama)</option>
              <option value="belirli_arac">🚚 Belirli Sayıda Araç</option>
            </select>
          </div>
          <div style={styles.datePickerContainer}>
            <div style={styles.dateLabel}><span>📅 Operasyon Tarihi</span></div>
            <input type="date" value={seciliTarih} onChange={(e) => setSeciliTarih(e.target.value)} style={styles.dateInput} />
          </div>
        </div>
      </div>

      {tab === "onay_bekleyen" && kargolar.length > 0 && (
        <div style={styles.statsBar}>
          <div style={styles.statCard}><span>📦</span><div><div style={styles.statValue}>{kargolar.length}</div><div style={styles.statLabel}>Havuzdaki Kargo</div></div></div>
          <div style={styles.statCard}><span>✅</span><div><div style={styles.statValue}>{seciliKargolar.size}</div><div style={styles.statLabel}>Seçili Kargo</div></div></div>
          <div style={styles.statCard}><span>⚖️</span><div><div style={styles.statValue}>{seciliToplamAgirlik.toFixed(1)} kg</div><div style={styles.statLabel}>Seçili Ağırlık</div></div></div>
          <button onClick={() => rotaHesapla(false)} disabled={seciliKargolar.size === 0 || loading} style={{ ...styles.primaryButton, opacity: seciliKargolar.size === 0 ? 0.5 : 1 }}>
            {loading ? "⏳ İşleniyor..." : `🚀 Planla (${seciliKargolar.size})`}
          </button>
        </div>
      )}

      {tab === "planlanan" && kargolar.length > 0 && (
        <div style={styles.statsBar}>
          <div style={styles.statCard}><span>🏢</span><div><div style={styles.statValue}>{ozmalSayisi}</div><div style={styles.statLabel}>Özmal Araç</div></div></div>
          <div style={styles.statCard}><span>🤝</span><div><div style={{ ...styles.statValue, color: "#f39c12" }}>{kiralikSayisi}</div><div style={styles.statLabel}>Kiralık Araç</div></div></div>
          <div style={styles.statCard}><span>⚖️</span><div><div style={styles.statValue}>{kargolar.reduce((s, k) => s + k.agirlik_kg, 0).toFixed(1)} kg</div><div style={styles.statLabel}>Toplam Yük</div></div></div>
          <button onClick={() => rotaHesapla(true)} style={styles.secondaryButton}>🔄 Yeniden Hesapla</button>
        </div>
      )}

      <div style={styles.tabContainer}>
        <button onClick={() => setTab("onay_bekleyen")} style={tab === "onay_bekleyen" ? styles.activeTab : styles.inactiveTab}>
          <span>⏳ Onay Bekleyenler</span>
          <span style={styles.badge}>{tab === "onay_bekleyen" ? kargolar.length : "..."}</span>
        </button>
        <button onClick={() => setTab("planlanan")} style={tab === "planlanan" ? styles.activeTab : styles.inactiveTab}>📋 Planlananlar</button>
        <button onClick={() => setTab("yola_cikan")} style={tab === "yola_cikan" ? styles.activeTab : styles.inactiveTab}>🚛 Yola Çıkanlar</button>
      </div>

      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              {tab === "onay_bekleyen" && (
                <th style={{ padding: "16px", width: "50px", textAlign: "center" }}>
                  <input type="checkbox" checked={seciliKargolar.size === kargolar.length && kargolar.length > 0} onChange={tumunuSec} style={{ accentColor: "#4caf50", cursor: "pointer" }} />
                </th>
              )}
              {tab === "planlanan" && <th style={{...styles.th, textAlign: "center"}}>İşlem</th>}
              <th style={styles.th}>Gönderen</th>
              <th style={styles.th}>Çıkış İstasyonu</th>
              <th style={{ ...styles.th, textAlign: "center" }}>Ağırlık</th>
              <th style={{ ...styles.th, textAlign: "center" }}>Varış</th>
              <th style={{ ...styles.th, textAlign: "center" }}>Kayıt</th>
              <th style={{ ...styles.th, textAlign: "center" }}>Durum</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" style={{ padding: "40px", textAlign: "center" }}>Yükleniyor...</td></tr>
            ) : (
              kargolar.map((k) => (
                <tr key={k.id} style={{ ...styles.tableRow, background: seciliKargolar.has(k.id) ? "rgba(76, 175, 80, 0.1)" : "transparent" }} onClick={() => tab === "onay_bekleyen" && toggleKargo(k.id)}>
                  {tab === "onay_bekleyen" && (
                    <td style={{ padding: "16px", textAlign: "center" }}>
                      <input type="checkbox" checked={seciliKargolar.has(k.id)} readOnly style={{ accentColor: "#4caf50" }} />
                    </td>
                  )}
                  {tab === "planlanan" && (
                    <td style={{...styles.td, textAlign: "center"}}>
                      <button onClick={(e) => { e.stopPropagation(); planIptalEt(k.id); }} style={{ background: "#e74c3c", color: "white", border: "none", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }}>
                        ❌ İptal Et
                      </button>
                    </td>
                  )}
                  <td style={styles.td}>
                    <div style={styles.senderName}>{k.gonderen?.first_name} {k.gonderen?.last_name}</div>
                    <div style={styles.senderEmail}>{k.gonderen?.email}</div>
                  </td>
                  <td style={styles.td}><div style={styles.stationBadge}>📍 {k.istasyon?.isim || k.cikis_istasyon_id}</div></td>
                  <td style={{...styles.td, textAlign: "center"}}><div style={styles.weightBadge}>{k.agirlik_kg} kg</div></td>
                  <td style={{...styles.td, textAlign: "center"}}><div style={styles.destinationBadge}>🎯 KOÜ</div></td>
                  <td style={{...styles.td, textAlign: "center"}}>{new Date(k.olusturma_tarihi).toLocaleDateString("tr-TR")}</td>
                  <td style={{...styles.td, textAlign: "center"}}><div style={styles.statusBadge(k.durum)}>{k.durum}</div></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}