import { hasLegalDetails, site } from "../site";
import { OpenInTelegram } from "./primitives";
import { useReveal } from "../hooks/useReveal";

export function Footer() {
  const ref = useReveal<HTMLDivElement>();

  return (
    <footer className="border-t border-hairline">
      <div
        ref={ref}
        className="mx-auto w-full max-w-6xl px-5 py-20 text-center sm:px-8 sm:py-28"
      >
        <img
          src="/cards/card-back.webp"
          alt=""
          width={480}
          height={720}
          loading="lazy"
          decoding="async"
          className="card-art float-slow mx-auto w-28 rounded-2xl border border-hairline shadow-[0_26px_50px_-28px_#000] sm:w-32"
        />
        <h2 className="font-display mt-9 text-3xl text-balance text-ink sm:text-4xl">
          Колода перетасована. Осталось вытянуть карту.
        </h2>
        <p className="mx-auto mt-5 max-w-md text-pretty text-ink-muted">
          Первый расклад займёт меньше минуты и ничего не будет стоить.
        </p>
        <div className="mt-9 flex justify-center">
          <OpenInTelegram size="lg">Открыть {site.name}</OpenInTelegram>
        </div>

        <div className="mt-16 border-t border-hairline pt-10 text-left text-sm text-ink-muted">
          {hasLegalDetails && (
            <>
              <div className="grid gap-8 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-gold uppercase">
                    Исполнитель
                  </p>
                  <p className="leading-relaxed">
                    Самозанятый {site.legalName}
                    <br />
                    ИНН {site.inn}
                  </p>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-gold uppercase">
                    Связь
                  </p>
                  <p className="leading-relaxed">
                    Обращения, претензии и возвраты:
                    <br />
                    <a href={`mailto:${site.email}`} className="text-ink hover:text-gold">
                      {site.email}
                    </a>
                  </p>
                </div>
              </div>

              <p className="mt-8 leading-relaxed">
                <a
                  href="/oferta.html"
                  className="text-ink underline decoration-hairline-strong underline-offset-4 hover:text-gold"
                >
                  Публичная оферта, условия оказания услуг и порядок возврата
                </a>
              </p>
            </>
          )}

          <div className="mt-8 flex flex-col gap-3 border-t border-hairline pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {new Date().getFullYear()} {site.name}
            </p>
            <p className="max-w-md text-xs leading-relaxed sm:text-right">
              Развлекательный сервис для лиц 18 лет и старше. Толкования создаёт
              искусственный интеллект. Расклады не заменяют консультацию врача,
              юриста или финансового специалиста.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
