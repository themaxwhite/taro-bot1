from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import ai, health, history, payments, spreads, subscriptions
from app.config import settings
from app.db import init_db

app = FastAPI(title="Tarot Mini App API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    # MVP-grade migration story: create tables if missing. Move to
    # Alembic once the schema needs to change against real prod data.
    init_db()


app.include_router(health.router)
app.include_router(spreads.router)
app.include_router(history.router)
app.include_router(ai.router)
app.include_router(payments.router)
app.include_router(subscriptions.router)
