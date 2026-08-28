import { useEffect, useState } from "react";
import { useTelegramUser } from "../../hooks/useTelegramUser";
import { SPREAD_TYPES, type SpreadType } from "../../types/tarot";
import { getDailyCardStatus } from "../../services/spreadsApi";
import { fetchProfile, type Gender } from "../../services/historyApi";
import { TopBar } from "../../components/TopBar/TopBar";
import { Greeting } from "../../components/Greeting/Greeting";
import { DailyWish } from "../../components/DailyWish/DailyWish";
import { DailyCardBanner } from "../../components/DailyCardBanner/DailyCardBanner";
import { DailyCardCooldown } from "../../components/DailyCardCooldown/DailyCardCooldown";
import { LoveNudgeBanner } from "../../components/LoveNudgeBanner/LoveNudgeBanner";
import { SpreadList } from "../../components/SpreadList/SpreadList";
import { EnergyBalance } from "../../components/EnergyBalance/EnergyBalance";
import { DailyStory } from "../../components/DailyStory/DailyStory";
import { getSubscriptionStatus } from "../../services/subscriptionsApi";
import { MysticalBackground } from "../../components/MysticalBackground/MysticalBackground";
import styles from "./MainScreen.module.css";

interface MainScreenProps {
  onSelectSpread: (id: SpreadType["id"]) => void;
  onOpenHistory: () => void;
  onOpenProfile: () => void;
  onOpenSubscription: () => void;
}

export function MainScreen({
  onSelectSpread,
  onOpenHistory,
  onOpenProfile,
  onOpenSubscription,
}: MainScreenProps) {
  const { firstName } = useTelegramUser();
  // "Карта дня" already has its own banner right above this grid —
  // listing it a second time here was redundant and just pushed
  // everything else further down the page.
  const gridSpreads = SPREAD_TYPES.filter((spread) => spread.id !== "daily-card");

  // Only set once today's card has actually been drawn — this is a
  // read-only status check (see services/spreadsApi.ts), so it never
  // spoils the banner for someone who hasn't drawn yet today.
  const [dailyCardCooldown, setDailyCardCooldown] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    getDailyCardStatus().then((nextAvailableAt) => {
      if (!cancelled) setDailyCardCooldown(nextAvailableAt);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Баланс разблокировок. null пока грузится — плашка рисуется сразу с
  // многоточием, чтобы шапка не прыгала, когда приедет число.
  const [energy, setEnergy] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    getSubscriptionStatus()
      .then((status) => {
        if (!cancelled) setEnergy(status.energy.balance);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Only used to pick the right pronoun in LoveNudgeBanner — stays null
  // (banner just doesn't render) if the fetch fails or gender was
  // somehow never set.
  const [gender, setGender] = useState<Gender | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchProfile()
      .then((profile) => {
        if (!cancelled) setGender(profile.gender);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={styles.screen}>
      <MysticalBackground />
      <TopBar onHistoryClick={onOpenHistory} onProfileClick={onOpenProfile} />
      <div className={styles.balanceRow}>
        <Greeting firstName={firstName} />
        <EnergyBalance balance={energy} onClick={onOpenSubscription} />
      </div>
      <DailyWish />
      {dailyCardCooldown && <DailyCardCooldown nextAvailableAt={dailyCardCooldown} />}
      <DailyCardBanner onClick={() => onSelectSpread("daily-card")} />
      <LoveNudgeBanner gender={gender} onSelectSpread={onSelectSpread} />
      <SpreadList spreads={gridSpreads} onSelect={onSelectSpread} />
      <DailyStory />
    </div>
  );
}
