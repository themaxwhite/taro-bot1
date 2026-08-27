import { Reveal, Section, SectionIntro } from "./primitives";

const steps = [
  {
    title: "Открываете бота",
    text: "Ничего не нужно устанавливать: приложение запускается внутри Telegram, аккаунт уже есть.",
  },
  {
    title: "Задаёте вопрос",
    text: "Выбираете расклад и, если хотите, формулируете вопрос своими словами. Можно и без него.",
  },
  {
    title: "Тянете карты из колоды",
    text: "Колода тасуется и вы выбираете карты вслепую — рубашкой вверх, как за настоящим столом.",
  },
  {
    title: "Читаете толкование",
    text: "Разбор каждой карты, её положения в раскладе и общий вывод — с учётом вашего вопроса.",
  },
];

export function HowItWorks() {
  return (
    <Section id="how">
      <SectionIntro eyebrow="Как это работает" title="Четыре шага, меньше минуты">
        Расклад устроен так же, как за столом: сначала вопрос, потом колода,
        потом карты — и только затем толкование.
      </SectionIntro>

      <ol className="mt-14 grid gap-px overflow-hidden rounded-3xl border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, i) => (
          <li key={step.title} className="group bg-surface transition-colors duration-300 hover:bg-surface-active">
            <Reveal index={i} className="h-full p-7">
              <span className="font-display grid size-11 place-items-center rounded-full border border-hairline text-lg text-gold-strong transition duration-300 group-hover:border-gold group-hover:bg-gold group-hover:text-on-gold">
                {i + 1}
              </span>
              <h3 className="font-display mt-5 text-xl text-ink">{step.title}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
                {step.text}
              </p>
            </Reveal>
          </li>
        ))}
      </ol>
    </Section>
  );
}
