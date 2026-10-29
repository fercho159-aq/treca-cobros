"use client";

import { useState, useEffect, useMemo } from "react";
import { collection, onSnapshot, query, where, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Student, Payment } from "@/utils/payments";
import { getSchoolWeeks, getCurrentWeek } from "@/utils/calendar";

// Mapeo de custodios a sus sub-escuelas (orden como en Excel)
const CUSTODIO_CONFIG: Record<string, { label: string; escuelas: { school: string; shift: string; displayName: string }[] }> = {
  "DANIEL CARMEN": {
    label: "DANIEL (CARMEN)",
    escuelas: [
      { school: "OSOS", shift: "Vespertino", displayName: "Osos Vespertino" },
      { school: "MINERVA", shift: "Matutino", displayName: "Minerva" },
      { school: "OSOS", shift: "Matutino", displayName: "Osos M" },
    ],
  },
  "OSCAR - CAROLINA": {
    label: "OSCAR (CARO) TREJO",
    escuelas: [
      { school: "OSOS", shift: "Matutino", displayName: "OSOS MAT" },
      { school: "OSOS", shift: "Vespertino", displayName: "OSOS VESP" },
    ],
  },
  "EDUARDO PEREZ": {
    label: "EDUARDO",
    escuelas: [
      { school: "OSOS", shift: "Matutino", displayName: "OSOS M" },
      { school: "OSOS", shift: "Vespertino", displayName: "OSOS V" },
      { school: "AMERICAS", shift: "Matutino", displayName: "AMERICAS" },
      { school: "FEDERICO FROBEL", shift: "Matutino", displayName: "FROBEL" },
    ],
  },
  "FERNANDO FABIAN": {
    label: "FERNANDO",
    escuelas: [
      { school: "OSOS", shift: "Matutino", displayName: "OSOS M" },
      { school: "OSOS", shift: "Vespertino", displayName: "OSOS V" },
      { school: "MOISES", shift: "Matutino", displayName: "MOISES" },
    ],
  },
};

const CUSTODIO_ORDER = ["DANIEL CARMEN", "OSCAR - CAROLINA", "EDUARDO PEREZ", "FERNANDO FABIAN"];

interface GastosData {
  gasolina: number;
  otrosGastos: number;
}

interface StudentExt extends Student {
  school: string;
  shift: string;
  driver: string;
  sectionNum: number;
}

const n = (v: number) => v ? v.toLocaleString("es-MX") : "";
const CELL = "border border-gray-300 px-2 py-1 text-[11px]";
const CELL_R = `${CELL} text-right`;
const CELL_B = `${CELL} font-bold`;
const CELL_RB = `${CELL_R} font-bold`;
const HEADER = "border border-[#0000AA] px-2 py-1 text-[10px] font-bold bg-[#0000CC] text-white";

