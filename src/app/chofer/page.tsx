"use client";

import { useState, useEffect } from "react";
import { collection, onSnapshot, query, where, addDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getCurrentWeek } from "@/utils/calendar";
import { getWeekStatus } from "@/utils/payments";
import type { Student, Payment } from "@/utils/payments";

const CHOFER_CREDENTIALS: Record<string, { password: string; driver: string; label: string }> = {
  carmen: { password: "carmen2026", driver: "DANIEL CARMEN", label: "Daniel - Carmen" },
  eduardo: { password: "eduardo2026", driver: "EDUARDO PEREZ", label: "Eduardo Pérez" },
  fernando: { password: "fernando2026", driver: "FERNANDO FABIAN", label: "Fernando Fabián" },
  carolina: { password: "carolina2026", driver: "OSCAR - CAROLINA", label: "Oscar - Carolina" },
};

interface StudentExt extends Student {
  school: string;
  shift: string;
  grade: string;
  groupClass: string;
  parentPhone: string;
  parentPhone2: string;
  sectionNum: number;
}

export default function ChoferPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [choferKey, setChoferKey] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [students, setStudents] = useState<StudentExt[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [payingStudent, setPayingStudent] = useState<StudentExt | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payWeeks, setPayWeeks] = useState(1);
  const [payMethod, setPayMethod] = useState<"efectivo" | "transferencia">("efectivo");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCurrentWeek(getCurrentWeek());
  }, []);

  const handleLogin = () => {
    const cred = CHOFER_CREDENTIALS[username.toLowerCase()];
    if (cred && cred.password === password) {
      setChoferKey(username.toLowerCase());
      setLoggedIn(true);
      setError("");
      setLoading(true);
    } else {
      setError("Usuario o contraseña incorrectos");
    }
  };

  // Cargar datos al hacer login
  useEffect(() => {
    if (!loggedIn || !choferKey) return;
    const cred = CHOFER_CREDENTIALS[choferKey];

    const q = query(collection(db, "cobros_students"), where("driver", "==", cred.driver));
    const unsub1 = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as StudentExt[];
      data.sort((a, b) => {
        if (a.sectionNum !== b.sectionNum) return a.sectionNum - b.sectionNum;
        return a.name.localeCompare(b.name);
      });
      setStudents(data);
      setLoading(false);
    });

    const unsub2 = onSnapshot(collection(db, "cobros_payments"), (snap) => {
      setPayments(snap.docs.map((d) => ({
        id: d.id, ...d.data(),
        timestamp: d.data().timestamp?.toDate?.() || new Date(),
      })) as Payment[]);
    });

    return () => { unsub1(); unsub2(); };
  }, [loggedIn, choferKey]);

  const handlePay = async () => {
    if (!payingStudent) return;
    setSaving(true);
    try {
      const totalAmount = payAmount * payWeeks;
      await addDoc(collection(db, "cobros_payments"), {
        studentId: payingStudent.id,
        amount: totalAmount,
        weekNumber: currentWeek,
        status: "pagado",
        paymentMethod: payMethod,
        timestamp: Timestamp.now(),
        notes: payWeeks > 1
          ? `Pago de ${payWeeks} semanas (chofer ${CHOFER_CREDENTIALS[choferKey].label})`
          : `Pago semana ${currentWeek} (chofer ${CHOFER_CREDENTIALS[choferKey].label})`,
      });
      setPayingStudent(null);
    } catch {
      alert("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handlePayInscription = async (student: StudentExt) => {
    setSaving(true);
    try {
      await addDoc(collection(db, "cobros_payments"), {
        studentId: student.id,
        amount: 300,
        weekNumber: 0,
        status: "pagado",
        paymentMethod: "efectivo",
        timestamp: Timestamp.now(),
        notes: `Inscripción (chofer ${CHOFER_CREDENTIALS[choferKey].label})`,
      });
    } catch {
      alert("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  // ====== LOGIN SCREEN ======
  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-blue-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
          <h1 className="text-2xl font-bold text-center mb-1">TRECA Cobros</h1>
          <p className="text-gray-500 text-center mb-6 text-sm">Acceso para choferes</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                placeholder="Tu nombre de usuario"
                className="w-full border rounded-lg px-4 py-3 text-lg"
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Tu contraseña"
                className="w-full border rounded-lg px-4 py-3 text-lg"
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
            </div>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button onClick={handleLogin}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-blue-700 transition"
            >Entrar</button>
          </div>
        </div>
      </div>
    );
  }

  // ====== CHOFER DASHBOARD ======
  const cred = CHOFER_CREDENTIALS[choferKey];

  if (loading) {
    return <div className="flex items-center justify-center h-screen text-gray-500">Cargando...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-700 text-white px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-lg">TRECA Cobros</h1>
          <p className="text-blue-200 text-sm">{cred.label} &middot; Semana {currentWeek}</p>
        </div>
        <button onClick={() => { setLoggedIn(false); setChoferKey(""); }}
          className="text-sm bg-blue-600 px-3 py-1 rounded hover:bg-blue-500"
        >Salir</button>
      </div>

      {/* Resumen rápido */}
      <div className="bg-white border-b px-4 py-3 flex gap-6 flex-wrap text-sm">
        <div>
          <span className="text-gray-500">Alumnos:</span>{" "}
          <span className="font-bold">{students.filter((s) => s.status !== "baja").length}</span>
        </div>
        <div>
          <span className="text-gray-500">Deben inscripción:</span>{" "}
          <span className="font-bold text-red-600">
            {students.filter((s) => !s.inscriptionPaid && s.status !== "baja").length}
          </span>
        </div>
      </div>

      {/* Lista de alumnos */}
      <div className="p-3 space-y-2">
        {students.filter((s) => s.status !== "baja").map((student) => {
          const weekStatus = getWeekStatus(student, currentWeek, payments);
          const inscStatus = getWeekStatus(student, 0, payments);
          const isPaid = weekStatus.label === "Pagado";
          const inscPaid = inscStatus.label === "✓";

          // Calcular semanas adelantadas o atrasadas
          let lastPaidWeek = 0;
          for (let w = 42; w >= 1; w--) {
            const ws = getWeekStatus(student, w, payments);
            if (ws.label === "Pagado") { lastPaidWeek = w; break; }
          }
          const adelantado = lastPaidWeek > currentWeek;
          const atrasado = !isPaid && currentWeek > 1;

          return (
            <div key={student.id}
              className={`bg-white rounded-xl border shadow-sm p-4 ${
                isPaid ? "border-green-200" : atrasado ? "border-red-200" : "border-gray-200"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-bold text-base">{student.name}</h3>
                  <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                    <p>{student.school} &middot; {student.shift} &middot; {student.grade}° {student.groupClass}</p>
                    <p>Tel: {student.parentPhone} {student.parentPhone2 ? `/ ${student.parentPhone2}` : ""}</p>
                    <p>Tarifa: <span className="font-medium">${student.weeklyRate}/sem</span></p>
                  </div>

                  <div className="flex gap-2 mt-2 flex-wrap">
                    {/* Inscripción */}
                    {inscPaid ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">INS PAGADA</span>
                    ) : (
                      <button onClick={() => handlePayInscription(student)} disabled={saving}
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 hover:bg-red-200 transition"
                      >DEBE INS $300 - Cobrar</button>
                    )}

                    {/* Estado semana actual */}
                    {isPaid ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">SEM {currentWeek} PAGADA</span>
                    ) : weekStatus.label === "N" ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600">SEM {currentWeek} N/A</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">DEBE SEM {currentWeek}</span>
                    )}

                    {adelantado && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">ADELANTADO hasta sem {lastPaidWeek}</span>
                    )}
                  </div>
                </div>

                {/* Botón cobrar */}
                {!isPaid && (
                  <button
                    onClick={() => {
                      setPayingStudent(student);
                      setPayAmount(student.weeklyRate);
                      setPayWeeks(1);
                    }}
                    className="ml-3 px-4 py-2 bg-green-600 text-white rounded-lg font-bold text-sm hover:bg-green-700 transition flex-shrink-0"
                  >
                    Cobrar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ====== MODAL COBRAR ====== */}
      {payingStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
            <div className="bg-green-600 text-white px-5 py-4 rounded-t-xl">
              <h2 className="font-bold text-lg">Cobrar</h2>
              <p className="text-green-100 text-sm">{payingStudent.name}</p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Monto por semana</label>
                <input type="number" value={payAmount} onChange={(e) => setPayAmount(Number(e.target.value))}
                  className="w-full border rounded-lg px-3 py-2 text-xl font-bold text-center"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Semanas</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map((n) => (
                    <button key={n} onClick={() => setPayWeeks(n)}
                      className={`flex-1 py-2 rounded-lg font-bold text-lg border transition ${
                        payWeeks === n ? "bg-green-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                    >{n}</button>
                  ))}
                </div>
                {payWeeks > 1 && (
                  <p className="text-sm text-green-600 mt-1 font-medium text-center">
                    Total: ${payAmount * payWeeks}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setPayMethod("efectivo")}
                  className={`flex-1 py-2 rounded-lg font-medium border transition ${
                    payMethod === "efectivo" ? "bg-green-100 border-green-500 text-green-700" : "bg-white border-gray-200"
                  }`}
                >Efectivo</button>
                <button onClick={() => setPayMethod("transferencia")}
                  className={`flex-1 py-2 rounded-lg font-medium border transition ${
                    payMethod === "transferencia" ? "bg-blue-100 border-blue-500 text-blue-700" : "bg-white border-gray-200"
                  }`}
                >Transferencia</button>
              </div>
            </div>
            <div className="px-5 py-4 bg-gray-50 rounded-b-xl flex gap-3">
              <button onClick={() => setPayingStudent(null)}
                className="flex-1 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition"
              >Cancelar</button>
              <button onClick={handlePay} disabled={saving}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 transition"
              >{saving ? "Guardando..." : `Cobrar $${payAmount * payWeeks}`}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
