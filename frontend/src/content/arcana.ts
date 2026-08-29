/**
 * Старшие арканы — для выбора карты-покровителя в профиле.
 *
 * Дублирует backend/app/tarot/cards.py: сервер проверяет выбор по
 * настоящей колоде (MAJOR_ARCANA_IDS), здесь же нужны только id и
 * название, чтобы нарисовать выбор. Картинка берётся по id тем же
 * путём, что и в раскладах — /cards/<id>.webp.
 */
export interface Arcana {
  id: string;
  name: string;
}

export const MAJOR_ARCANA: Arcana[] = [
  { id: "major-00", name: "Шут" },
  { id: "major-01", name: "Маг" },
  { id: "major-02", name: "Верховная Жрица" },
  { id: "major-03", name: "Императрица" },
  { id: "major-04", name: "Император" },
  { id: "major-05", name: "Иерофант" },
  { id: "major-06", name: "Влюблённые" },
  { id: "major-07", name: "Колесница" },
  { id: "major-08", name: "Сила" },
  { id: "major-09", name: "Отшельник" },
  { id: "major-10", name: "Колесо Фортуны" },
  { id: "major-11", name: "Справедливость" },
  { id: "major-12", name: "Повешенный" },
  { id: "major-13", name: "Смерть" },
  { id: "major-14", name: "Умеренность" },
  { id: "major-15", name: "Дьявол" },
  { id: "major-16", name: "Башня" },
  { id: "major-17", name: "Звезда" },
  { id: "major-18", name: "Луна" },
  { id: "major-19", name: "Солнце" },
  { id: "major-20", name: "Суд" },
  { id: "major-21", name: "Мир" },
];

export const ZODIAC_SIGNS: { id: string; symbol: string; title: string }[] = [
  { id: "aries", symbol: "♈", title: "Овен" },
  { id: "taurus", symbol: "♉", title: "Телец" },
  { id: "gemini", symbol: "♊", title: "Близнецы" },
  { id: "cancer", symbol: "♋", title: "Рак" },
  { id: "leo", symbol: "♌", title: "Лев" },
  { id: "virgo", symbol: "♍", title: "Дева" },
  { id: "libra", symbol: "♎", title: "Весы" },
  { id: "scorpio", symbol: "♏", title: "Скорпион" },
  { id: "sagittarius", symbol: "♐", title: "Стрелец" },
  { id: "capricorn", symbol: "♑", title: "Козерог" },
  { id: "aquarius", symbol: "♒", title: "Водолей" },
  { id: "pisces", symbol: "♓", title: "Рыбы" },
];
