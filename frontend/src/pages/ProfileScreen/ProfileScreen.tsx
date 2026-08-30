import { useEffect, useState } from "react";
import { useTelegramUser } from "../../hooks/useTelegramUser";
import type { ProfileInsights, ProfileStats } from "../../types/history";
import type { Theme } from "../../hooks/useTheme";
import { TIER_TITLES, type SubscriptionStatus } from "../../types/subscription";
import {
  fetchProfileStats,
  fetchProfileInsights,
  fetchProfile,
  updateNotifications,
  type ZodiacSign,
} from "../../services/historyApi";
import { getSubscriptionStatus } from "../../services/subscriptionsApi";
import { EnergyBalance } from "../../components/EnergyBalance/EnergyBalance";
import { ScreenHeader } from "../../components/ScreenHeader/ScreenHeader";
import { Avatar } from "../../components/Avatar/Avatar";
import { StatRow } from "../../components/StatRow/StatRow";
import { Switch } from "../../components/Switch/Switch";
import { MysticalBackground } from "../../components/MysticalBackground/MysticalBackground";
import { IdentityCard } from "../../components/IdentityCard/IdentityCard";
import { isSoundEnabled, playTap, setSoundEnabled } from "../../feedback/sound";
import styles from "./ProfileScreen.module.css";

interface ProfileScreenProps {
  onBack: () => void;
  onOpenSubscription: () => void;
  onOpenTerms: () => void;
  onOpenGuide: () => void;
  onOpenStats: () => void;
  onOpenReferral: () => void;
  onOpenAdmin: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}

function daysWord(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 14) return "дней";
  switch (n % 10) {
    case 1:
      return "день";
    case 2:
    case 3:
    case 4:
      return "дня";
    default:
      return "дней";
  }
}

/**
 * Подпись под серией дней подряд: ради чего эта цифра растёт. Пока
 * награда за серию не была видна, счётчик оставался просто числом.
 */
function streakRewardLabel(stats: ProfileStats | null): string | null {
  if (!stats?.nextRewardDay || !stats.nextRewardEnergy) return null;
  const left = stats.nextRewardDay - stats.daysStreak;
  if (left <= 0) return null;
  return `Ещё ${left} ${daysWord(left)} подряд — и ✦ ${stats.nextRewardEnergy} в подарок`;
}

function subscriptionLabel(sub: SubscriptionStatus | null): string {
  if (sub === null || sub.status !== "active") return "Нет активной подписки";
  if (sub.tier === "admin") return "Админ-доступ активен";
  const title = TIER_TITLES[sub.tier ?? ""] ?? sub.tier ?? "";
  return `${title} — осталось ${(sub.quotaTotal ?? 0) - (sub.quotaUsed ?? 0)} из ${sub.quotaTotal}`;
}

