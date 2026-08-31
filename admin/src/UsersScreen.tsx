import { useState } from "react";
import { getUser, searchUsers, type UserBrief, type UserDetail } from "./api";
import type { TelegramLoginPayload } from "./auth";
import { formatDate, formatDateTime, formatMoney, formatNumber, plural } from "./format";

type Props = {
  auth: TelegramLoginPayload;
  onAuthError: (message: string) => void;
};

export function UsersScreen({ auth, onAuthError }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserBrief[] | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fail = (e: Error) => {
    setError(e.message);
    onAuthError(e.message);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;
    setBusy(true);
    setError(null);
    setDetail(null);
    searchUsers(auth, q)
      .then(setResults)
      .catch(fail)
      .finally(() => setBusy(false));
  };

  const open = (id: number) => {
    setBusy(true);
    setError(null);
    getUser(auth, id)
      .then(setDetail)
      .catch(fail)
      .finally(() => setBusy(false));
  };

  return (
    <>
      <form className="search" onSubmit={submit}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Имя, @username или числовой id"
          aria-label="Поиск пользователя"
        />
        <button type="submit">Найти</button>
      </form>

      {error && <p className="error">{error}</p>}
      {busy && <p className="muted">Загружаем…</p>}

      {detail ? (
        <UserCard detail={detail} onBack={() => setDetail(null)} />
      ) : (
        results && <Results users={results} onOpen={open} />
      )}
    </>
  );
}

function Results({ users, onOpen }: { users: UserBrief[]; onOpen: (id: number) => void }) {
  if (users.length === 0) {
    return <p className="muted">Никого не нашлось. Поиск идёт по имени, username и id.</p>;
  }

  return (
    <div className="panel">
      <h2>
        Найдено: {users.length} {plural(users.length, "человек", "человека", "человек")}
      </h2>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>Имя</th>
              <th>Username</th>
              <th>ID</th>
              <th>Пришёл</th>
              <th style={{ textAlign: "right" }}>Раскладов</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.telegram_id} className="clickable" onClick={() => onOpen(u.telegram_id)}>
                <td>{u.first_name}</td>
                <td className="muted">{u.username ? "@" + u.username : "—"}</td>
                <td className="muted">{u.telegram_id}</td>
                <td className="muted">{formatDate(u.created_at)}</td>
                <td className="num">{u.spreads_total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UserCard({ detail, onBack }: { detail: UserDetail; onBack: () => void }) {
  const sub = detail.subscription_tier
    ? `${detail.subscription_tier} — ${detail.subscription_status ?? "?"}, ` +
      `${detail.subscription_quota_used ?? 0} из ${detail.subscription_quota_total ?? 0}` +
      (detail.subscription_period_end
        ? `, до ${formatDate(detail.subscription_period_end)}`
        : "")
    : "нет";

  return (
    <>
      <p>
        <button type="button" className="link" onClick={onBack}>
          ← к результатам поиска
        </button>
      </p>

      <div className="panel">
        <h2>
          {detail.first_name} {detail.username ? "@" + detail.username : ""}
        </h2>
        <dl className="facts">
          <dt>ID</dt>
          <dd>{detail.telegram_id}</dd>
          <dt>Пришёл</dt>
          <dd>{formatDateTime(detail.created_at)}</dd>
          <dt>Профиль</dt>
          <dd>
            {[detail.gender, detail.zodiac_sign, detail.patron_card].filter(Boolean).join(", ") ||
              "не заполнен"}
          </dd>
          <dt>Уведомления</dt>
          <dd>{detail.notifications_enabled ? "включены" : "выключены"}</dd>
          <dt>Приглашения</dt>
          <dd>
            {detail.referred_by ? `пришёл от ${detail.referred_by}; ` : ""}
            привёл {detail.referrals_count}
          </dd>
          <dt>Энергия</dt>
          <dd>
            всего {formatNumber(detail.energy_total)} — суточной {detail.energy_daily},
            купленной {detail.energy_purchased}, за друзей {detail.energy_referral}
          </dd>
          <dt>Подписка</dt>
          <dd>{sub}</dd>
          <dt>Активность</dt>
          <dd>
            {formatNumber(detail.spreads_total)}{" "}
            {plural(detail.spreads_total, "расклад", "расклада", "раскладов")},{" "}
            {formatNumber(detail.chat_questions)}{" "}
            {plural(detail.chat_questions, "вопрос", "вопроса", "вопросов")} в чат
          </dd>
        </dl>
      </div>

      <div className="panel">
        <h2>Платежи</h2>
        {detail.payments.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Платежей нет.
          </p>
        ) : (
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Что</th>
                  <th>Статус</th>
                  <th>Провайдер</th>
                  <th style={{ textAlign: "right" }}>Сумма</th>
                </tr>
              </thead>
              <tbody>
                {detail.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="muted">{formatDateTime(p.created_at)}</td>
                    <td>
                      {p.kind === "energy" ? `энергия ×${p.energy_amount}` : `подписка ${p.tier}`}
                    </td>
                    <td>
                      <span className={"tag " + (p.status === "succeeded" ? "ok" : "warn")}>
                        {p.status}
                      </span>
                    </td>
                    <td className="muted">
                      {p.provider}
                      {p.provider_payment_id ? ` · ${p.provider_payment_id}` : ""}
                    </td>
                    <td className="num">{formatMoney(p.amount_rub)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel">
        <h2>Что человек делал</h2>
        {/* Журнала списаний энергии в базе нет — здесь перечислены события,
            которые действительно записаны: расклады, уточняющие вопросы и
            вопросы в чат. Восстановить по ним текущий остаток нельзя, и это
            ограничение самих данных, а не экрана. */}
        {detail.events.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Событий нет.
          </p>
        ) : (
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Когда</th>
                  <th>Событие</th>
                  <th style={{ textAlign: "right" }}>Стоило</th>
                </tr>
              </thead>
              <tbody>
                {detail.events.map((e, i) => (
                  <tr key={i}>
                    <td className="muted">{formatDateTime(e.created_at)}</td>
                    <td>
                      {e.title}
                      {e.detail && <div className="muted">{e.detail}</div>}
                    </td>
                    <td className="num">{e.cost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
