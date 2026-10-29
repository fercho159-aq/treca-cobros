"use client";

import { useState, useEffect } from "react";

interface SubEscuela { escuela: string; ingreso: number; }
interface CustodioData {
  nombre: string; escuela: string; ingreso: number; otrosIngresos: number;
  totalIngresos: number; gasolina: number; otrosGastos: number;
  totalGastos: number; totalNeto: number; dividendos: number; extra: string;
  sub_escuelas: SubEscuela[];
}
interface SocioRow {
  label: string; monto: number; socio: string; recibe: number;
  cobro: number; ahorro: number; total: number; gasolina: number; totalFinal: number;
}
interface InscripcionRow { custodio: string; monto: number; para_daniel: string; para_socios: string; }
interface WeekData {
  semana: number;
  custodios: CustodioData[];
  totales_row: { totalIngresos: number; gasolina: number; otrosGastos: number; totalGastos: number; totalNeto: number; dividendos: number } | null;
  dividendo_socios_4: { label: string; monto: number } | null;
  porcentaje_20: { label: string; monto: number } | null;
  socios_table: SocioRow[];
  inscripciones: InscripcionRow[];
  inscripciones_total: { total: number; para_daniel: number; para_socios: number } | null;
}

const n = (v: number) => v ? v.toLocaleString("es-MX") : "";
const CELL = "border border-gray-300 px-2 py-1 text-[11px]";
const CELL_R = `${CELL} text-right`;
const HEADER = "border border-[#0000AA] px-2 py-1 text-[10px] font-bold bg-[#0000CC] text-white";

