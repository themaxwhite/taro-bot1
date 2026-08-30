import { useEffect, useState } from "react";
import { MainScreen } from "./pages/MainScreen/MainScreen";
import { SpreadScreen } from "./pages/SpreadScreen/SpreadScreen";
import { ResultScreen } from "./pages/ResultScreen/ResultScreen";
import { HistoryScreen } from "./pages/HistoryScreen/HistoryScreen";
import { HistoryDetailScreen } from "./pages/HistoryDetailScreen/HistoryDetailScreen";
import { ProfileScreen } from "./pages/ProfileScreen/ProfileScreen";
import { SubscriptionScreen } from "./pages/SubscriptionScreen/SubscriptionScreen";
import { TermsScreen } from "./pages/TermsScreen/TermsScreen";
import { ReferralScreen } from "./pages/ReferralScreen/ReferralScreen";
import { AdminScreen } from "./pages/AdminScreen/AdminScreen";
import { OnboardingScreen } from "./pages/OnboardingScreen/OnboardingScreen";
import { GuideScreen } from "./pages/GuideScreen/GuideScreen";
import { ChatScreen } from "./pages/ChatScreen/ChatScreen";
import { StatsScreen } from "./pages/StatsScreen/StatsScreen";
import { Spinner } from "./components/Spinner/Spinner";
import { useTheme } from "./hooks/useTheme";
import { useReferralCapture } from "./hooks/useReferralCapture";
import { useTelegramBackButton } from "./hooks/useTelegramBackButton";
import { fetchProfile } from "./services/historyApi";
import type { SpreadId } from "./types/tarot";
import type { HistoryEntry } from "./types/history";
import styles from "./App.module.css";

// Ten screens now — still no router (e.g. react-router). Navigation
// is mostly a flat back-to-main flow with no deep stack; historyDetail
// and admin are the nested exceptions (back goes to history/profile,
// not main) since they're reached from another screen and returning
// there is the obvious expectation. Revisit with a real router if more
// nesting shows up.
//
// Going back is expressed once, as `back` below, and then handed both to
// Telegram's native back button and to the screen itself — the screen
// only draws its own arrow when there is no native one to use. Keeping a
// single handler is the point: two copies of "where does back go" would
// eventually disagree, and the one in the client's header is exactly the
// one nobody would think to update.
type Screen =
  | { name: "main" }
  | { name: "spread"; spreadId: SpreadId }
  | { name: "result"; spreadId: SpreadId; question: string }
  | { name: "history" }
  | { name: "historyDetail"; entry: HistoryEntry }
  | { name: "profile" }
  | { name: "subscription" }
  | { name: "terms" }
  | { name: "guide" }
  | { name: "chat" }
  | { name: "stats" }
  | { name: "referral" }
  | { name: "admin" };

type OnboardingStatus = "checking" | "needed" | "done";

