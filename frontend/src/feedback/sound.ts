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
 * 2. Приложение открывают в метро и на работе. Звук остаётся негромким
 *    и выключается одним переключателем в профиле. Общий уровень задаёт
 *    MASTER_GAIN — двигать громкость нужно им, а не амплитудами
 *    отдельных звуков, иначе баланс между ними разъезжается.
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

/**
 * Общая громкость. Раньше уровень был зашит в каждый звук по отдельности,
 * и «сделать погромче» означало править четыре числа, рискуя разъехаться
 * в балансе между ними. Теперь пропорции живут в самих звуках, а этот
 * множитель двигает их все разом.
 */
const MASTER_GAIN = 0.9;

let master: GainNode | null = null;

/** Общий выход. Все звуки идут через него, а не в destination напрямую. */
function output(): GainNode | null {
  const audio = ctx();
  if (!audio) return null;
  try {
    if (master === null || master.context !== audio) {
      master = audio.createGain();
      master.gain.value = MASTER_GAIN;
      master.connect(audio.destination);
    }
    return master;
  } catch {
    return null;
  }
}

interface ToneOptions {
  freq: number;
  durationMs: number;
  peak: number;
  type?: OscillatorType;
  delayMs?: number;
  /**
   * Время нарастания. Короткое читается как щипок, длинное — как
   * наплыв. Именно оно, а не сама нота, решает, звучит ли звук резко.
   */
  attackMs?: number;
}

/** Тон с настраиваемой атакой и экспоненциальным затуханием. */
function tone({ freq, durationMs, peak, type = "sine", delayMs = 0, attackMs = 12 }: ToneOptions): void {
  const audio = ctx();
  const out = output();
  if (!audio || !out) return;
  try {
    const start = audio.currentTime + delayMs / 1000;
    const end = start + durationMs / 1000;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    // Затухание, а не резкий обрыв: обрыв слышен щелчком.
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + attackMs / 1000);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(gain).connect(out);
    osc.start(start);
    osc.stop(end + 0.02);
  } catch {
    // См. правило 3.
  }
}

/** Касание кнопки — почти неслышный отклик. */
export function playTap(): void {
  tone({ freq: 660, durationMs: 45, peak: 0.035, type: "triangle" });
}

/**
 * Переворот карты.
 *
 * Не сухой шорох, а мягкий взмах: шум идёт через полосовой фильтр,
 * который за время звука съезжает сверху вниз — так слышится карта,
 * прошедшая по воздуху и легшая на стол, а не щелчок картона. Плюс
 * тихий низкий тон, дающий звуку тело: один только шум звучит
 * по-бумажному сухо.
 *
 * Атака намеренно не мгновенная. Резкое начало и есть то, что читается
 * как «щёлк», сколько его ни делай тише.
 */
export function playFlip(): void {
  const audio = ctx();
  const out = output();
  if (!audio || !out) return;
  try {
    const duration = 0.42;
    const frames = Math.floor(audio.sampleRate * duration);
    const buffer = audio.createBuffer(1, frames, audio.sampleRate);
    const data = buffer.getChannelData(0);
    // Доля длительности, уходящая на нарастание.
    const attack = 0.22;
    for (let i = 0; i < frames; i += 1) {
      const t = i / frames;
      const envelope = t < attack ? t / attack : (1 - (t - attack) / (1 - attack)) ** 1.7;
      data[i] = (Math.random() * 2 - 1) * envelope;
    }

    const source = audio.createBufferSource();
    source.buffer = buffer;

    const now = audio.currentTime;
    const filter = audio.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(2700, now);
    filter.frequency.exponentialRampToValueAtTime(760, now + duration);
    // Широкая полоса: узкая превращает шум в свист.
    filter.Q.value = 0.7;

    const gain = audio.createGain();
    gain.gain.value = 0.17;

    source.connect(filter).connect(gain).connect(out);
    source.start(now);

    // Тело звука — короткий низкий тон под шумом.
    tone({ freq: 210, durationMs: 300, peak: 0.05, type: "sine", attackMs: 70 });
  } catch {
    // См. правило 3.
  }
}

/**
 * Расклад открыт целиком — мажорное трезвучие, наплывом.
 *
 * Ноты вступают по очереди и с медленной атакой, так что аккорд
 * распускается, а не ударяет. Звучит он около 1,8 с — этого хватает,
 * чтобы накрыть открытие расклада на три-пять карт целиком; на десяти
 * картах перевороты продолжаются и после того, как аккорд отзвучал, и
 * дальше их несёт уже собственный шелест.
 */
export function playReveal(): void {
  tone({ freq: 528, durationMs: 1700, peak: 0.075, attackMs: 220 });
  tone({ freq: 660, durationMs: 1600, peak: 0.06, attackMs: 240, delayMs: 150 });
  tone({ freq: 792, durationMs: 1500, peak: 0.05, attackMs: 260, delayMs: 300 });
}
