"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Student {
  id: string;
  name: string;
  school: string;
  shift: string;
  driver: string;
  weeklyRate: number;
  inscriptionPaid: boolean;
  parentPhone: string;
  parentPhone2: string;
  grade: string;
  groupClass: string;
  sectionNum: number;
  numInSection: number;
  status: string;
  notes: string;
}

interface Section {
  sectionNum: number;
  school: string;
  shift: string;
  driver: string;
  students: Student[];
}

export default function FortalezaListasTab() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "cobros_students"), where("group", "==", "Fortaleza"));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Student[];
      data.sort((a, b) => {
        if (a.sectionNum !== b.sectionNum) return a.sectionNum - b.sectionNum;
        return a.numInSection - b.numInSection;
      });
      setStudents(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  // Agrupar por sección
  const sections: Section[] = [];
  for (const student of students) {
    let section = sections.find((s) => s.sectionNum === student.sectionNum);
    if (!section) {
      section = {
        sectionNum: student.sectionNum,
        school: student.school,
        shift: student.shift || "",
        driver: student.driver,
        students: [],
      };
      sections.push(section);
    }
    section.students.push(student);
  }
  sections.sort((a, b) => a.sectionNum - b.sectionNum);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">Cargando...</div>;
  }

  return (
    <div className="overflow-auto h-full">
      <table className="border-collapse text-xs w-full" style={{ minWidth: "900px" }}>
        <tbody>
          {sections.length === 0 ? (
            <tr>
              <td colSpan={10} className="text-center py-8 text-gray-400">
                No hay alumnos. Ve a <a href="/seed" className="text-blue-600 underline">/seed</a> para cargar datos.
              </td>
            </tr>
          ) : (
            sections.map((section) => (
              <SectionRows key={section.sectionNum} section={section} />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

const ROWS_PER_SECTION = 30;

function SectionRows({ section }: { section: Section }) {
  // Generar 30 filas como en el Excel (numeradas, con datos o vacías)
  const rows = Array.from({ length: ROWS_PER_SECTION }, (_, i) => {
    const rowNum = i + 1;
    const student = section.students.find((s) => s.numInSection === rowNum);
    return { rowNum, student };
  });

  return (
    <>
      {/* Número de sección */}
      <tr className="bg-[#0000CC]">
        <td className="border border-[#0000AA] px-2 py-1 text-white font-bold text-[11px]" colSpan={1}>
          {section.sectionNum}
        </td>
        <td className="border border-[#0000AA] px-2 py-1 text-white font-bold text-[11px]" colSpan={2}>
          ESCUELA: {section.school}
        </td>
        <td className="border border-[#0000AA] px-2 py-1 text-white font-bold text-[11px]" colSpan={2}>
          TURNO: {section.shift === "Matutino" ? "MAT" : section.shift === "Vespertino" ? "VESP" : section.shift}
        </td>
        <td className="border border-[#0000AA] px-2 py-1 text-white font-bold text-[11px]" colSpan={3}>
          CUSTODIO: {section.driver}
        </td>
        <td className="border border-[#0000AA] px-2 py-1" colSpan={2}></td>
      </tr>

      {/* Header de columnas */}
      <tr className="bg-[#0000CC] text-white">
        <td className="border border-[#0000AA] px-2 py-0.5 text-[10px] font-bold text-center">#</td>
        <td className="border border-[#0000AA] px-2 py-0.5 text-[10px] font-bold">ALUMNO</td>
        <td className="border border-[#0000AA] px-2 py-0.5 text-[10px] font-bold text-center">Grado</td>
        <td className="border border-[#0000AA] px-2 py-0.5 text-[10px] font-bold text-center">Grupo</td>
        <td className="border border-[#0000AA] px-2 py-0.5 text-[10px] font-bold">TELEFONO 1</td>
        <td className="border border-[#0000AA] px-2 py-0.5 text-[10px] font-bold">TELEFONO 2</td>
        <td className="border border-[#0000AA] px-2 py-0.5 text-[10px] font-bold text-center">INGRESO</td>
        <td className="border border-[#0000AA] px-2 py-0.5 text-[10px] font-bold text-center">TARIFA</td>
        <td className="border border-[#0000AA] px-2 py-0.5 text-[10px] font-bold text-center">Inscripción</td>
        <td className="border border-[#0000AA] px-2 py-0.5 text-[10px] font-bold">Observaciones</td>
      </tr>

      {/* Filas numeradas (30 por sección como en Excel) */}
      {rows.map(({ rowNum, student }) => (
        <tr
          key={`${section.sectionNum}-${rowNum}`}
          className={`bg-white hover:bg-yellow-50 ${
            student?.status === "baja" ? "opacity-50" : ""
          }`}
        >
          <td className="border border-gray-300 px-2 py-0.5 text-center text-[10px] text-gray-500 w-[30px]">
            {rowNum}
          </td>
          {student ? (
            <>
              <td className="border border-gray-300 px-2 py-0.5 text-[11px]">
                <Link
                  href={`/cobros/${student.id}`}
                  className="hover:underline hover:text-blue-600"
                >
                  {student.name}
                </Link>
              </td>
              <td className="border border-gray-300 px-2 py-0.5 text-center text-[10px]">{student.grade}</td>
              <td className="border border-gray-300 px-2 py-0.5 text-center text-[10px]">{student.groupClass}</td>
              <td className="border border-gray-300 px-2 py-0.5 text-[10px]">{student.parentPhone}</td>
              <td className="border border-gray-300 px-2 py-0.5 text-[10px]">{student.parentPhone2}</td>
              <td className="border border-gray-300 px-2 py-0.5 text-center text-[10px]"></td>
              <td className="border border-gray-300 px-2 py-0.5 text-center text-[10px] font-medium">
                {student.weeklyRate}
              </td>
              <td className={`border border-gray-300 px-2 py-0.5 text-center text-[10px] font-bold ${
                student.inscriptionPaid ? "text-green-700 bg-[#C6EFCE]" : student.notes?.toLowerCase().includes("debe") ? "text-red-600" : ""
              }`}>
                {student.inscriptionPaid ? "PAGADA" : student.notes?.toLowerCase().includes("debe") ? student.notes : ""}
              </td>
              <td className="border border-gray-300 px-2 py-0.5 text-[10px] text-gray-500">{student.notes}</td>
            </>
          ) : (
            <>
              <td className="border border-gray-300 px-2 py-0.5"></td>
              <td className="border border-gray-300 px-2 py-0.5"></td>
              <td className="border border-gray-300 px-2 py-0.5"></td>
              <td className="border border-gray-300 px-2 py-0.5"></td>
              <td className="border border-gray-300 px-2 py-0.5"></td>
              <td className="border border-gray-300 px-2 py-0.5"></td>
              <td className="border border-gray-300 px-2 py-0.5"></td>
              <td className="border border-gray-300 px-2 py-0.5"></td>
              <td className="border border-gray-300 px-2 py-0.5"></td>
            </>
          )}
        </tr>
      ))}

      {/* Espacio entre secciones */}
      <tr className="h-2 bg-gray-100">
        <td colSpan={10}></td>
      </tr>
    </>
  );
}