export default function CuentasGeneralTab() {
  const [students, setStudents] = useState<StudentExt[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [gastosMap, setGastosMap] = useState<Record<string, GastosData>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    setSelectedWeek(getCurrentWeek());
  }, []);

  // Cargar alumnos
  useEffect(() => {
    const q = query(collection(db, "cobros_students"), where("group", "==", "Fortaleza"));
    const unsub = onSnapshot(q, (snap) => {
      setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as StudentExt[]);
      setLoading(false);
    });
    return unsub;
  }, []);

  // Cargar pagos
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "cobros_payments"), (snap) => {
      setPayments(snap.docs.map((d) => ({
        id: d.id, ...d.data(),
        timestamp: d.data().timestamp?.toDate?.() || new Date(),
      })) as Payment[]);
    });
    return unsub;
  }, []);

  // Cargar gastos editables
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "cobros_config", "gastos_cuentas_general"), (snap) => {
      if (snap.exists()) setGastosMap(snap.data().data || {});
    });
    return unsub;
  }, []);

  const saveGasto = async (key: string, field: "gasolina" | "otrosGastos", value: number) => {
    const current = gastosMap[key] || { gasolina: 0, otrosGastos: 0 };
    const updated = { ...current, [field]: value };
    const newMap = { ...gastosMap, [key]: updated };
    setGastosMap(newMap);
    await setDoc(doc(db, "cobros_config", "gastos_cuentas_general"), { data: newMap }, { merge: true });
  };

  // Calcular ingresos por custodio/escuela/semana
  const weekData = useMemo(() => {
    const result: Record<string, { escuelas: Record<string, number>; totalIngresos: number }> = {};

    for (const custodioKey of CUSTODIO_ORDER) {
      const config = CUSTODIO_CONFIG[custodioKey];
      const escuelasData: Record<string, number> = {};
      let total = 0;

      for (const esc of config.escuelas) {
        // Encontrar alumnos de este custodio+escuela+turno
        const matchingStudents = students.filter(
          (s) => s.driver === custodioKey && s.school === esc.school && s.shift === esc.shift
        );

        // Sumar pagos de esta semana para estos alumnos
        let ingreso = 0;
        for (const student of matchingStudents) {
          const studentPayments = payments.filter(
            (p) => p.studentId === student.id && p.weekNumber === selectedWeek && p.status === "pagado"
          );
          ingreso += studentPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
        }

        escuelasData[esc.displayName] = ingreso;
        total += ingreso;
      }

      // Inscripciones de esta semana
      const inscStudents = students.filter((s) => s.driver === custodioKey);
      let inscripcionIngreso = 0;
      for (const st of inscStudents) {
        const inscPayments = payments.filter(
          (p) => p.studentId === st.id && p.weekNumber === 0 && p.status === "pagado"
        );
        // Solo contar inscripciones (se registran una vez, las asignamos a semana 1 conceptualmente)
        // Por ahora no las sumamos aquí, van aparte
        inscripcionIngreso += 0; // inscripciones van en su sección
      }

      result[custodioKey] = { escuelas: escuelasData, totalIngresos: total };
    }

    return result;
  }, [students, payments, selectedWeek]);

  // Totales generales
  const totales = useMemo(() => {
    let totalIngresos = 0;
    let totalGasolina = 0;
    let totalOtrosGastos = 0;

    for (const custodioKey of CUSTODIO_ORDER) {
      const data = weekData[custodioKey];
      const gastoKey = `${selectedWeek}_${custodioKey}`;
      const gastos = gastosMap[gastoKey] || { gasolina: 0, otrosGastos: 0 };

      totalIngresos += data?.totalIngresos || 0;
      totalGasolina += gastos.gasolina;
      totalOtrosGastos += gastos.otrosGastos;
    }

    const totalGastos = totalGasolina + totalOtrosGastos;
    const totalNeto = totalIngresos - totalGastos;

    return { totalIngresos, totalGasolina, totalOtrosGastos, totalGastos, totalNeto };
  }, [weekData, gastosMap, selectedWeek]);

  // Dividendos
  const dividendoSocios4 = totales.totalNeto / 4;
  const porcentaje20 = dividendoSocios4 * 0.2;
  const dividendo4Socios = dividendoSocios4 * 0.8;
  const dividendoSocioDaniel = dividendo4Socios * 2;

  const weeks = getSchoolWeeks();
  const weekNums = weeks.map((w) => w.week).slice(0, 42);

  const handleCellClick = (key: string, val: number) => {
    setEditing(key);
    setEditValue(String(val || ""));
  };

  const handleSave = async (custodioKey: string, field: "gasolina" | "otrosGastos") => {
    const key = `${selectedWeek}_${custodioKey}`;
    await saveGasto(key, field, parseFloat(editValue) || 0);
    setEditing(null);
  };

  const EditCell = ({ custodioKey, field }: { custodioKey: string; field: "gasolina" | "otrosGastos" }) => {
    const key = `${selectedWeek}_${custodioKey}`;
    const gastos = gastosMap[key] || { gasolina: 0, otrosGastos: 0 };
    const val = gastos[field];
    const editKey = `${key}_${field}`;

    if (editing === editKey) {
      return (
        <td className={`${CELL} p-0`}>
          <input type="number" autoFocus value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => handleSave(custodioKey, field)}
            onKeyDown={(e) => e.key === "Enter" && handleSave(custodioKey, field)}
            className="w-full px-2 py-1 text-right text-[11px] border-2 border-blue-500 outline-none"
          />
        </td>
      );
    }
    return (
      <td onClick={() => handleCellClick(editKey, val)}
        className={`${CELL_R} cursor-pointer hover:bg-yellow-50`}
      >
        {val ? n(val) : <span className="text-gray-300 text-[9px]">editar</span>}
      </td>
    );
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Cargando...</div>;

  return (
    <div className="overflow-auto h-full p-3">
      {/* Selector de semana */}
      <div className="flex gap-1 mb-3 flex-wrap">
        {weekNums.slice(0, 20).map((w) => (
          <button key={w} onClick={() => setSelectedWeek(w)}
            className={`px-2.5 py-1 rounded text-[10px] font-bold border transition ${
              selectedWeek === w ? "bg-[#0000CC] text-white border-[#0000CC]" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}
          >{w}</button>
        ))}
      </div>

      <div className="space-y-6">
        {/* ============ TABLA CUSTODIOS ============ */}
        <table className="border-collapse bg-white" style={{ minWidth: "950px" }}>
          <thead>
            <tr>
              <th className={HEADER} style={{ minWidth: 150 }}>NOMBRE</th>
              <th className={HEADER} style={{ minWidth: 120 }}>ESCUELA</th>
              <th className={`${HEADER} text-right`} style={{ minWidth: 80 }}>INGRESO</th>
              <th className={`${HEADER} text-right`} style={{ minWidth: 100 }}>OTROS INGRESOS</th>
              <th className={`${HEADER} text-right`} style={{ minWidth: 100 }}>TOTAL INGRESOS</th>
              <th className={`${HEADER} text-right`} style={{ minWidth: 80 }}>GASOLINA</th>
              <th className={`${HEADER} text-right`} style={{ minWidth: 100 }}>OTROS GASTOS</th>
              <th className={`${HEADER} text-right`} style={{ minWidth: 100 }}>TOTAL GASTOS</th>
              <th className={`${HEADER} text-right`} style={{ minWidth: 100 }}>TOTAL NETO</th>
              <th className={`${HEADER} text-right`} style={{ minWidth: 90 }}>DIVIENDOS</th>
            </tr>
          </thead>
          <tbody>
            {CUSTODIO_ORDER.map((custodioKey, idx) => {
              const config = CUSTODIO_CONFIG[custodioKey];
              const data = weekData[custodioKey] || { escuelas: {}, totalIngresos: 0 };
              const gastoKey = `${selectedWeek}_${custodioKey}`;
              const gastos = gastosMap[gastoKey] || { gasolina: 0, otrosGastos: 0 };
              const totalGastos = gastos.gasolina + gastos.otrosGastos;
              const totalNeto = data.totalIngresos - totalGastos;
              const dividendos = totales.totalNeto > 0 ? dividendoSocios4 : 0;

              const firstEsc = config.escuelas[0];
              const restEsc = config.escuelas.slice(1);

              return (
                <>
                  {/* Fila principal del custodio */}
                  <tr key={custodioKey} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className={CELL_B}>{config.label}</td>
                    <td className={CELL}>{firstEsc.displayName}</td>
                    <td className={CELL_R}>{n(data.escuelas[firstEsc.displayName] || 0)}</td>
                    <td className={CELL_R}></td>
                    <td className={CELL_RB}>{n(data.totalIngresos)}</td>
                    <EditCell custodioKey={custodioKey} field="gasolina" />
                    <EditCell custodioKey={custodioKey} field="otrosGastos" />
                    <td className={CELL_RB}>{n(totalGastos)}</td>
                    <td className={`${CELL_RB} ${totalNeto >= 0 ? "text-green-700" : "text-red-600"}`}>{n(totalNeto)}</td>
                    <td className={CELL_R}>{n(dividendos)}</td>
                  </tr>
                  {/* Sub-escuelas */}
                  {restEsc.map((esc, si) => (
                    <tr key={`${custodioKey}-${si}`} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className={CELL}></td>
                      <td className={CELL}>{esc.displayName}</td>
                      <td className={CELL_R}>{n(data.escuelas[esc.displayName] || 0)}</td>
                      <td className={CELL}></td><td className={CELL}></td><td className={CELL}></td>
                      <td className={CELL}></td><td className={CELL}></td><td className={CELL}></td>
                      <td className={CELL}></td>
                    </tr>
                  ))}
                </>
              );
            })}

            {/* Totales */}
            <tr className="bg-[#D9E2F3] font-bold">
              <td className={CELL} colSpan={2}></td>
              <td className={CELL_R}></td>
              <td className={CELL_R}></td>
              <td className={`${CELL_RB} text-blue-800`}>{n(totales.totalIngresos)}</td>
              <td className={CELL_R}>{n(totales.totalGasolina)}</td>
              <td className={CELL_R}>{n(totales.totalOtrosGastos)}</td>
              <td className={CELL_R}>{n(totales.totalGastos)}</td>
              <td className={`${CELL_RB} text-green-700`}>{n(totales.totalNeto)}</td>
              <td className={CELL_R}>{n(totales.totalNeto)}</td>
            </tr>
          </tbody>
        </table>

        {/* ============ DIVIDENDOS ============ */}
        <div className="flex gap-8 flex-wrap">
          <div>
            <table className="border-collapse bg-white">
              <tbody>
                <tr>
                  <td className={CELL_B}>DIVIENDO SOCIOS (4)</td>
                  <td className={CELL_RB}>${n(dividendoSocios4)}</td>
                </tr>
                <tr>
                  <td className={`${CELL} text-right`}>20%</td>
                  <td className={CELL_R}>${n(porcentaje20)}</td>
                </tr>
                <tr>
                  <td className={CELL_B}>DIVIENDO 4 SOCIOS</td>
                  <td className={CELL_RB}>${n(dividendo4Socios)}</td>
                </tr>
                <tr>
                  <td className={CELL_B}>DIVIDENDO SOCIO DANIEL</td>
                  <td className={CELL_RB}>${n(dividendoSocioDaniel)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <table className="border-collapse bg-white">
              <thead>
                <tr>
                  <th className={HEADER}></th>
                  <th className={`${HEADER} text-right`}>RECIBE</th>
                  <th className={`${HEADER} text-right`}>COBRO</th>
                  <th className={`${HEADER} text-right`}>AHORRO</th>
                  <th className={`${HEADER} text-right`}>TOTAL</th>
                  <th className={`${HEADER} text-right`}>GASOLINA</th>
                  <th className={`${HEADER} text-right`}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { socio: "treca-fortaleza", recibe: dividendoSocioDaniel, custodio: "DANIEL CARMEN" },
                  { socio: "Lalo Eduardo", recibe: dividendo4Socios, custodio: "EDUARDO PEREZ" },
                  { socio: "Fernando Socio", recibe: dividendo4Socios, custodio: "FERNANDO FABIAN" },
                  { socio: "treca2-fortaleza", recibe: dividendo4Socios, custodio: "OSCAR - CAROLINA" },
                ].map((s, i) => {
                  const cobro = weekData[s.custodio]?.totalIngresos || 0;
                  const ahorro = 800;
                  const gastoKey = `${selectedWeek}_${s.custodio}`;
                  const g = gastosMap[gastoKey] || { gasolina: 0, otrosGastos: 0 };
                  const total = s.recibe - cobro - ahorro;
                  const gasolina = g.gasolina;
                  const totalFinal = total - gasolina;
                  return (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className={CELL_B}>{s.socio}</td>
                      <td className={CELL_R}>{n(s.recibe)}</td>
                      <td className={CELL_R}>{n(cobro)}</td>
                      <td className={CELL_R}>{n(ahorro)}</td>
                      <td className={`${CELL_RB} ${total >= 0 ? "" : "text-red-600"}`}>{n(total)}</td>
                      <td className={CELL_R}>{n(gasolina)}</td>
                      <td className={`${CELL_RB} ${totalFinal >= 0 ? "text-green-700" : "text-red-600"}`}>{n(totalFinal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ============ INSCRIPCIONES ============ */}
        <div className="flex gap-8 flex-wrap items-start">
          <table className="border-collapse bg-white">
            <thead>
              <tr>
                <th className={HEADER}>INSCRIPCIONES</th>
                <th className={`${HEADER} text-right`}>MONTO</th>
              </tr>
            </thead>
            <tbody>
              {CUSTODIO_ORDER.map((custodioKey, i) => {
                const config = CUSTODIO_CONFIG[custodioKey];
                const inscStudents = students.filter((s) => s.driver === custodioKey);
                let inscTotal = 0;
                for (const st of inscStudents) {
                  const inscPayments = payments.filter(
                    (p) => p.studentId === st.id && p.weekNumber === 0 && p.status === "pagado"
                  );
                  inscTotal += inscPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
                }
                return (
                  <tr key={i} className="bg-white">
                    <td className={CELL_B}>{config.label}</td>
                    <td className={CELL_R}>{inscTotal ? n(inscTotal) : ""}</td>
                  </tr>
                );
              })}
              <tr className="bg-[#D9E2F3] font-bold">
                <td className={CELL}>TOTAL</td>
                <td className={CELL_R}>
                  {n(CUSTODIO_ORDER.reduce((sum, ck) => {
                    const inscStudents = students.filter((s) => s.driver === ck);
                    let t = 0;
                    for (const st of inscStudents) {
                      t += payments.filter((p) => p.studentId === st.id && p.weekNumber === 0 && p.status === "pagado")
                        .reduce((s, p) => s + (p.amount || 0), 0);
                    }
                    return sum + t;
                  }, 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
