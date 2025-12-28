import logging
import time
from datetime import datetime, timedelta
from fastapi import HTTPException
from typing import List, Dict, Optional

from services.supabase_service import (
    istasyonlari_dbden_cek,
    sistem_ayarlarini_getir,
    araclari_getir,
    kargo_listesi_getir,
    rota_detaylarini_kaydet,
    optimizasyon_sonucunu_kaydet,
    sistem_logu_kaydet,
    supabase_admin
)
from services.vrp_clark_wright import rotayi_optimize_et
from models.cargo_model import KargoDurum
from models.route_model import OptimizasyonSonucCreate, RotaDetayBase

# Logger ayarla
logger = logging.getLogger(__name__)


class RouteController:
    """Rota planlama ve optimizasyon işlemlerini yöneten controller"""
    
    @staticmethod
    def solve_route(
        tarih: str, 
        kargo_ids: Optional[List[int]] = None, 
        senaryo_id: Optional[int] = None,
        kullanici_id: Optional[str] = None,
        problem_tipi: str = "sinirsiz_arac"
    ) -> Dict:
        """
        Verilen tarih için rota planlaması yapar.
        
        İKİ MOD:
        1. SENARYO MODU: senaryo_id verilirse, o senaryonun yüklerini kullanır
        2. KARGO MODU: senaryo_id yoksa, bekleyen gerçek kargoları kullanır
        
        Args:
            tarih: Planlama tarihi (YYYY-MM-DD)
            kargo_ids: Planlanacak spesifik kargo ID'leri (opsiyonel)
            senaryo_id: Senaryo ID'si - VARSA SENARYO MODU AKTIF
            kullanici_id: İşlemi yapan kullanıcı ID
            problem_tipi: "sinirsiz_arac" veya "belirli_arac"
        
        Returns:
            Dict: Rota ve özet bilgileri
        """
        
        baslangic_zamani = time.time()
        
        try:
            # ============================================
            # 1. VALIDATION - Tarih Kontrolü
            # ============================================
            if not tarih:
                raise HTTPException(
                    status_code=400, 
                    detail="Tarih parametresi zorunludur"
                )
            
            try:
                datetime.strptime(tarih, "%Y-%m-%d")
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail="Geçersiz tarih formatı. Beklenen: YYYY-MM-DD"
                )
            
            # Mod belirleme
            if senaryo_id:
                logger.info(f"🎯 SENARYO MODU: Tarih={tarih}, Senaryo={senaryo_id}, Problem={problem_tipi}")
            else:
                logger.info(f"📦 KARGO MODU: Tarih={tarih}, Problem={problem_tipi}")
            
            # ============================================
            # 2. ESKİ ROTALARI TEMİZLE (Sadece Kargo Modunda)
            # ============================================
            if not senaryo_id:
                eski_rotalar = supabase_admin.table("rota_ozetleri")\
                    .select("id")\
                    .eq("planlanan_tarih", tarih)\
                    .execute()
                
                if eski_rotalar.data:
                    r_ids = [r["id"] for r in eski_rotalar.data]
                    logger.info(f"{len(r_ids)} eski rota siliniyor...")
                    
                    # Önce detayları sil
                    supabase_admin.table("rota_detaylari")\
                        .delete()\
                        .in_("rota_oz_id", r_ids)\
                        .execute()
                    
                    # Sonra özetleri sil
                    supabase_admin.table("rota_ozetleri")\
                        .delete()\
                        .in_("id", r_ids)\
                        .execute()
                    
                    # Kargoları beklemede'ye al
                    supabase_admin.table("kargolar")\
                        .update({
                            "durum": KargoDurum.BEKLEMEDE.value,
                            "arac_id": None,
                            "planlanan_tarih": None
                        })\
                        .eq("planlanan_tarih", tarih)\
                        .execute()
                    
                    logger.info("Eski rotalar temizlendi")
            
            # ============================================
            # 3. VERİLERİ HAZIRLA
            # ============================================
            
            # Sistem ayarlarını getir
            ayarlar = sistem_ayarlarini_getir()
            if not ayarlar:
                raise HTTPException(
                    status_code=500,
                    detail="Sistem ayarları yüklenemedi"
                )
            
            # Araçları getir
            araclar = araclari_getir(sadece_aktif=True)
            if not araclar:
                raise HTTPException(
                    status_code=404,
                    detail="Aktif araç bulunamadı"
                )
            
            logger.info(f"{len(araclar)} aktif araç bulundu")
            
            # İstasyonları getir
            istasyonlar = istasyonlari_dbden_cek(sadece_aktif=True)
            if not istasyonlar:
                raise HTTPException(
                    status_code=500,
                    detail="İstasyon bilgileri yüklenemedi"
                )
            
            # ============================================
            # 4. YÜK HARİTASI OLUŞTUR
            # MOD AYRIMI: Senaryo vs Kargo
            # ============================================
            yuk_haritasi = {}
            toplam_kargo_kg = 0
            toplam_kargo_adet = 0
            kargolar = []  # Kargo listesi (kargo modunda dolu olacak)
            
            if senaryo_id:
                # ============================================
                # SENARYO MODU: Senaryo yüklerini kullan
                # ============================================
                logger.info(f"📋 Senaryo {senaryo_id} yükleri çekiliyor...")
                
                senaryo_yukleri = supabase_admin.table("senaryo_yukleri")\
                    .select("*")\
                    .eq("senaryo_id", senaryo_id)\
                    .execute()
                
                if not senaryo_yukleri.data:
                    raise HTTPException(
                        status_code=404,
                        detail=f"Senaryo {senaryo_id} için yük bulunamadı"
                    )
                
                # Yük haritası oluştur
                for yuk in senaryo_yukleri.data:
                    if yuk["agirlik_kg"] == 0 or yuk["adet"] == 0:
                        continue  # Boş yükleri atla
                    
                    ist_id = yuk["alim_istasyon_id"]
                    
                    if ist_id not in yuk_haritasi:
                        yuk_haritasi[ist_id] = {
                            "kg": 0,
                            "adet": 0,
                            "ids": []  # Senaryo için ID yok
                        }
                    
                    yuk_haritasi[ist_id]["kg"] += yuk["agirlik_kg"]
                    yuk_haritasi[ist_id]["adet"] += yuk["adet"]
                    
                    toplam_kargo_kg += yuk["agirlik_kg"]
                    toplam_kargo_adet += yuk["adet"]
                
                logger.info(
                    f"✅ Senaryo yükleri: {toplam_kargo_kg} kg, "
                    f"{toplam_kargo_adet} adet, "
                    f"{len(yuk_haritasi)} istasyon"
                )
            
            else:
                # ============================================
                # KARGO MODU: Gerçek kargoları kullan
                # ============================================
                logger.info("📦 Gerçek kargolar çekiliyor...")
                
                if kargo_ids and len(kargo_ids) > 0:
                    # Spesifik kargolar
                    tum_kargolar = kargo_listesi_getir(durum=KargoDurum.BEKLEMEDE.value)
                    kargolar = [k for k in tum_kargolar if k["id"] in kargo_ids]
                else:
                    # Tüm bekleyen kargolar
                    kargolar = kargo_listesi_getir(durum=KargoDurum.BEKLEMEDE.value)
                
                if not kargolar:
                    raise HTTPException(
                        status_code=404,
                        detail="Planlanacak kargo bulunamadı"
                    )
                
                # Yük haritası oluştur
                for k in kargolar:
                    ist_id = k["cikis_istasyon_id"]
                    
                    if ist_id not in yuk_haritasi:
                        yuk_haritasi[ist_id] = {
                            "kg": 0,
                            "adet": 0,
                            "ids": []
                        }
                    
                    yuk_haritasi[ist_id]["kg"] += k["agirlik_kg"]
                    yuk_haritasi[ist_id]["adet"] += k.get("adet", 1)
                    yuk_haritasi[ist_id]["ids"].append(k["id"])
                    
                    toplam_kargo_kg += k["agirlik_kg"]
                    toplam_kargo_adet += k.get("adet", 1)
                
                logger.info(
                    f"✅ Gerçek kargolar: {len(kargolar)} adet, "
                    f"{toplam_kargo_kg} kg, "
                    f"{len(yuk_haritasi)} istasyon"
                )
            
            # İstasyonlara yük bilgisini ekle
            veriler = []
            for s in istasyonlar:
                istasyon_data = {**s}
                if s["id"] in yuk_haritasi:
                    istasyon_data["kargo_agirlik"] = yuk_haritasi[s["id"]]["kg"]
                    istasyon_data["kargo_adet"] = yuk_haritasi[s["id"]]["adet"]
                else:
                    istasyon_data["kargo_agirlik"] = 0
                    istasyon_data["kargo_adet"] = 0
                
                veriler.append(istasyon_data)
            
            # ============================================
            # 5. ALGORİTMA ÇALIŞTIR
            # ============================================
            logger.info("Optimizasyon algoritması başlatılıyor...")
            
            algo_baslangic = time.time()
            sonuc = rotayi_optimize_et(
                veriler, 
                araclar, 
                ayarlar,
                problem_tipi=problem_tipi
            )
            algo_sure = (time.time() - algo_baslangic) * 1000
            
            # YENİ: Return değeri kontrol et
            if isinstance(sonuc, dict) and "rotalar" in sonuc:
                optimize_rotalar = sonuc["rotalar"]
                algo_ozet = sonuc["ozet"]
                algo_sure = algo_ozet.get("calisma_suresi_ms", algo_sure)
                
                logger.info(
                    f"Algoritma tamamlandı: {len(optimize_rotalar)} rota, "
                    f"Kabul: {algo_ozet.get('kabul_edilen_kargo_sayisi', 0)}, "
                    f"Red: {algo_ozet.get('reddedilen_kargo_sayisi', 0)}, "
                    f"{int(algo_sure)} ms"
                )
            else:
                # Eski format
                optimize_rotalar = sonuc
                algo_ozet = {}
                logger.warning("Eski format rota sonucu")
                logger.info(f"Algoritma tamamlandı: {len(optimize_rotalar)} rota, {int(algo_sure)} ms")
            
            if not optimize_rotalar:
                raise HTTPException(
                    status_code=500,
                    detail="Rota optimizasyonu başarısız"
                )
            
            # ============================================
            # 6. ROTALARI KAYDET (Sadece Kargo Modunda)
            # ============================================
            toplam_km = 0
            toplam_maliyet = 0
            basarili_rota_sayisi = 0
            
            if not senaryo_id:
                # Sadece kargo modunda veritabanına kaydet
                for rota in optimize_rotalar:
                    try:
                        # Rota özeti kaydet
                        rota_data = {
                            "planlanan_tarih": tarih,
                            "arac_id": str(rota["arac_id"]),
                            "arac_isim": rota.get("arac_isim"),
                            "toplam_km": rota["toplam_km"],
                            "toplam_maliyet": rota["maliyet"],
                            "duraklar": [d["istasyon_isim"] for d in rota.get("duraklar", [])],
                            "cizim_koordinatlari": rota.get("cizim_koordinatlari", [])
                        }
                        
                        rota_oz = supabase_admin.table("rota_ozetleri")\
                            .insert([rota_data])\
                            .execute()
                        
                        if rota_oz.data:
                            rota_oz_id = rota_oz.data[0]["id"]
                            
                            # Rota detaylarını kaydet
                            detaylar = []
                            for d in rota.get("duraklar", []):
                                detay = RotaDetayBase(
                                    sira=d["sira"],
                                    istasyon_id=d["istasyon_id"],
                                    mesafe_onceki_km=d.get("ara_mesafe", 0),
                                    yuklu_kargo_sayisi=1,
                                    yuklu_kargo_kg=d.get("yuklu_kargo_kg", 0),
                                    kalan_kapasite_kg=d.get("kalan_kapasite_kg", 0)
                                )
                                detaylar.append(detay)
                            
                            if detaylar:
                                rota_detaylarini_kaydet(detaylar, rota_oz_id)
                            
                            # İlgili kargoların durumunu güncelle
                            istasyon_isimleri = [d["istasyon_isim"] for d in rota.get("duraklar", [])]
                            kargo_ids_guncelle = [
                                k_id for ist_id in yuk_haritasi.keys()
                                for k_id in yuk_haritasi[ist_id].get("ids", [])
                                if any(i["id"] == ist_id for i in istasyonlar if i["isim"] in istasyon_isimleri)
                            ]
                            
                            if kargo_ids_guncelle:
                                supabase_admin.table("kargolar")\
                                    .update({
                                        "durum": KargoDurum.PLANLANDI.value,
                                        "planlanan_tarih": tarih,
                                        "arac_id": str(rota["arac_id"])
                                    })\
                                    .in_("id", kargo_ids_guncelle)\
                                    .execute()
                            
                            basarili_rota_sayisi += 1
                            toplam_km += rota["toplam_km"]
                            toplam_maliyet += rota["maliyet"]
                    
                    except Exception as e:
                        logger.error(f"Rota kaydedilemedi: {e}")
                        continue
            else:
                # Senaryo modunda sadece toplamları hesapla
                for rota in optimize_rotalar:
                    toplam_km += rota["toplam_km"]
                    toplam_maliyet += rota["maliyet"]
                    basarili_rota_sayisi += 1
            
            # ============================================
            # 7. OPTİMİZASYON SONUCUNU KAYDET
            # ============================================
            if senaryo_id:
                try:
                    tasinan_sayisi = algo_ozet.get("kabul_edilen_kargo_sayisi", len(yuk_haritasi))
                    tasinan_kg = algo_ozet.get("tasınan_kargo_kg", toplam_kargo_kg)
                    reddedilen_sayisi = algo_ozet.get("reddedilen_kargo_sayisi", 0)
                    
                    performans = OptimizasyonSonucCreate(
                        senaryo_id=senaryo_id,
                        algoritma_adi="Clarke-Wright + 2-opt",
                        problem_tipi=problem_tipi,
                        calisma_suresi_ms=int(algo_sure),
                        toplam_maliyet=toplam_maliyet,
                        toplam_km=toplam_km,
                        kullanilan_arac_sayisi=len(optimize_rotalar),
                        tasinan_kargo_sayisi=tasinan_sayisi,
                        tasinan_kargo_kg=tasinan_kg,
                        kabul_edilen_kargo_sayisi=tasinan_sayisi,
                        reddedilen_kargo_sayisi=reddedilen_sayisi,
                        cozum_detaylari={
                            "arac_bilgileri": [
                                {
                                    "arac_id": r["arac_id"],
                                    "arac_isim": r["arac_isim"],
                                    "kapasite_kg": r["kapasite_kg"],
                                    "yuklu_kg": r["yuk_kg"],
                                    "doluluk_orani": r["doluluk_orani"],
                                    "mesafe_km": r["toplam_km"],
                                    "maliyet": r["maliyet"]
                                } for r in optimize_rotalar
                            ],
                            "kargo_kabul_durumu": {
                                "toplam": algo_ozet.get("toplam_kargo_sayisi", len(yuk_haritasi)),
                                "kabul": tasinan_sayisi,
                                "red": reddedilen_sayisi
                            }
                        }
                    )
                    
                    optimizasyon_sonucunu_kaydet(performans)
                    logger.info("Optimizasyon sonucu kaydedildi")
                
                except Exception as e:
                    logger.warning(f"Optimizasyon sonucu kaydedilemedi: {e}")
            
            # ============================================
            # 8. SONUÇ DÖNDÜR
            # ============================================
            toplam_sure = (time.time() - baslangic_zamani) * 1000
            
            sonuc = {
                "basarili": True,
                "mesaj": f"{basarili_rota_sayisi} rota başarıyla planlandı",
                "rotalar": optimize_rotalar,
                "ozet": {
                    "tarih": tarih,
                    "toplam_km": round(toplam_km, 2),
                    "toplam_maliyet": round(toplam_maliyet, 2),
                    "kullanilan_arac_sayisi": len(optimize_rotalar),
                    "tasınan_kargo_sayisi": algo_ozet.get("kabul_edilen_kargo_sayisi", len(kargolar) if kargolar else len(yuk_haritasi)),
                    "tasınan_kargo_kg": algo_ozet.get("tasınan_kargo_kg", round(toplam_kargo_kg, 2)),
                    "kabul_edilen_kargo_sayisi": algo_ozet.get("kabul_edilen_kargo_sayisi", len(kargolar) if kargolar else len(yuk_haritasi)),
                    "reddedilen_kargo_sayisi": algo_ozet.get("reddedilen_kargo_sayisi", 0),
                    "aktif_istasyon_sayisi": len(yuk_haritasi),
                    "calisma_suresi_ms": int(toplam_sure),
                    "algoritma_suresi_ms": int(algo_sure),
                    "mod": "senaryo" if senaryo_id else "kargo"  # YENİ: Hangi mod kullanıldı
                }
            }
            
            # Sistem logu kaydet
            if kullanici_id:
                try:
                    sistem_logu_kaydet(
                        kullanici_id=kullanici_id,
                        islem="rota_planlama",
                        detay=f"Tarih: {tarih}, Mod: {'Senaryo' if senaryo_id else 'Kargo'}, Rotalar: {len(optimize_rotalar)}"
                    )
                except:
                    pass
            
            logger.info(
                f"Rota planlama tamamlandı: {basarili_rota_sayisi} rota, "
                f"{int(toplam_sure)} ms"
            )
            
            return sonuc
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Rota planlama hatası: {e}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Rota planlama sırasında hata oluştu: {str(e)}"
            )