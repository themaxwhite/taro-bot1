import styles from "./Avatar.module.css";

interface AvatarProps {
  photoUrl: string | null;
  firstName: string | null;
  /** Active subscription tier ("basic" | "plus" | "premium" | "admin"), or null if unsubscribed — controls the ring around the avatar. */
  tier?: string | null;
}

function ringClass(tier: string | null | undefined): string {
  if (tier === "premium" || tier === "admin") return styles.ringPremium;
  if (tier === "plus") return styles.ringPlus;
  if (tier === "basic") return styles.ringBasic;
  return "";
}

export function Avatar({ photoUrl, firstName, tier }: AvatarProps) {
  const ring = ringClass(tier);

  if (photoUrl) {
    return (
      <div className={`${styles.ringWrap} ${ring}`}>
        <img className={styles.avatar} src={photoUrl} alt={firstName ?? "Профиль"} />
      </div>
    );
  }

  const initial = firstName?.charAt(0).toUpperCase() ?? "?";

  return (
    <div className={`${styles.ringWrap} ${ring}`}>
      <div className={styles.avatar} aria-hidden="true">
        <span className={styles.initial}>{initial}</span>
      </div>
    </div>
  );
}
