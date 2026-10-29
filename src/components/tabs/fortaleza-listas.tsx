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
        <thead className="sticky top-0 z-20">
          <tr className="bg-[#0000CC] text-white">
            <th className="border border-[#0000AA] px-2 py-1.5 text-left min-w-[30px]">#</th>
            <th className="border border-[#0000AA] px-2 py-1.5 text-left min-w-[200px]">ALUMNO</th>
            <th className="border border-[#0000AA] px-2 py-1.5 text-center min-w-[50px]">Grado</th>
            <th className="border border-[#0000AA] px-2 py-1.5 text-center min-w-[50px]">Grupo</th>
            <th className="border border-[#0000AA] px-2 py-1.5 text-left min-w-[110px]">TELEFONO 1</th>
            <th className="border border-[#0000AA] px-2 py-1.5 text-left min-w-[110px]">TELEFONO 2</th>
            <th className="border border-[#0000AA] px-2 py-1.5 text-center min-w-[60px]">INGRESO</th>
            <th className="border border-[#0000AA] px-2 py-1.5 text-center min-w-[60px]">TARIFA</th>
            <th className="border border-[#0000AA] px-2 py-1.5 text-center min-w-[90px]">Inscripcion</th>
            <th className="border border-[#0000AA] px-2 py-1.5 text-left min-w-[150px]">Observaciones</th>
          </tr>
        </thead>
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

function SectionRows({ section }: { section: Section }) {
  return (
    <>
      {/* Header de sección como en Excel */}
      <tr className="bg-[#D9E2F3]">
        <td className="border border-gray-300 px-2 py-1 font-bold text-[11px]" colSpan={10}>
          <span className="text-blue-800">ESCUELA:</span> {section.school}
          <span className="mx-4 text-blue-800">TURNO:</span> {section.shift}
          <span className="mx-4 text-blue-800">CUSTODIO:</span> {section.driver}
        </td>
      </tr>

      {section.students.map((student, idx) => (
        <tr
          key={student.id}
          className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-yellow-50 ${
            student.status === "baja" ? "opacity-50 line-through" : ""
          }`}
        >
          <td className="border border-gray-300 px-2 py-1 text-center text-gray-500">
            {student.numInSection}
          </td>
          <td className="border border-gray-300 px-2 py-1">
            <Link
              href={`/cobros/${student.id}`}
              className="hover:underline hover:text-blue-600"
            >
              {student.name}
            </Link>
          </td>
          <td className="border border-gray-300 px-2 py-1 text-center">{student.grade}</td>
          <td className="border border-gray-300 px-2 py-1 text-center">{student.groupClass}</td>
          <td className="border border-gray-300 px-2 py-1">{student.parentPhone}</td>
          <td className="border border-gray-300 px-2 py-1">{student.parentPhone2}</td>
          <td className="border border-gray-300 px-2 py-1 text-center"></td>
          <td className="border border-gray-300 px-2 py-1 text-center font-medium">
            {student.weeklyRate}
          </td>
          <td className={`border border-gray-300 px-2 py-1 text-center font-medium ${
            student.inscriptionPaid ? "text-green-700 bg-[#C6EFCE]" : "text-red-600"
          }`}>
            {student.inscriptionPaid ? "PAGADA" : ""}
          </td>
          <td className="border border-gray-300 px-2 py-1 text-gray-500">{student.notes}</td>
        </tr>
      ))}
    </>
  );
}
