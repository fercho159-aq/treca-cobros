"use client";

import { useState } from "react";
import PagoSemanalTab from "@/components/tabs/pago-semanal";
import FortalezaListasTab from "@/components/tabs/fortaleza-listas";
import CuentasGeneralTab from "@/components/tabs/cuentas-general";

const TABS = [
  { id: "listas", label: "Fortaleza Listas" },
  { id: "pagos", label: "Pago semanal - Fortaleza" },
  { id: "cuentas", label: "Cuentas General Fortaleza" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("pagos");

  return (
    <div className="flex flex-col h-[calc(100vh-52px)]">
      {/* Contenido de la pestaña */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "listas" && <FortalezaListasTab />}
        {activeTab === "pagos" && <PagoSemanalTab />}
        {activeTab === "cuentas" && <CuentasGeneralTab />}
      </div>

      {/* Tabs en la parte inferior - estilo Excel */}
      <div className="flex-shrink-0 bg-gray-200 border-t border-gray-400 flex items-end px-1 pt-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-1.5 text-sm font-medium border border-b-0 rounded-t-md mr-0.5 transition-colors ${
              activeTab === tab.id
                ? "bg-white border-gray-400 text-black -mb-px z-10"
                : "bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
