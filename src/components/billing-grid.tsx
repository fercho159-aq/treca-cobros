"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getSchoolWeeks, getCurrentWeek, formatWeekDate } from "@/utils/calendar";
import { getWeekStatus, calculateSummary } from "@/utils/payments";
import type { Student, Payment } from "@/utils/payments";
import SummaryBar from "./summary-bar";
import PaymentDialog from "./payment-dialog";

export default function BillingGrid() {
  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCell, setSelectedCell] = useState<{
    student: Student;
    week: number;
    label: string;
  } | null>(null);
  const [driverFilter, setDriverFilter] = useState<string>("todos");
  const [searchTerm, setSearchTerm] = useState("");

  const [currentWeek, setCurrentWeek] = useState(1);
  const [weeks, setWeeks] = useState(getSchoolWeeks());
  const gridRef = useRef<HTMLDivElement>(null);
  const currentWeekRef = useRef<HTMLTableCellElement>(null);

  useEffect(() => {
    setCurrentWeek(getCurrentWeek());
    setWeeks(getSchoolWeeks());
  }, []);

  // Cargar alumnos en tiempo real
  useEffect(() => {
    const q = query(collection(db, "cobros_students"), where("group", "==", "Fortaleza"));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Student[];
      data.sort((a, b) => a.name.localeCompare(b.name));
      setStudents(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  // Cargar pagos en tiempo real
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "cobros_payments"), (snap) => {
      const data = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate?.() || new Date(),
      })) as Payment[];
      setPayments(data);
    });
    return unsub;
  }, []);

  // Scroll a semana actual al cargar
  useEffect(() => {
    if (!loading && currentWeekRef.current) {
      currentWeekRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [loading]);

  const handleCellClick = useCallback(
    (student: Student, weekNum: number, weekLabel: string) => {
      setSelectedCell({ student, week: weekNum, label: weekLabel });
    },
    []
  );

  const handlePaymentSaved = useCallback(() => {
    setSelectedCell(null);
    // Los pagos se actualizan automáticamente por onSnapshot
  }, []);

  // Filtrar alumnos
  const filteredStudents = students.filter((s) => {
    if (driverFilter !== "todos" && s.driver !== driverFilter) return false;
    if (searchTerm && !s.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  // Drivers únicos para filtro
  const drivers = [...new Set(students.map((s) => s.driver).filter(Boolean))];

  // Resumen
  const summary = calculateSummary(filteredStudents, payments, currentWeek);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 text-lg">Cargando datos...</div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-[1800px] mx-auto">
      <SummaryBar
        totalPaid={summary.totalPaid}
        totalOwed={summary.totalOwed}
        collectionRate={summary.collectionRate}
        currentWeek={currentWeek}
        studentCount={filteredStudents.length}
      />

      {/* Filtros */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="Buscar alumno..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm w-64"
        />
        <select
          value={driverFilter}
          onChange={(e) => setDriverFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="todos">Todos los choferes</option>
          {drivers.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {/* Grid */}
      <div
        ref={gridRef}
        className="bg-white border rounded-lg shadow-sm overflow-auto"
        style={{ maxHeight: "calc(100vh - 280px)" }}
      >
        <table className="text-sm border-collapse w-full">
          <thead className="sticky top-0 z-20">
            <tr className="bg-blue-700 text-white">
              <th className="sticky left-0 z-30 bg-blue-700 px-3 py-2 text-left min-w-[200px] border-r border-blue-600">
                Alumno
              </th>
              <th className="px-2 py-2 text-center min-w-[70px] border-r border-blue-600">
                Ins
              </th>
              {weeks.map((w) => (
                <th
                  key={w.week}
                  ref={w.week === currentWeek ? currentWeekRef : undefined}
                  className={`px-2 py-1 text-center min-w-[80px] border-r border-blue-600 ${
                    w.week === currentWeek ? "bg-yellow-500 text-black" : ""
                  }`}
                >
                  <div className="font-bold">{w.week}</div>
                  <div className="text-[10px] font-normal opacity-80">
                    {formatWeekDate(w.startDate)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={44} className="text-center py-8 text-gray-400">
                  No hay alumnos registrados. Ve a la sección de Sync para importar desde Google Sheets.
                </td>
              </tr>
            ) : (
              filteredStudents.map((student, idx) => (
                <tr
                  key={student.id}
                  className={`border-b ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-blue-50/50`}
                >
                  {/* Nombre del alumno */}
                  <td className="sticky left-0 z-10 px-3 py-2 font-medium border-r bg-inherit">
                    <Link
                      href={`/cobros/${student.id}`}
                      className="truncate max-w-[190px] block text-blue-700 hover:underline"
                      title={student.name}
                    >
                      {student.name}
                    </Link>
                    <div className="text-[10px] text-gray-400">
                      {student.driver} &middot; ${student.weeklyRate}/sem
                    </div>
                  </td>

                  {/* Celda de inscripción */}
                  <CellRenderer
                    student={student}
                    weekNumber={0}
                    payments={payments}
                    weekLabel="Inscripción"
                    currentWeek={currentWeek}
                    onClick={handleCellClick}
                  />

                  {/* Celdas de semanas */}
                  {weeks.map((w) => (
                    <CellRenderer
                      key={w.week}
                      student={student}
                      weekNumber={w.week}
                      payments={payments}
                      weekLabel={`${formatWeekDate(w.startDate)} - ${formatWeekDate(w.endDate)}`}
                      currentWeek={currentWeek}
                      onClick={handleCellClick}
                    />
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Dialog de pago */}
      {selectedCell && (
        <PaymentDialog
          student={selectedCell.student}
          weekNumber={selectedCell.week}
          weekLabel={selectedCell.label}
          onClose={() => setSelectedCell(null)}
          onSaved={handlePaymentSaved}
        />
      )}
    </div>
  );
}

// Componente de celda individual
function CellRenderer({
  student,
  weekNumber,
  payments,
  weekLabel,
  currentWeek,
  onClick,
}: {
  student: Student;
  weekNumber: number;
  payments: Payment[];
  weekLabel: string;
  currentWeek: number;
  onClick: (student: Student, week: number, label: string) => void;
}) {
  const status = getWeekStatus(student, weekNumber, payments);
  const isCurrent = weekNumber === currentWeek;

  return (
    <td
      onClick={() => onClick(student, weekNumber, weekLabel)}
      className={`px-1 py-1.5 text-center border-r cursor-pointer transition-colors hover:ring-2 hover:ring-blue-400 hover:ring-inset ${
        isCurrent ? "ring-2 ring-yellow-400 ring-inset" : ""
      }`}
      style={{ backgroundColor: status.bg || undefined }}
    >
      <span
        className="text-xs font-semibold"
        style={{ color: status.color }}
      >
        {status.label}
      </span>
    </td>
  );
}
