import axios from 'axios';

// Backend URL'inizi buraya tanımlayın
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const routeService = {
    /**
     * Yeni Clarke-Wright algoritmasını tetikler
     * @param {Object} data - { tarih, problem_tipi, kargo_ids, senaryo_id }
     */
    planRoute: async (data) => {
        try {
            const response = await api.post('/api/routes/plan', data);
            return response.data;
        } catch (error) {
            console.error("Rota planlama hatası:", error);
            throw error.response?.data || error.message;
        }
    },

    /**
     * Belirli bir tarihteki kayıtlı rota özetlerini getirir
     */
    listRoutes: async (tarih, aracId = null) => {
        try {
            const params = {};
            if (tarih) params.tarih = tarih;
            if (aracId) params.arac_id = aracId;
            
            const response = await api.get('/api/routes/list', { params });
            return response.data;
        } catch (error) {
            console.error("Rota listeleme hatası:", error);
            throw error.response?.data || error.message;
        }
    },

    /**
     * Rota detaylarını ve çizim koordinatlarını getirir
     */
    getRouteDetails: async (rotaId) => {
        try {
            const response = await api.get(`/api/routes/details/${rotaId}`);
            return response.data;
        } catch (error) {
            console.error("Rota detay hatası:", error);
            throw error.response?.data || error.message;
        }
    },

    /**
     * Belirli bir tarihteki tüm rotaları siler
     */
    deleteRoutes: async (tarih) => {
        try {
            const response = await api.delete(`/api/routes/delete/${tarih}`);
            return response.data;
        } catch (error) {
            console.error("Rota silme hatası:", error);
            throw error.response?.data || error.message;
        }
    },

    /**
     * Sistem ayarlarını getirir (km maliyeti, kiralama bedelleri)
     */
    getSettings: async () => {
        try {
            const response = await api.get('/api/routes/settings');
            return response.data;
        } catch (error) {
            console.error("Ayarlar getirme hatası:", error);
            throw error.response?.data || error.message;
        }
    },

    /**
     * Sistem ayarlarını günceller
     */
    updateSettings: async (settings) => {
        try {
            const response = await api.put('/api/routes/settings', settings);
            return response.data;
        } catch (error) {
            console.error("Ayarlar güncelleme hatası:", error);
            throw error.response?.data || error.message;
        }
    },

    /**
     * Rota istatistiklerini getirir (Dashboard için)
     */
    getStatistics: async (baslangic, bitis) => {
        try {
            const params = { baslangic_tarih: baslangic, bitis_tarih: bitis };
            const response = await api.get('/api/routes/statistics', { params });
            return response.data;
        } catch (error) {
            console.error("İstatistik hatası:", error);
            throw error.response?.data || error.message;
        }
    },

    /**
     * Sınırsız ve Belirli Araç problem tiplerini karşılaştırır
     */
    compareProblems: async (tarih, kargoIds = null) => {
        try {
            const response = await api.post('/api/routes/compare', { 
                tarih, 
                kargo_ids: kargoIds 
            });
            return response.data;
        } catch (error) {
            console.error("Karşılaştırma hatası:", error);
            throw error.response?.data || error.message;
        }
    },

    /**
     * Backend ve OSMnx servis durumunu kontrol eder
     */
    checkHealth: async () => {
        try {
            const response = await api.get('/api/routes/health');
            return response.data;
        } catch (error) {
            return { basarili: false, durum: "Backend erişilemez" };
        }
    }
};

export default api;