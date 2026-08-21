import styles from "./Avatar.module.css";

interface AvatarProps {
  photoUrl: string | null;
  firstName: string | null;
}

export function Avatar({ photoUrl, firstName }: AvatarProps) {
  if (photoUrl) {
    return <img className={styles.avatar} src={photoUrl} alt={firstName ?? "Профиль"} />;
  }

  const initial = firstName?.charAt(0).toUpperCase() ?? "?";

  return (
    <div className={styles.avatar} aria-hidden="true">
      <span className={styles.initial}>{initial}</span>
    </div>
  );
}
