"use client";

import { useState } from "react";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Student } from "@/utils/payments";

interface PaymentDialogProps {
  student: Student;
  weekNumber: number;
  weekLabel: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function PaymentDialog({
  student,
  weekNumber,
  weekLabel,
  onClose,
  onSaved,
}: PaymentDialogProps) {
  const isInscription = weekNumber === 0;
  const defaultAmount = isInscription ? 300 : student.weeklyRate;

  const [amount, setAmount] = useState(defaultAmount);
  const [method, setMethod] = useState<"efectivo" | "transferencia">("efectivo");
  const [status, setStatus] = useState<"pagado" | "no_aplica" | "cortesia">("pagado");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [weeks, setWeeks] = useState(1);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (status === "pagado" && weeks > 1 && !isInscription) {
        // Pago de múltiples semanas: un solo registro con el monto total
        await addDoc(collection(db, "cobros_payments"), {
          studentId: student.id,
          amount: amount * weeks,
          weekNumber,
          status: "pagado",
          paymentMethod: method,
          transferReference: reference || null,
          notes: notes || `Pago de ${weeks} semanas (sem ${weekNumber}-${weekNumber + weeks - 1})`,
          timestamp: Timestamp.now(),
        });
      } else {
        await addDoc(collection(db, "cobros_payments"), {
          studentId: student.id,
          amount: status === "pagado" ? amount : 0,
          weekNumber,
          status,
          paymentMethod: method,
          transferReference: reference || null,
          notes: notes || null,
          timestamp: Timestamp.now(),
        });
      }
      onSaved();
    } catch (err) {
      console.error("Error guardando pago:", err);
      alert("Error al guardar el pago");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="bg-blue-700 text-white px-6 py-4 rounded-t-xl">
          <h2 className="font-bold text-lg">{student.name}</h2>
          <p className="text-blue-200 text-sm">
            {isInscription ? "Inscripción" : `Semana ${weekNumber} - ${weekLabel}`}
          </p>
        </div>

        <div className="p-6 space-y-4">
          {/* Tipo de registro */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <div className="flex gap-2">
              {(["pagado", "no_aplica", "cortesia"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                    status === s
                      ? s === "pagado"
                        ? "bg-green-100 border-green-500 text-green-700"
                        : s === "no_aplica"
                        ? "bg-gray-100 border-gray-500 text-gray-700"
                        : "bg-purple-100 border-purple-500 text-purple-700"
                      : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  {s === "pagado" ? "Pago" : s === "no_aplica" ? "N (no aplica)" : "Cortesía"}
                </button>
              ))}
            </div>
          </div>

          {status === "pagado" && (
            <>
              {/* Monto */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monto por semana
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full border rounded-lg px-3 py-2 text-lg font-bold"
                />
              </div>

              {/* Número de semanas */}
              {!isInscription && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Semanas a pagar
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4].map((n) => (
                      <button
                        key={n}
                        onClick={() => setWeeks(n)}
                        className={`w-12 h-10 rounded-lg font-bold border transition ${
                          weeks === n
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  {weeks > 1 && (
                    <p className="text-sm text-blue-600 mt-1 font-medium">
                      Total: ${amount * weeks} (semanas {weekNumber} a {weekNumber + weeks - 1})
                    </p>
                  )}
                </div>
              )}

              {/* Método de pago */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Método de pago
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setMethod("efectivo")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                      method === "efectivo"
                        ? "bg-green-100 border-green-500 text-green-700"
                        : "bg-white border-gray-200 text-gray-500"
                    }`}
                  >
                    Efectivo
                  </button>
                  <button
                    onClick={() => setMethod("transferencia")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                      method === "transferencia"
                        ? "bg-blue-100 border-blue-500 text-blue-700"
                        : "bg-white border-gray-200 text-gray-500"
                    }`}
                  >
                    Transferencia
                  </button>
                </div>
              </div>

              {method === "transferencia" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Referencia
                  </label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="No. de referencia o banco"
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              )}
            </>
          )}

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas (opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observaciones..."
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
        </div>

        {/* Botones */}
        <div className="px-6 py-4 bg-gray-50 rounded-b-xl flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
