import { useEffect, useState } from "react";
import { getSpreads, type SpreadsBreakdown } from "./api";
import type { AdminSession } from "./auth";
import { formatNumber, plural } from "./format";

const PERIODS = [
  { days: 7, label: "Неделя" },
  { days: 30, label: "Месяц" },
  { days: 90, label: "Квартал" },
  { days: 0, label: "Всё время" },
];

type Props = {
  session: AdminSession;
  onAuthError: (message: string) => void;
};

export function SpreadsScreen({ session, onAuthError }: Props) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<SpreadsBreakdown | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    getSpreads(session, days)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message);
        onAuthError(e.message);
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session, days, onAuthError]);

  if (error) return <p className="error">{error}</p>;

  const max = data ? Math.max(1, ...data.rows.map((r) => r.total)) : 1;

  return (
    <>
      <div className="filters">
        <div className="periods">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              type="button"
              aria-current={days === p.days}
              onClick={() => setDays(p.days)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {data && (
        <div className="tiles">
          <Tile label="Раскладов" value={formatNumber(data.total)} sub="за период" />
          <Tile
            label="Открыто целиком"
            value={formatNumber(data.unlocked_total)}
            sub={
              data.total > 0
                ? `${Math.round((data.unlocked_total / data.total) * 100)}% от начатых`
                : "нет данных"
            }
          />
          <Tile
            label="Уточняющих вопросов"
            value={formatNumber(data.follow_ups)}
            sub="карта или вопрос к раскладу"
          />
          <Tile label="Вопросов в чат" value={formatNumber(data.chat_questions)} sub="за период" />
        </div>
      )}

      {busy && <p className="muted">Загружаем…</p>}

      {data && !busy && data.rows.length === 0 && (
        <div className="panel">
          <p className="muted" style={{ margin: 0 }}>
            За этот период раскладов не было.
          </p>
        </div>
      )}

      {data && data.rows.length > 0 && (
        <div className="panel">
          <h2>
            {data.rows.length} {plural(data.rows.length, "вид", "вида", "видов")} раскладов
          </h2>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Расклад</th>
                  <th style={{ textAlign: "right" }}>Всего</th>
                  <th style={{ textAlign: "right" }}>Открыто</th>
                  <th style={{ textAlign: "right" }}>Людей</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.spread_id}>
                    <td>
                      {row.title}
                      {/* Полоска длиной в долю от самого частого расклада —
                          сравнивать столбики глазом быстрее, чем числа. */}
                      <div
                        className="share"
                        style={{ width: `${Math.max(2, (row.total / max) * 100)}%` }}
                      />
                    </td>
                    <td className="num">{formatNumber(row.total)}</td>
                    <td className="num">
                      {formatNumber(row.unlocked)}
                      <div className="muted">
                        {row.total > 0 ? `${Math.round((row.unlocked / row.total) * 100)}%` : "—"}
                      </div>
                    </td>
                    <td className="num">{formatNumber(row.users)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
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
