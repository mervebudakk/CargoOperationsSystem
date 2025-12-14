import { useEffect, useMemo, useState } from "react";
import {
  istasyonlariGetirService,
  senaryolariGetirService,
  senaryoYukleriniGetirService,
  senaryoOlusturService,
} from "../services/api";

export default function SenaryoGirisi() {
  const [stations, setStations] = useState([]);
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState(1);

  const [name, setName] = useState("");
  const [aciklama, setAciklama] = useState("");
  const [rows, setRows] = useState([]); // { istasyon_id, isim, adet, agirlik_kg }

  const ilceler = useMemo(
    () => stations.filter((s) => s.id !== 0).sort((a, b) => a.id - b.id),
    [stations]
  );

  // ilk yükleme
  useEffect(() => {
    (async () => {
      const [st, sc] = await Promise.all([
        istasyonlariGetirService(),
        senaryolariGetirService(),
      ]);
      setStations(st);
      setScenarios(sc);
    })();
  }, []);

  // senaryo seçilince tabloyu doldur
  useEffect(() => {
    if (!stations.length || !scenarios.length) return;

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
      const sc = scenarios.find((x) => x.id === Number(selectedScenarioId));
      setName(sc?.name ?? "");
      setAciklama(sc?.aciklama ?? "");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedScenarioId, stations, scenarios]);

  const onChangeCell = (idx, field, value) => {
    const v = value === "" ? "" : Number(value);
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: v } : r))
    );
  };

  const kaydet = async () => {
    // boş stringleri 0'a çevir
    const yukler = rows.map((r) => ({
      alim_istasyon_id: r.istasyon_id,
      adet: Number(r.adet || 0),
      agirlik_kg: Number(r.agirlik_kg || 0),
    }));

    const payload = { name, aciklama, yukler };

    const created = await senaryoOlusturService(payload);
    alert(`Senaryo kaydedildi. ID: ${created.id}`);

    // senaryo listesini güncelle
    const sc = await senaryolariGetirService();
    setScenarios(sc);
    setSelectedScenarioId(created.id);
  };

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
            setSelectedScenarioId(1);
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

      <div style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <input
          placeholder="Senaryo adı"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ padding: 8, minWidth: 260 }}
        />
        <input
          placeholder="Açıklama"
          value={aciklama}
          onChange={(e) => setAciklama(e.target.value)}
          style={{ padding: 8, minWidth: 360 }}
        />
        <button onClick={kaydet}>Kaydet</button>
      </div>

      <div style={{ marginTop: 16, overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 640 }}>
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
                    onChange={(e) => onChangeCell(idx, "agirlik_kg", e.target.value)}
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
  width: "100%",
  padding: 6,
};
