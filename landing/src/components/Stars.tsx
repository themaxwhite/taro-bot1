import { OpenInTelegram, Reveal, Section, SectionIntro } from "./primitives";

/* Цены и состав сверены с бэкендом: app/subscriptions.py (тарифы),
   app/energy.py (пакеты и суточная энергия).

   Платёжный провайдер сейчас не подключён, поэтому платный блок
   описан как то, что появится, а не как то, что можно купить: обещать
   на лендинге кнопку, которой нет в приложении, — худший вид вранья,
   потому что его обнаруживают уже внутри.

   Раньше здесь были Telegram Stars — механики, которой в продукте нет
   вовсе. */
const tiers = [
  {
    name: "Бесплатно",
    price: "0",
    unit: "каждый день",
    items: [
      "Карта дня — бесплатно и не тратит энергию",
      "Одна энергия в сутки: открывает любой расклад целиком",
      "История раскладов и статистика колоды",
      "Дневное пожелание",
    ],
    cta: false,
  },
  {
    name: "Энергия и подписка",
    price: "Скоро",
    unit: "готовим оплату",
    items: [
      "Подписка: от 70 до 300 разблокировок в месяц",
      "Свой вопрос к раскладу своими словами",
      "Пакет энергии разово, не сгорает",
      "Оплата пока не подключена — всё бесплатное работает",
    ],
    cta: true,
  },
];

export function Stars() {
  return (
    <Section id="pricing">
      <SectionIntro
        eyebrow="Оплата"
        title="Каждый день бесплатно, дальше — по желанию"
      >
        Расклад открывается за одну энергию, и одна приходит каждые сутки —
        этого хватает, чтобы пользоваться приложением, ничего не платя.
        Платные тарифы готовятся, оплата пока не подключена.
      </SectionIntro>

      <div className="mt-14 grid gap-6 lg:grid-cols-2">
        {tiers.map((tier, i) => (
          <Reveal key={tier.name} index={i} delay={80} className="h-full">
          <article
            className={`group relative flex h-full flex-col overflow-hidden rounded-3xl border p-8 transition duration-300 hover:-translate-y-1.5 ${
              tier.cta
                ? "border-gold/70 bg-surface shadow-[0_40px_90px_-50px_var(--gold)] hover:shadow-[0_50px_100px_-50px_var(--gold)]"
                : "border-hairline bg-surface hover:border-hairline-strong"
            }`}
          >
            <h3 className="font-display text-2xl text-ink">{tier.name}</h3>
            <p className="mt-4 flex items-baseline gap-2">
              <span className="font-display text-4xl text-gold-strong">
                {tier.price}
              </span>
              <span className="text-sm text-ink-muted">{tier.unit}</span>
            </p>
            <ul className="mt-7 flex-1 space-y-3 text-[15px] text-ink-muted">
              {tier.items.map((item) => (
                <li key={item} className="flex gap-3">
                  <CheckGlyph />
                  {item}
                </li>
              ))}
            </ul>
            {tier.cta && (
              <div className="mt-8">
                <OpenInTelegram size="lg">Попробовать</OpenInTelegram>
              </div>
            )}
            <span className="sheen pointer-events-none absolute inset-0 rounded-3xl" />
          </article>
          </Reveal>
        ))}
      </div>
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
