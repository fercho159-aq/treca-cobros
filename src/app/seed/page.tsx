"use client";

import { useState } from "react";
import { collection, doc, setDoc, writeBatch, getDocs, deleteDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface StudentData {
  num: number;
  nombre: string;
  grado?: string;
  grupo?: string;
  tel1?: string;
  tel2?: string;
  tarifa: number | null;
  inscripcion?: string;
  observaciones?: string;
}

interface PaymentStudentData {
  num: string;
  nombre: string;
  tel1?: string;
  tel2?: string;
  inscripcion?: string;
  tarifa?: string;
  pagos_semanales: Record<string, string>;
}

interface Section {
  section_num: string;
  escuela: string;
  turno: string;
  custodio: string;
  students: StudentData[];
}

interface PaymentSection {
  section_num: string;
  escuela: string;
  turno: string;
  custodio: string;
  students: PaymentStudentData[];
}

interface FortalezaData {
  fortaleza_listas: Section[];
  pago_semanal_fortaleza: PaymentSection[];
  week_labels: string[];
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export default function SeedPage() {
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setLog((prev) => [...prev, msg]);
  };

  const handleSeed = async () => {
    if (!confirm("Esto cargará todos los datos de Fortaleza. ¿Continuar?")) return;
    setLoading(true);
    setStatus("Cargando JSON...");
    setLog([]);

    try {
      const res = await fetch("/fortaleza_data.json");
      const data: FortalezaData = await res.json();
      addLog(`JSON cargado: ${data.fortaleza_listas.length} secciones en listas, ${data.pago_semanal_fortaleza.length} en pagos`);

      // Step 1: Load students from fortaleza_listas
      setStatus("Cargando alumnos...");
      const studentIdMap = new Map<string, string>(); // normalized name -> doc id
      let studentCount = 0;

      for (const section of data.fortaleza_listas) {
        for (const student of section.students) {
          const normalized = normalizeName(student.nombre);
          const docId = `fortaleza_${section.section_num}_${String(student.num).padStart(3, "0")}`;

          const inscPaid = (student.inscripcion || "").toUpperCase().includes("PAG") ||
                          (student.inscripcion || "").toUpperCase().includes("PADAGA");

          const tarifa = student.tarifa || 350;
          const serviceType = tarifa <= 250 ? "medio" : "completo";

          await setDoc(doc(db, "cobros_students", docId), {
            name: student.nombre,
            school: section.escuela,
            shift: section.turno === "MAT" ? "Matutino" : section.turno === "VESP" ? "Vespertino" : section.turno,
            driver: section.custodio,
            serviceType,
            weeklyRate: tarifa,
            inscriptionPaid: inscPaid,
            startWeek: 1,
            status: "activo",
            parentPhone: student.tel1 || "",
            parentPhone2: student.tel2 || "",
            group: "Fortaleza",
            grade: student.grado || "",
            groupClass: student.grupo || "",
            sectionNum: parseInt(section.section_num),
            numInSection: student.num,
            notes: student.observaciones || "",
          });

          studentIdMap.set(normalized, docId);
          studentCount++;
        }
      }
      addLog(`${studentCount} alumnos cargados`);

      // Step 2: Load payments from pago_semanal_fortaleza
      setStatus("Cargando pagos semanales...");
      let paymentCount = 0;
      let skipped = 0;

      for (const section of data.pago_semanal_fortaleza) {
        for (const student of section.students) {
          const normalized = normalizeName(student.nombre);
          let studentId = studentIdMap.get(normalized);

          // If not found by exact match, try fuzzy
          if (!studentId) {
            for (const [key, id] of studentIdMap.entries()) {
              if (key.includes(normalized) || normalized.includes(key)) {
                studentId = id;
                break;
              }
            }
          }

          // If still not found, create a new student doc
          if (!studentId) {
            studentId = `fortaleza_${section.section_num}_extra_${student.nombre.slice(0, 20).replace(/\s/g, "_")}`;
            const tarifa = parseInt(student.tarifa || "350") || 350;
            await setDoc(doc(db, "cobros_students", studentId), {
              name: student.nombre,
              school: section.escuela,
              shift: section.turno === "MAT" ? "Matutino" : section.turno === "VESP" ? "Vespertino" : section.turno,
              driver: section.custodio,
              serviceType: tarifa <= 250 ? "medio" : "completo",
              weeklyRate: tarifa,
              inscriptionPaid: false,
              startWeek: 1,
              status: "activo",
              parentPhone: student.tel1 || "",
              parentPhone2: student.tel2 || "",
              group: "Fortaleza",
              grade: "",
              groupClass: "",
              sectionNum: parseInt(section.section_num),
              numInSection: parseInt(student.num) || 0,
              notes: "Agregado desde pagos",
            });
            studentIdMap.set(normalized, studentId);
            addLog(`Alumno extra creado: ${student.nombre}`);
          }

          // Load inscription payment if paid
          const insPaid = (student.inscripcion || "").trim();
          if (insPaid && insPaid !== "" && insPaid !== "0") {
            const insAmount = parseInt(insPaid) || 300;
            const insDocId = `${studentId}_ins`;
            await setDoc(doc(db, "cobros_payments", insDocId), {
              studentId,
              amount: insAmount,
              weekNumber: 0,
              status: "pagado",
              paymentMethod: "efectivo",
              timestamp: Timestamp.now(),
              notes: "Inscripción (importado)",
            });
            paymentCount++;
          }

          // Load weekly payments
          for (const [weekStr, value] of Object.entries(student.pagos_semanales)) {
            const weekNum = parseInt(weekStr);
            const val = String(value || "").trim();

            if (!val || val === "" || val.startsWith("-")) {
              continue; // Empty or dashes = skip
            }

            const payDocId = `${studentId}_w${weekNum}`;
            const numVal = parseInt(val);

            if (!isNaN(numVal) && numVal > 0) {
              // Numeric payment
              await setDoc(doc(db, "cobros_payments", payDocId), {
                studentId,
                amount: numVal,
                weekNumber: weekNum,
                status: "pagado",
                paymentMethod: "efectivo",
                timestamp: Timestamp.now(),
                notes: "Importado de Excel",
              });
              paymentCount++;
            } else if (val.toUpperCase() === "N") {
              await setDoc(doc(db, "cobros_payments", payDocId), {
                studentId,
                amount: 0,
                weekNumber: weekNum,
                status: "no_aplica",
                paymentMethod: "efectivo",
                timestamp: Timestamp.now(),
                notes: "N - No asistió",
              });
              paymentCount++;
            } else if (val.toUpperCase() === "CORTESIA" || val.toUpperCase().includes("CORTESIA")) {
              await setDoc(doc(db, "cobros_payments", payDocId), {
                studentId,
                amount: 0,
                weekNumber: weekNum,
                status: "cortesia",
                paymentMethod: "efectivo",
                timestamp: Timestamp.now(),
                notes: val,
              });
              paymentCount++;
            } else if (val.toUpperCase() === "BAJA" || val.toUpperCase() === "BJ") {
              // Mark student as baja
              await setDoc(doc(db, "cobros_students", studentId), { status: "baja" }, { merge: true });
              await setDoc(doc(db, "cobros_payments", payDocId), {
                studentId,
                amount: 0,
                weekNumber: weekNum,
                status: "no_aplica",
                paymentMethod: "efectivo",
                timestamp: Timestamp.now(),
                notes: "BAJA",
              });
              paymentCount++;
            } else if (val.toUpperCase() === "PAGADA") {
              // "PAGADA" usually means inscription was paid
              // Skip if it's already handled
              skipped++;
            } else {
              addLog(`Valor desconocido para ${student.nombre} sem ${weekNum}: "${val}"`);
              skipped++;
            }
          }
        }
      }

      addLog(`${paymentCount} pagos cargados, ${skipped} omitidos`);
      setStatus(`¡Listo! ${studentCount} alumnos y ${paymentCount} pagos cargados.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      setStatus(`Error: ${msg}`);
      addLog(`ERROR: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    if (!confirm("¿Borrar TODOS los datos de cobros? Esta acción no se puede deshacer.")) return;
    if (!confirm("¿Estás seguro? Se borrarán todos los alumnos y pagos.")) return;
    setLoading(true);
    setStatus("Borrando datos...");

    try {
      const studentsSnap = await getDocs(collection(db, "cobros_students"));
      for (const d of studentsSnap.docs) {
        await deleteDoc(d.ref);
      }
      const paymentsSnap = await getDocs(collection(db, "cobros_payments"));
      for (const d of paymentsSnap.docs) {
        await deleteDoc(d.ref);
      }
      setStatus(`Borrados ${studentsSnap.size} alumnos y ${paymentsSnap.size} pagos`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error";
      setStatus(`Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <a href="/" className="text-blue-600 hover:underline text-sm mb-6 inline-block">
        &larr; Volver al grid
      </a>

      <div className="bg-white rounded-lg border shadow-sm p-8">
        <h2 className="text-2xl font-bold mb-2">Cargar Datos de Fortaleza</h2>
        <p className="text-gray-500 mb-6">
          Carga los datos del Excel de Fortaleza (alumnos + pagos semanales) al sistema.
        </p>

        <div className="flex gap-4 mb-6">
          <button
            onClick={handleSeed}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {loading ? "Cargando..." : "Cargar Datos"}
          </button>
          <button
            onClick={handleClear}
            disabled={loading}
            className="px-6 py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 disabled:opacity-50 transition"
          >
            Borrar Todo
          </button>
        </div>

        {status && (
          <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 mb-4">
            <p className="font-bold text-blue-700">{status}</p>
          </div>
        )}

        {log.length > 0 && (
          <div className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs font-mono max-h-96 overflow-auto">
            {log.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
