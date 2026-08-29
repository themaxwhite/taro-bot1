import { useState } from "react";
import { MAJOR_ARCANA, ZODIAC_SIGNS } from "../../content/arcana";
import { updatePatronCard, updateZodiac, type ZodiacSign } from "../../services/historyApi";
import styles from "./IdentityCard.module.css";

interface IdentityCardProps {
  zodiacSign: ZodiacSign | null;
  patronCard: string | null;
  /** Сообщает наверх новое состояние, чтобы профиль не перезапрашивался целиком. */
  onChange: (next: { zodiacSign?: ZodiacSign; patronCard?: string | null }) => void;
}

type OpenPicker = "none" | "zodiac" | "patron";

/**
 * Знак зодиака и карта-покровитель — то, что приложение знает о самом
 * человеке, а не о его раскладах.
 *
 * Оба выбираются раскрывающейся сеткой прямо здесь, а не отдельным
 * экраном: выбор из готового списка — это одно касание, и уводить ради
 * него со страницы значит делать из него событие.
 *
 * Знак спрашивают один раз в онбординге, где легко промахнуться, и до
 * сих пор исправить его было негде. Карта-покровитель в онбординг
 * намеренно не входит: это необязательный выбор, и новичку, который ещё
 * не видел ни одной карты, он ничего не говорит.
 */
export function IdentityCard({ zodiacSign, patronCard, onChange }: IdentityCardProps) {
  const [open, setOpen] = useState<OpenPicker>("none");
  const [saving, setSaving] = useState(false);

  const sign = ZODIAC_SIGNS.find((z) => z.id === zodiacSign) ?? null;
  const patron = MAJOR_ARCANA.find((a) => a.id === patronCard) ?? null;

  function toggle(picker: OpenPicker) {
    setOpen((current) => (current === picker ? "none" : picker));
  }

  async function pickZodiac(id: string) {
    setSaving(true);
    try {
      await updateZodiac(id as ZodiacSign);
      onChange({ zodiacSign: id as ZodiacSign });
      setOpen("none");
    } catch {
      // Молча: строка останется на прежнем значении, повторное касание
      // просто попробует снова.
    } finally {
      setSaving(false);
    }
  }

  async function pickPatron(id: string | null) {
    setSaving(true);
    try {
      await updatePatronCard(id);
      onChange({ patronCard: id });
      setOpen("none");
    } catch {
      // См. выше.
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.block}>
      <button
        type="button"
        className={styles.row}
        onClick={() => toggle("zodiac")}
        aria-expanded={open === "zodiac"}
      >
        <span className={styles.rowIcon} aria-hidden="true">
          {sign ? sign.symbol : "✳"}
        </span>
        <span className={styles.rowText}>
          <span className={styles.rowLabel}>Знак зодиака</span>
          <span className={styles.rowValue}>{sign ? sign.title : "Не выбран"}</span>
        </span>
        <span className={`${styles.chevron} ${open === "zodiac" ? styles.chevronOpen : ""}`} aria-hidden="true">
          ›
        </span>
      </button>

      {open === "zodiac" && (
        <div className={styles.zodiacGrid}>
          {ZODIAC_SIGNS.map((z) => (
            <button
              key={z.id}
              type="button"
              disabled={saving}
              className={`${styles.zodiacCell} ${z.id === zodiacSign ? styles.selected : ""}`}
              onClick={() => pickZodiac(z.id)}
            >
              <span className={styles.zodiacSymbol} aria-hidden="true">
                {z.symbol}
              </span>
              <span className={styles.zodiacTitle}>{z.title}</span>
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        className={styles.row}
        onClick={() => toggle("patron")}
        aria-expanded={open === "patron"}
      >
        {patron ? (
          <img className={styles.rowThumb} src={`/cards/${patron.id}.webp`} alt="" aria-hidden="true" />
        ) : (
          <span className={styles.rowIcon} aria-hidden="true">
            ✦
          </span>
        )}
        <span className={styles.rowText}>
          <span className={styles.rowLabel}>Карта-покровитель</span>
          <span className={styles.rowValue}>{patron ? patron.name : "Не выбрана"}</span>
        </span>
        <span className={`${styles.chevron} ${open === "patron" ? styles.chevronOpen : ""}`} aria-hidden="true">
          ›
        </span>
      </button>

      {open === "patron" && (
        <div className={styles.patronPicker}>
          <p className={styles.hint}>
            Один из 22 старших арканов — тот, что откликается вам. Ни на расклады, ни на
            их толкование выбор не влияет.
          </p>
          <div className={styles.patronGrid}>
            {MAJOR_ARCANA.map((card) => (
              <button
                key={card.id}
                type="button"
                disabled={saving}
                className={`${styles.patronCell} ${card.id === patronCard ? styles.selected : ""}`}
                onClick={() => pickPatron(card.id)}
              >
                <img className={styles.patronImage} src={`/cards/${card.id}.webp`} alt="" loading="lazy" />
                <span className={styles.patronName}>{card.name}</span>
              </button>
            ))}
          </div>
          {patronCard && (
            <button type="button" className={styles.clearButton} disabled={saving} onClick={() => pickPatron(null)}>
              Убрать выбор
            </button>
          )}
        </div>
      )}
    </div>
  );
}
