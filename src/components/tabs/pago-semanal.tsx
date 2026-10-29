"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getSchoolWeeks, getCurrentWeek, formatWeekDate } from "@/utils/calendar";
import { getWeekStatus, calculateSummary } from "@/utils/payments";
import type { Student, Payment } from "@/utils/payments";
import SummaryBar from "@/components/summary-bar";
import PaymentDialog from "@/components/payment-dialog";

// Week labels from the Excel
const WEEK_LABELS: Record<number, string> = {
  1: "31 Ago- 04 Sep", 2: "7 - 11 Sep", 3: "14 - 18 Sep", 4: "21 - 25 Sep",
  5: "28 sep - 2 oct", 6: "5-9 Oct", 7: "12-16 Oct", 8: "19-23 Oct",
  9: "26-30 Oct", 10: "2-6 Nov", 11: "9-13 Nov", 12: "16-20 Nov",
  13: "23-27 Nov", 14: "30 Nov-4 Dic", 15: "7-11 Dic", 16: "14-18 Dic",
  17: "04-08 Ene", 18: "11-15 Ene", 19: "18-22 Ene", 20: "25-29 Ene",
  21: "01-05 Feb", 22: "08-12 Feb", 23: "15-19 Feb", 24: "22-26 Feb",
  25: "01-05 Mar", 26: "08-12 Mar", 27: "15-19 Mar", 28: "05-09 Abr",
  29: "12-16 Abr", 30: "19-23 Abr", 31: "26-30 Abr", 32: "03-07 May",
  33: "10-14 May", 34: "17-21 May", 35: "24-28 May", 36: "31 May-04 Jun",
  37: "07-11 Jun", 38: "14-18 Jun", 39: "21-25 Jun", 40: "28 Jun-02 Jul",
  41: "05-09 Jul", 42: "12-16 Jul",
};

interface StudentWithSection extends Student {
  sectionNum: number;
  numInSection: number;
  shift: string;
}

interface Section {
  sectionNum: number;
  school: string;
  shift: string;
  driver: string;
  students: StudentWithSection[];
}

