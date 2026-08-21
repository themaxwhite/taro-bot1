import styles from "./Greeting.module.css";

interface GreetingProps {
  firstName: string | null;
}

function getTimeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return "Доброй ночи";
  if (hour < 12) return "Доброе утро";
  if (hour < 18) return "Добрый день";
  return "Добрый вечер";
}

export function Greeting({ firstName }: GreetingProps) {
  return (
    <div className={styles.greeting}>
      <p className={styles.subtitle}>{getTimeOfDayGreeting()}</p>
      <h1 className={styles.title}>{firstName ? `${firstName} 👋` : "Добро пожаловать"}</h1>
    </div>
  );
}
