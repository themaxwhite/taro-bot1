import { useEffect, useState } from "react";
import { TIERS, type SubscriptionStatus, type SubscriptionTierId } from "../../types/subscription";
import { getSubscriptionStatus, subscribeToTier, redeemPromoCode } from "../../services/subscriptionsApi";
import { SpreadsApiError } from "../../services/spreadsApi";
import { ScreenHeader } from "../../components/ScreenHeader/ScreenHeader";
import { Spinner } from "../../components/Spinner/Spinner";
import styles from "./SubscriptionScreen.module.css";

interface SubscriptionScreenProps {
  onBack: () => void;
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; subscription: SubscriptionStatus };

type BuyState = { status: "idle" } | { status: "paying"; tier: SubscriptionTierId } | { status: "error"; message: string };

type PromoState = { status: "idle" } | { status: "checking" } | { status: "error"; message: string };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

function tierTitle(tier: string): string {
  return TIERS.find((t) => t.id === tier)?.title ?? (tier === "admin" ? "Админ-доступ" : tier);
}

export function SubscriptionScreen({ onBack }: SubscriptionScreenProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [buyState, setBuyState] = useState<BuyState>({ status: "idle" });
  const [promoCode, setPromoCode] = useState("");
  const [promoState, setPromoState] = useState<PromoState>({ status: "idle" });

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

  async function handleSubscribe(tier: SubscriptionTierId) {
    setBuyState({ status: "paying", tier });
    try {
      await subscribeToTier(tier);
      setBuyState({ status: "idle" });
      load();
    } catch (error) {
      const message = error instanceof SpreadsApiError ? error.message : "Не удалось оформить подписку.";
      setBuyState({ status: "error", message });
    }
  }

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

      {state.status !== "loading" && (
        <div className={styles.tiers}>
          {TIERS.map((tier) => (
            <div key={tier.id} className={styles.tierCard}>
              {tier.badge && <span className={styles.tierBadge}>{tier.badge}</span>}
              <div className={styles.tierHead}>
                <span className={styles.tierTitle}>{tier.title}</span>
                <span className={styles.tierPrice}>{tier.priceRub} ₽/мес</span>
              </div>
              <p className={styles.tierDescription}>{tier.description}</p>
              <button
                type="button"
                className={styles.tierButton}
                disabled={buyState.status === "paying" || isActiveTier(tier.id)}
                onClick={() => handleSubscribe(tier.id)}
              >
                {isActiveTier(tier.id)
                  ? "Уже активен"
                  : buyState.status === "paying" && buyState.tier === tier.id
                    ? "Ждём подтверждение оплаты…"
                    : "Оформить"}
              </button>
            </div>
          ))}
        </div>
      )}

      {buyState.status === "error" && <p className={styles.error}>{buyState.message}</p>}

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
