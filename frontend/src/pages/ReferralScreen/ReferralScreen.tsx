import { useEffect, useState } from "react";
import { getReferralStatus, type ReferralStatus } from "../../services/referralApi";
import { SpreadsApiError } from "../../services/spreadsApi";
import { ScreenHeader } from "../../components/ScreenHeader/ScreenHeader";
import { Spinner } from "../../components/Spinner/Spinner";
import styles from "./ReferralScreen.module.css";

interface ReferralScreenProps {
  onBack: () => void;
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; referral: ReferralStatus };

const SHARE_TEXT = "Присоединяйся к Taro Aurum — расклады таро с AI-толкованием и картой дня ✨";

export function ReferralScreen({ onBack }: ReferralScreenProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  useEffect(() => {
    let cancelled = false;
    getReferralStatus()
      .then((referral) => {
        if (!cancelled) setState({ status: "ready", referral });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof SpreadsApiError ? error.message : "Не удалось загрузить данные.";
        setState({ status: "error", message });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCopy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 1500);
    } catch {
      // Clipboard API can be unavailable (e.g. permissions) — the link is still shown on screen to copy manually.
    }
  }

  function handleShare(link: string) {
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(SHARE_TEXT)}`;
    const webApp = window.Telegram?.WebApp;
    if (webApp) {
      webApp.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, "_blank");
    }
  }

  return (
    <div className={styles.screen}>
      <ScreenHeader title="Пригласить друзей" onBack={onBack} />

      {state.status === "loading" && (
        <div className={styles.centerState}>
          <Spinner />
        </div>
      )}

      {state.status === "error" && <p className={styles.error}>{state.message}</p>}

      {state.status === "ready" && (
        <>
          <p className={styles.pitch}>
            За каждого друга, который откроет приложение по вашей ссылке, вы получаете{" "}
            <b>одну бесплатную разблокировку</b> — подробное толкование или дополнительную карту, без подписки.
          </p>

          <div className={styles.statsRow}>
            <div className={styles.statCard}>
              <span className={styles.statValue}>{state.referral.referredCount}</span>
              <span className={styles.statLabel}>приглашено</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statValue}>{state.referral.bonusQuota}</span>
              <span className={styles.statLabel}>бонусов доступно</span>
            </div>
          </div>

          {state.referral.referralLink ? (
            <div className={styles.linkSection}>
              <div className={styles.linkBox}>{state.referral.referralLink}</div>
              <div className={styles.linkActions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => handleCopy(state.referral.referralLink!)}
                >
                  {copyState === "copied" ? "Скопировано ✓" : "Скопировать"}
                </button>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => handleShare(state.referral.referralLink!)}
                >
                  Поделиться
                </button>
              </div>
            </div>
          ) : (
            <p className={styles.error}>Реферальная ссылка временно недоступна.</p>
          )}
        </>
      )}
    </div>
  );
}