export function ProfileScreen({
  onBack,
  onOpenSubscription,
  onOpenTerms,
  onOpenGuide,
  onOpenStats,
  onOpenReferral,
  onOpenAdmin,
  theme,
  onToggleTheme,
}: ProfileScreenProps) {
  const { firstName, username, photoUrl } = useTelegramUser();
  const [stats, setStats] = useState<ProfileStats | null>(null);
  // Сводка грузится отдельным запросом: она заметно тяжелее трёх чисел в
  // шапке (разбирает карты всех раскладов), и её задержка не должна
  // держать остальной экран.
  const [insights, setInsights] = useState<ProfileInsights | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [zodiacSign, setZodiacSign] = useState<ZodiacSign | null>(null);
  const [patronCard, setPatronCard] = useState<string | null>(null);
  // Живёт в localStorage, а не на сервере: это свойство устройства, а не
  // человека — со звуком дома и без звука в метро один и тот же аккаунт.
  const [soundOn, setSoundOn] = useState(isSoundEnabled);
  const [notificationsBusy, setNotificationsBusy] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchProfileInsights()
      .then((data) => {
        if (!cancelled) setInsights(data);
      })
      .catch(() => {
        // Не критично: блоки статистики просто не появятся.
      });
    fetchProfileStats()
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch(() => {
        // Non-critical for this screen — StatRow just falls back to "—".
      });
    fetchProfile()
      .then((data) => {
        if (!cancelled) {
          setNotificationsEnabled(data.notificationsEnabled);
          setZodiacSign(data.zodiacSign);
          setPatronCard(data.patronCard);
          setIsAdmin(data.isAdmin);
        }
      })
      .catch(() => {});
    getSubscriptionStatus()
      .then((value) => {
        if (!cancelled) setSubscription(value);
      })
      .catch(() => {
        // Non-critical — the subscription row just falls back to "Нет активной подписки".
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleToggleNotifications(next: boolean) {
    const previous = notificationsEnabled;
    setNotificationsEnabled(next); // optimistic — a toggle that lags feels broken
    setNotificationsBusy(true);
    try {
      await updateNotifications(next);
    } catch {
      setNotificationsEnabled(previous);
    } finally {
      setNotificationsBusy(false);
    }
  }

  const activeTier = subscription?.status === "active" ? subscription.tier : null;

  return (
    <div className={styles.screen}>
      <MysticalBackground density="subtle" />
      <ScreenHeader title="Профиль" onBack={onBack} />

      <div className={styles.identity}>
        <Avatar photoUrl={photoUrl} firstName={firstName} tier={activeTier} />
        <span className={styles.name}>{firstName ?? "Гость"}</span>
        {username && <span className={styles.username}>@{username}</span>}
      </div>

      <StatRow
        stats={[
          { label: "Раскладов", value: stats?.totalSpreads ?? "—" },
          { label: "Дней подряд", value: stats?.daysStreak ?? "—" },
          // Энергии здесь намеренно нет: сразу под этой строкой стоит
          // аккумулятор с разбивкой по источникам, и то же число выше
          // было просто вторым его написанием.
          { label: "Карт вытянуто", value: insights?.totalCards ?? "—" },
        ]}
      />

      {streakRewardLabel(stats) && <p className={styles.streakHint}>{streakRewardLabel(stats)}</p>}

      {subscription && (
        <div className={styles.energyRow}>
          <EnergyBalance
            balance={subscription.energy.balance}
            variant="detailed"
            breakdown={subscription.energy}
            onClick={onOpenSubscription}
          />
          {/* Одна строка вместо прежнего абзаца на четыре: подробное
              объяснение теперь живёт в «Как это работает», и повторять
              его здесь значило держать на экране справку, которую
              читают один раз. */}
          <p className={styles.energyHint}>
            Одна энергия открывает расклад целиком. Одна приходит каждый день.
          </p>
        </div>
      )}

      <IdentityCard
        zodiacSign={zodiacSign}
        patronCard={patronCard}
        onChange={(next) => {
          if (next.zodiacSign !== undefined) setZodiacSign(next.zodiacSign);
          if (next.patronCard !== undefined) setPatronCard(next.patronCard);
        }}
      />

      <div className={`${styles.settingsList} ${styles.subscriptionRow}`}>
        <button
          type="button"
          className={`${styles.settingsItem} ${activeTier ? styles.subscriptionActive : ""} ${
            activeTier === "premium" || activeTier === "admin" ? styles.subscriptionPremium : ""
          }`}
          onClick={onOpenSubscription}
        >
          <span className={styles.settingsIcon} aria-hidden="true">
            ⭐
          </span>
          <span className={styles.settingsLabel}>{subscriptionLabel(subscription)}</span>
          <span className={styles.chevron} aria-hidden="true">
            ›
          </span>
        </button>
        <button type="button" className={styles.settingsItem} onClick={onOpenStats}>
          <span className={styles.settingsIcon} aria-hidden="true">
            📊
          </span>
          <span className={styles.settingsLabel}>Статистика и достижения</span>
          <span className={styles.chevron} aria-hidden="true">
            ›
          </span>
        </button>
        <button type="button" className={styles.settingsItem} onClick={onOpenReferral}>
          <span className={styles.settingsIcon} aria-hidden="true">
            🎁
          </span>
          <span className={styles.settingsLabel}>Пригласить друзей</span>
          <span className={styles.chevron} aria-hidden="true">
            ›
          </span>
        </button>
      </div>

      <div className={styles.settingsList}>
        <div className={styles.settingsItem}>
          <span className={styles.settingsIcon} aria-hidden="true">
            🔔
          </span>
          <span className={styles.settingsLabel}>Напоминание о карте дня</span>
          <Switch
            checked={notificationsEnabled}
            onChange={handleToggleNotifications}
            disabled={notificationsBusy}
            ariaLabel="Напоминание о карте дня"
          />
        </div>
        <div className={styles.settingsItem}>
          <span className={styles.settingsIcon} aria-hidden="true">
            🔉
          </span>
          <span className={styles.settingsLabel}>Звук карт</span>
          <Switch
            checked={soundOn}
            onChange={(next) => {
              setSoundEnabled(next);
              setSoundOn(next);
              // Включили — сразу слышно, что именно включили.
              if (next) playTap();
            }}
            ariaLabel="Звук карт"
          />
        </div>
        <div className={styles.settingsItem}>
          <span className={styles.settingsIcon} aria-hidden="true">
            🌙
          </span>
          <span className={styles.settingsLabel}>Тёмная тема</span>
          <Switch
            checked={theme === "dark"}
            onChange={onToggleTheme}
            ariaLabel="Тёмная тема"
          />
        </div>
        <button type="button" className={styles.settingsItem} onClick={onOpenGuide}>
          <span className={styles.settingsIcon} aria-hidden="true">
            💡
          </span>
          <span className={styles.settingsLabel}>Как это работает</span>
          <span className={styles.chevron} aria-hidden="true">
            ›
          </span>
        </button>
        <button type="button" className={styles.settingsItem} onClick={onOpenTerms}>
          <span className={styles.settingsIcon} aria-hidden="true">
            📄
          </span>
          <span className={styles.settingsLabel}>Условия использования</span>
          <span className={styles.chevron} aria-hidden="true">
            ›
          </span>
        </button>
        {isAdmin && (
          <button type="button" className={styles.settingsItem} onClick={onOpenAdmin}>
            <span className={styles.settingsIcon} aria-hidden="true">
              📊
            </span>
            <span className={styles.settingsLabel}>Дашборд</span>
            <span className={styles.chevron} aria-hidden="true">
              ›
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
