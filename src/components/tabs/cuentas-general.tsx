"use client";

import { useState, useEffect } from "react";

interface CustodioData {
  nombre: string;
  escuela: string;
  ingreso: number;
  otrosIngresos: number;
  totalIngresos: number;
  gasolina: number;
  otrosGastos: number;
  totalGastos: number;
  totalNeto: number;
  dividendos: number;
  sub_escuelas: { escuela: string; ingreso: number }[];
}

interface WeekData {
  semana: number;
  custodios: CustodioData[];
  inscripciones: { custodio: string; monto: number }[];
  totales: {
    totalIngresos?: number;
    gasolina?: number;
    otrosGastos?: number;
    totalGastos?: number;
    totalNeto?: number;
  };
}

const fmt = (n: number) =>
  n ? n.toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0 }) : "";

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
        if (cuentas.length > 0) {
          setSelectedWeek(cuentas[cuentas.length - 1].semana);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">Cargando...</div>;
  }

  const currentData = weeksData.find((w) => w.semana === selectedWeek);

  return (
    <div className="overflow-auto h-full p-4">
      {/* Selector de semana */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {weeksData.map((w) => (
          <button
            key={w.semana}
            onClick={() => setSelectedWeek(w.semana)}
            className={`px-4 py-2 rounded-lg text-sm font-bold border transition ${
              selectedWeek === w.semana
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}
          >
            Semana {w.semana}
          </button>
        ))}
      </div>

      {!currentData ? (
        <div className="text-gray-400 text-center py-8">
          No hay datos de cuentas. Carga los datos desde <a href="/seed" className="text-blue-600 underline">/seed</a>.
        </div>
      ) : (
        <>
          {/* Tabla de custodios */}
          <table className="border-collapse text-xs w-full bg-white" style={{ minWidth: "900px" }}>
            <thead>
              <tr className="bg-[#0000CC] text-white">
                <th className="border border-[#0000AA] px-2 py-1.5 text-left min-w-[160px]">NOMBRE</th>
                <th className="border border-[#0000AA] px-2 py-1.5 text-left min-w-[130px]">ESCUELA</th>
                <th className="border border-[#0000AA] px-2 py-1.5 text-right min-w-[80px]">INGRESO</th>
                <th className="border border-[#0000AA] px-2 py-1.5 text-right min-w-[90px]">OTROS ING.</th>
                <th className="border border-[#0000AA] px-2 py-1.5 text-right min-w-[90px]">TOTAL ING.</th>
                <th className="border border-[#0000AA] px-2 py-1.5 text-right min-w-[80px]">GASOLINA</th>
                <th className="border border-[#0000AA] px-2 py-1.5 text-right min-w-[90px]">OTROS GAST.</th>
                <th className="border border-[#0000AA] px-2 py-1.5 text-right min-w-[90px]">TOTAL GAST.</th>
                <th className="border border-[#0000AA] px-2 py-1.5 text-right min-w-[90px]">TOTAL NETO</th>
                <th className="border border-[#0000AA] px-2 py-1.5 text-right min-w-[90px]">DIVIDENDOS</th>
              </tr>
            </thead>
            <tbody>
              {currentData.custodios.map((c, idx) => (
                <>
                  <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="border border-gray-300 px-2 py-1.5 font-bold">{c.nombre}</td>
                    <td className="border border-gray-300 px-2 py-1.5">{c.escuela}</td>
                    <td className="border border-gray-300 px-2 py-1.5 text-right">{fmt(c.ingreso)}</td>
                    <td className="border border-gray-300 px-2 py-1.5 text-right">{fmt(c.otrosIngresos)}</td>
                    <td className="border border-gray-300 px-2 py-1.5 text-right font-bold text-blue-700">{fmt(c.totalIngresos)}</td>
                    <td className="border border-gray-300 px-2 py-1.5 text-right text-red-600">{fmt(c.gasolina)}</td>
                    <td className="border border-gray-300 px-2 py-1.5 text-right text-red-600">{fmt(c.otrosGastos)}</td>
                    <td className="border border-gray-300 px-2 py-1.5 text-right font-bold text-red-600">{fmt(c.totalGastos)}</td>
                    <td className={`border border-gray-300 px-2 py-1.5 text-right font-bold ${c.totalNeto >= 0 ? "text-green-700" : "text-red-600"}`}>
                      {fmt(c.totalNeto)}
                    </td>
                    <td className="border border-gray-300 px-2 py-1.5 text-right">{fmt(c.dividendos)}</td>
                  </tr>
                  {/* Sub-escuelas */}
                  {c.sub_escuelas?.map((sub, si) => (
                    <tr key={`${idx}-sub-${si}`} className="bg-gray-50">
                      <td className="border border-gray-300 px-2 py-1"></td>
                      <td className="border border-gray-300 px-2 py-1 text-gray-600 pl-4">{sub.escuela}</td>
                      <td className="border border-gray-300 px-2 py-1 text-right text-gray-600">{fmt(sub.ingreso)}</td>
                      <td className="border border-gray-300 px-2 py-1" colSpan={7}></td>
                    </tr>
                  ))}
                </>
              ))}

              {/* Totales */}
              {currentData.totales.totalIngresos && (
                <tr className="bg-[#D9E2F3] font-bold">
                  <td className="border border-gray-400 px-2 py-2" colSpan={2}>TOTAL</td>
                  <td className="border border-gray-400 px-2 py-2 text-right"></td>
                  <td className="border border-gray-400 px-2 py-2 text-right"></td>
                  <td className="border border-gray-400 px-2 py-2 text-right text-blue-700">{fmt(currentData.totales.totalIngresos || 0)}</td>
                  <td className="border border-gray-400 px-2 py-2 text-right text-red-600">{fmt(currentData.totales.gasolina || 0)}</td>
                  <td className="border border-gray-400 px-2 py-2 text-right text-red-600">{fmt(currentData.totales.otrosGastos || 0)}</td>
                  <td className="border border-gray-400 px-2 py-2 text-right text-red-600">{fmt(currentData.totales.totalGastos || 0)}</td>
                  <td className="border border-gray-400 px-2 py-2 text-right text-green-700">{fmt(currentData.totales.totalNeto || 0)}</td>
                  <td className="border border-gray-400 px-2 py-2 text-right"></td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Inscripciones */}
          {currentData.inscripciones.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-bold mb-2 text-gray-700">INSCRIPCIONES</h3>
              <table className="border-collapse text-xs bg-white">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-3 py-1.5 text-left min-w-[200px]">Custodio</th>
                    <th className="border border-gray-300 px-3 py-1.5 text-right min-w-[100px]">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {currentData.inscripciones.map((ins, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="border border-gray-300 px-3 py-1.5">{ins.custodio}</td>
                      <td className="border border-gray-300 px-3 py-1.5 text-right font-medium">{fmt(ins.monto)}</td>
                    </tr>
                  ))}
                  <tr className="bg-[#D9E2F3] font-bold">
                    <td className="border border-gray-400 px-3 py-1.5">TOTAL</td>
                    <td className="border border-gray-400 px-3 py-1.5 text-right">
                      {fmt(currentData.inscripciones.reduce((s, i) => s + i.monto, 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
