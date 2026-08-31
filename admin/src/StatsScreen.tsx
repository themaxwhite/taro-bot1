import { useEffect, useMemo, useState } from "react";
import { getStats, getTimeseries, type DayStats, type Stats } from "./api";
import type { AdminSession } from "./auth";
import { formatMoney, formatNumber } from "./format";
import { Sparkline } from "./Sparkline";

/* Человеческие названия тарифов. Ключи приходят из базы, а не из
   фиксированного списка, поэтому незнакомый тариф показываем как есть —
   лучше сырой ключ, чем пропавшая строка.

   Держать синхронно с backend/app/subscriptions.py::TIERS. */
const TIER_LABELS: Record<string, string> = {
  basic: "Базовый",
  plus: "Плюс",
  premium: "Премиум",
  master: "Магистр",
  admin: "Служебная",
};

/* Снятые с продажи тарифы показываем, только пока на них кто-то есть.
   «Базовый — 0» ничего не сообщает и лишь занимает строку, а «Базовый —
   3» это действующее обязательство, и прятать его нельзя. */
const RETIRED_TIERS = new Set(["basic"]);

type Period = 1 | 7 | 30 | 0; // 0 — всё время

const PERIODS: { id: Period; label: string }[] = [
  { id: 1, label: "День" },
  { id: 7, label: "Неделя" },
  { id: 30, label: "Месяц" },
  { id: 0, label: "Всё время" },
];

type Props = {
  session: AdminSession;
  onAuthError: (message: string) => void;
};

export function StatsScreen({ session, onAuthError }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [series, setSeries] = useState<DayStats[] | null>(null);
  const [period, setPeriod] = useState<Period>(7);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getStats(session), getTimeseries(session, 30)])
      .then(([s, t]) => {
        if (cancelled) return;
        setStats(s);
        setSeries(t);
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

  /* Суммы за выбранный период считаем из уже загруженного ряда по дням, а
     не отдельным запросом: лишняя ручка на сервере ради тех же чисел —
     это ещё одно место, где данные могут разойтись между собой. */
  const window = useMemo(() => {
    if (!series || period === 0) return null;
    const tail = series.slice(-period);
    return {
      newUsers: sum(tail, (d) => d.new_users),
      spreads: sum(tail, (d) => d.spreads),
      revenue: sum(tail, (d) => d.revenue_rub),
      energy: sum(tail, (d) => d.energy_sold),
      bestActive: Math.max(0, ...tail.map((d) => d.active_users)),
    };
  }, [series, period]);

  if (error) return <p className="error">{error}</p>;
  if (!stats || !series) return <p className="muted">Загружаем…</p>;

  const subscriptions = Object.entries(stats.active_subscriptions).filter(
    ([tier, count]) => count > 0 || !RETIRED_TIERS.has(tier),
  );
  const subscribersTotal = subscriptions.reduce((acc, [, n]) => acc + n, 0);
  const periodLabel = PERIODS.find((p) => p.id === period)!.label.toLowerCase();

  return (
    <>
      <div className="periods">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-current={period === p.id}
            onClick={() => setPeriod(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="tiles">
        <Tile
          label="Пользователей"
          value={formatNumber(stats.users_total)}
          sub={window ? `+${window.newUsers} за ${periodLabel}` : "за всё время"}
        />
        <Tile
          label="Активных"
          value={formatNumber(window ? window.bestActive : stats.active_today)}
          sub={window && period > 1 ? "лучший день периода" : "сделали расклад"}
        />
        <Tile
          label="Раскладов"
          value={formatNumber(window ? window.spreads : stats.spreads_total)}
          sub={window ? `за ${periodLabel}` : "за всё время"}
        />
        <Tile
          label="Выручка"
          value={formatMoney(window ? window.revenue : stats.revenue_total_rub)}
          sub={window ? `за ${periodLabel}` : "за всё время"}
        />
        <Tile
          label="Куплено энергии"
          value={formatNumber(window ? window.energy : stats.energy_sold_total)}
          sub={`${formatNumber(stats.energy_unspent)} не израсходовано`}
        />
        <Tile label="Подписок" value={formatNumber(subscribersTotal)} sub="действующих" />
        <Tile
          label="По приглашениям"
          value={formatNumber(stats.referrals_total)}
          sub="пришли по ссылке друга"
        />
      </div>

      <div className="sparks">
        <Sparkline
          title="Регистрации"
          points={series.map((d) => ({ date: d.date, value: d.new_users }))}
          format={formatNumber}
          total={formatNumber(sum(series, (d) => d.new_users))}
        />
        <Sparkline
          title="Расклады"
          points={series.map((d) => ({ date: d.date, value: d.spreads }))}
          format={formatNumber}
          total={formatNumber(sum(series, (d) => d.spreads))}
        />
        <Sparkline
          title="Выручка"
          points={series.map((d) => ({ date: d.date, value: d.revenue_rub }))}
          format={formatMoney}
          total={formatMoney(sum(series, (d) => d.revenue_rub))}
        />
      </div>

      <div className="panel">
        <h2>Подписки по тарифам</h2>
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
                <td>
                  {TIER_LABELS[tier] ?? tier}
                  {RETIRED_TIERS.has(tier) && <span className="muted"> · снят с продажи</span>}
                </td>
                <td className="num">{formatNumber(count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function sum<T>(rows: T[], pick: (row: T) => number): number {
  return rows.reduce((acc, row) => acc + pick(row), 0);
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
