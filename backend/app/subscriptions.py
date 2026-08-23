from dataclasses import dataclass
from enum import Enum


class SubscriptionTier(str, Enum):
    BASIC = "basic"
    PLUS = "plus"


@dataclass(frozen=True)
class TierConfig:
    id: SubscriptionTier
    title: str
    price_rub: int
    monthly_quota: int
    description: str


# IMPORTANT: keep tier ids, prices and quotas in sync with
# frontend/src/types/subscription.ts (TIERS). Any change here requires a
# matching change on the frontend, and vice versa.
TIERS: dict[SubscriptionTier, TierConfig] = {
    SubscriptionTier.BASIC: TierConfig(
        id=SubscriptionTier.BASIC,
        title="Базовый",
        price_rub=199,
        monthly_quota=10,
        description="10 разблокировок в месяц — подробное толкование расклада или дополнительная карта",
    ),
    SubscriptionTier.PLUS: TierConfig(
        id=SubscriptionTier.PLUS,
        title="Плюс",
        price_rub=399,
        monthly_quota=30,
        description="30 разблокировок в месяц — для тех, кто гадает часто",
    ),
}
