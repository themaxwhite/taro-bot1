/**
 * Frontend-facing description of a spread type. Card selection,
 * randomness and orientation are decided by the backend (Tarot Engine) —
 * this type only describes what the UI needs to render a choice.
 */
export type SpreadId =
  | "daily-card"
  | "love"
  | "future"
  | "celtic-cross"
  | "yes-no"
  | "horseshoe"
  | "compatibility"
  | "work"
  | "crossroads"
  | "mirror"
  | "month";

export interface SpreadType {
  id: SpreadId;
  title: string;
  description: string;
  cardCount: number;
}

export const SPREAD_TYPES: SpreadType[] = [
  {
    id: "daily-card",
    title: "Карта дня",
    description: "Одна карта — подсказка на сегодня",
    cardCount: 1,
  },
  {
    id: "yes-no",
    title: "Да или нет",
    description: "Быстрый ответ на конкретный вопрос",
    cardCount: 1,
  },
  {
    id: "love",
    title: "Любовь",
    description: "Прошлое, настоящее, возможное развитие",
    cardCount: 3,
  },
  {
    id: "future",
    title: "Будущее",
    description: "Текущая ситуация, скрытый фактор, развитие",
    cardCount: 3,
  },
  {
    id: "work",
    title: "Работа и деньги",
    description: "Где вы сейчас, что мешает и что упускаете — 4 карты",
    cardCount: 4,
  },
  {
    id: "crossroads",
    title: "Два пути",
    description: "Выбор между двумя вариантами: что даст каждый и чего будет стоить",
    cardCount: 5,
  },
  {
    id: "mirror",
    title: "Зеркало",
    description: "Каким вы себя видите и каким вас видят другие — 4 карты",
    cardCount: 4,
  },
  {
    id: "month",
    title: "Месяц впереди",
    description: "Начало, середина, конец месяца и его главная тема",
    cardCount: 4,
  },
  {
    id: "celtic-cross",
    title: "Кельтский крест",
    description: "Классический глубокий расклад на любой вопрос — 10 карт",
    cardCount: 10,
  },
  {
    id: "horseshoe",
    title: "Подкова",
    description: "Классический расклад на удачу и путь к решению — 7 карт",
    cardCount: 7,
  },
  {
    id: "compatibility",
    title: "Совместимость",
    description: "Расклад на отношения — вы, партнёр и что вас ждёт",
    cardCount: 5,
  },
];

/**
 * Разбивка сетки на главной по смыслу.
 *
 * Десять плиток подряд читаются как список, в котором надо разбираться;
 * четыре коротких раздела — как меню, где сразу видно нужную полку. Это
 * та же проблема, ради которой появился онбординг, только с другой
 * стороны: объяснить, что здесь есть, дешевле, чем заставлять читать
 * описания всех раскладов.
 */
export interface SpreadGroup {
  title: string;
  spreads: SpreadType[];
}

const GROUP_ORDER: { title: string; ids: SpreadId[] }[] = [
  { title: "Что впереди", ids: ["yes-no", "future", "month"] },
  { title: "Отношения", ids: ["love", "compatibility"] },
  { title: "Дело и выбор", ids: ["work", "crossroads"] },
  { title: "Глубокий разбор", ids: ["mirror", "horseshoe", "celtic-cross"] },
];

/**
 * Разделы с уже разрешёнными раскладами.
 *
 * `exclude` — то, что показано отдельно и не должно дублироваться в
 * сетке (карта дня живёт в своём баннере над ней).
 *
 * Расклад, не попавший ни в один раздел, уезжает в «Другие», а не
 * исчезает: список разделов легко забыть обновить, добавляя новый
 * расклад, и тихо пропавшая плитка — куда худший исход, чем лишний
 * заголовок.
 */
export function spreadGroups(exclude: SpreadId[] = []): SpreadGroup[] {
  const skip = new Set<SpreadId>(exclude);
  const placed = new Set<SpreadId>();

  const groups = GROUP_ORDER.map(({ title, ids }) => {
    const spreads = ids
      .filter((id) => !skip.has(id))
      .map((id) => SPREAD_TYPES.find((s) => s.id === id))
      .filter((s): s is SpreadType => s !== undefined);
    spreads.forEach((s) => placed.add(s.id));
    return { title, spreads };
  }).filter((group) => group.spreads.length > 0);

  const leftovers = SPREAD_TYPES.filter((s) => !skip.has(s.id) && !placed.has(s.id));
  return leftovers.length > 0 ? [...groups, { title: "Другие", spreads: leftovers }] : groups;
}
