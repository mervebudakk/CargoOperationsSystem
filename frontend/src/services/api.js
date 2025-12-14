import axios from 'axios';

// Backend adresimiz (Sabit değişken)
const BASE_URL = 'http://127.0.0.1:8000';

// 1. İstasyonları Getir
export const istasyonlariGetirService = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/stations`);
    return response.data; // Veriyi (istasyonlar listesini) döndür
  } catch (error) {
    console.error("İstasyonlar çekilirken hata oluştu:", error);
    throw error;
  }
};

// 2. Rotayı Hesapla
export const rotayiHesaplaService = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/solve-route`);
    // Backend'den { rota: [...], toplam_km: 120 } geliyor
    return response.data; 
  } catch (error) {
    console.error("Rota hesaplanırken hata oluştu:", error);
    throw error;
  }
};