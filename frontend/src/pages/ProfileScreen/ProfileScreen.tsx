import { useEffect, useState } from "react";
import { useTelegramUser } from "../../hooks/useTelegramUser";
import type { ProfileStats } from "../../types/history";
import { fetchProfileStats, fetchInterests, updateInterests } from "../../services/historyApi";
import { ScreenHeader } from "../../components/ScreenHeader/ScreenHeader";
import { Avatar } from "../../components/Avatar/Avatar";
import { StatRow } from "../../components/StatRow/StatRow";
import styles from "./ProfileScreen.module.css";

interface ProfileScreenProps {
  onBack: () => void;
}

const SETTINGS_ITEMS = [
  { icon: "🔔", label: "Уведомления" },
  { icon: "🌐", label: "Язык" },
  { icon: "📄", label: "Условия использования" },
];

export function ProfileScreen({ onBack }: ProfileScreenProps) {
  const { firstName, username, photoUrl } = useTelegramUser();
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [interests, setInterests] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

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
