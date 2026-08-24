import { useEffect, useState } from "react";
import { useTelegramUser } from "../../hooks/useTelegramUser";
import type { ProfileStats } from "../../types/history";
import type { SubscriptionStatus } from "../../types/subscription";
import { fetchProfileStats, fetchProfile, updateInterests, updateNotifications } from "../../services/historyApi";
import { getSubscriptionStatus } from "../../services/subscriptionsApi";
import { ScreenHeader } from "../../components/ScreenHeader/ScreenHeader";
import { Avatar } from "../../components/Avatar/Avatar";
import { StatRow } from "../../components/StatRow/StatRow";
import { Switch } from "../../components/Switch/Switch";
import styles from "./ProfileScreen.module.css";

interface ProfileScreenProps {
  onBack: () => void;
  onOpenSubscription: () => void;
  onOpenTerms: () => void;
  onOpenReferral: () => void;
  onOpenAdmin: () => void;
}

function subscriptionLabel(sub: SubscriptionStatus | null): string {
  if (sub === null || sub.status !== "active") return "Нет активной подписки";
  if (sub.tier === "admin") return "Админ-доступ активен";
  const title = sub.tier === "plus" ? "Плюс" : "Базовый";
  return `${title} — осталось ${(sub.quotaTotal ?? 0) - (sub.quotaUsed ?? 0)} из ${sub.quotaTotal}`;
}

export function ProfileScreen({
  onBack,
  onOpenSubscription,
  onOpenTerms,
  onOpenReferral,
  onOpenAdmin,
}: ProfileScreenProps) {
  const { firstName, username, photoUrl } = useTelegramUser();
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [interests, setInterests] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationsBusy, setNotificationsBusy] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
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
          setInterests(data.interests);
          setNotificationsEnabled(data.notificationsEnabled);
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

  async function handleSaveInterests() {
    setSaveState("saving");
    try {
      await updateInterests(interests.trim());
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1500);
    } catch {
      setSaveState("idle");
    }
  }

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

  return (
    <div className={styles.screen}>
      <ScreenHeader title="Профиль" onBack={onBack} />

      <div className={styles.identity}>
        <Avatar photoUrl={photoUrl} firstName={firstName} />
        <span className={styles.name}>{firstName ?? "Гость"}</span>
        {username && <span className={styles.username}>@{username}</span>}
      </div>

      <StatRow
        stats={[
          { label: "Раскладов", value: stats?.totalSpreads ?? "—" },
          { label: "Дней подряд", value: stats?.daysStreak ?? "—" },
        ]}
      />

      <div className={`${styles.settingsList} ${styles.subscriptionRow}`}>
        <button type="button" className={styles.settingsItem} onClick={onOpenSubscription}>
          <span className={styles.settingsIcon} aria-hidden="true">
            ⭐
          </span>
          <span className={styles.settingsLabel}>{subscriptionLabel(subscription)}</span>
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

      <div className={styles.interestsSection}>
        <label className={styles.interestsLabel} htmlFor="profile-interests">
          Ваши темы
        </label>
        <p className={styles.interestsHint}>
          Учитываются в AI-толковании расклада — например: отношения, карьера, переезд
        </p>
        <textarea
          id="profile-interests"
          className={styles.interestsInput}
          value={interests}
          maxLength={500}
          rows={2}
          onChange={(e) => setInterests(e.target.value)}
        />
        <button type="button" className={styles.saveButton} onClick={handleSaveInterests}>
          {saveState === "saving" ? "Сохранение…" : saveState === "saved" ? "Сохранено ✓" : "Сохранить"}
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
