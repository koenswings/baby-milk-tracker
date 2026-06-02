interface Props {
  percentage: number;
  label: string;
  value: string;
}

export default function StatusBadge({ percentage, label, value }: Props) {
  let colorClass = "text-green-400 bg-green-900/30 border-green-700";
  if (percentage < 90) colorClass = "text-red-400 bg-red-900/30 border-red-700";
  else if (percentage < 100) colorClass = "text-yellow-400 bg-yellow-900/30 border-yellow-700";

  return (
    <div className={`rounded-xl border p-4 ${colorClass}`}>
      <div className="text-sm font-medium opacity-80">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      <div className="text-sm mt-1">{Math.round(percentage)}% of target</div>
    </div>
  );
}
