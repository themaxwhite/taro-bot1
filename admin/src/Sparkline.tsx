import { useState } from "react";

/**
 * Спарклайн — столбики по дням, один показатель на карточку.
 *
 * Малые кратные вместо одного графика с несколькими шкалами: регистрации,
 * расклады и рубли живут в разных порядках величин, и совмещать их на
 * одной оси значило бы рисовать вторую ось справа — самый верный способ
 * заставить читателя увидеть связь, которой в данных нет.
 *
 * Серия одна, поэтому легенды нет: показатель называет заголовок
 * карточки. Значения не подписываются на каждом столбике — вместо этого
 * при наведении в шапке карточки появляется дата и число, а само
 * значение доступно и без мыши, во всплывающей подсказке браузера.
 */

type Props = {
  title: string;
  points: { date: string; value: number }[];
  /** Как показать число: рубли, штуки. */
  format: (value: number) => string;
  /** Итог за весь показанный период — крупным в шапке. */
  total: string;
};

const GAP = 2; // просвет между столбиками, как требует спецификация марок
const HEIGHT = 44;

export function Sparkline({ title, points, format, total }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);

  const max = Math.max(1, ...points.map((p) => p.value));
  const width = points.length * (4 + GAP);
  const barWidth = 4;

  const shown = hovered !== null ? points[hovered] : null;

  return (
    <div className="spark">
      <div className="spark-head">
        <span className="spark-title">{title}</span>
        <span className="spark-total">{shown ? format(shown.value) : total}</span>
      </div>

      <svg
        className="spark-plot"
        viewBox={`0 0 ${width} ${HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${title}: ${total} за период`}
        onMouseLeave={() => setHovered(null)}
      >
        {points.map((p, i) => {
          /* Ноль тоже рисуем — полоской в один пиксель у основания.
             Пустой день без отметки читается как отсутствие данных, а не
             как отсутствие событий. */
          const h = p.value === 0 ? 1 : Math.max(2, (p.value / max) * (HEIGHT - 2));
          return (
            <rect
              key={p.date}
              x={i * (barWidth + GAP)}
              y={HEIGHT - h}
              width={barWidth}
              height={h}
              rx={1.5}
              className={hovered === i ? "bar hot" : "bar"}
              onMouseEnter={() => setHovered(i)}
            >
              <title>{`${formatDay(p.date)}: ${format(p.value)}`}</title>
            </rect>
          );
        })}
      </svg>

      <div className="spark-foot">
        {shown ? formatDay(shown.date) : `${points.length} дней`}
      </div>
    </div>
  );
}

function formatDay(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${day}.${month}`;
}
