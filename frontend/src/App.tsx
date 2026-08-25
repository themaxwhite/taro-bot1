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
import { Spinner } from "./components/Spinner/Spinner";
import { useAmbientSound } from "./hooks/useAmbientSound";
import { useTheme } from "./hooks/useTheme";
import { useReferralCapture } from "./hooks/useReferralCapture";
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
type Screen =
  | { name: "main" }
  | { name: "spread"; spreadId: SpreadId }
  | { name: "result"; spreadId: SpreadId; question: string }
  | { name: "history" }
  | { name: "historyDetail"; entry: HistoryEntry }
  | { name: "profile" }
  | { name: "subscription" }
  | { name: "terms" }
  | { name: "referral" }
  | { name: "admin" };

type OnboardingStatus = "checking" | "needed" | "done";

function App() {
  const [screen, setScreen] = useState<Screen>({ name: "main" });
  const goHome = () => setScreen({ name: "main" });
  // Lives at the App level (not inside MainScreen) so the AudioContext
  // isn't torn down and recreated every time the user navigates away
  // from and back to the main screen — it just keeps playing.
  const ambientSound = useAmbientSound();
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

  if (screen.name === "spread") {
    return (
      <SpreadScreen
        spreadId={screen.spreadId}
        onBack={goHome}
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
        onBack={goHome}
        onDone={goHome}
        onNeedSubscription={() => setScreen({ name: "subscription" })}
      />
    );
  }

  if (screen.name === "history") {
    return <HistoryScreen onBack={goHome} onOpenEntry={(entry) => setScreen({ name: "historyDetail", entry })} />;
  }

  if (screen.name === "historyDetail") {
    return (
      <HistoryDetailScreen
        entry={screen.entry}
        onBack={() => setScreen({ name: "history" })}
        onNeedSubscription={() => setScreen({ name: "subscription" })}
      />
    );
  }

  if (screen.name === "profile") {
    return (
      <ProfileScreen
        onBack={goHome}
        onOpenSubscription={() => setScreen({ name: "subscription" })}
        onOpenTerms={() => setScreen({ name: "terms" })}
        onOpenReferral={() => setScreen({ name: "referral" })}
        onOpenAdmin={() => setScreen({ name: "admin" })}
        theme={theme.theme}
        onToggleTheme={theme.toggle}
      />
    );
  }

  if (screen.name === "admin") {
    return <AdminScreen onBack={() => setScreen({ name: "profile" })} />;
  }

  if (screen.name === "subscription") {
    return <SubscriptionScreen onBack={goHome} />;
  }

  if (screen.name === "terms") {
    return <TermsScreen onBack={goHome} />;
  }

  if (screen.name === "referral") {
    return <ReferralScreen onBack={goHome} />;
  }

  return (
    <MainScreen
      onSelectSpread={(spreadId) => setScreen({ name: "spread", spreadId })}
      onOpenHistory={() => setScreen({ name: "history" })}
      onOpenProfile={() => setScreen({ name: "profile" })}
      soundEnabled={ambientSound.enabled}
      onToggleSound={ambientSound.toggle}
    />
  );
}

export default App;
