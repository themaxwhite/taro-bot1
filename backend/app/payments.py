"""
Начисление купленного.

Вынесено из обработчика уведомлений Робокассы, потому что зачесть платёж
теперь можно двумя путями: автоматически, по уведомлению, и вручную из
админ-панели, когда уведомление не дошло. Разойтись эти пути не должны —
иначе ручной зачёт однажды начислит не то, что начислил бы обычный.

Здесь только начисление. Проверка подписи, суммы и прав живёт у
вызывающих: у обработчика уведомления это подпись Робокассы, у панели —
список администраторов.
"""

import datetime as dt
import logging

from sqlalchemy.orm import Session

from app.models import Subscription, SubscriptionPayment, User
from app.subscriptions import TIERS

logger = logging.getLogger(__name__)

SUBSCRIPTION_DAYS = 30


class CreditError(Exception):
    """Начислить нельзя: неизвестный тариф или пропавший пользователь."""


def credit(db: Session, payment: SubscriptionPayment) -> str:
    """
    Начисляет купленное и переводит платёж в «оплачен».

    Возвращает описание того, что начислено, — для лога и для ответа
    панели. Ничего не проверяет про повторы: вызывающий обязан убедиться,
    что платёж ещё не зачтён, иначе энергия начислится дважды.
    """
    user = db.get(User, payment.user_id)
    if user is None:
        raise CreditError(f"пользователь {payment.user_id} не найден")

    if payment.kind == "energy":
        user.purchased_energy += payment.energy_amount
        what = f"{payment.energy_amount} энергии"
    else:
        tier = next((t for t in TIERS.values() if t.id.value == payment.tier), None)
        if tier is None:
            raise CreditError(f"неизвестный тариф {payment.tier!r}")

        sub = db.get(Subscription, user.telegram_id)
        if sub is None:
            sub = Subscription(user_id=user.telegram_id)
            db.add(sub)
        sub.tier = tier.id.value
        sub.status = "active"
        sub.quota_total = tier.monthly_quota
        sub.quota_used = 0
        sub.period_end = dt.datetime.utcnow() + dt.timedelta(days=SUBSCRIPTION_DAYS)
        what = f"подписка «{tier.title}» до {sub.period_end:%d.%m.%Y}"

    payment.status = "succeeded"
    db.commit()

    logger.info("Счёт %s зачтён: пользователь %s, %s", payment.id, payment.user_id, what)
    return what
