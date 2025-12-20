import { useEffect, useMemo, useState } from "react";
import {
  istasyonlariGetirService,
  senaryolariGetirService,
  senaryoYukleriniGetirService,
  senaryoOlusturService,
} from "../services/api";
import "../styles/App.css";


export default function SenaryoGirisi() {
  const [stations, setStations] = useState([]);
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState(null);

  const [name, setName] = useState("");
  const [aciklama, setAciklama] = useState("");
  const [rows, setRows] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const ilceler = useMemo(
    () => stations.filter((s) => s.id !== 0).sort((a, b) => a.id - b.id),
    [stations]
  );


  // 🔄 Backend hazır olana kadar bekleyen yükleme (retry + timeout)
  useEffect(() => {
    let cancelled = false;
    const startTime = Date.now();
    const MAX_WAIT = 180000; // 3 dakika

    const loadData = async () => {
      try {
        const [st, sc] = await Promise.all([
          istasyonlariGetirService(),
          senaryolariGetirService(),
        ]);

        if (cancelled) return;

        setStations(st);
        setScenarios(sc);

        if (sc.length > 0) {
          setSelectedScenarioId(sc[0].id);
        }

        setLoading(false);
      } catch (err) {
        if (Date.now() - startTime > MAX_WAIT) {
          setError("Backend başlatılamadı. Lütfen daha sonra tekrar deneyin.");
          setLoading(false);
          return;
        }

        // 2 saniye sonra tekrar dene
        setTimeout(loadData, 2000);
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  // 📦 Senaryo seçilince tabloyu doldur
  useEffect(() => {
    if (!selectedScenarioId || !stations.length) return;

    (async () => {
      const yukler = await senaryoYukleriniGetirService(selectedScenarioId);
      const map = new Map(yukler.map((y) => [y.alim_istasyon_id, y]));

      const newRows = ilceler.map((s) => {
        const y = map.get(s.id);
        return {
          istasyon_id: s.id,
          isim: s.isim,
          adet: y?.adet ?? 0,
          agirlik_kg: y?.agirlik_kg ?? 0,
        };
      });

      setRows(newRows);

      const sc = scenarios.find((x) => x.id === selectedScenarioId);
      setName(sc?.name ?? "");
      setAciklama(sc?.aciklama ?? "");
    })();
  }, [selectedScenarioId, stations, scenarios, ilceler]);

  const onChangeCell = (idx, field, value) => {
    const v = value === "" ? "" : Number(value);
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: v } : r))
    );
  };

  const kaydet = async () => {
    const yukler = rows.map((r) => ({
      alim_istasyon_id: r.istasyon_id,
      adet: Number(r.adet || 0),
      agirlik_kg: Number(r.agirlik_kg || 0),
    }));

    const payload = { name, aciklama, yukler };

    const created = await senaryoOlusturService(payload);
    alert(`Senaryo kaydedildi. ID: ${created.id}`);

    const sc = await senaryolariGetirService();
    setScenarios(sc);
    setSelectedScenarioId(created.id);
  };

  // ⏳ YÜKLENİYOR EKRANI
  if (loading) {
    return (
      <div style={loadingStyle}>
        <div style={spinnerStyle}></div>
        <div style={{ marginTop: 16 }}>Yükleniyor...</div>
      </div>
    );
  }

  // ❌ HATA EKRANI
  if (error) {
    return (
      <div style={errorStyle}>
        ❌ {error}
      </div>
    );
  }

  // ✅ NORMAL EKRAN
  return (
    <div style={{ padding: 16 }}>
      <h2>Senaryo Girişi</h2>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label>
          Hazır Senaryo:
          <select
            value={selectedScenarioId}
            onChange={(e) => setSelectedScenarioId(Number(e.target.value))}
            style={{ marginLeft: 8 }}
          >
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} (#{s.id})
              </option>
            ))}
          </select>
        </label>

        <button
          onClick={() => {
            setSelectedScenarioId(null);
            setName("");
            setAciklama("");
            setRows(
              ilceler.map((s) => ({
                istasyon_id: s.id,
                isim: s.isim,
                adet: 0,
                agirlik_kg: 0,
              }))
            );
          }}
        >
          Yeni Senaryo Başlat
        </button>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 12 }}>
        <input
          placeholder="Senaryo adı"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inp}
        />
        <input
          placeholder="Açıklama"
          value={aciklama}
          onChange={(e) => setAciklama(e.target.value)}
          style={inp}
        />
        <button onClick={kaydet}>Kaydet</button>
      </div>

      <div style={{ marginTop: 16, overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={th}>İlçe</th>
              <th style={th}>Kargo Sayısı</th>
              <th style={th}>Ağırlık (kg)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.istasyon_id}>
                <td style={td}>{r.isim}</td>
                <td style={td}>
                  <input
                    type="number"
                    min="0"
                    value={r.adet}
                    onChange={(e) => onChangeCell(idx, "adet", e.target.value)}
                    style={inp}
                  />
                </td>
                <td style={td}>
                  <input
                    type="number"
                    min="0"
                    value={r.agirlik_kg}
                    onChange={(e) =>
                      onChangeCell(idx, "agirlik_kg", e.target.value)
                    }
                    style={inp}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* 🎨 STYLES */

const loadingStyle = {
  height: "100vh",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  fontSize: 20,
};

const spinnerStyle = {
  width: 50,
  height: 50,
  border: "5px solid #f3f3f3",
  borderTop: "5px solid #3498db",
  borderRadius: "50%",
  animation: "spin 1s linear infinite",
};

const errorStyle = {
  padding: 24,
  color: "red",
  fontSize: 18,
};

const th = {
  border: "1px solid #444",
  padding: 8,
  textAlign: "left",
};

const td = {
  border: "1px solid #444",
  padding: 8,
};

const inp = {
  padding: 6,
  minWidth: 200,
};