import { useEffect, useState } from "react";
import { useTelegramUser } from "../../hooks/useTelegramUser";
import type { ProfileStats } from "../../types/history";
import type { SubscriptionStatus } from "../../types/subscription";
import { fetchProfileStats, fetchInterests, updateInterests } from "../../services/historyApi";
import { getSubscriptionStatus } from "../../services/subscriptionsApi";
import { ScreenHeader } from "../../components/ScreenHeader/ScreenHeader";
import { Avatar } from "../../components/Avatar/Avatar";
import { StatRow } from "../../components/StatRow/StatRow";
import styles from "./ProfileScreen.module.css";

interface ProfileScreenProps {
  onBack: () => void;
  onOpenSubscription: () => void;
}

const SETTINGS_ITEMS = [
  { icon: "🔔", label: "Уведомления" },
  { icon: "🌐", label: "Язык" },
  { icon: "📄", label: "Условия использования" },
];

function subscriptionLabel(sub: SubscriptionStatus | null): string {
  if (sub === null || sub.status !== "active") return "Нет активной подписки";
  if (sub.tier === "admin") return "Админ-доступ активен";
  const title = sub.tier === "plus" ? "Плюс" : "Базовый";
  return `${title} — осталось ${(sub.quotaTotal ?? 0) - (sub.quotaUsed ?? 0)} из ${sub.quotaTotal}`;
}

export function ProfileScreen({ onBack, onOpenSubscription }: ProfileScreenProps) {
  const { firstName, username, photoUrl } = useTelegramUser();
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [interests, setInterests] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchProfileStats()
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch(() => {
        // Non-critical for this screen — StatRow just falls back to "—".
      });
    fetchInterests()
      .then((value) => {
        if (!cancelled) setInterests(value);
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
        {SETTINGS_ITEMS.map((item) => (
          <button key={item.label} type="button" className={styles.settingsItem}>
            <span className={styles.settingsIcon} aria-hidden="true">
              {item.icon}
            </span>
            <span className={styles.settingsLabel}>{item.label}</span>
            <span className={styles.chevron} aria-hidden="true">
              ›
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