export default function CuentasGeneralTab() {
  const [weeksData, setWeeksData] = useState<WeekData[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Cargando...</div>;

  const w = weeksData.find((d) => d.semana === selectedWeek);

  return (
    <div className="overflow-auto h-full p-3">
      {/* Selector de semana */}
      <div className="flex gap-1 mb-3 flex-wrap">
        {weeksData.map((d) => (
          <button key={d.semana} onClick={() => setSelectedWeek(d.semana)}
            className={`px-3 py-1.5 rounded text-xs font-bold border transition ${
              selectedWeek === d.semana ? "bg-[#0000CC] text-white border-[#0000CC]" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}
          >Semana {d.semana}</button>
        ))}
      </div>

      {!w ? (
        <div className="text-gray-400 text-center py-8">No hay datos.</div>
      ) : (
        <div className="space-y-6">
          {/* ============ TABLA 1: CUSTODIOS ============ */}
          <table className="border-collapse bg-white" style={{ minWidth: "950px" }}>
            <thead>
              <tr>
                <th className={HEADER} style={{minWidth:160}}>NOMBRE</th>
                <th className={HEADER} style={{minWidth:130}}>ESCUELA</th>
                <th className={`${HEADER} text-right`} style={{minWidth:80}}>INGRESO</th>
                <th className={`${HEADER} text-right`} style={{minWidth:100}}>OTROS INGRESOS</th>
                <th className={`${HEADER} text-right`} style={{minWidth:100}}>TOTAL INGRESOS</th>
                <th className={`${HEADER} text-right`} style={{minWidth:80}}>GASOLINA</th>
                <th className={`${HEADER} text-right`} style={{minWidth:100}}>OTROS GASTOS</th>
                <th className={`${HEADER} text-right`} style={{minWidth:100}}>TOTAL GASTOS</th>
                <th className={`${HEADER} text-right`} style={{minWidth:100}}>TOTAL NETO</th>
                <th className={`${HEADER} text-right`} style={{minWidth:90}}>DIVIENDOS</th>
                <th className={`${HEADER} text-right`} style={{minWidth:70}}>.</th>
              </tr>
            </thead>
            <tbody>
              {w.custodios.map((c, idx) => (
                <>
                  <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className={`${CELL} font-bold`}>{c.nombre}</td>
                    <td className={CELL}>{c.escuela}</td>
                    <td className={CELL_R}>{n(c.ingreso)}</td>
                    <td className={CELL_R}>{n(c.otrosIngresos)}</td>
                    <td className={`${CELL_R} font-bold`}>{n(c.totalIngresos)}</td>
                    <td className={CELL_R}>{n(c.gasolina)}</td>
                    <td className={CELL_R}>{n(c.otrosGastos)}</td>
                    <td className={`${CELL_R} font-bold`}>{n(c.totalGastos)}</td>
                    <td className={`${CELL_R} font-bold ${c.totalNeto >= 0 ? "text-green-700" : "text-red-600"}`}>{n(c.totalNeto)}</td>
                    <td className={CELL_R}>{n(c.dividendos)}</td>
                    <td className={CELL_R}>{c.extra ? n(parseFloat(c.extra)) : ""}</td>
                  </tr>
                  {c.sub_escuelas.map((sub, si) => (
                    <tr key={`${idx}-s${si}`} className="bg-white">
                      <td className={CELL}></td>
                      <td className={CELL}>{sub.escuela}</td>
                      <td className={CELL_R}>{n(sub.ingreso)}</td>
                      <td className={CELL}></td><td className={CELL}></td><td className={CELL}></td>
                      <td className={CELL}></td><td className={CELL}></td><td className={CELL}></td>
                      <td className={CELL}></td><td className={CELL}></td>
                    </tr>
                  ))}
                </>
              ))}
              {/* Totales */}
              {w.totales_row && (
                <tr className="bg-[#D9E2F3] font-bold">
                  <td className={CELL} colSpan={2}></td>
                  <td className={CELL_R}></td>
                  <td className={CELL_R}></td>
                  <td className={`${CELL_R} text-blue-800`}>{n(w.totales_row.totalIngresos)}</td>
                  <td className={CELL_R}>{n(w.totales_row.gasolina)}</td>
                  <td className={CELL_R}>{n(w.totales_row.otrosGastos)}</td>
                  <td className={CELL_R}>{n(w.totales_row.totalGastos)}</td>
                  <td className={`${CELL_R} text-green-700`}>{n(w.totales_row.totalNeto)}</td>
                  <td className={CELL_R}>{n(w.totales_row.dividendos)}</td>
                  <td className={CELL}></td>
                </tr>
              )}
            </tbody>
          </table>

          {/* ============ DIVIDENDOS ============ */}
          <div className="flex gap-8 flex-wrap">
            {/* Lado izquierdo: Dividendo socios */}
            <div>
              {w.dividendo_socios_4 && (
                <table className="border-collapse bg-white mb-2">
                  <tbody>
                    <tr>
                      <td className={`${CELL} font-bold`}>{w.dividendo_socios_4.label}</td>
                      <td className={CELL_R}>{n(w.dividendo_socios_4.monto)}</td>
                    </tr>
                    {w.porcentaje_20 && (
                      <tr>
                        <td className={CELL}>0.2</td>
                        <td className={CELL_R}>{n(w.porcentaje_20.monto)}</td>
                      </tr>
                    )}
                    {w.socios_table.filter(s => s.label).map((s, i) => (
                      <tr key={i}>
                        <td className={`${CELL} font-bold`}>{s.label}</td>
                        <td className={CELL_R}>{n(s.monto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Lado derecho: Tabla de socios RECIBE/COBRO/AHORRO */}
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
                  {w.socios_table.map((s, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className={`${CELL} font-bold`}>{s.socio}</td>
                      <td className={CELL_R}>{n(s.recibe)}</td>
                      <td className={CELL_R}>{n(s.cobro)}</td>
                      <td className={CELL_R}>{n(s.ahorro)}</td>
                      <td className={`${CELL_R} font-bold ${s.total >= 0 ? "" : "text-red-600"}`}>{n(s.total)}</td>
                      <td className={CELL_R}>{n(s.gasolina)}</td>
                      <td className={`${CELL_R} font-bold ${s.totalFinal >= 0 ? "text-green-700" : "text-red-600"}`}>{n(s.totalFinal)}</td>
                    </tr>
                  ))}
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
                {w.inscripciones.map((ins, i) => (
                  <tr key={i} className="bg-white">
                    <td className={`${CELL} font-bold`}>{ins.custodio}</td>
                    <td className={CELL_R}>{ins.monto ? n(ins.monto) : ""}</td>
                  </tr>
                ))}
                {w.inscripciones_total && (
                  <tr className="bg-[#D9E2F3] font-bold">
                    <td className={CELL}>TOTAL</td>
                    <td className={CELL_R}>{n(w.inscripciones_total.total)}</td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Distribución inscripciones */}
            {w.inscripciones_total && (w.inscripciones_total.para_daniel > 0 || w.inscripciones_total.para_socios > 0) && (
              <table className="border-collapse bg-white">
                <thead>
                  <tr>
                    <th className={HEADER}>PARA TRECA-FORTALEZA<br/><span className="font-normal text-[9px]">20% + SU PARTE</span></th>
                    <th className={HEADER}>PARA SOCIOS<br/><span className="font-normal text-[9px]">SU PARTE</span></th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-white">
                    <td className={CELL_R}>{n(w.inscripciones_total.para_daniel)}</td>
                    <td className={CELL_R}>{n(w.inscripciones_total.para_socios)}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
