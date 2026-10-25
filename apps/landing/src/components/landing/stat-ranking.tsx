export type Stat = { value: string; label: string; note: string };

/** Comparison figures retain their measured/estimated qualification beside the value. */
export function StatRanking({ stats }: { stats: Stat[] }) {
  return (
    <dl className="stat-ranking">
      {stats.map((stat) => (
        <div key={stat.label}>
          <dt>{stat.label}</dt>
          <dd className="stat-value">{stat.value}</dd>
          <dd className="stat-note">{stat.note}</dd>
        </div>
      ))}
    </dl>
  );
}
