import { useEffect, useState } from "react";
import { getStats, type Stats } from "./api";
import type { AdminSession } from "./auth";
import { formatMoney, formatNumber } from "./format";

/* Человеческие названия тарифов. Ключи приходят из базы, а не из
   фиксированного списка, поэтому незнакомый тариф показываем как есть —
   лучше сырой ключ, чем пропавшая строка. */
const TIER_LABELS: Record<string, string> = {
  plus: "Плюс",
  premium: "Премиум",
  master: "Магистр",
  admin: "Служебная",
};

type Props = {
  session: AdminSession;
  onAuthError: (message: string) => void;
};

export function StatsScreen({ session, onAuthError }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getStats(session)
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message);
        onAuthError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [session, onAuthError]);

  if (error) return <p className="error">{error}</p>;
  if (!stats) return <p className="muted">Загружаем…</p>;

  const subscriptions = Object.entries(stats.active_subscriptions);
  const subscribersTotal = subscriptions.reduce((sum, [, n]) => sum + n, 0);

  return (
    <>
      <div className="tiles">
        <Tile label="Пользователей" value={formatNumber(stats.users_total)}
              sub={`+${stats.users_new_today} сегодня, +${stats.users_new_7d} за неделю`} />
        <Tile label="Активны сегодня" value={formatNumber(stats.active_today)}
              sub="сделали хотя бы один расклад" />
        <Tile label="Раскладов всего" value={formatNumber(stats.spreads_total)}
              sub={`${formatNumber(stats.spreads_today)} сегодня`} />
        <Tile label="Выручка" value={formatMoney(stats.revenue_total_rub)}
              sub={`${formatMoney(stats.revenue_7d_rub)} за неделю`} />
        <Tile label="Подписок" value={formatNumber(subscribersTotal)} sub="действующих" />
        <Tile label="По приглашениям" value={formatNumber(stats.referrals_total)}
              sub="пришли по ссылке друга" />
      </div>

      <div className="panel">
        <h2>Подписки по тарифам</h2>
        {subscriptions.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Действующих подписок нет.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Тариф</th>
                <th style={{ textAlign: "right" }}>Подписчиков</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map(([tier, count]) => (
                <tr key={tier}>
                  <td>{TIER_LABELS[tier] ?? tier}</td>
                  <td className="num">{formatNumber(count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="tile">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}
