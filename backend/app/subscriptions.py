from dataclasses import dataclass, field
from enum import Enum


class SubscriptionTier(str, Enum):
    # BASIC снят с продажи, но остаётся здесь навсегда: тариф хранится в
    # базе строкой, и его резолвит и вебхук отложенного платежа, и экран
    # профиля действующего подписчика. Убрать значение из enum — значит
    # уронить и то, и другое.
    BASIC = "basic"
    PLUS = "plus"
    PREMIUM = "premium"
    MASTER = "master"


@dataclass(frozen=True)
class TierConfig:
    id: SubscriptionTier
    title: str
    price_rub: int
    monthly_quota: int
    description: str
    # Короткая плашка на карточке тарифа, на поведение не влияет.
    badge: str | None = None
    # Что входит помимо количества — то, чем тарифы отличаются друг от
    # друга по существу, а не размером пакета.
    perks: tuple[str, ...] = ()
    # False — тариф больше не продаётся, но продолжает работать у тех,
    # кто уже на нём. Такие тарифы не показываются в выборе и
    # отклоняются при попытке оплатить.
    purchasable: bool = True


# ВАЖНО: держать id, цены, квоты, описания, плашки и перки синхронно с
# frontend/src/types/subscription.ts (TIERS).
#
# Цены выстроены от бесплатного уровня: одна энергия в сутки — это около
# 30 разблокировок в месяц, поэтому платный тариф обязан давать заметно
# больше, иначе он не имеет смысла. Стоимость единицы падает с каждой
# ступенью (8,56 -> 4,99 -> 4,00 руб.) и в любом тарифе ниже, чем в самом
# выгодном пакете энергии (11,2 руб.) — пакеты продают отсутствие
# ежемесячного списания, а не цену.
#
# «Плюс» при этом сознательно невыгоден рядом с «Премиумом»: 200 руб.
# разницы дают вдвое больше разблокировок и свои вопросы. Это приманка,
# на фоне которой «Премиум» читается как очевидный выбор, а не ошибка
# расчёта — если понадобится сделать «Плюс» самостоятельным тарифом, ему
# нужна квота около 100.
TIERS: dict[SubscriptionTier, TierConfig] = {
    SubscriptionTier.BASIC: TierConfig(
        id=SubscriptionTier.BASIC,
        title="Базовый",
        price_rub=199,
        monthly_quota=10,
        description="Тариф снят с продажи. Действует до конца оплаченного периода.",
        purchasable=False,
    ),
    SubscriptionTier.PLUS: TierConfig(
        id=SubscriptionTier.PLUS,
        title="Плюс",
        price_rub=599,
        monthly_quota=70,
        description=(
            "70 разблокировок в месяц — больше двух в день. Для тех, кто "
            "раскладывает регулярно и не хочет считать оставшееся."
        ),
        perks=("70 разблокировок в месяц", "Все расклады"),
    ),
    SubscriptionTier.PREMIUM: TierConfig(
        id=SubscriptionTier.PREMIUM,
        title="Премиум",
        price_rub=799,
        monthly_quota=160,
        description=(
            "160 разблокировок в месяц и главное — свой вопрос к раскладу "
            "своими словами, а не только из готового списка."
        ),
        badge="Популярный",
        perks=(
            "160 разблокировок в месяц",
            "Свой вопрос к раскладу своими словами",
            "Все расклады",
        ),
    ),
    SubscriptionTier.MASTER: TierConfig(
        id=SubscriptionTier.MASTER,
        title="Магистр",
        price_rub=1199,
        monthly_quota=300,
        description=(
            "300 разблокировок в месяц, свои вопросы к раскладам и личный "
            "чат с поддержкой — разберём расклад, поможем с вопросом, "
            "ответим и по всему остальному."
        ),
        badge="Максимум",
        perks=(
            "300 разблокировок в месяц",
            "Свой вопрос к раскладу своими словами",
            "Личный чат с поддержкой",
            "Все расклады",
        ),
    ),
}


def purchasable_tiers() -> list[TierConfig]:
    """Тарифы, которые сейчас можно купить, в порядке возрастания цены."""
    return sorted((t for t in TIERS.values() if t.purchasable), key=lambda t: t.price_rub)


# Тарифы, дающие свой вопрос к раскладу своими словами. "admin" — не
# тариф из витрины, а промокод владельца, который и так обходит всё
# остальное (см. api/subscriptions.py::redeem_promo).
FREE_TEXT_TIERS = ("premium", "master", "admin")

# Тарифы с личным чатом поддержки.
SUPPORT_CHAT_TIERS = ("master", "admin")
