import axios from "axios";
import { supabase } from "../lib/supabaseClient";

// Backend adresi (env varsa onu kullan, yoksa fallback)
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Yeni senaryo kaydetmek için
export const senaryoOlusturService = async (payload) => {
  const headers = await getAuthHeaders();
  const res = await axios.post(`${BASE_URL}/scenarios`, payload, { headers });
  return res.data;
};

export const istasyonlariGetirService = async () => {
  const headers = await getAuthHeaders();
  const res = await axios.get(`${BASE_URL}/stations`, { headers });
  return res.data;
};

export const senaryolariGetirService = async () => {
  const headers = await getAuthHeaders();
  const res = await axios.get(`${BASE_URL}/scenarios`, { headers });
  return res.data;
};

export const senaryoYukleriniGetirService = async (senaryoId) => {
  const headers = await getAuthHeaders();
  const res = await axios.get(`${BASE_URL}/scenarios/${senaryoId}`, { headers });
  return res.data;
};

// solve-route'u senaryo ile çağırmak için
export const rotayiHesaplaService = async (senaryoId) => {
  const headers = await getAuthHeaders();
  const res = await axios.get(`${BASE_URL}/solve-route?senaryo_id=${senaryoId}`, { headers });
  return res.data;
};
