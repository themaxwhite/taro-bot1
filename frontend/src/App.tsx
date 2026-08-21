import { useState } from "react";
import { MainScreen } from "./pages/MainScreen/MainScreen";
import { SpreadScreen } from "./pages/SpreadScreen/SpreadScreen";
import { ResultScreen } from "./pages/ResultScreen/ResultScreen";
import { HistoryScreen } from "./pages/HistoryScreen/HistoryScreen";
import { ProfileScreen } from "./pages/ProfileScreen/ProfileScreen";
import { useAmbientSound } from "./hooks/useAmbientSound";
import type { SpreadId } from "./types/tarot";

// Five screens now — still no router (e.g. react-router). All
// navigation is a simple back-to-main flow with no deep history stack,
// so a router would add complexity without real benefit yet. Revisit
// once nested navigation (e.g. history item -> detail) is needed.
type Screen =
  | { name: "main" }
  | { name: "spread"; spreadId: SpreadId }
  | { name: "result"; spreadId: SpreadId; question: string }
  | { name: "history" }
  | { name: "profile" };

function App() {
  const [screen, setScreen] = useState<Screen>({ name: "main" });
  const goHome = () => setScreen({ name: "main" });
  // Lives at the App level (not inside MainScreen) so the AudioContext
  // isn't torn down and recreated every time the user navigates away
  // from and back to the main screen — it just keeps playing.
  const ambientSound = useAmbientSound();

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
      />
    );
  }

  if (screen.name === "history") {
    return <HistoryScreen onBack={goHome} />;
  }

  if (screen.name === "profile") {
    return <ProfileScreen onBack={goHome} />;
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