export default function PagoSemanalTab() {
  const [students, setStudents] = useState<StudentWithSection[]>([]);
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

  const currentWeekRef = useRef<HTMLTableCellElement>(null);

  useEffect(() => {
    setCurrentWeek(getCurrentWeek());
  }, []);

  // Cargar alumnos en tiempo real
  useEffect(() => {
    const q = query(collection(db, "cobros_students"), where("group", "==", "Fortaleza"));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as StudentWithSection[];
      data.sort((a, b) => {
        if (a.sectionNum !== b.sectionNum) return a.sectionNum - b.sectionNum;
        return a.numInSection - b.numInSection;
      });
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

  // Scroll a semana actual
  useEffect(() => {
    if (!loading && currentWeekRef.current) {
      setTimeout(() => {
        currentWeekRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      }, 500);
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
  }, []);

  // Filtrar alumnos
  const filteredStudents = students.filter((s) => {
    if (driverFilter !== "todos" && s.driver !== driverFilter) return false;
    if (searchTerm && !s.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  // Agrupar por sección
  const sections: Section[] = [];
  for (const student of filteredStudents) {
    let section = sections.find((s) => s.sectionNum === student.sectionNum);
    if (!section) {
      section = {
        sectionNum: student.sectionNum,
        school: student.school,
        shift: student.shift || "",
        driver: student.driver,
        students: [],
      };
      sections.push(section);
    }
    section.students.push(student);
  }
  sections.sort((a, b) => a.sectionNum - b.sectionNum);

  // Drivers únicos
  const drivers = [...new Set(students.map((s) => s.driver).filter(Boolean))];

  // Resumen
  const summary = calculateSummary(filteredStudents, payments, currentWeek);

  // Semanas a mostrar (42)
  const weekNums = Array.from({ length: 42 }, (_, i) => i + 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 text-lg">Cargando datos...</div>
      </div>
    );
  }

  return (
    <div className="p-2 sm:p-4">
      <SummaryBar
        totalPaid={summary.totalPaid}
        totalOwed={summary.totalOwed}
        collectionRate={summary.collectionRate}
        currentWeek={currentWeek}
        studentCount={filteredStudents.length}
      />

      {/* Filtros */}
      <div className="flex gap-3 mb-3 flex-wrap items-center">
        <input
          type="text"
          placeholder="Buscar alumno..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border rounded px-2 py-1 text-sm w-52"
        />
        <select
          value={driverFilter}
          onChange={(e) => setDriverFilter(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="todos">Todos los choferes</option>
          {drivers.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <span className="text-xs text-gray-400">
          {filteredStudents.length} alumnos &middot; {sections.length} secciones
        </span>
      </div>

      {/* Grid estilo Excel */}
      <div
        className="border border-gray-400 bg-white overflow-auto"
        style={{ maxHeight: "calc(100vh - 240px)" }}
      >
        <table className="border-collapse text-xs" style={{ minWidth: "3600px" }}>
          {/* Header de semanas - estilo Excel azul */}
          <thead className="sticky top-0 z-20">
            {/* Fila de números de semana */}
            <tr>
              <th className="sticky left-0 z-30 bg-[#0000CC] text-white border border-[#0000AA] px-1 py-0 min-w-[30px] text-[10px]">#</th>
              <th className="sticky left-[30px] z-30 bg-[#0000CC] text-white border border-[#0000AA] px-1 py-0 min-w-[180px] text-[10px]">ALUMNO</th>
              <th className="sticky left-[210px] z-30 bg-[#0000CC] text-white border border-[#0000AA] px-1 py-0 min-w-[40px] text-[10px]">TARIFA</th>
              <th className="bg-[#0000CC] text-white border border-[#0000AA] px-1 py-0 min-w-[50px] text-[10px]">INS</th>
              {weekNums.map((w) => (
                <th
                  key={w}
                  ref={w === currentWeek ? currentWeekRef : undefined}
                  className={`border border-[#0000AA] px-1 py-0 min-w-[72px] text-center ${
                    w === currentWeek
                      ? "bg-yellow-400 text-black"
                      : "bg-[#0000CC] text-white"
                  }`}
                >
                  <div className="font-bold text-[11px]">{w}</div>
                  <div className="text-[8px] font-normal opacity-90 whitespace-nowrap">
                    {WEEK_LABELS[w] || ""}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sections.length === 0 ? (
              <tr>
                <td colSpan={46} className="text-center py-8 text-gray-400">
                  No hay alumnos. Ve a <a href="/seed" className="text-blue-600 underline">/seed</a> para cargar datos.
                </td>
              </tr>
            ) : (
              sections.map((section) => (
                <SectionBlock
                  key={section.sectionNum}
                  section={section}
                  payments={payments}
                  currentWeek={currentWeek}
                  weekNums={weekNums}
                  onCellClick={handleCellClick}
                  currentWeekRef={currentWeekRef}
                />
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

// Bloque de sección (como en el Excel: ESCUELA / TURNO / CUSTODIO)
function SectionBlock({
  section,
  payments,
  currentWeek,
  weekNums,
  onCellClick,
}: {
  section: Section;
  payments: Payment[];
  currentWeek: number;
  weekNums: number[];
  onCellClick: (student: Student, week: number, label: string) => void;
  currentWeekRef: React.RefObject<HTMLTableCellElement | null>;
}) {
  return (
    <>
      {/* Header de sección */}
      <tr className="bg-[#D9E2F3]">
        <td
          colSpan={46}
          className="px-2 py-1 font-bold text-[11px] text-gray-800 border border-gray-300"
        >
          <span className="text-blue-800">ESCUELA:</span> {section.school}
          <span className="mx-3 text-blue-800">TURNO:</span> {section.shift}
          <span className="mx-3 text-blue-800">CUSTODIO:</span> {section.driver}
        </td>
      </tr>

      {/* Filas de alumnos */}
      {section.students.map((student, idx) => (
        <tr
          key={student.id}
          className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-yellow-50`}
        >
          {/* # */}
          <td className="sticky left-0 z-10 bg-inherit border border-gray-300 px-1 py-0.5 text-center text-[10px] text-gray-500 min-w-[30px]">
            {student.numInSection}
          </td>

          {/* Nombre */}
          <td className="sticky left-[30px] z-10 bg-inherit border border-gray-300 px-1 py-0.5 min-w-[180px]">
            <Link
              href={`/cobros/${student.id}`}
              className="text-[11px] hover:underline hover:text-blue-600 truncate block max-w-[175px]"
              title={student.name}
            >
              {student.name}
            </Link>
          </td>

          {/* Tarifa */}
          <td className="sticky left-[210px] z-10 bg-inherit border border-gray-300 px-1 py-0.5 text-center text-[10px] font-medium min-w-[40px]">
            {student.weeklyRate}
          </td>

          {/* Inscripción */}
          <InscriptionCell
            student={student}
            payments={payments}
            onClick={onCellClick}
          />

          {/* Semanas 1-42 */}
          {weekNums.map((w) => (
            <WeekCell
              key={w}
              student={student}
              weekNumber={w}
              payments={payments}
              currentWeek={currentWeek}
              onClick={onCellClick}
            />
          ))}
        </tr>
      ))}
    </>
  );
}

// Celda de inscripción
function InscriptionCell({
  student,
  payments,
  onClick,
}: {
  student: Student;
  payments: Payment[];
  onClick: (student: Student, week: number, label: string) => void;
}) {
  const status = getWeekStatus(student, 0, payments);
  const isPaid = status.label === "✓";

  return (
    <td
      onClick={() => onClick(student, 0, "Inscripción")}
      className={`border border-gray-300 px-1 py-0.5 text-center cursor-pointer hover:ring-1 hover:ring-blue-400 hover:ring-inset text-[10px] font-medium min-w-[50px] ${
        isPaid ? "bg-[#C6EFCE] text-[#006100]" : "bg-white text-gray-500"
      }`}
    >
      {isPaid ? "300" : ""}
    </td>
  );
}

// Celda de semana - estilo Excel
function WeekCell({
  student,
  weekNumber,
  payments,
  currentWeek,
  onClick,
}: {
  student: Student;
  weekNumber: number;
  payments: Payment[];
  currentWeek: number;
  onClick: (student: Student, week: number, label: string) => void;
}) {
  const status = getWeekStatus(student, weekNumber, payments);
  const isCurrent = weekNumber === currentWeek;
  const label = WEEK_LABELS[weekNumber] || `Sem ${weekNumber}`;

  // Determinar qué mostrar en la celda (estilo Excel)
  let cellContent = "";
  let cellBg = "";
  let cellColor = "#000";

  if (status.label === "Pagado") {
    // Mostrar el monto pagado como número (como en Excel)
    cellContent = String(status.paid || student.weeklyRate);
    cellBg = ""; // Sin fondo especial, como en Excel
    cellColor = "#000";
  } else if (status.label.startsWith("Abono")) {
    cellContent = String(status.paid);
    cellBg = "#FFF2CC"; // Amarillo claro
    cellColor = "#B45309";
  } else if (status.label === "N") {
    cellContent = "N";
    cellBg = "#E2E8F0";
    cellColor = "#64748b";
  } else if (status.label === "Cortesía") {
    cellContent = "CORTESIA";
    cellBg = "#E9D5FF";
    cellColor = "#7C3AED";
  } else if (status.label === "N/A") {
    cellContent = "";
    cellBg = "#F1F5F9";
    cellColor = "#94A3B8";
  } else if (status.label.startsWith("$")) {
    // No pagado - celda vacía como en Excel
    cellContent = "";
    cellBg = "";
    cellColor = "#000";
  }

  return (
    <td
      onClick={() => onClick(student, weekNumber, label)}
      className={`border border-gray-300 px-1 py-0.5 text-center cursor-pointer hover:ring-1 hover:ring-blue-400 hover:ring-inset text-[10px] font-medium min-w-[72px] ${
        isCurrent ? "ring-2 ring-yellow-400 ring-inset" : ""
      }`}
      style={{
        backgroundColor: cellBg || undefined,
        color: cellColor,
      }}
    >
      {cellContent}
    </td>
  );
}
