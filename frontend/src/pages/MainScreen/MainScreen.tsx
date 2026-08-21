import { useTelegramUser } from "../../hooks/useTelegramUser";
import { SPREAD_TYPES, type SpreadType } from "../../types/tarot";
import { TopBar } from "../../components/TopBar/TopBar";
import { Greeting } from "../../components/Greeting/Greeting";
import { DailyWish } from "../../components/DailyWish/DailyWish";
import { DailyCardBanner } from "../../components/DailyCardBanner/DailyCardBanner";
import { SpreadList } from "../../components/SpreadList/SpreadList";
import styles from "./MainScreen.module.css";

interface MainScreenProps {
  onSelectSpread: (id: SpreadType["id"]) => void;
  onOpenHistory: () => void;
  onOpenProfile: () => void;
}

export function MainScreen({
  onSelectSpread,
  onOpenHistory,
  onOpenProfile,
}: MainScreenProps) {
  const { firstName } = useTelegramUser();

  return (
    <div className={styles.screen}>
      <TopBar onHistoryClick={onOpenHistory} onProfileClick={onOpenProfile} />
      <Greeting firstName={firstName} />
      <DailyWish />
      <DailyCardBanner onClick={() => onSelectSpread("daily-card")} />
      <SpreadList spreads={SPREAD_TYPES} onSelect={onSelectSpread} />
    </div>
  );
}
