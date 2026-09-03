import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    admin,
    admin_auth,
    ai,
    chat,
    health,
    history,
    payments,
    referral,
    robokassa,
    spreads,
    subscriptions,
)
from app.config import settings
from app.db import init_db
from app.notifications import send_daily_reminders

# Без этого корневой логгер остаётся на WARNING, и каждый logger.info в
# коде приложения пропадает молча. Заметно это стало на платежах: строка
# «Счёт N оплачен, начислено …» не писалась никуда, и об успешном зачёте
# можно было судить только по коду ответа. Ошибки при этом были видны — то
# есть в логах оставались одни неприятности, без подтверждений, что
# остальное отработало.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

app = FastAPI(
    title="Tarot Mini App API",
    version="0.1.0",
    # Схема API снаружи нужна только при разработке — см. EXPOSE_API_DOCS.
    docs_url="/docs" if settings.expose_api_docs else None,
    redoc_url=None,
    openapi_url="/openapi.json" if settings.expose_api_docs else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

scheduler = AsyncIOScheduler()


@app.on_event("startup")
def on_startup() -> None:
    # Runs the Alembic migrations (and, the first time, adopts a
    # database that predates them) — see app/db.py::init_db.
    init_db()

    # In-process scheduler for the daily "карта дня" reminder — no
    # external cron to set up, the job just runs as long as the app does.
    scheduler.add_job(
        send_daily_reminders,
        "cron",
        hour=settings.daily_notification_hour_utc,
        minute=0,
    )
    scheduler.start()


@app.on_event("shutdown")
def on_shutdown() -> None:
    scheduler.shutdown(wait=False)


app.include_router(health.router)
app.include_router(spreads.router)
app.include_router(history.router)
app.include_router(ai.router)
app.include_router(payments.router)
app.include_router(subscriptions.router)
app.include_router(referral.router)
app.include_router(admin.router)
app.include_router(admin_auth.router)
app.include_router(robokassa.router)
app.include_router(chat.router)
