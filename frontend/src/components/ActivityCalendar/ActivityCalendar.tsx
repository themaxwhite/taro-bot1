import type { ActivityDay } from "../../types/history";
import styles from "./ActivityCalendar.module.css";

interface ActivityCalendarProps {
  activity: ActivityDay[];
  from: string;
  to: string;
}

const WEEKDAY_LABELS = ["Пн", "", "Ср", "", "Пт", "", "Вс"];
const MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

/** Понедельник той недели, в которую попадает дата. */
function weekStart(date: Date): Date {
  const result = new Date(date);
  // getDay(): воскресенье это 0, а неделя у нас начинается с понедельника.
  const shift = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - shift);
  return result;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Насыщенность клетки. Четыре ступени, а не плавная шкала: на квадрате
 * в семь пикселей разница между «три расклада» и «четыре» неразличима,
 * а вот «пусто / был / был не раз» читается сразу.
 */
function level(count: number): 0 | 1 | 2 | 3 {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  return 3;
}

/**
 * Карта активности за последние 14 недель.
 *
 * Сервер присылает только непустые дни (app/insights.py) — пустых в окне
 * подавляющее большинство, и гонять их через сеть незачем. Сетка
 * достраивается здесь: от понедельника недели, в которую попало начало
 * окна, и до сегодня.
 */
export function ActivityCalendar({ activity, from, to }: ActivityCalendarProps) {
  const counts = new Map(activity.map((day) => [day.date, day.count]));
  const end = new Date(`${to}T00:00:00Z`);
  const cursor = weekStart(new Date(`${from}T00:00:00Z`));

  const weeks: { date: string; count: number; inRange: boolean }[][] = [];
  const monthLabels: { index: number; label: string }[] = [];
  let lastMonth = -1;

  while (cursor <= end) {
    const week: { date: string; count: number; inRange: boolean }[] = [];
    for (let i = 0; i < 7; i += 1) {
      const date = isoDate(cursor);
      week.push({
        date,
        count: counts.get(date) ?? 0,
        // Дни до начала окна и после сегодняшнего рисуются пустыми
        // местами, а не клетками: иначе они читались бы как дни без
        // раскладов, хотя про них попросту нечего сказать.
        inRange: cursor >= new Date(`${from}T00:00:00Z`) && cursor <= end,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    const monthOfWeek = new Date(`${week[0].date}T00:00:00Z`).getUTCMonth();
    if (monthOfWeek !== lastMonth) {
      monthLabels.push({ index: weeks.length, label: MONTHS[monthOfWeek] });
      lastMonth = monthOfWeek;
    }
    weeks.push(week);
  }

  const activeDays = activity.length;
  const totalSpreads = activity.reduce((sum, day) => sum + day.count, 0);

  return (
    <section className={styles.card}>
      <div className={styles.head}>
        <h2 className={styles.heading}>Активность</h2>
        <span className={styles.summary}>
          {activeDays === 0 ? "Пока пусто" : `${totalSpreads} за ${activeDays} дн.`}
        </span>
      </div>

      <div className={styles.scroll}>
        <div className={styles.months}>
          {weeks.map((week, i) => {
            const label = monthLabels.find((m) => m.index === i);
            return (
              <span key={week[0].date} className={styles.month}>
                {label?.label ?? ""}
              </span>
            );
          })}
        </div>

        <div className={styles.body}>
          <div className={styles.weekdays} aria-hidden="true">
            {WEEKDAY_LABELS.map((label, i) => (
              <span key={i} className={styles.weekday}>
                {label}
              </span>
            ))}
          </div>

          <div className={styles.grid}>
            {weeks.map((week) => (
              <div key={week[0].date} className={styles.week}>
                {week.map((day) =>
                  day.inRange ? (
                    <span
                      key={day.date}
                      className={`${styles.cell} ${styles[`level${level(day.count)}`]}`}
                      title={`${day.date}: ${day.count}`}
                    />
                  ) : (
                    <span key={day.date} className={styles.blank} />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
