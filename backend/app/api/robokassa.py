"""
Приём оплаты через Робокассу.

Три точки:

* `POST /api/payments/robokassa/create` — приложение просит ссылку на
  оплату. Здесь же заводится строка платежа в статусе `pending`; её id и
  становится номером счёта для Робокассы.
* `POST|GET /api/payments/robokassa/result` — Робокасса сообщает, что
  деньги получены. Единственное место, где начисляется купленное.
* `GET /api/payments/robokassa/success|fail` — сюда возвращается человек
  из платёжной формы. Ничего не начисляет: вернуться в приложение можно и
  не заплатив, а «оплачено» говорит только ResultURL.

Разделение это не формальность, а защита от простейшего обмана: иначе
достаточно открыть адрес успеха руками, чтобы получить энергию бесплатно.
"""

import datetime as dt
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import PlainTextResponse, RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import robokassa
from app.api.deps import get_current_user
from app.config import settings
from app.db import get_db
from app.energy import ENERGY_PACKS
from app.models import SubscriptionPayment, User
from app.subscriptions import TIERS

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/payments/robokassa", tags=["payments"])

PROVIDER = "robokassa"


class CreatePaymentRequest(BaseModel):
    # "energy" + id пакета, либо "subscription" + id тарифа.
    kind: str
    item_id: str


class CreatePaymentResponse(BaseModel):
    payment_url: str
    invoice_id: int


def _require_configured() -> tuple[str, str]:
    if not settings.robokassa_merchant_login or not settings.robokassa_password1:
        raise HTTPException(status_code=503, detail="Приём оплаты пока не подключён")
    return settings.robokassa_merchant_login, settings.robokassa_password1