function App() {
  const [screen, setScreen] = useState<Screen>({ name: "main" });
  const goHome = () => setScreen({ name: "main" });
  // Also lives at the App level — the data-theme attribute it manages
  // is on <html>, outside any single screen, so it needs to be applied
  // regardless of which screen is currently mounted.
  const theme = useTheme();
  // Fires once per app open, regardless of which screen renders first.
  useReferralCapture();

  // Gender + zodiac sign gate the main menu on a brand-new profile —
  // checked once per app open. Defaults to "done" on a fetch failure
  // rather than getting stuck showing a spinner forever.
  const [onboarding, setOnboarding] = useState<OnboardingStatus>("checking");
  useEffect(() => {
    let cancelled = false;
    fetchProfile()
      .then((profile) => {
        if (!cancelled) setOnboarding(profile.gender && profile.zodiacSign ? "done" : "needed");
      })
      .catch(() => {
        if (!cancelled) setOnboarding("done");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Where "back" goes from the current screen. Two screens are reached
  // from somewhere other than main and return there instead.
  const back =
    screen.name === "historyDetail"
      ? () => setScreen({ name: "history" })
      : screen.name === "admin" || screen.name === "guide" || screen.name === "stats"
        ? () => setScreen({ name: "profile" })
        : goHome;

  // null hides the native button: the main screen has nowhere to go, and
  // onboarding is a gate the user isn't allowed to back out of.
  useTelegramBackButton(onboarding !== "done" || screen.name === "main" ? null : back);

  if (onboarding === "checking") {
    return (
      <div className={styles.loading}>
        <Spinner />
      </div>
    );
  }

  if (onboarding === "needed") {
    return <OnboardingScreen onComplete={() => setOnboarding("done")} />;
  }

  // Ветки экранов вынесены в отдельную функцию, чтобы обёртку с
  // анимацией перехода поставить один раз, а не повторять её в каждом
  // из десятка `return`.
  function renderScreen() {
    if (screen.name === "spread") {
      return (
        <SpreadScreen
          spreadId={screen.spreadId}
          onBack={back}
          onCardsSelected={(spreadId, question) => {
            // The deck-selection gesture itself is cosmetic — the actual
            // cards are resolved by the backend Tarot Engine on the result
            // screen. The question the user typed does travel along,
            // though: it's stored with the spread and used later for the
            // paid AI interpretation.
            setScreen({ name: "result", spreadId, question });
          }}
        />
      );
    }

    if (screen.name === "result") {
      return (
        <ResultScreen
          spreadId={screen.spreadId}
          question={screen.question}
          onBack={back}
          onDone={goHome}
          onNeedSubscription={() => setScreen({ name: "subscription" })}
        />
      );
    }

    if (screen.name === "history") {
      return <HistoryScreen onBack={back} onOpenEntry={(entry) => setScreen({ name: "historyDetail", entry })} />;
    }

    if (screen.name === "historyDetail") {
      return (
        <HistoryDetailScreen
          entry={screen.entry}
          onBack={back}
          onNeedSubscription={() => setScreen({ name: "subscription" })}
        />
      );
    }

    if (screen.name === "profile") {
      return (
        <ProfileScreen
          onBack={back}
          onOpenSubscription={() => setScreen({ name: "subscription" })}
          onOpenTerms={() => setScreen({ name: "terms" })}
          onOpenGuide={() => setScreen({ name: "guide" })}
        onOpenStats={() => setScreen({ name: "stats" })}
          onOpenReferral={() => setScreen({ name: "referral" })}
          onOpenAdmin={() => setScreen({ name: "admin" })}
          theme={theme.theme}
          onToggleTheme={theme.toggle}
        />
      );
    }

    if (screen.name === "admin") {
      return <AdminScreen onBack={back} />;
    }

    if (screen.name === "subscription") {
      return <SubscriptionScreen onBack={back} />;
    }

    if (screen.name === "chat") {
      return (
        <ChatScreen onBack={back} onNeedEnergy={() => setScreen({ name: "subscription" })} />
      );
    }

    if (screen.name === "stats") {
      return <StatsScreen onBack={back} />;
    }

    if (screen.name === "guide") {
      return <GuideScreen onBack={back} />;
    }

    if (screen.name === "terms") {
      return <TermsScreen onBack={back} />;
    }

    if (screen.name === "referral") {
      return <ReferralScreen onBack={back} />;
    }

    return (
      <MainScreen
        onSelectSpread={(spreadId) => setScreen({ name: "spread", spreadId })}
        onOpenHistory={() => setScreen({ name: "history" })}
        onOpenProfile={() => setScreen({ name: "profile" })}
        onOpenSubscription={() => setScreen({ name: "subscription" })}
        onOpenChat={() => setScreen({ name: "chat" })}
        />
      );
    }

  // key на имени экрана заставляет React заменить узел целиком, а не
  // обновить его на месте, — без этого CSS-анимация появления не
  // перезапускалась бы при переходе.
  return (
    <div key={screen.name} className={styles.screenEnter}>
      {renderScreen()}
    </div>
  );
}

export default App;
