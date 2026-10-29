"use client";

interface SummaryBarProps {
  totalPaid: number;
  totalOwed: number;
  collectionRate: number;
  currentWeek: number;
  studentCount: number;
}

export default function SummaryBar({
  totalPaid,
  totalOwed,
  collectionRate,
  currentWeek,
  studentCount,
}: SummaryBarProps) {
  const fmt = (n: number) =>
    n.toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0 });

  return (
    <div className="bg-white border rounded-lg p-4 mb-4 flex flex-wrap gap-6 items-center shadow-sm">
      <div>
        <p className="text-xs text-gray-500 uppercase">Semana Actual</p>
        <p className="text-2xl font-bold text-blue-700">{currentWeek}</p>
      </div>
      <div>
        <p className="text-xs text-gray-500 uppercase">Alumnos</p>
        <p className="text-2xl font-bold">{studentCount}</p>
      </div>
      <div>
        <p className="text-xs text-gray-500 uppercase">Cobrado</p>
        <p className="text-2xl font-bold text-green-600">{fmt(totalPaid)}</p>
      </div>
      <div>
        <p className="text-xs text-gray-500 uppercase">Pendiente</p>
        <p className="text-2xl font-bold text-red-500">{fmt(totalOwed)}</p>
      </div>
      <div>
        <p className="text-xs text-gray-500 uppercase">Cobranza</p>
        <p className={`text-2xl font-bold ${collectionRate >= 80 ? "text-green-600" : collectionRate >= 50 ? "text-yellow-500" : "text-red-500"}`}>
          {collectionRate}%
        </p>
      </div>
    </div>
  );
}
