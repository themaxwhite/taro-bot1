import { hasLegalDetails } from "../site";
import { Reveal, Section, SectionIntro } from "./primitives";

/* Цены и состав сверены с бэкендом: app/subscriptions.py (тарифы),
   app/energy.py (пакеты и суточная энергия).

   Стоимость показана полностью и конкретно — этого требует модерация
   платёжной системы: на сайте должны быть описание и цена услуги. Числа
   здесь обязаны совпадать с теми, что человек увидит в приложении, — это
   та же цена, а не «от».

   Полный перечень с порядком возврата — в оферте (public/oferta.html). */
const packs = [
  { name: "5 энергии", price: "89 ₽" },
  { name: "15 энергии", price: "199 ₽" },
  { name: "40 энергии", price: "449 ₽" },
];

const plans = [
  { name: "Плюс", detail: "70 разблокировок в месяц", price: "599 ₽" },
  { name: "Премиум", detail: "160 разблокировок, свой вопрос к раскладу", price: "799 ₽" },
  { name: "Магистр", detail: "300 разблокировок в месяц и свой вопрос к раскладу", price: "1199 ₽" },
];

export function Stars() {
  return (
    <Section id="pricing">
      <SectionIntro eyebrow="Оплата" title="Каждый день бесплатно, дальше — по желанию">
        Расклад открывается за одну энергию, и одна приходит каждые сутки — этого
        хватает, чтобы пользоваться приложением, ничего не платя. Ниже — полная
        стоимость платных возможностей.
      </SectionIntro>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        <Reveal index={0} delay={80} className="h-full">
          <article className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-hairline bg-surface p-8">
            <h3 className="font-display text-2xl text-ink">Бесплатно</h3>
            <p className="mt-4 flex items-baseline gap-2">
              <span className="font-display text-4xl text-gold-strong">0 ₽</span>
              <span className="text-sm text-ink-muted">каждый день</span>
            </p>
            <ul className="mt-7 flex-1 space-y-3 text-[15px] text-ink-muted">
              {[
                "Карта дня — не тратит энергию",
                "Одна энергия в сутки: открывает любой расклад целиком",
                "История раскладов и статистика колоды",
                "Энергия за приглашённых друзей",
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <CheckGlyph />
                  {item}
                </li>
              ))}
            </ul>
            <span className="sheen pointer-events-none absolute inset-0 rounded-3xl" />
          </article>
        </Reveal>

        <Reveal index={1} delay={80} className="h-full">
          <article className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-hairline bg-surface p-8">
            <h3 className="font-display text-2xl text-ink">Пакет энергии</h3>
            <p className="mt-2 text-sm text-ink-muted">Разово, не сгорает</p>
            <ul className="mt-7 flex-1 space-y-3 text-[15px]">
              {packs.map((pack) => (
                <li key={pack.name} className="flex items-baseline justify-between gap-4 border-b border-hairline pb-2.5 text-ink-muted last:border-0">
                  <span>{pack.name}</span>
                  <span className="font-display text-lg whitespace-nowrap text-gold-strong tabular-nums">
                    {pack.price}
                  </span>
                </li>
              ))}
            </ul>
            <span className="sheen pointer-events-none absolute inset-0 rounded-3xl" />
          </article>
        </Reveal>

        <Reveal index={2} delay={80} className="h-full">
          <article className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-gold/70 bg-surface p-8 shadow-[0_40px_90px_-50px_var(--gold)]">
            <h3 className="font-display text-2xl text-ink">Подписка</h3>
            <p className="mt-2 text-sm text-ink-muted">На месяц, продлевается вручную</p>
            <ul className="mt-7 flex-1 space-y-4 text-[15px]">
              {plans.map((plan) => (
                <li key={plan.name} className="border-b border-hairline pb-3 last:border-0">
                  <span className="flex items-baseline justify-between gap-4">
                    <span className="text-ink">{plan.name}</span>
                    <span className="font-display text-lg whitespace-nowrap text-gold-strong tabular-nums">
                      {plan.price}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-ink-muted">
                    {plan.detail}
                  </span>
                </li>
              ))}
            </ul>
            <span className="sheen pointer-events-none absolute inset-0 rounded-3xl" />
          </article>
        </Reveal>
      </div>

      <Reveal delay={120}>
        <p className="mt-8 text-sm text-ink-muted">
          Подписка не продлевается автоматически — по окончании оплаченного
          месяца она просто заканчивается.
          {hasLegalDetails && (
            <>
              {" "}Условия оказания услуг и порядок возврата — в{" "}
              <a
                href="/oferta"
                className="text-ink underline decoration-hairline-strong underline-offset-4 hover:text-gold"
              >
                публичной оферте
              </a>
              .
            </>
          )}
        </p>
      </Reveal>
    </Section>
  );
}

function CheckGlyph() {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className="mt-1 size-4 shrink-0 text-sage-strong"
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m4 10.6 4 4 8-9.2"
      />
    </svg>
  );
}
