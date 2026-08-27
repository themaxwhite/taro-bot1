import { Reveal, Section, SectionIntro } from "./primitives";

const features = [
  {
    title: "Карты тянет сервер, не браузер",
    text: "Выбор карт, случайность и положение решаются только на бэкенде. Клиент не может подкрутить результат — и не «подгоняет» карту под ожидаемый ответ.",
    span: "lg:col-span-2",
  },
  {
    title: "Толкование с учётом вопроса",
    text: "Разбор пишется под ваш вопрос и темы из профиля, а не берётся из общего справочника значений.",
  },
  {
    title: "Карта дня — раз в сутки",
    text: "Закрепляется на календарный день. Никаких пересдач до тех пор, пока день не сменится.",
  },
  {
    title: "История раскладов",
    text: "Каждый расклад сохраняется: можно вернуться через месяц и перечитать, что выпало и что это значило.",
  },
  {
    title: "Фон, который не мешает",
    text: "Эмбиент синтезируется прямо в браузере — без аудиофайлов и лишней загрузки. Выключается одним переключателем.",
    span: "lg:col-span-2",
  },
];

export function Features() {
  return (
    <Section id="features">
      <SectionIntro eyebrow="Детали" title="Сделано честно">
        Таро — про интерпретацию, а не про подтасовку. Поэтому всё, что влияет
        на результат, устроено прозрачно.
      </SectionIntro>

      <div className="mt-14 grid gap-6 lg:grid-cols-3">
        {features.map((feature, i) => (
          <Reveal key={feature.title} index={i} className={feature.span ?? ""}>
            <article className="panel group relative h-full overflow-hidden rounded-3xl p-7 transition duration-500 hover:border-hairline-strong">
              <h3 className="font-display text-xl text-ink">{feature.title}</h3>
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-muted">
                {feature.text}
              </p>
              <span className="sheen pointer-events-none absolute inset-0 rounded-3xl" />
            </article>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
