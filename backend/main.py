from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import route_plan

app = FastAPI()

# --- GÜVENLİK VE BAĞLANTI AYARLARI ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- YÖNLENDİRİCİLERİ (ROUTERS) DAHİL ET ---
app.include_router(route_plan.router)

@app.get("/")
def ana_sayfa():
    return {"Durum": "Sistem Çalışıyor! 🚀"}