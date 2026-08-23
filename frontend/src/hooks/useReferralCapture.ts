import { useEffect } from "react";
import { registerReferral } from "../services/referralApi";

const REF_PARAM_PATTERN = /^ref_(\d+)$/;

/**
 * Runs once per app open: if the Mini App was launched via a referral
 * link (https://t.me/<bot>/<app>?startapp=ref_<id>), Telegram surfaces
 * that as initDataUnsafe.start_param — register it with the backend so
 * the referrer gets credited. Silently does nothing outside Telegram,
 * with no start_param, or on a malformed one; registration is also
 * idempotent server-side, so calling it again on a later open is safe.
 */
export function useReferralCapture(): void {
  useEffect(() => {
    const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
    if (!startParam) return;

    const match = REF_PARAM_PATTERN.exec(startParam);
    if (!match) return;

    registerReferral(Number(match[1])).catch(() => {
      // Best-effort — a failed referral registration shouldn't block anything else in the app.
    });
  }, []);
}
