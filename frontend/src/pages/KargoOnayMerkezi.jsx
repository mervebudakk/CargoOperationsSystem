import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { styles } from "../styles/KargoOnayMerkezi.styles";

export default function KargoOnayMerkezi() {
  const [kargolar, setKargolar] = useState([]);
  const [tab, setTab] = useState("onay_bekleyen");
  const [seciliTarih, setSeciliTarih] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [seciliKargolar, setSeciliKargolar] = useState(new Set());
  
  // --- OPERASYON MODU STATE ---
  // Mod 1: Sınırsız Araç (Kiralama Serbest)
  // Mod 2: Belirli Sayıda Araç (Özmal odaklı)
  const [operasyonModu, setOperasyonModu] = useState("sinirsiz");

  useEffect(() => {
    verileriGetir();
  }, [tab, seciliTarih]);

  const verileriGetir = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("kargolar")
        .select(`
          *,
          gonderen:users!gonderen_id (email, first_name, last_name),
          istasyon:istasyonlar!cikis_istasyon_id (isim)
        `);

      if (tab === "onay_bekleyen") {
        query = query.eq("durum", "Beklemede");
      } else {
        query = query
          .eq("durum", tab === "planlanan" ? "Planlandı" : "Yolda")
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

  const rotaHesapla = async (isReplan = false) => {
  if (!isReplan && seciliKargolar.size === 0) return alert("⚠️ Lütfen kargo seçin!");
  
  setLoading(true);
  try {
    // 1. Backend'den rotayı al
    const response = await fetch(`http://localhost:8000/solve-route?tarih=${seciliTarih}&mode=${operasyonModu}`);
    const result = await response.json();
    if (result.hata) throw new Error(result.hata);

    // 2. ÖNCE: Eğer aynı tarih için eski özetler varsa temizle (Replan mantığı)
    await supabase.from("rota_ozetleri").delete().eq("planlanan_tarih", seciliTarih);

    // 3. HER ARAÇ İÇİN: Rota özetini kaydet ve kargoları güncelle
    for (const rota of result.arac_rotalari) {
      
      // Rota Özetini Kaydet
      const { error: summaryError } = await supabase
        .from("rota_ozetleri")
        .insert([{
          planlanan_tarih: seciliTarih,
          arac_id: rota.arac_id.toString(),
          arac_isim: rota.arac_isim,
          toplam_km: rota.toplam_km,
          toplam_maliyet: rota.maliyet,
          cizim_koordinatlari: rota.cizim_koordinatlari, // JSONB alanı
          duraklar: rota.rota_duraklari // TEXT[] alanı
        }]);

      if (summaryError) throw summaryError;

      // Bu rotadaki kargoların DB durumunu ve arac_id'sini güncelle
      const { error: kargoError } = await supabase
        .from("kargolar")
        .update({ 
          durum: "Planlandı", 
          planlanan_tarih: seciliTarih,
          arac_id: rota.arac_id.toString() 
        })
        .in("cikis_istasyon_id", kargolar.filter(k => rota.rota_duraklari.includes(k.istasyon.isim)).map(k => k.cikis_istasyon_id))
        .eq("durum", "Beklemede");
        
      if (kargoError) throw kargoError;
    }

    alert("✅ Rota, Maliyetler ve Harita Verileri Başarıyla Kaydedildi!");
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
      setSeciliKargolar(new Set(kargolar.map(k => k.id)));
    }
  };

  const seciliToplamAgirlik = kargolar
    .filter(k => seciliKargolar.has(k.id))
    .reduce((sum, k) => sum + k.agirlik_kg, 0);

  const kullanılanAraclar = [...new Set(kargolar.map(k => k.arac_id).filter(Boolean))];
  const kiralikSayisi = kullanılanAraclar.filter(id => id.startsWith("KIRALIK")).length;
  const ozmalSayisi = kullanılanAraclar.filter(id => !id.startsWith("KIRALIK")).length;
  const toplamPlanlananYuk = kargolar.reduce((sum, k) => sum + k.agirlik_kg, 0);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>🚚 Kargo Operasyon Merkezi</h1>
          <p style={styles.subtitle}>Gerçek zamanlı kargo takip ve rota optimizasyonu</p>
        </div>
        <div style={{display: "flex", gap: "15px", alignItems: "center"}}>
          {/* OPERASYON MODU SEÇİCİ */}
          <div style={styles.datePickerContainer}>
            <div style={styles.dateLabel}><span>⚙️ Operasyon Modu</span></div>
            <select 
              value={operasyonModu} 
              onChange={(e) => setOperasyonModu(e.target.value)} 
              style={{...styles.dateInput, padding: "8px 12px", minWidth: "180px"}}
            >
              <option value="sinirsiz">♾️ Sınırsız Araç (Kiralama)</option>
              <option value="sabit">🚚 Belirli Sayıda Araç</option>
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
          <button onClick={() => rotaHesapla(false)} disabled={seciliKargolar.size === 0 || loading} style={{...styles.primaryButton, opacity: seciliKargolar.size === 0 ? 0.5 : 1}}>
            {loading ? "⏳ İşleniyor..." : `🚀 Planla (${seciliKargolar.size})`}
          </button>
        </div>
      )}

      {tab === "planlanan" && kargolar.length > 0 && (
        <div style={styles.statsBar}>
          <div style={styles.statCard}><span>🏢</span><div><div style={styles.statValue}>{ozmalSayisi}</div><div style={styles.statLabel}>Özmal Araç</div></div></div>
          <div style={styles.statCard}><span>🤝</span><div><div style={{...styles.statValue, color: "#f39c12"}}>{kiralikSayisi}</div><div style={styles.statLabel}>Kiralık Araç</div></div></div>
          <div style={styles.statCard}><span>⚖️</span><div><div style={styles.statValue}>{toplamPlanlananYuk.toFixed(1)} kg</div><div style={styles.statLabel}>Toplam Yük</div></div></div>
          <div style={{...styles.statCard, border: "1px solid #f39c12"}}>
             <button onClick={() => rotaHesapla(true)} style={{...styles.secondaryButton, width: "100%"}}>🔄 Yeniden Hesapla</button>
          </div>
        </div>
      )}

      <div style={styles.tabContainer}>
        <button onClick={() => setTab("onay_bekleyen")} style={tab === "onay_bekleyen" ? styles.activeTab : styles.inactiveTab}>
          <span>⏳ Onay Bekleyenler</span><span style={styles.badge}>{tab === "onay_bekleyen" ? kargolar.length : "..."}</span>
        </button>
        <button onClick={() => setTab("planlanan")} style={tab === "planlanan" ? styles.activeTab : styles.inactiveTab}>📋 Planlananlar</button>
        <button onClick={() => setTab("yola_cikan")} style={tab === "yola_cikan" ? styles.activeTab : styles.inactiveTab}>🚛 Yola Çıkanlar</button>
      </div>

      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              {tab === "onay_bekleyen" && (
                <th style={{ padding: "16px", width: "50px", textAlign: "center", cursor: "pointer" }} onClick={tumunuSec}>
                  <input type="checkbox" checked={seciliKargolar.size === kargolar.length && kargolar.length > 0} readOnly style={{ accentColor: "#4caf50", cursor: "pointer" }} />
                </th>
              )}
              <th style={styles.th}>Gönderen</th>
              <th style={styles.th}>Çıkış İstasyonu</th>
              <th style={thStyle}>Ağırlık</th>
              <th style={thStyle}>Varış</th>
              <th style={thStyle}>Kayıt</th>
              <th style={thStyle}>Durum</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan="7" style={{padding:"40px",textAlign:"center"}}>Yükleniyor...</td></tr> : 
              kargolar.map(k => (
                <tr key={k.id} style={{...styles.tableRow, background: seciliKargolar.has(k.id) ? 'rgba(76, 175, 80, 0.1)' : 'transparent'}} onClick={() => tab === "onay_bekleyen" && toggleKargo(k.id)}>
                  {tab === "onay_bekleyen" && (
                    <td style={{padding:"16px",textAlign:"center"}}>
                      <input type="checkbox" checked={seciliKargolar.has(k.id)} readOnly style={{accentColor:"#4caf50"}} onClick={(e) => e.stopPropagation()} />
                    </td>
                  )}
                  <td style={styles.td}>
                    <div style={styles.senderName}>{k.gonderen?.first_name} {k.gonderen?.last_name}</div>
                    <div style={styles.senderEmail}>{k.gonderen?.email}</div>
                  </td>
                  <td style={styles.td}><div style={styles.stationBadge}>📍 {k.istasyon?.isim || k.cikis_istasyon_id}</div></td>
                  <td style={styles.td}><div style={styles.weightBadge}>{k.agirlik_kg} kg</div></td>
                  <td style={styles.td}><div style={styles.destinationBadge}>🎯 Umuttepe</div></td>
                  <td style={styles.td}>{new Date(k.olusturma_tarihi).toLocaleDateString("tr-TR")}</td>
                  <td style={styles.td}><div style={styles.statusBadge(k.durum)}>{k.durum}</div></td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle = { ...styles.th, textAlign: "center" };