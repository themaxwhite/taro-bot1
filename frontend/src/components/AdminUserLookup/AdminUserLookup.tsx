import { useState } from "react";
import {
  fetchAdminUser,
  searchAdminUsers,
  type AdminUserBrief,
  type AdminUserDetail,
} from "../../services/adminApi";
import { SpreadsApiError } from "../../services/spreadsApi";
import { Spinner } from "../Spinner/Spinner";
import styles from "./AdminUserLookup.module.css";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const PAYMENT_STATUS: Record<string, string> = {
  succeeded: "прошёл",
  pending: "завис",
  canceled: "отменён",
};

const EVENT_KIND: Record<string, string> = {
  spread: "расклад",
  "follow-up": "вопрос к раскладу",
  chat: "чат",
};

/**
 * Поиск пользователя и его карточка — для разбора обращений в поддержку.
 *
 * Показывает то, что реально записано: платежи с их статусами, остатки
 * энергии по источникам и ленту оплачиваемых действий. Журнала списаний
 * в базе нет, поэтому «почему баланс именно такой» отсюда не выводится —
 * зато видно, что человек делал и какой платёж не дошёл.
 */
export function AdminUserLookup() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminUserBrief[] | null>(null);
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    const trimmed = query.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    setDetail(null);
    try {
      setResults(await searchAdminUsers(trimmed));
    } catch (e) {
      setError(e instanceof SpreadsApiError ? e.message : "Не удалось выполнить поиск.");
    } finally {
      setBusy(false);
    }
  }

  async function openUser(telegramId: number) {
    setBusy(true);
    setError(null);
    try {
      setDetail(await fetchAdminUser(telegramId));
      setResults(null);
    } catch (e) {
      setError(e instanceof SpreadsApiError ? e.message : "Не удалось загрузить карточку.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.block}>
      <h2 className={styles.heading}>Поиск пользователя</h2>

      <div className={styles.searchRow}>
        <input
          className={styles.input}
          value={query}
          placeholder="id, имя или username"
          autoCapitalize="off"
          autoCorrect="off"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleSearch();
          }}
        />
        <button
          type="button"
          className={styles.searchButton}
          disabled={!query.trim() || busy}
          onClick={handleSearch}
        >
          Найти
        </button>
      </div>

      {busy && (
        <div className={styles.centerState}>
          <Spinner />
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {results !== null && results.length === 0 && !busy && (
        <p className={styles.note}>Никого не нашлось.</p>
      )}

      {results !== null && results.length > 0 && (
        <ul className={styles.results}>
          {results.map((user) => (
            <li key={user.telegramId}>
              <button type="button" className={styles.result} onClick={() => openUser(user.telegramId)}>
                <span className={styles.resultName}>
                  {user.firstName}
                  {user.username ? ` · @${user.username}` : ""}
                </span>
                <span className={styles.resultMeta}>
                  id {user.telegramId} · раскладов {user.spreadsTotal}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {detail && (
        <div className={styles.detail}>
          <div className={styles.detailHead}>
            <span className={styles.detailName}>
              {detail.firstName}
              {detail.username ? ` · @${detail.username}` : ""}
            </span>
            <span className={styles.detailMeta}>
              id {detail.telegramId} · с {formatDate(detail.createdAt)}
            </span>
          </div>

          <dl className={styles.facts}>
            <div className={styles.fact}>
              <dt>Энергия всего</dt>
              <dd>{detail.energyTotal}</dd>
            </div>
            <div className={styles.fact}>
              <dt>Суточная</dt>
              <dd>{detail.energyDaily}</dd>
            </div>
            <div className={styles.fact}>
              <dt>Куплено</dt>
              <dd>{detail.energyPurchased}</dd>
            </div>
            <div className={styles.fact}>
              <dt>За друзей</dt>
              <dd>{detail.energyReferral}</dd>
            </div>
          </dl>

          <p className={styles.line}>
            <strong>Подписка:</strong>{" "}
            {detail.subscriptionTier
              ? `${detail.subscriptionTier} (${detail.subscriptionStatus}), квота ${detail.subscriptionQuotaUsed}/${detail.subscriptionQuotaTotal}` +
                (detail.subscriptionPeriodEnd ? `, до ${formatDate(detail.subscriptionPeriodEnd)}` : "")
              : "нет"}
          </p>
          <p className={styles.line}>
            <strong>Раскладов:</strong> {detail.spreadsTotal} · <strong>вопросов в чат:</strong>{" "}
            {detail.chatQuestions} · <strong>привёл друзей:</strong> {detail.referralsCount}
          </p>

          <h3 className={styles.subHeading}>Платежи</h3>
          {detail.payments.length === 0 ? (
            <p className={styles.note}>Платежей не было.</p>
          ) : (
            <ul className={styles.rows}>
              {detail.payments.map((payment) => (
                <li
                  key={payment.yookassaPaymentId}
                  className={`${styles.row} ${payment.status === "pending" ? styles.rowWarn : ""}`}
                >
                  <span className={styles.rowWhen}>{formatDate(payment.createdAt)}</span>
                  <span className={styles.rowWhat}>
                    {payment.kind === "energy"
                      ? `Энергия ×${payment.energyAmount}`
                      : `Подписка «${payment.tier}»`}
                    <span className={styles.rowId}>{payment.yookassaPaymentId}</span>
                  </span>
                  <span className={styles.rowValue}>
                    {payment.amountRub} ₽
                    <span className={styles.rowStatus}>
                      {PAYMENT_STATUS[payment.status] ?? payment.status}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <h3 className={styles.subHeading}>Действия</h3>
          {detail.events.length === 0 ? (
            <p className={styles.note}>Действий не было.</p>
          ) : (
            <ul className={styles.rows}>
              {detail.events.map((event, i) => (
                <li key={`${event.createdAt}-${i}`} className={styles.row}>
                  <span className={styles.rowWhen}>{formatDate(event.createdAt)}</span>
                  <span className={styles.rowWhat}>
                    {event.title}
                    <span className={styles.rowId}>
                      {EVENT_KIND[event.kind] ?? event.kind}
                      {event.detail ? ` · ${event.detail}` : ""}
                    </span>
                  </span>
                  <span className={styles.rowValue}>{event.cost > 0 ? `✦ ${event.cost}` : "—"}</span>
                </li>
              ))}
            </ul>
          )}

          <p className={styles.note}>
            Списания энергии в базе не журналируются — здесь видно, что человек делал и за что
            платил, но не то, из чего сложился текущий остаток.
          </p>
        </div>
      )}
    </section>
  );
}
