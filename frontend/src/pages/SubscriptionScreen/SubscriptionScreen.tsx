import { useEffect, useState } from "react";
import { TIERS, type SubscriptionStatus, type SubscriptionTierId } from "../../types/subscription";
import {
  getSubscriptionStatus,
  subscribeToTier,
  redeemPromoCode,
  getEnergyPacks,
  buyEnergyPack,
} from "../../services/subscriptionsApi";
import type { EnergyPack } from "../../types/energy";
import { EnergyBalance } from "../../components/EnergyBalance/EnergyBalance";
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

type PackState = { status: "idle" } | { status: "paying"; packId: string } | { status: "error"; message: string };

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
  const [packs, setPacks] = useState<EnergyPack[]>([]);
  const [packState, setPackState] = useState<PackState>({ status: "idle" });

  useEffect(() => {
    // Пакеты — витрина: если их не удалось загрузить, экран подписки
    // должен работать дальше, просто без этого блока.
    getEnergyPacks()
      .then(setPacks)
      .catch(() => {});
  }, []);

  async function handleBuyPack(packId: string) {
    setPackState({ status: "paying", packId });
    try {
      await buyEnergyPack(packId);
      setPackState({ status: "idle" });
      load();
    } catch (error) {
      const message = error instanceof SpreadsApiError ? error.message : "Не удалось пополнить энергию.";
      setPackState({ status: "error", message });
    }
  }

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

      {packs.length > 0 && (
        <div className={styles.packs}>
          <h2 className={styles.sectionHeading}>Пополнить энергию</h2>
          <p className={styles.sectionHint}>Разово, без подписки. Купленная энергия не сгорает.</p>
          <div className={styles.packRow}>
            {packs.map((pack) => (
              <button
                key={pack.id}
                type="button"
                className={styles.packCard}
                disabled={packState.status === "paying"}
                onClick={() => handleBuyPack(pack.id)}
              >
                {pack.badge && <span className={styles.packBadge}>{pack.badge}</span>}
                <span className={styles.packAmount}>✦ {pack.amount}</span>
                <span className={styles.packPrice}>
                  {packState.status === "paying" && packState.packId === pack.id
                    ? "Ждём оплату…"
                    : `${pack.priceRub} ₽`}
                </span>
              </button>
            ))}
          </div>
          {packState.status === "error" && <p className={styles.error}>{packState.message}</p>}
        </div>
      )}

      {state.status !== "loading" && (
        <div className={styles.tiers}>
          <h2 className={styles.sectionHeading}>Подписка</h2>
          <p className={styles.sectionHint}>Запас разблокировок каждый месяц.</p>
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
