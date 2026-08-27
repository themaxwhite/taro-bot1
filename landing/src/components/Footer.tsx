import { site } from "../site";
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

        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-hairline pt-8 text-sm text-ink-muted sm:flex-row">
          <p>
            © {new Date().getFullYear()} {site.name}
          </p>
          <p className="max-w-md text-center text-xs leading-relaxed sm:text-right">
            Развлекательный сервис. Расклады не заменяют консультацию врача,
            юриста или финансового специалиста.
          </p>
        </div>
      </div>
    </footer>
  );
}
