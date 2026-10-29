"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SyncPage() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message?: string;
    total?: number;
    created?: number;
    updated?: number;
    error?: string;
  } | null>(null);
  const router = useRouter();

  const handleSync = async () => {
    setSyncing(true);
    setResult(null);
    try {
      const res = await fetch("/api/sync-sheets", { method: "POST" });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ success: false, error: "Error de conexión" });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <button
        onClick={() => router.push("/")}
        className="text-blue-600 hover:underline text-sm mb-6 inline-block"
      >
        &larr; Volver al grid
      </button>

      <div className="bg-white rounded-lg border shadow-sm p-8 text-center">
        <h2 className="text-2xl font-bold mb-2">Sincronizar Google Sheets</h2>
        <p className="text-gray-500 mb-6">
          Importa la lista de alumnos desde la hoja de Google Sheets de Fortaleza.
          <br />
          Los pagos NO se afectan, solo se actualiza la lista de alumnos.
        </p>

        <button
          onClick={handleSync}
          disabled={syncing}
          className="px-8 py-3 bg-blue-600 text-white rounded-lg font-bold text-lg hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {syncing ? "Sincronizando..." : "Sincronizar Ahora"}
        </button>

        {result && (
          <div
            className={`mt-6 p-4 rounded-lg text-left ${
              result.success ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
            }`}
          >
            {result.success ? (
              <>
                <p className="font-bold text-green-700">{result.message}</p>
                <div className="mt-2 text-sm text-green-600">
                  <p>Total procesados: {result.total}</p>
                  <p>Nuevos: {result.created}</p>
                  <p>Actualizados: {result.updated}</p>
                </div>
              </>
            ) : (
              <p className="font-bold text-red-700">Error: {result.error}</p>
            )}
          </div>
        )}

        <div className="mt-8 text-left text-sm text-gray-400">
          <p className="font-medium text-gray-600 mb-2">Formato esperado de la hoja:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Secciones con: ESCUELA: ... | TURNO: ... | CUSTODIO: ...</li>
            <li>Columnas: #, ALUMNO, Grado, Grupo, TEL1, TEL2, INGRESO, TARIFA, INS, OBS</li>
            <li>Tab: &quot;Fortaleza Listas&quot;</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
