import { useEffect, useState } from "react";
import { listPayments, type PaymentRow, type PaymentsPage } from "./api";
import type { AdminSession } from "./auth";
import { formatDateTime, formatMoney, formatNumber, plural } from "./format";

const PERIODS = [
  { days: 7, label: "Неделя" },
  { days: 30, label: "Месяц" },
  { days: 90, label: "Квартал" },
  { days: 0, label: "Всё время" },
];

const STATUSES = [
  { id: "all", label: "Любой статус" },
  { id: "succeeded", label: "Успешные" },
  { id: "pending", label: "Незавершённые" },
  { id: "canceled", label: "Отменённые" },
];

const KINDS = [
  { id: "all", label: "Всё" },
  { id: "subscription", label: "Подписки" },
  { id: "energy", label: "Энергия" },
];

const TIER_LABELS: Record<string, string> = {
  basic: "Базовый",
  plus: "Плюс",
  premium: "Премиум",
  master: "Магистр",
  admin: "Служебная",
};

type Props = {
  session: AdminSession;
  onAuthError: (message: string) => void;
  onOpenUser: (id: number) => void;
};

export function PaymentsScreen({ session, onAuthError, onOpenUser }: Props) {
  const [days, setDays] = useState(30);
  const [status, setStatus] = useState("all");
  const [kind, setKind] = useState("all");
  const [page, setPage] = useState<PaymentsPage | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    listPayments(session, { days, status, kind })
      .then((data) => {
        if (!cancelled) setPage(data);
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
  }, [session, days, status, kind, onAuthError]);

  if (error) return <p className="error">{error}</p>;

  return (
    <>
      {/* Фильтры одной строкой над таблицей — период кнопками, потому что
          вариантов мало и они выбираются чаще всего. */}
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

        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Статус">
          {STATUSES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>

        <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Что куплено">
          {KINDS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </select>
      </div>

      {page && (
        <div className="tiles">
          <Tile label="Платежей" value={formatNumber(page.total_count)} sub="за период" />
          <Tile label="Получено" value={formatMoney(page.succeeded_rub)} sub="успешные платежи" />
          <Tile
            label="Незавершённых"
            value={formatNumber(page.pending_count)}
            sub={page.pending_count > 0 ? "деньги могли уйти без доступа" : "все дошли"}
          />
        </div>
      )}

      {busy && <p className="muted">Загружаем…</p>}

      {page && !busy && page.rows.length === 0 ? (
        <div className="panel">
          <p className="muted" style={{ margin: 0 }}>
            Платежей за этот период нет. Приём оплаты ещё не подключён — как только
            заработает Робокасса, каждая покупка появится здесь.
          </p>
        </div>
      ) : (
        page &&
        page.rows.length > 0 && (
          <div className="panel">
            <h2>
              {page.rows.length} {plural(page.rows.length, "платёж", "платежа", "платежей")}
              {page.total_count > page.rows.length && ` из ${page.total_count}`}
            </h2>
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th>Когда</th>
                    <th>Кто</th>
                    <th>Что</th>
                    <th>Статус</th>
                    <th>Платёж</th>
                    <th style={{ textAlign: "right" }}>Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {page.rows.map((row) => (
                    <Row key={row.id} row={row} onOpenUser={onOpenUser} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </>
  );
}

function Row({ row, onOpenUser }: { row: PaymentRow; onOpenUser: (id: number) => void }) {
  const what =
    row.kind === "energy"
      ? `Энергия ×${row.energy_amount}`
      : `Подписка «${TIER_LABELS[row.tier] ?? row.tier}»`;

  const statusClass =
    row.status === "succeeded" ? "tag ok" : row.status === "pending" ? "tag warn" : "tag";

  return (
    <tr>
      <td className="muted">{formatDateTime(row.created_at)}</td>
      <td>
        <button type="button" className="link" onClick={() => onOpenUser(row.user_id)}>
          {row.user_name}
        </button>
        <div className="muted">{row.username ? "@" + row.username : row.user_id}</div>
      </td>
      <td>{what}</td>
      <td>
        <span className={statusClass}>{row.status}</span>
      </td>
      <td className="muted">
        {row.provider}
        {row.provider_payment_id && <div>{row.provider_payment_id}</div>}
      </td>
      <td className="num">{formatMoney(row.amount_rub)}</td>
    </tr>
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
