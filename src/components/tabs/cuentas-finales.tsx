"use client";

import { useState, useEffect } from "react";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface WeekData {
  semana: number;
  dividendo_socios_4: { label: string; monto: number } | null;
  totales_row: { totalNeto: number } | null;
}

interface GastosOscar {
  sueldoChofer: number;
  refacciones: number;
  otros: number;
  notaSueldo: string;
  notaRefacciones: string;
  notaOtros: string;
}

const n = (v: number) => v.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const CELL = "border border-gray-300 px-3 py-1.5 text-[11px]";
const CELL_R = `${CELL} text-right`;
const CELL_B = `${CELL} font-bold`;
const CELL_RB = `${CELL_R} font-bold`;
const HEADER = "border border-[#0000AA] px-3 py-1.5 text-[10px] font-bold bg-[#0000CC] text-white";

export default function CuentasFinalesTab() {
  const [weeksData, setWeeksData] = useState<WeekData[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [gastos, setGastos] = useState<Record<number, GastosOscar>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  // Cargar datos de Cuentas General
  useEffect(() => {
    fetch("/fortaleza_data.json")
      .then((r) => r.json())
      .then((data) => {
        const cuentas = data.cuentas_general_fortaleza || [];
        setWeeksData(cuentas);
        if (cuentas.length > 0) setSelectedWeek(cuentas[cuentas.length - 1].semana);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Cargar gastos de Oscar desde Firestore (tiempo real)
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "cobros_config", "gastos_oscar"), (snap) => {
      if (snap.exists()) {
        setGastos(snap.data().semanas || {});
      }
    });
    return unsub;
  }, []);

  const saveGasto = async (weekNum: number, field: keyof GastosOscar, value: number | string) => {
    const current = gastos[weekNum] || { sueldoChofer: 0, refacciones: 0, otros: 0, notaSueldo: "", notaRefacciones: "", notaOtros: "" };
    const updated = { ...current, [field]: value };
    const newGastos = { ...gastos, [weekNum]: updated };
    setGastos(newGastos);
    await setDoc(doc(db, "cobros_config", "gastos_oscar"), { semanas: newGastos }, { merge: true });
  };

  const handleCellClick = (key: string, currentValue: number | string) => {
    setEditing(key);
    setEditValue(String(currentValue || ""));
  };

  const handleCellSave = async (weekNum: number, field: keyof GastosOscar) => {
    const isNote = field.startsWith("nota");
    const value = isNote ? editValue : (parseFloat(editValue) || 0);
    await saveGasto(weekNum, field, value);
    setEditing(null);
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Cargando...</div>;

  const w = weeksData.find((d) => d.semana === selectedWeek);
  const g = gastos[selectedWeek] || { sueldoChofer: 0, refacciones: 0, otros: 0, notaSueldo: "", notaRefacciones: "", notaOtros: "" };

  // Cálculos
  const dividendoSocios4 = w?.dividendo_socios_4?.monto || 0;
  const totalGastosOscar = g.sueldoChofer + g.refacciones + g.otros;
  const despuesGastos = dividendoSocios4 - totalGastosOscar;
  const descuento10 = despuesGastos * 0.10;
  const despues10 = despuesGastos - descuento10;
  const porPersona = despues10 / 3;

  // Resumen acumulado
  const resumenTotal = weeksData.reduce(
    (acc, week) => {
      const wg = gastos[week.semana] || { sueldoChofer: 0, refacciones: 0, otros: 0 };
      const div4 = week.dividendo_socios_4?.monto || 0;
      const gTotal = wg.sueldoChofer + wg.refacciones + wg.otros;
      const dg = div4 - gTotal;
      const d10 = dg * 0.10;
      const d10r = dg - d10;
      const pp = d10r / 3;
      acc.dividendo += div4;
      acc.gastos += gTotal;
      acc.descuento10 += d10;
      acc.porPersona += pp;
      return acc;
    },
    { dividendo: 0, gastos: 0, descuento10: 0, porPersona: 0 }
  );

  const EditableCell = ({ weekNum, field, value, className }: { weekNum: number; field: keyof GastosOscar; value: number; className?: string }) => {
    const key = `${weekNum}-${field}`;
    if (editing === key) {
      return (
        <td className={`${CELL} p-0`}>
          <input
            type="number"
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => handleCellSave(weekNum, field)}
            onKeyDown={(e) => e.key === "Enter" && handleCellSave(weekNum, field)}
            className="w-full px-2 py-1 text-right text-[11px] border-2 border-blue-500 outline-none"
          />
        </td>
      );
    }
    return (
      <td
        onClick={() => handleCellClick(key, value)}
        className={`${CELL_R} cursor-pointer hover:bg-yellow-50 ${className || ""}`}
      >
        {value ? n(value) : <span className="text-gray-300">Click para editar</span>}
      </td>
    );
  };

  return (
    <div className="overflow-auto h-full p-3">
      {/* Selector de semana */}
      <div className="flex gap-1 mb-3 flex-wrap items-center">
        {weeksData.map((d) => (
          <button key={d.semana} onClick={() => setSelectedWeek(d.semana)}
            className={`px-3 py-1.5 rounded text-xs font-bold border transition ${
              selectedWeek === d.semana ? "bg-[#0000CC] text-white border-[#0000CC]" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}
          >Sem {d.semana}</button>
        ))}
        <span className="ml-4 text-xs text-gray-500">OSCAR - CAROLINA (Caro) &middot; 3 socios</span>
      </div>

      {!w ? (
        <div className="text-gray-400 text-center py-8">No hay datos.</div>
      ) : (
        <div className="flex gap-8 flex-wrap items-start">
          {/* ======= TABLA PRINCIPAL: CUENTAS FINALES ======= */}
          <div>
            <h3 className="text-sm font-bold mb-2 text-[#0000CC]">CUENTAS FINALES - SEMANA {selectedWeek}</h3>
            <table className="border-collapse bg-white" style={{ minWidth: "400px" }}>
              <tbody>
                {/* Dividendo de Cuentas General */}
                <tr className="bg-[#D9E2F3]">
                  <td className={CELL_B}>DIVIDENDO SOCIOS (4)</td>
                  <td className={CELL_RB}>${n(dividendoSocios4)}</td>
                </tr>

                <tr><td className={CELL} colSpan={2}></td></tr>

                {/* Gastos Oscar */}
                <tr className="bg-gray-100">
                  <td className={`${CELL_B} text-red-700`} colSpan={2}>GASTOS OSCAR - CAROLINA</td>
                </tr>
                <tr>
                  <td className={CELL}>Sueldo Chofer (Caro)</td>
                  <EditableCell weekNum={selectedWeek} field="sueldoChofer" value={g.sueldoChofer} />
                </tr>
                <tr>
                  <td className={CELL}>Refacciones</td>
                  <EditableCell weekNum={selectedWeek} field="refacciones" value={g.refacciones} />
                </tr>
                <tr>
                  <td className={CELL}>Otros</td>
                  <EditableCell weekNum={selectedWeek} field="otros" value={g.otros} />
                </tr>
                <tr className="bg-red-50">
                  <td className={`${CELL_B} text-red-700`}>TOTAL GASTOS</td>
                  <td className={`${CELL_RB} text-red-700`}>-${n(totalGastosOscar)}</td>
                </tr>

                <tr><td className={CELL} colSpan={2}></td></tr>

                {/* Después de gastos */}
                <tr className="bg-blue-50">
                  <td className={CELL_B}>DESPUÉS DE GASTOS</td>
                  <td className={CELL_RB}>${n(despuesGastos)}</td>
                </tr>

                {/* 10% descuento */}
                <tr>
                  <td className={CELL}>10% Descuento (tu trato)</td>
                  <td className={`${CELL_R} text-red-600`}>-${n(descuento10)}</td>
                </tr>

                <tr className="bg-green-50">
                  <td className={CELL_B}>DESPUÉS DEL 10%</td>
                  <td className={CELL_RB}>${n(despues10)}</td>
                </tr>

                <tr><td className={CELL} colSpan={2}></td></tr>

                {/* División entre 3 */}
                <tr className="bg-[#0000CC] text-white">
                  <td className={`${CELL} font-bold border-[#0000AA]`}>÷ 3 SOCIOS = POR PERSONA</td>
                  <td className={`${CELL_R} font-bold border-[#0000AA] text-lg`}>${n(porPersona)}</td>
                </tr>
              </tbody>
            </table>

            {/* Desglose por persona */}
            <table className="border-collapse bg-white mt-3" style={{ minWidth: "400px" }}>
              <thead>
                <tr>
                  <th className={HEADER}>SOCIO</th>
                  <th className={`${HEADER} text-right`}>RECIBE</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-white">
                  <td className={CELL_B}>Daniel Trejo (Papá)</td>
                  <td className={`${CELL_RB} text-green-700`}>${n(porPersona)}</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className={CELL_B}>Fernando Trejo</td>
                  <td className={`${CELL_RB} text-green-700`}>${n(porPersona)}</td>
                </tr>
                <tr className="bg-white">
                  <td className={CELL_B}>Aldo Trejo (Tú)</td>
                  <td className={`${CELL_RB} text-green-700`}>${n(porPersona)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ======= RESUMEN ACUMULADO ======= */}
          <div>
            <h3 className="text-sm font-bold mb-2 text-[#0000CC]">ACUMULADO (Semanas 1-{weeksData[weeksData.length - 1]?.semana})</h3>
            <table className="border-collapse bg-white" style={{ minWidth: "320px" }}>
              <tbody>
                <tr className="bg-[#D9E2F3]">
                  <td className={CELL_B}>Total Dividendos</td>
                  <td className={CELL_RB}>${n(resumenTotal.dividendo)}</td>
                </tr>
                <tr>
                  <td className={CELL}>Total Gastos Oscar</td>
                  <td className={`${CELL_R} text-red-600`}>-${n(resumenTotal.gastos)}</td>
                </tr>
                <tr>
                  <td className={CELL}>Total 10% Descuento</td>
                  <td className={`${CELL_R} text-red-600`}>-${n(resumenTotal.descuento10)}</td>
                </tr>
                <tr className="bg-[#0000CC] text-white">
                  <td className={`${CELL} font-bold border-[#0000AA]`}>POR PERSONA ACUMULADO</td>
                  <td className={`${CELL_R} font-bold border-[#0000AA] text-lg`}>${n(resumenTotal.porPersona)}</td>
                </tr>
              </tbody>
            </table>

            {/* Tabla por semana */}
            <h3 className="text-sm font-bold mb-2 mt-4 text-[#0000CC]">DESGLOSE POR SEMANA</h3>
            <table className="border-collapse bg-white text-[10px]" style={{ minWidth: "500px" }}>
              <thead>
                <tr>
                  <th className={HEADER}>SEM</th>
                  <th className={`${HEADER} text-right`}>DIVIDENDO</th>
                  <th className={`${HEADER} text-right`}>GASTOS</th>
                  <th className={`${HEADER} text-right`}>-10%</th>
                  <th className={`${HEADER} text-right`}>POR PERSONA</th>
                </tr>
              </thead>
              <tbody>
                {weeksData.map((week) => {
                  const wg = gastos[week.semana] || { sueldoChofer: 0, refacciones: 0, otros: 0 };
                  const div4 = week.dividendo_socios_4?.monto || 0;
                  const gT = wg.sueldoChofer + wg.refacciones + wg.otros;
                  const dg = div4 - gT;
                  const d10 = dg * 0.10;
                  const pp = (dg - d10) / 3;
                  return (
                    <tr key={week.semana} className={week.semana === selectedWeek ? "bg-yellow-100 font-bold" : week.semana % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                      <td className={`${CELL} text-center`}>{week.semana}</td>
                      <td className={CELL_R}>${n(div4)}</td>
                      <td className={`${CELL_R} ${gT > 0 ? "text-red-600" : ""}`}>{gT > 0 ? `-$${n(gT)}` : "-"}</td>
                      <td className={`${CELL_R} text-red-600`}>-${n(d10)}</td>
                      <td className={`${CELL_R} text-green-700 font-bold`}>${n(pp)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
