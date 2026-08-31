/** Единое форматирование чисел и дат, чтобы таблицы не разъезжались. */

const dateTime = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const dateOnly = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/* Бэкенд отдаёт время без часового пояса (datetime.utcnow), поэтому «Z»
   приходится дописывать вручную — иначе браузер посчитает его местным и
   сдвинет всё на разницу с UTC. */
function parse(value: string): Date {
  const normalized = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : value + "Z";
  return new Date(normalized);
}

export const formatDateTime = (value: string) => dateTime.format(parse(value));
export const formatDate = (value: string) => dateOnly.format(parse(value));

export const formatNumber = (value: number) => value.toLocaleString("ru-RU");
export const formatMoney = (rub: number) => `${rub.toLocaleString("ru-RU")} ₽`;

/** «1 расклад / 2 расклада / 5 раскладов» */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