@router.post("/create", response_model=CreatePaymentResponse)
def create_payment(
    body: CreatePaymentRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CreatePaymentResponse:
    """Заводит платёж и отдаёт ссылку на форму оплаты."""
    merchant_login, password1 = _require_configured()

    if body.kind == "energy":
        pack = ENERGY_PACKS.get(body.item_id)
        if pack is None:
            raise HTTPException(status_code=404, detail="Такого пакета нет")
        amount_rub = pack.price_rub
        description = f"Taro Aurum: {pack.title}"
        payment = SubscriptionPayment(
            provider=PROVIDER,
            user_id=user.telegram_id,
            kind="energy",
            tier="",
            energy_amount=pack.amount,
            amount_rub=amount_rub,
            status="pending",
        )
    elif body.kind == "subscription":
        tier = next((t for t in TIERS.values() if t.id.value == body.item_id), None)
        if tier is None or not tier.purchasable:
            # Снятый с продажи тариф не должен продаваться по прямой
            # ссылке — цену и квоту для него никто не поддерживает.
            raise HTTPException(status_code=404, detail="Такого тарифа нет в продаже")
        amount_rub = tier.price_rub
        description = f"Taro Aurum: подписка «{tier.title}»"
        payment = SubscriptionPayment(
            provider=PROVIDER,
            user_id=user.telegram_id,
            kind="subscription",
            tier=tier.id.value,
            energy_amount=0,
            amount_rub=amount_rub,
            status="pending",
        )
    else:
        raise HTTPException(status_code=400, detail="Неизвестный тип покупки")

    # Строка нужна до ссылки: её id и есть номер счёта, который уйдёт в
    # Робокассу и вернётся обратно в уведомлении.
    db.add(payment)
    db.commit()
    db.refresh(payment)

    url = robokassa.payment_url(
        merchant_login=merchant_login,
        password1=password1,
        amount_rub=amount_rub,
        invoice_id=payment.id,
        description=description,
        is_test=settings.robokassa_test_mode,
    )
    logger.info(
        "Создан платёж %s: пользователь %s, %s, %s руб.",
        payment.id, user.telegram_id, description, amount_rub,
    )
    return CreatePaymentResponse(payment_url=url, invoice_id=payment.id)


@router.api_route("/result", methods=["GET", "POST"], response_class=PlainTextResponse)
async def payment_result(request: Request, db: Session = Depends(get_db)) -> PlainTextResponse:
    """
    Уведомление от Робокассы. Единственное место, где что-то начисляется.
    """
    if not settings.robokassa_password2:
        logger.error("Уведомление получено, но ROBOKASSA_PASSWORD2 не задан")
        raise HTTPException(status_code=503, detail="not configured")

    form = dict(request.query_params)
    if request.method == "POST":
        form.update({k: str(v) for k, v in (await request.form()).items()})

    amount = form.get("OutSum", "")
    invoice_raw = form.get("InvId", "")
    signature = form.get("SignatureValue", "")

    if not robokassa.result_signature_valid(
        amount=amount,
        invoice_id=invoice_raw,
        password2=settings.robokassa_password2,
        received=signature,
    ):
        logger.warning("Уведомление с неверной подписью, счёт %r", invoice_raw)
        raise HTTPException(status_code=400, detail="bad signature")

    if not invoice_raw.isdigit():
        raise HTTPException(status_code=400, detail="bad invoice")
    payment = db.get(SubscriptionPayment, int(invoice_raw))
    if payment is None:
        logger.error("Уведомление по неизвестному счёту %s", invoice_raw)
        raise HTTPException(status_code=404, detail="unknown invoice")

    if payment.status == "succeeded":
        # Робокасса повторяет уведомление, пока не получит подтверждения, и
        # повтор после успешной обработки — норма, а не ошибка. Отвечаем
        # тем же «OK», но ничего не начисляем второй раз.
        logger.info("Повторное уведомление по счёту %s — уже зачтён", payment.id)
        return PlainTextResponse(robokassa.result_ok(payment.id))

    # Сверяем сумму: подпись подтверждает, что уведомление от Робокассы, но
    # не что заплатили столько, сколько мы выставили.
    if amount != robokassa.format_amount(payment.amount_rub):
        logger.error(
            "Счёт %s: пришло %s, ожидалось %s — не зачитываем",
            payment.id, amount, robokassa.format_amount(payment.amount_rub),
        )
        raise HTTPException(status_code=400, detail="amount mismatch")

    user = db.get(User, payment.user_id)
    if user is None:
        logger.error("Счёт %s: пользователь %s пропал", payment.id, payment.user_id)
        raise HTTPException(status_code=404, detail="unknown user")

    if payment.kind == "energy":
        user.purchased_energy += payment.energy_amount
    else:
        tier = next((t for t in TIERS.values() if t.id.value == payment.tier), None)
        if tier is None:
            logger.error("Счёт %s: неизвестный тариф %r", payment.id, payment.tier)
            raise HTTPException(status_code=400, detail="unknown tier")
        subscription = _activate(db, user.telegram_id, tier)
        logger.info("Счёт %s: включена подписка %s до %s", payment.id, tier.id.value, subscription)

    payment.status = "succeeded"
    payment.provider_payment_id = form.get("PaymentMethod") or None
    db.commit()

    logger.info(
        "Счёт %s оплачен: пользователь %s, %s руб.",
        payment.id, payment.user_id, payment.amount_rub,
    )
    return PlainTextResponse(robokassa.result_ok(payment.id))


def _activate(db: Session, user_id: int, tier) -> dt.datetime:
    """Включает подписку. Вынесено сюда, чтобы обработчик читался."""
    from app.api.subscriptions import _activate_subscription

    _activate_subscription(
        db, user_id, tier=tier.id.value, quota_total=tier.monthly_quota, days=30
    )
    return dt.datetime.utcnow() + dt.timedelta(days=30)


@router.get("/success")
def payment_success() -> RedirectResponse:
    """
    Возврат человека из формы оплаты.

    Ничего не начисляет и ничему не верит: сюда можно прийти и не заплатив,
    просто открыв адрес. Начисление живёт только в обработчике уведомлений.
    """
    return RedirectResponse(settings.mini_app_return_url or "https://t.me", status_code=302)


@router.get("/fail")
def payment_fail() -> RedirectResponse:
    return RedirectResponse(settings.mini_app_return_url or "https://t.me", status_code=302)
