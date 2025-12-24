import { useState, useEffect } from "react";
import { istasyonlariGetirService } from "../services/api";
import { styles } from "../styles/KargoGonder.styles";

function KargoGonder({ userId }) {
  const [istasyonlar, setIstasyonlar] = useState([]);
  const [form, setForm] = useState({
    cikis_istasyon_id: "",
    agirlik_kg: "",
    adet: 1
  });
  const [mesaj, setMesaj] = useState("");
  const [mesajTipi, setMesajTipi] = useState(""); // "success", "error", "loading"
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. İstasyonları yükle
  useEffect(() => {
    istasyonlariGetirService().then(setIstasyonlar);
  }, []);

  // 2. Kargo Gönderme İşlemi
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMesaj("Kargonuz oluşturuluyor...");
    setMesajTipi("loading");

    try {
      const response = await fetch(`http://localhost:8000/send-cargo?user_id=${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          cikis_istasyon_id: parseInt(form.cikis_istasyon_id),
          agirlik_kg: parseFloat(form.agirlik_kg),
          adet: parseInt(form.adet)
        })
      });

      const res = await response.json();
      
      if (res.hata) {
        setMesaj("❌ Hata: " + res.hata);
        setMesajTipi("error");
      } else {
        setMesaj("✅ Kargonuz başarıyla oluşturuldu! Admin onayı bekleniyor.");
        setMesajTipi("success");
        setForm({ cikis_istasyon_id: "", agirlik_kg: "", adet: 1 });
      }
    } catch (error) {
      setMesaj("❌ Sunucu bağlantı hatası! Lütfen tekrar deneyin.");
      setMesajTipi("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mesaj stilini belirle
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
          <span>Kargo Gönderim Bilgilendirmesi</span>
        </div>
        <p style={styles.infoText}>
          Kargonuz oluşturulduktan sonra operasyon ekibi tarafından onaylanacak ve 
          rota planlamasına dahil edilecektir. Durumunu "Kargolarım" sayfasından takip edebilirsiniz.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.formCard}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>
              Çıkış İlçesi
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
                .filter(ist => ist.isim !== "Kocaeli Universitesi") 
                .map(ist => (
                  <option key={ist.id} value={ist.id}>
                    📍 {ist.isim}
                  </option>
                ))
              }
            </select>
            <span style={styles.helperText}>
              Kargonuzun hangi ilçeden gönderileceğini seçin
            </span>
          </div>

          <hr style={styles.divider} />

          <div style={styles.flexRow}>
            <div style={{ ...styles.inputGroup, ...styles.flexItem }}>
              <label style={styles.label}>
                Ağırlık (kg)
                <span style={styles.requiredStar}>*</span>
              </label>
              <input 
                type="number" 
                step="0.1" 
                min="0.1"
                required 
                placeholder="Örn: 2.5"
                value={form.agirlik_kg}
                onChange={(e) => setForm({...form, agirlik_kg: e.target.value})}
                style={styles.input}
                disabled={isSubmitting}
              />
              <span style={styles.helperText}>
                Toplam ağırlık (kg cinsinden)
              </span>
            </div>

            <div style={{ ...styles.inputGroup, ...styles.flexItem }}>
              <label style={styles.label}>
                Adet
                <span style={styles.requiredStar}>*</span>
              </label>
              <input 
                type="number" 
                min="1"
                required 
                placeholder="Örn: 3"
                value={form.adet}
                onChange={(e) => setForm({...form, adet: e.target.value})}
                style={styles.input}
                disabled={isSubmitting}
              />
              <span style={styles.helperText}>
                Kargo paketi sayısı
              </span>
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
          {isSubmitting ? "⏳ İşleniyor..." : "🚀 Kargoyu Oluştur"}
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