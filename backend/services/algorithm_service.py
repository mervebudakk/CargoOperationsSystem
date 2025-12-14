from geopy.distance import geodesic

def en_kisa_rotayi_hesapla(istasyonlar):
    """Greedy (En Yakın Komşu) algoritması ile rotayı belirler."""
    if not istasyonlar:
        return {"rota": [], "toplam_km": 0}

    # Değişkenlerimizi tanımlayalım
    rota = [istasyonlar[0]] # Başlangıç noktası (İlk eleman)
    ziyaret_edilmemis = istasyonlar[1:] # Geriye kalanlar
    mevcut_konum = istasyonlar[0]
    toplam_mesafe = 0

    while ziyaret_edilmemis:
        en_yakin_istasyon = None
        minimum_mesafe = float('inf') # Sonsuz sayı

        for aday_istasyon in ziyaret_edilmemis:
            # Mesafeyi hesapla (km cinsinden)
            mesafe = geodesic(
                (mevcut_konum["lat"], mevcut_konum["lon"]),
                (aday_istasyon["lat"], aday_istasyon["lon"])
            ).km

            # Eğer bu istasyon daha yakınsa, yeni en yakınımız budur
            if mesafe < minimum_mesafe:
                minimum_mesafe = mesafe
                en_yakin_istasyon = aday_istasyon

        # En yakın olanı rotaya ekle
        rota.append(en_yakin_istasyon)
        # Listeden düş (Artık ziyaret edildi)
        ziyaret_edilmemis.remove(en_yakin_istasyon)
        # Konumumuzu güncelle
        mevcut_konum = en_yakin_istasyon
        # Toplam yolu arttır
        toplam_mesafe += minimum_mesafe

    # Anahtarlar
    return {"rota": rota, "toplam_km": round(toplam_mesafe, 2)}