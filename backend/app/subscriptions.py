from dataclasses import dataclass
from enum import Enum


class SubscriptionTier(str, Enum):
    BASIC = "basic"
    PLUS = "plus"
    PREMIUM = "premium"


@dataclass(frozen=True)
class TierConfig:
    id: SubscriptionTier
    title: str
    price_rub: int
    monthly_quota: int
    description: str
    # Short label shown as a badge on the tier card — purely marketing,
    # no effect on behavior. None for tiers that don't need one.
    badge: str | None = None


# IMPORTANT: keep tier ids, prices, quotas, descriptions and badges in
# sync with frontend/src/types/subscription.ts (TIERS). Any change here
# requires a matching change on the frontend, and vice versa.
TIERS: dict[SubscriptionTier, TierConfig] = {
    SubscriptionTier.BASIC: TierConfig(
        id=SubscriptionTier.BASIC,
        title="Базовый",
        price_rub=199,
        monthly_quota=10,
        description=(
            "10 разблокировок в месяц — подробное толкование расклада, "
            "дополнительная карта или уточняющий вопрос. Хороший старт, "
            "если гадаете время от времени и хотите более глубокий ответ, "
            "когда он действительно нужен."
        ),
    ),
    SubscriptionTier.PLUS: TierConfig(
        id=SubscriptionTier.PLUS,
        title="Плюс",
        price_rub=399,
        monthly_quota=30,
        description=(
            "30 разблокировок в месяц — хватит почти на каждый день. "
            "Самый популярный тариф среди тех, кто уже не представляет "
            "расклад без подробного толкования."
        ),
        badge="Популярный",
    ),
    SubscriptionTier.PREMIUM: TierConfig(
        id=SubscriptionTier.PREMIUM,
        title="Премиум",
        price_rub=799,
        monthly_quota=100,
        description=(
            "100 разблокировок в месяц и эксклюзив: свой вопрос к раскладу "
            "своими словами, а не только из готового списка. Для тех, кому "
            "нужен настоящий разговор с картами, а не шаблонные ответы."
        ),
        badge="Максимум",
    ),
}
