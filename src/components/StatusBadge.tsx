interface Props {
  percentage: number;
  label: string;
  value: string;
}

function colorClasses(percentage: number): string {
  if (percentage > 110) return "text-red-400 bg-red-900/30 border-red-700";
  if (percentage > 105) return "text-yellow-400 bg-yellow-900/30 border-yellow-700";
  if (percentage >= 80) return "text-green-400 bg-green-900/30 border-green-700";
  if (percentage >= 70) return "text-yellow-400 bg-yellow-900/30 border-yellow-700";
  return "text-red-400 bg-red-900/30 border-red-700";
}

function statusLabel(percentage: number): string {
  if (percentage > 110) return "⚠️ overfed";
  if (percentage > 105) return "slightly overfed";
  if (percentage >= 80) return "on track";
  if (percentage >= 70) return "slightly behind";
  return "⚠️ behind";
}

export default function StatusBadge({ percentage, label, value }: Props) {
  return (
    <div className={`rounded-xl border p-4 ${colorClasses(percentage)}`}>
      <div className="text-sm font-medium opacity-80">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      <div className="text-sm mt-1">{Math.round(percentage)}% · {statusLabel(percentage)}</div>
    </div>
  );
}
