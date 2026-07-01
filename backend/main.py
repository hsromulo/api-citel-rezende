from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.columns import router as columns_router
from backend.api.draw import router as draw_router
from backend.api.health import router as health_router
from backend.api.sync import router as sync_router


app = FastAPI(title="Citel ERP to Supabase Sync API")

app.add_middleware(
  CORSMiddleware,
  allow_origins=[
    "https://projeto-qrcode-two.vercel.app",
    "http://localhost:5173",
    "http://localhost:4173",
  ],
  allow_origin_regex=r"https://.*\.vercel\.app",
  allow_credentials=True,
  allow_methods=["GET", "POST", "OPTIONS"],
  allow_headers=["Authorization", "Content-Type"],
)

app.include_router(health_router)
app.include_router(sync_router)
app.include_router(draw_router)
app.include_router(columns_router)
