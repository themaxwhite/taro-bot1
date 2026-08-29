/**
 * Озвучка толкования встроенным в браузер синтезом речи.
 *
 * Почему не серверный TTS: студийный голос (Yandex SpeechKit,
 * ElevenLabs, OpenAI) — это отдельный ключ, оплата за каждый символ и
 * хранение аудио. SpeechSynthesis не стоит ничего и не требует бэкенда
 * вовсе. Плата за это — голос выбирается из того, что установлено на
 * устройстве: мы можем найти лучший из имеющихся русских женских, но не
 * можем гарантировать конкретный тембр.
 *
 * Как и звук карт, озвучка — необязательная надстройка: нет поддержки,
 * нет русского голоса, что-то упало — экран продолжает работать молча.
 */

/**
 * Имена голосов, которые звучат мягче остальных на своих платформах.
 * Порядок — это порядок предпочтения, а не алфавит.
 *
 * Список именно из имён, потому что API не сообщает ни пол, ни тембр:
 * `SpeechSynthesisVoice` знает только имя, язык и признак локального.
 * Определить «женский тёплый» программно нельзя, поэтому выбор сделан
 * заранее и вручную.
 */
const PREFERRED_VOICES = [
  "Milena", // macOS/iOS — самый мягкий русский из системных, женский
  "Alena", // Яндекс, женский
  "Google русский", // Android/Chrome, женский
  "Microsoft Svetlana",
  "Microsoft Irina",
];

function synth(): SpeechSynthesis | null {
  try {
    return window.speechSynthesis ?? null;
  } catch {
    return null;
  }
}

export function isSpeechSupported(): boolean {
  return synth() !== null && typeof window.SpeechSynthesisUtterance === "function";
}

/**
 * Лучший доступный русский голос.
 *
 * Список голосов на части платформ заполняется асинхронно и на первый
 * вызов приходит пустым — тогда возвращаем null, и речь пойдёт голосом
 * по умолчанию. Это лучше, чем ждать: молчащая кнопка выглядит
 * сломанной.
 */
function pickVoice(): SpeechSynthesisVoice | null {
  const available = synth()?.getVoices() ?? [];
  const russian = available.filter((v) => v.lang.toLowerCase().startsWith("ru"));
  if (russian.length === 0) return null;

  for (const name of PREFERRED_VOICES) {
    const match = russian.find((v) => v.name.includes(name));
    if (match) return match;
  }
  // Ни один из отобранных не установлен. Берём любой русский —
  // локальный вперёд, он звучит ровнее сетевого и не зависит от связи.
  // Пол здесь уже не выбрать: API его не сообщает, и угадывать по имени
  // произвольного голоса — значит ошибаться молча.
  return russian.find((v) => v.localService) ?? russian[0];
}

/**
 * Заставляет браузер начать загрузку списка голосов.
 *
 * На Chrome `getVoices()` до события `voiceschanged` возвращает пустой
 * массив, и самое первое нажатие прочиталось бы голосом по умолчанию
 * вместо выбранного. Экран зовёт это при открытии, задолго до того, как
 * кнопку успеют нажать.
 */
export function primeVoices(): void {
  try {
    synth()?.getVoices();
  } catch {
    // Прогрев необязателен: не вышло — просто возьмётся голос по умолчанию.
  }
}

export function stopSpeech(): void {
  try {
    synth()?.cancel();
  } catch {
    // Молча: остановка озвучки не повод ронять экран.
  }
}

/**
 * Читает текст вслух. `onEnd` вызывается и при штатном завершении, и при
 * ошибке — экрану нужно вернуть кнопку в исходное состояние в обоих
 * случаях, а разбираться в причине ему незачем.
 */
export function speak(text: string, onEnd: () => void): boolean {
  const engine = synth();
  if (!engine || !isSpeechSupported()) return false;

  try {
    // Остановить предыдущее чтение: иначе два толкования зазвучат разом.
    engine.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ru-RU";
    const voice = pickVoice();
    if (voice) utterance.voice = voice;
    // Медленнее и ниже стандартного. Темп по умолчанию для толкования
    // суетлив — его слушают, а не просматривают; а тон ниже единицы
    // звучит теплее, тогда как выше — звонче и жёстче, то есть ровно
    // противоположно просьбе.
    utterance.rate = 0.92;
    utterance.pitch = 0.95;
    utterance.volume = 1;
    utterance.onend = onEnd;
    utterance.onerror = onEnd;

    engine.speak(utterance);
    return true;
  } catch {
    return false;
  }
}
