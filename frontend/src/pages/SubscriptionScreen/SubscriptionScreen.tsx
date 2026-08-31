import { useEffect, useState } from "react";
import {
  TIER_TITLES,
  type SubscriptionStatus,
  type SubscriptionTierId,
  type TierOption,
} from "../../types/subscription";
import {
  getSubscriptionStatus,
  redeemPromoCode,
  getEnergyPacks,
  getTiers,
} from "../../services/subscriptionsApi";
import type { EnergyPack } from "../../types/energy";
import { EnergyBalance } from "../../components/EnergyBalance/EnergyBalance";
import { SpreadsApiError } from "../../services/spreadsApi";
import { ScreenHeader } from "../../components/ScreenHeader/ScreenHeader";
import { Spinner } from "../../components/Spinner/Spinner";
import { openOffer } from "../../content/contacts";
import styles from "./SubscriptionScreen.module.css";

interface SubscriptionScreenProps {
  onBack: () => void;
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; subscription: SubscriptionStatus };

type PromoState = { status: "idle" } | { status: "checking" } | { status: "error"; message: string };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

function tierTitle(tier: string): string {
  // По названиям, а не по витрине с сервера: у пользователя может быть
  // активен тариф, снятый с продажи, и его всё равно нужно назвать.
  return TIER_TITLES[tier] ?? tier;
}

export function SubscriptionScreen({ onBack }: SubscriptionScreenProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [promoCode, setPromoCode] = useState("");
  const [promoState, setPromoState] = useState<PromoState>({ status: "idle" });
  const [packs, setPacks] = useState<EnergyPack[]>([]);
  const [tiers, setTiers] = useState<TierOption[]>([]);

  useEffect(() => {
    // Пакеты — витрина: если их не удалось загрузить, экран подписки
    // должен работать дальше, просто без этого блока.
    getEnergyPacks()
      .then(setPacks)
      .catch(() => {});
    // То же и с тарифами: витрина приходит с сервера, чтобы цена на
    // экране не могла разойтись с ценой в счёте.
    getTiers()
      .then(setTiers)
      .catch(() => {});
  }, []);

  function load() {
    setState({ status: "loading" });
    getSubscriptionStatus()
      .then((subscription) => setState({ status: "ready", subscription }))
      .catch((error: unknown) => {
        const message = error instanceof SpreadsApiError ? error.message : "Не удалось загрузить статус подписки.";
        setState({ status: "error", message });
      });
  }

  useEffect(load, []);

  async function handleRedeemPromo() {
    setPromoState({ status: "checking" });
    try {
      await redeemPromoCode(promoCode.trim());
      setPromoCode("");
      setPromoState({ status: "idle" });
      load();
    } catch (error) {
      const message = error instanceof SpreadsApiError ? error.message : "Не удалось активировать промокод.";
      setPromoState({ status: "error", message });
    }
  }

  const active = state.status === "ready" ? state.subscription : null;
  const isActiveTier = (tier: SubscriptionTierId) => active?.status === "active" && active.tier === tier;

  return (
    <div className={styles.screen}>
      <ScreenHeader title="Подписка" onBack={onBack} />

      {state.status === "loading" && (
        <div className={styles.centerState}>
          <Spinner />
        </div>
      )}

      {state.status === "error" && <p className={styles.error}>{state.message}</p>}

      {active?.status === "active" && (
        <div className={styles.currentCard}>
          <span className={styles.currentLabel}>Текущий тариф</span>
          <span className={styles.currentTitle}>{tierTitle(active.tier ?? "")}</span>
          <span className={styles.currentQuota}>
            Осталось {(active.quotaTotal ?? 0) - (active.quotaUsed ?? 0)} из {active.quotaTotal} в этом месяце
          </span>
          {active.periodEnd && (
            <span className={styles.currentRenew}>Действует до {formatDate(active.periodEnd)}</span>
          )}
        </div>
      )}

      {state.status === "ready" && (
        <div className={styles.balanceBlock}>
          <EnergyBalance
            balance={state.subscription.energy.balance}
            variant="detailed"
            breakdown={state.subscription.energy}
          />
          <p className={styles.balanceHint}>
            Одна энергия открывает расклад целиком — карты вместе с толкованием. Столько же стоит
            дополнительная карта или уточняющий вопрос. Карта дня бесплатна и не тратит энергию.
          </p>
        </div>
      )}

      {state.status !== "loading" && (packs.length > 0 || tiers.length > 0) && (
        <p className={styles.paymentsOff}>
          Оплата сейчас отключена — пополнить энергию и оформить подписку нельзя. Всё
          остальное работает: карта дня, суточная энергия и энергия за приглашённых друзей.
        </p>
      )}

      {packs.length > 0 && (
        <div className={styles.packs}>
          <h2 className={styles.sectionHeading}>Пополнить энергию</h2>
          <p className={styles.sectionHint}>Разово, без подписки. Купленная энергия не сгорает.</p>
          <div className={styles.packRow}>
            {packs.map((pack) => (
              <button key={pack.id} type="button" className={styles.packCard} disabled>
                {pack.badge && <span className={styles.packBadge}>{pack.badge}</span>}
                <span className={styles.packAmount}>✦ {pack.amount}</span>
                <span className={styles.packPrice}>{pack.priceRub} ₽</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {state.status !== "loading" && tiers.length > 0 && (
        <div className={styles.tiers}>
          <h2 className={styles.sectionHeading}>Подписка</h2>
          <p className={styles.sectionHint}>Запас разблокировок каждый месяц.</p>
          {tiers.map((tier) => (
            <div key={tier.id} className={styles.tierCard}>
              {tier.badge && <span className={styles.tierBadge}>{tier.badge}</span>}
              <div className={styles.tierHead}>
                <span className={styles.tierTitle}>{tier.title}</span>
                <span className={styles.tierPrice}>{tier.priceRub} ₽/мес</span>
              </div>
              <p className={styles.tierDescription}>{tier.description}</p>
              {tier.perks.length > 0 && (
                <ul className={styles.tierPerks}>
                  {tier.perks.map((perk) => (
                    <li key={perk} className={styles.tierPerk}>
                      {perk}
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" className={styles.tierButton} disabled>
                {isActiveTier(tier.id) ? "Уже активен" : "Пока недоступно"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Оферта — на экране, где принимают решение платить, а не только
          в настройках. Ссылка, а не копия текста: разошедшиеся редакции
          порядка возврата означали бы два разных обещания покупателю. */}
      {state.status !== "loading" && (
        <button type="button" className={styles.offerLink} onClick={openOffer}>
          Условия оказания услуг и порядок возврата ↗
        </button>
      )}

      {state.status !== "loading" && (
        <div className={styles.promoSection}>
          <label className={styles.promoLabel} htmlFor="promo-code">
            Есть промокод?
          </label>
          <div className={styles.promoRow}>
            <input
              id="promo-code"
              className={styles.promoInput}
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              placeholder="Введите код"
              autoCapitalize="off"
              autoCorrect="off"
            />
            <button
              type="button"
              className={styles.promoButton}
              disabled={!promoCode.trim() || promoState.status === "checking"}
              onClick={handleRedeemPromo}
            >
              {promoState.status === "checking" ? "…" : "Активировать"}
            </button>
          </div>
          {promoState.status === "error" && <p className={styles.error}>{promoState.message}</p>}
        </div>
      )}
    </div>
  );
}
