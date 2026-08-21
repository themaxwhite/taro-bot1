import secrets

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.config import settings
from app.db import get_db
from app.models import Purchase, SpreadRecord, User
from app.telegram.bot_api import TelegramApiError, answer_pre_checkout_query, create_invoice_link

router = APIRouter(prefix="/api", tags=["payments"])


PRODUCTS = {
    "interpretation": {
        "title": "Подробное толкование расклада",
        "description": "Развёрнутое AI-толкование именно вашего расклада, с учётом вопроса и интересов.",
        "stars": lambda: settings.price_interpretation_stars,
    },
    "extra_card": {
        "title": "Дополнительная карта",
        "description": "Вытянуть ещё одну карту к уже сделанному раскладу.",
        "stars": lambda: settings.price_extra_card_stars,
    },
}


class CreateInvoiceRequest(BaseModel):
    product: str
    spread_record_id: int


class CreateInvoiceResponse(BaseModel):
    invoice_link: str
    payload: str


class PaymentStatusResponse(BaseModel):
    status: str  # "pending" | "paid"
    product: str
    spread_record_id: int


@router.post("/payments/create-invoice", response_model=CreateInvoiceResponse)
async def create_invoice(
    body: CreateInvoiceRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CreateInvoiceResponse:
    if body.product not in PRODUCTS:
        raise HTTPException(status_code=400, detail="Unknown product")

    record = db.get(SpreadRecord, body.spread_record_id)
    if record is None or record.user_id != user.telegram_id:
        raise HTTPException(status_code=404, detail="Spread not found")

    if not settings.telegram_bot_token:
        raise HTTPException(
            status_code=400,
            detail="TELEGRAM_BOT_TOKEN не настроен на сервере — оплата недоступна в dev-режиме.",
        )

    payload = secrets.token_urlsafe(16)
    purchase = Purchase(
        payload=payload,
        user_id=user.telegram_id,
        product=body.product,
        spread_record_id=record.id,
        status="pending",
    )
    db.add(purchase)
    db.commit()

    product = PRODUCTS[body.product]
    try:
        link = await create_invoice_link(
            title=product["title"],
            description=product["description"],
            payload=payload,
            stars=product["stars"](),
        )
    except TelegramApiError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return CreateInvoiceResponse(invoice_link=link, payload=payload)


@router.get("/payments/status", response_model=PaymentStatusResponse)
def get_payment_status(
    payload: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PaymentStatusResponse:
    purchase = db.execute(
        select(Purchase).where(Purchase.payload == payload, Purchase.user_id == user.telegram_id)
    ).scalar_one_or_none()
    if purchase is None:
        raise HTTPException(status_code=404, detail="Purchase not found")
    return PaymentStatusResponse(
        status=purchase.status, product=purchase.product, spread_record_id=purchase.spread_record_id
    )


@router.post("/telegram/webhook")
async def telegram_webhook(request: Request, db: Session = Depends(get_db)) -> dict:
    """
    Telegram calls this directly (not from the Mini App) — configure it
    once via `setWebhook` (see DEPLOYMENT.md). Authenticated by the
    secret token Telegram echoes back in a header, not by user initData.
    """
    if settings.telegram_webhook_secret:
        header = request.headers.get("X-Telegram-Bot-Api-Secret-Token")
        if header != settings.telegram_webhook_secret:
            raise HTTPException(status_code=401, detail="Invalid webhook secret")

    update = await request.json()

    pre_checkout_query = update.get("pre_checkout_query")
    if pre_checkout_query is not None:
        payload = pre_checkout_query.get("invoice_payload", "")
        purchase = db.execute(select(Purchase).where(Purchase.payload == payload)).scalar_one_or_none()
        ok = purchase is not None and purchase.status == "pending"
        await answer_pre_checkout_query(
            pre_checkout_query["id"], ok, error_message=None if ok else "Заказ не найден или уже оплачен."
        )
        return {"ok": True}

    message = update.get("message") or {}
    successful_payment = message.get("successful_payment")
    if successful_payment is not None:
        payload = successful_payment.get("invoice_payload", "")
        purchase = db.execute(select(Purchase).where(Purchase.payload == payload)).scalar_one_or_none()
        if purchase is not None and purchase.status == "pending":
            purchase.status = "paid"
            purchase.telegram_payment_charge_id = successful_payment.get("telegram_payment_charge_id")
            db.commit()
        return {"ok": True}

    return {"ok": True}
