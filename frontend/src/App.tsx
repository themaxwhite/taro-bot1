import { useState } from "react";
import { MainScreen } from "./pages/MainScreen/MainScreen";
import { SpreadScreen } from "./pages/SpreadScreen/SpreadScreen";
import { ResultScreen } from "./pages/ResultScreen/ResultScreen";
import { HistoryScreen } from "./pages/HistoryScreen/HistoryScreen";
import { HistoryDetailScreen } from "./pages/HistoryDetailScreen/HistoryDetailScreen";
import { ProfileScreen } from "./pages/ProfileScreen/ProfileScreen";
import { SubscriptionScreen } from "./pages/SubscriptionScreen/SubscriptionScreen";
import { TermsScreen } from "./pages/TermsScreen/TermsScreen";
import { ReferralScreen } from "./pages/ReferralScreen/ReferralScreen";
import { useAmbientSound } from "./hooks/useAmbientSound";
import { useReferralCapture } from "./hooks/useReferralCapture";
import type { SpreadId } from "./types/tarot";
import type { HistoryEntry } from "./types/history";

// Nine screens now — still no router (e.g. react-router). Navigation
// is mostly a flat back-to-main flow with no deep stack; historyDetail
// is the one nested exception (back goes to history, not main) since
// it's reached from a list and returning to that list is the obvious
// expectation. Revisit with a real router if more nesting shows up.
type Screen =
  | { name: "main" }
  | { name: "spread"; spreadId: SpreadId }
  | { name: "result"; spreadId: SpreadId; question: string }
  | { name: "history" }
  | { name: "historyDetail"; entry: HistoryEntry }
  | { name: "profile" }
  | { name: "subscription" }
  | { name: "terms" }
  | { name: "referral" };

function App() {
  const [screen, setScreen] = useState<Screen>({ name: "main" });
  const goHome = () => setScreen({ name: "main" });
  // Lives at the App level (not inside MainScreen) so the AudioContext
  // isn't torn down and recreated every time the user navigates away
  // from and back to the main screen — it just keeps playing.
  const ambientSound = useAmbientSound();
  // Fires once per app open, regardless of which screen renders first.
  useReferralCapture();

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
      />
    );
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
