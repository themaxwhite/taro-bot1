import { useTelegramUser } from "../../hooks/useTelegramUser";
import { SPREAD_TYPES, type SpreadType } from "../../types/tarot";
import { TopBar } from "../../components/TopBar/TopBar";
import { Greeting } from "../../components/Greeting/Greeting";
import { DailyWish } from "../../components/DailyWish/DailyWish";
import { DailyCardBanner } from "../../components/DailyCardBanner/DailyCardBanner";
import { SpreadList } from "../../components/SpreadList/SpreadList";
import { MysticalBackground } from "../../components/MysticalBackground/MysticalBackground";
import styles from "./MainScreen.module.css";

interface MainScreenProps {
  onSelectSpread: (id: SpreadType["id"]) => void;
  onOpenHistory: () => void;
  onOpenProfile: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export function MainScreen({
  onSelectSpread,
  onOpenHistory,
  onOpenProfile,
  soundEnabled,
  onToggleSound,
}: MainScreenProps) {
  const { firstName } = useTelegramUser();

  return (
    <div className={styles.screen}>
      <MysticalBackground />
      <TopBar
        onHistoryClick={onOpenHistory}
        onProfileClick={onOpenProfile}
        soundEnabled={soundEnabled}
        onToggleSound={onToggleSound}
      />
      <Greeting firstName={firstName} />
      <DailyWish />
      <DailyCardBanner onClick={() => onSelectSpread("daily-card")} />
      <SpreadList spreads={SPREAD_TYPES} onSelect={onSelectSpread} />
    </div>
  );
}
