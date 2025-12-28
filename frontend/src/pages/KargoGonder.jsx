import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { styles } from "../styles/KargoGonder.styles";

function KargoGonder({ userId }) {
  const [istasyonlar, setIstasyonlar] = useState([]);
  const [form, setForm] = useState({
    cikis_istasyon_id: "",
    agirlik_kg: "",
    adet: 1
  });
  const [mesaj, setMesaj] = useState("");
  const [mesajTipi, setMesajTipi] = useState(""); 
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchIstasyonlar = async () => {
      const { data, error } = await supabase
        .from("istasyonlar")
        .select("id, isim")
        .eq("aktif", true)
        .order("isim");
      
      if (!error && data) {
        setIstasyonlar(data);
      }
    };
    fetchIstasyonlar();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMesaj("Kargonuz oluşturuluyor...");
    setMesajTipi("loading");

    try {
      const kargoPayload = {
        gonderen_id: userId,
        cikis_istasyon_id: parseInt(form.cikis_istasyon_id),
        agirlik_kg: parseFloat(form.agirlik_kg),
        adet: parseInt(form.adet),
        durum: 'Beklemede'
      };

      const { data, error } = await supabase
        .from("kargolar")
        .insert([kargoPayload])
        .select();

      if (error) throw error;

      setMesaj("✅ Kargonuz başarıyla oluşturuldu! Operasyon ekibi planlamaya dahil edecektir.");
      setMesajTipi("success");
      setForm({ cikis_istasyon_id: "", agirlik_kg: "", adet: 1 });

    } catch (error) {
      console.error("Kargo gönderim hatası:", error);
      setMesaj(`❌ Hata: ${error.message || "Sunucu bağlantı hatası!"}`);
      setMesajTipi("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusStyle = () => {
    const baseStyle = styles.statusMessage;
    if (mesajTipi === "success") return { ...baseStyle, ...styles.statusSuccess };
    if (mesajTipi === "error") return { ...baseStyle, ...styles.statusError };
    if (mesajTipi === "loading") return { ...baseStyle, ...styles.statusLoading };
    return baseStyle;
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>
          <span>📦</span>
          <span>Yeni Kargo Gönder</span>
        </h2>
        <p style={styles.subtitle}>
          Varış Noktası:
          <span style={styles.destinationBadge}>
            🎯 Kocaeli Üniversitesi (Umuttepe)
          </span>
        </p>
      </div>

      <div style={styles.infoBox}>
        <div style={styles.infoTitle}>
          <span>ℹ️</span>
          <span>Gönderim Bilgilendirmesi</span>
        </div>
        <p style={styles.infoText}>
          Tüm kargolar ilçelerden toplanarak ana varış noktamız olan 
          <strong> Kocaeli Üniversitesi Umuttepe Yerleşkesi</strong>'ne ulaştırılır.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.formCard}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>
              Kalkış İlçesi
              <span style={styles.requiredStar}>*</span>
            </label>
            <select 
              required 
              value={form.cikis_istasyon_id}
              onChange={(e) => setForm({...form, cikis_istasyon_id: e.target.value})}
              style={styles.select}
              disabled={isSubmitting}
            >
              <option value="">İlçe Seçiniz...</option>
              {istasyonlar
                .filter(ist => !ist.isim.toLowerCase().includes("universite")) 
                .map(ist => (
                  <option key={ist.id} value={ist.id}>
                    📍 {ist.isim}
                  </option>
                ))
              }
            </select>
          </div>

          <hr style={styles.divider} />

          <div style={styles.flexRow}>
            <div style={{ ...styles.inputGroup, ...styles.flexItem }}>
              <label style={styles.label}>
                Toplam Ağırlık (kg)
                <span style={styles.requiredStar}>*</span>
              </label>
              <input 
                type="number" 
                step="0.1" 
                min="0.1"
                required 
                placeholder="Örn: 5.5"
                value={form.agirlik_kg}
                onChange={(e) => setForm({...form, agirlik_kg: e.target.value})}
                style={styles.input}
                disabled={isSubmitting}
              />
            </div>

            <div style={{ ...styles.inputGroup, ...styles.flexItem }}>
              <label style={styles.label}>
                Paket Adedi
                <span style={styles.requiredStar}>*</span>
              </label>
              <input 
                type="number" 
                min="1"
                required 
                placeholder="Örn: 2"
                value={form.adet}
                onChange={(e) => setForm({...form, adet: e.target.value})}
                style={styles.input}
                disabled={isSubmitting}
              />
            </div>
          </div>
        </div>

        <button 
          type="submit" 
          style={{
            ...styles.button,
            ...(isSubmitting ? styles.buttonDisabled : {})
          }}
          disabled={isSubmitting}
        >
          {isSubmitting ? "⏳ İşleniyor..." : "🚀 Kargo Talebi Oluştur"}
        </button>

        {mesaj && (
          <div style={getStatusStyle()}>
            {mesaj}
          </div>
        )}
      </form>
    </div>
  );
}

export default KargoGonder;