import axios from 'axios';

// Backend adresimiz (Sabit değişken)
const BASE_URL = 'http://127.0.0.1:8000';

export const istasyonlariGetirService = async () => {
  const res = await axios.get(`${BASE_URL}/stations`);
  return res.data;
};

export const senaryolariGetirService = async () => {
  const res = await axios.get(`${BASE_URL}/scenarios`);
  return res.data;
};

export const senaryoYukleriniGetirService = async (senaryoId) => {
  const res = await axios.get(`${BASE_URL}/scenarios/${senaryoId}`);
  return res.data;
};

// solve-route'u senaryo ile çağırmak için
export const rotayiHesaplaService = async (senaryoId) => {
  const res = await axios.get(`${BASE_URL}/solve-route?senaryo_id=${senaryoId}`);
  return res.data;
};

// Yeni senaryo kaydetmek için (backend'de POST endpoint yazacağız)
export const senaryoOlusturService = async (payload) => {
  const res = await axios.post(`${BASE_URL}/scenarios`, payload);
  return res.data;
};
