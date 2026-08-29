/**
 * Звуки интерфейса, синтезируемые в браузере через Web Audio API.
 *
 * Без единого аудиофайла: три коротких звука дешевле собрать
 * осциллятором, чем тащить, кэшировать и версионировать мегабайты mp3 в
 * мини-приложении, которое открывают внутри мессенджера.
 *
 * Три правила, из которых всё здесь следует:
 *
 * 1. AudioContext нельзя создать до жеста пользователя — браузер его
 *    заглушит. Поэтому контекст ленивый: он появляется при первом
 *    воспроизведении, то есть уже внутри обработчика касания.
 * 2. Приложение открывают в метро и на работе. Звук тихий (амплитуды
 *    ниже 0.07) и выключается одним переключателем в профиле.
 * 3. Звук — украшение. Любая ошибка здесь гасится: приложение без звука
 *    работает, приложение, упавшее из-за звука, — нет.
 */

const STORAGE_KEY = "tarot:sound-enabled";

let context: AudioContext | null = null;
let enabled = readEnabled();

function readEnabled(): boolean {
  try {
    // По умолчанию включено: звук карт — часть атмосферы, ради которой
    // расклад и открывают. Выключается в профиле и запоминается на этом
    // устройстве.
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function isSoundEnabled(): boolean {
  return enabled;
}

export function setSoundEnabled(next: boolean): void {
  enabled = next;
  try {
    localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
  } catch {
    // Не запомнили — в этой сессии всё равно работает.
  }
}

function ctx(): AudioContext | null {
  if (!enabled) return null;
  try {
    if (context === null) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      context = new Ctor();
    }
    // Сафари усыпляет контекст при уходе со вкладки.
    if (context.state === "suspended") void context.resume();
    return context;
  } catch {
    return null;
  }
}

/** Короткий тон с экспоненциальным затуханием — основа всех звуков. */
function tone(freq: number, durationMs: number, peak: number, type: OscillatorType = "sine", delayMs = 0): void {
  const audio = ctx();
  if (!audio) return;
  try {
    const start = audio.currentTime + delayMs / 1000;
    const end = start + durationMs / 1000;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    // Затухание, а не резкий обрыв: обрыв слышен щелчком.
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(gain).connect(audio.destination);
    osc.start(start);
    osc.stop(end + 0.02);
  } catch {
    // См. правило 3.
  }
}

/** Касание кнопки — почти неслышный отклик. */
export function playTap(): void {
  tone(660, 45, 0.03, "triangle");
}

/**
 * Переворот карты: шорох из отфильтрованного шума, а не тон. Карта,
 * падающая на стол, — это призвук, а не нота.
 */
export function playFlip(): void {
  const audio = ctx();
  if (!audio) return;
  try {
    const duration = 0.16;
    const frames = Math.floor(audio.sampleRate * duration);
    const buffer = audio.createBuffer(1, frames, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) {
      // Шум, затухающий к концу — звук скользящего картона.
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 2;
    }
    const source = audio.createBufferSource();
    source.buffer = buffer;

    const filter = audio.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1600;
    filter.Q.value = 0.8;

    const gain = audio.createGain();
    gain.gain.value = 0.06;

    source.connect(filter).connect(gain).connect(audio.destination);
    source.start();
  } catch {
    // См. правило 3.
  }
}

/** Расклад открыт целиком — две ноты, мягко и вверх. */
export function playReveal(): void {
  tone(528, 620, 0.045, "sine");
  tone(792, 700, 0.035, "sine", 110);
}
