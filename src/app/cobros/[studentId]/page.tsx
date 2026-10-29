"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, collection, query, where, onSnapshot, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getSchoolWeeks, getCurrentWeek, formatWeekDate } from "@/utils/calendar";
import { getWeekStatus } from "@/utils/payments";
import type { Student, Payment } from "@/utils/payments";

export default function StudentDetailWrapper() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-500">Cargando...</div>}>
      <StudentDetailPage />
    </Suspense>
  );
}

function StudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.studentId as string;

  const [student, setStudent] = useState<Student | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const [weeks, setWeeks] = useState<ReturnType<typeof getSchoolWeeks>>([]);
  const [currentWeek, setCurrentWeek] = useState(1);

  useEffect(() => {
    setWeeks(getSchoolWeeks());
    setCurrentWeek(getCurrentWeek());
  }, []);

  useEffect(() => {
    getDoc(doc(db, "cobros_students", studentId)).then((snap) => {
      if (snap.exists()) {
        setStudent({ id: snap.id, ...snap.data() } as Student);
      }
      setLoading(false);
    });
  }, [studentId]);

  useEffect(() => {
    const q = query(
      collection(db, "cobros_payments"),
      where("studentId", "==", studentId)
    );
    const unsub = onSnapshot(q, (snap) => {
      setPayments(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          timestamp: d.data().timestamp?.toDate?.() || new Date(),
        })) as Payment[]
      );
    });
    return unsub;
  }, [studentId]);

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm("¿Eliminar este pago?")) return;
    await deleteDoc(doc(db, "cobros_payments", paymentId));
  };

  if (loading) return <div className="p-8 text-gray-500">Cargando...</div>;
  if (!student) return <div className="p-8 text-red-500">Alumno no encontrado</div>;

  const totalPaid = payments
    .filter((p) => p.status === "pagado")
    .reduce((s, p) => s + p.amount, 0);

  const totalOwed =
    Array.from({ length: currentWeek }, (_, i) => i + 1).reduce((sum, w) => {
      const st = getWeekStatus(student, w, payments);
      if (st.label.startsWith("$")) return sum + student.weeklyRate;
      if (st.label.startsWith("Abono")) return sum + (student.weeklyRate - st.paid);
      return sum;
    }, 0) + (student.inscriptionPaid ? 0 : 300);

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <button
        onClick={() => router.push("/")}
        className="text-blue-600 hover:underline text-sm mb-4 inline-block"
      >
        &larr; Volver al grid
      </button>

      {/* Info del alumno */}
      <div className="bg-white rounded-lg border shadow-sm p-6 mb-6">
        <h2 className="text-2xl font-bold mb-2">{student.name}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Chofer:</span>{" "}
            <span className="font-medium">{student.driver}</span>
          </div>
          <div>
            <span className="text-gray-500">Escuela:</span>{" "}
            <span className="font-medium">{student.school}</span>
          </div>
          <div>
            <span className="text-gray-500">Tarifa:</span>{" "}
            <span className="font-medium">${student.weeklyRate}/sem</span>
          </div>
          <div>
            <span className="text-gray-500">Servicio:</span>{" "}
            <span className="font-medium">{student.serviceType}</span>
          </div>
        </div>
        <div className="mt-4 flex gap-6">
          <div className="text-green-600 font-bold text-lg">
            Pagado: ${totalPaid.toLocaleString()}
          </div>
          <div className={`font-bold text-lg ${totalOwed > 0 ? "text-red-500" : "text-green-600"}`}>
            {totalOwed > 0 ? `Debe: $${totalOwed.toLocaleString()}` : "Al corriente"}
          </div>
        </div>
      </div>

      {/* Grid de semanas */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden mb-6">
        <h3 className="px-4 py-3 font-bold bg-gray-50 border-b">Estado por Semana</h3>
        <div className="grid grid-cols-4 md:grid-cols-7 gap-px bg-gray-200">
          {/* Inscripción */}
          {(() => {
            const st = getWeekStatus(student, 0, payments);
            return (
              <div
                className="p-3 text-center"
                style={{ backgroundColor: st.bg || "#fff" }}
              >
                <div className="text-xs text-gray-500">Ins</div>
                <div className="font-bold text-sm" style={{ color: st.color }}>
                  {st.label}
                </div>
              </div>
            );
          })()}

          {weeks.map((w) => {
            const st = getWeekStatus(student, w.week, payments);
            return (
              <div
                key={w.week}
                className={`p-3 text-center ${w.week === currentWeek ? "ring-2 ring-yellow-400 ring-inset" : ""}`}
                style={{ backgroundColor: st.bg || "#fff" }}
              >
                <div className="text-xs text-gray-500">
                  S{w.week}
                </div>
                <div className="font-bold text-sm" style={{ color: st.color }}>
                  {st.label}
                </div>
                <div className="text-[9px] text-gray-400">
                  {formatWeekDate(w.startDate)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Historial de pagos */}
      <div className="bg-white rounded-lg border shadow-sm">
        <h3 className="px-4 py-3 font-bold bg-gray-50 border-b">Historial de Pagos</h3>
        {payments.length === 0 ? (
          <p className="p-4 text-gray-400 text-center">Sin pagos registrados</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-2 text-left">Fecha</th>
                <th className="px-4 py-2 text-left">Semana</th>
                <th className="px-4 py-2 text-right">Monto</th>
                <th className="px-4 py-2 text-left">Método</th>
                <th className="px-4 py-2 text-left">Estado</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {payments
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                .map((p) => (
                  <tr key={p.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2">
                      {new Date(p.timestamp).toLocaleDateString("es-MX")}
                    </td>
                    <td className="px-4 py-2">
                      {p.weekNumber === 0 ? "Inscripción" : `Semana ${p.weekNumber}`}
                    </td>
                    <td className="px-4 py-2 text-right font-medium">
                      ${p.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 capitalize">{p.paymentMethod}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          p.status === "pagado"
                            ? "bg-green-100 text-green-700"
                            : p.status === "no_aplica"
                            ? "bg-gray-100 text-gray-700"
                            : "bg-purple-100 text-purple-700"
                        }`}
                      >
                        {p.status === "pagado" ? "Pagado" : p.status === "no_aplica" ? "N/A" : "Cortesía"}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => handleDeletePayment(p.id)}
                        className="text-red-400 hover:text-red-600 text-xs"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
