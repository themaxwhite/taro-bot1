import { useCallback, useEffect, useState } from "react";
import { useTelegramUser } from "../../hooks/useTelegramUser";
import { spreadGroups, type SpreadType } from "../../types/tarot";
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
import { SpreadSuggestion } from "../../components/SpreadSuggestion/SpreadSuggestion";
import { ChatBanner } from "../../components/ChatBanner/ChatBanner";
import { getSubscriptionStatus } from "../../services/subscriptionsApi";
import type { EnergyBreakdown } from "../../types/energy";
import { useRefreshOnReturn } from "../../hooks/useRefreshOnReturn";
import { MysticalBackground } from "../../components/MysticalBackground/MysticalBackground";
import styles from "./MainScreen.module.css";

interface MainScreenProps {
  onSelectSpread: (id: SpreadType["id"]) => void;
  onOpenHistory: () => void;
  onOpenProfile: () => void;
  onOpenSubscription: () => void;
  onOpenChat: () => void;
}

export function MainScreen({
  onSelectSpread,
  onOpenHistory,
  onOpenProfile,
  onOpenSubscription,
  onOpenChat,
}: MainScreenProps) {
  const { firstName } = useTelegramUser();
  // Сетка разбита на смысловые разделы (types/tarot.ts::spreadGroups).
  // "Карта дня" исключена: у неё свой баннер прямо над сеткой, и вторым
  // вхождением она просто отодвигала всё остальное вниз.
  const groups = spreadGroups(["daily-card"]);

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
  // многоточием, чтобы шапка не прыгала, когда приедет число. Разбивка
  // нужна и здесь: без неё шкала аккумулятора не знает своей ёмкости.
  const [energy, setEnergy] = useState<EnergyBreakdown | null>(null);

  const loadEnergy = useCallback(() => {
    getSubscriptionStatus()
      .then((status) => setEnergy(status.energy))
      .catch(() => {});
  }, []);

  useEffect(loadEnergy, [loadEnergy]);
  /* Вернулись в приложение — перечитываем баланс. Главный случай: человек
     уходил платить и вернулся с уже начисленной энергией. */
  useRefreshOnReturn(loadEnergy);

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
        <EnergyBalance
          balance={energy?.balance ?? null}
          breakdown={energy ?? undefined}
          onClick={onOpenSubscription}
        />
      </div>
      <DailyWish />
      {dailyCardCooldown && <DailyCardCooldown nextAvailableAt={dailyCardCooldown} />}
      <DailyCardBanner onClick={() => onSelectSpread("daily-card")} />
      <ChatBanner onOpen={onOpenChat} />
      <LoveNudgeBanner gender={gender} onSelectSpread={onSelectSpread} />
      {groups.map((group) => (
        <SpreadList
          key={group.title}
          title={group.title}
          spreads={group.spreads}
          onSelect={onSelectSpread}
        />
      ))}

      <SpreadSuggestion onSelectSpread={onSelectSpread} />
    </div>
  );
}
