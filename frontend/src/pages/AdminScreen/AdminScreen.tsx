import { useEffect, useState } from "react";
import { fetchAdminStats, type AdminStats } from "../../services/adminApi";
import { TIER_TITLES } from "../../types/subscription";
import { SpreadsApiError } from "../../services/spreadsApi";
import { ScreenHeader } from "../../components/ScreenHeader/ScreenHeader";
import { Spinner } from "../../components/Spinner/Spinner";
import styles from "./AdminScreen.module.css";

interface AdminScreenProps {
  onBack: () => void;
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; stats: AdminStats };

interface Metric {
  label: string;
  value: string;
}

function formatRub(amount: number): string {
  return `${amount.toLocaleString("ru-RU")} ₽`;
}

function buildSections(stats: AdminStats): { title: string; metrics: Metric[] }[] {
  return [
    {
      title: "Пользователи",
      metrics: [
        { label: "Всего", value: stats.usersTotal.toLocaleString("ru-RU") },
        { label: "Новых сегодня", value: String(stats.usersNewToday) },
        { label: "Новых за 7 дней", value: String(stats.usersNew7d) },
        { label: "Активных сегодня", value: String(stats.activeToday) },
      ],
    },
    {
      title: "Расклады",
      metrics: [
        { label: "Всего", value: stats.spreadsTotal.toLocaleString("ru-RU") },
        { label: "Сегодня", value: String(stats.spreadsToday) },
      ],
    },
    {
      title: "Подписки",
      // Строка на каждый тариф, который вернул сервер, включая снятые с
      // продажи и админский доступ: иначе действующие подписчики
      // старого тарифа просто пропадают из статистики.
      metrics: Object.entries(stats.activeSubscriptions).map(([tier, count]) => ({
        label: `${TIER_TITLES[tier] ?? tier} (активные)`,
        value: String(count),
      })),
    },
    {
      title: "Выручка",
      metrics: [
        { label: "Всего", value: formatRub(stats.revenueTotalRub) },
        { label: "За 7 дней", value: formatRub(stats.revenue7dRub) },
      ],
    },
    {
      title: "Рефералы",
      metrics: [{ label: "Пришло по рефералке", value: String(stats.referralsTotal) }],
    },
  ];
}

export function AdminScreen({ onBack }: AdminScreenProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    fetchAdminStats()
      .then((stats) => {
        if (!cancelled) setState({ status: "success", stats });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message =
          error instanceof SpreadsApiError ? error.message : "Не удалось загрузить статистику.";
        setState({ status: "error", message });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={styles.screen}>
      <ScreenHeader title="Дашборд" onBack={onBack} />

      {state.status === "loading" && (
        <div className={styles.centerState}>
          <Spinner />
        </div>
      )}

      {state.status === "error" && <p className={styles.empty}>{state.message}</p>}

      {state.status === "success" && (
        <div className={styles.sections}>
          {buildSections(state.stats).map((section) => (
            <div key={section.title} className={styles.section}>
              <h2 className={styles.sectionTitle}>{section.title}</h2>
              <div className={styles.grid}>
                {section.metrics.map((metric) => (
                  <div key={metric.label} className={styles.card}>
                    <span className={styles.cardValue}>{metric.value}</span>
                    <span className={styles.cardLabel}>{metric.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
