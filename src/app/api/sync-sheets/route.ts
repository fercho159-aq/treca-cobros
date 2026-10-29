import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { google } from "googleapis";

const SPREADSHEET_ID = "1VL0O5tMzNlfrlI9_KkqhHDY613DCOIZW";
const SHEET_TAB = "Fortaleza Listas";

const SHIFT_MAP: Record<string, string> = {
  MAT: "Matutino",
  VESP: "Vespertino",
  VES: "Vespertino",
};

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function cleanPhone(phone: string | number | undefined): string {
  return String(phone || "").replace(/\D/g, "").trim();
}

interface ParsedStudent {
  name: string;
  grade: string;
  group: string;
  parentPhone: string;
  parentPhone2: string;
  school: string;
  shift: string;
  driver: string;
  route: string;
  weeklyRate: number;
  inscriptionRate: number;
  notes: string;
}

function parseSheetTab(rows: string[][]): ParsedStudent[] {
  const students: ParsedStudent[] = [];
  let currentSection: {
    school: string;
    shift: string;
    driver: string;
    routeNumber: string;
  } | null = null;

  for (const row of rows) {
    while (row.length < 10) row.push("");

    // Detect metadata row (ESCUELA:)
    if (row.some((cell) => /ESCUELA\s*:/i.test(String(cell || "")))) {
      currentSection = { school: "", shift: "", driver: "", routeNumber: "" };
      for (const cell of row) {
        const val = String(cell || "").trim();
        if (/ESCUELA\s*:/i.test(val)) {
          currentSection.school = val.replace(/ESCUELA\s*:\s*/i, "").trim();
        }
        if (/TURNO\s*:/i.test(val)) {
          const raw = val.replace(/TURNO\s*:\s*/i, "").trim().toUpperCase();
          currentSection.shift = SHIFT_MAP[raw] || raw;
        }
        if (/CUSTODIO\s*:/i.test(val)) {
          currentSection.driver = val.replace(/CUSTODIO\s*:\s*/i, "").trim();
        }
      }
      const lastVal = String(row[9] || row[row.length - 1] || "").trim();
      if (/^\d+$/.test(lastVal)) {
        currentSection.routeNumber = lastVal;
      }
      continue;
    }

    // Skip header rows
    if (row.some((cell) => /ALUMNO/i.test(String(cell || "")))) continue;

    // Student row: col A = number, col B = name
    const num = String(row[0] || "").trim();
    const name = String(row[1] || "").trim();
    if (currentSection && /^\d+$/.test(num) && name.length > 0) {
      const tarifa = parseFloat(String(row[7] || "0").replace(/[^0-9.]/g, "")) || 350;
      const inscripcion = parseFloat(String(row[8] || "0").replace(/[^0-9.]/g, "")) || 300;

      students.push({
        name,
        grade: String(row[2] || "").trim(),
        group: String(row[3] || "").trim().toUpperCase(),
        parentPhone: cleanPhone(row[4]),
        parentPhone2: cleanPhone(row[5]),
        school: currentSection.school,
        shift: currentSection.shift,
        driver: currentSection.driver,
        route: currentSection.routeNumber
          ? `Fortaleza ${currentSection.routeNumber}`
          : `Fortaleza ${currentSection.school}`,
        weeklyRate: tarifa,
        inscriptionRate: inscripcion,
        notes: String(row[9] || "").trim(),
      });
    }
  }

  return students;
}

export async function POST() {
  try {
    // Get Google Sheets client
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    let authClient;

    if (serviceAccountKey) {
      const credentials = JSON.parse(serviceAccountKey);
      authClient = new google.auth.GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
      });
    } else {
      authClient = new google.auth.GoogleAuth({
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
      });
    }

    const sheets = google.sheets({ version: "v4", auth: authClient });

    // Read the sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_TAB}'!A:J`,
    });

    const rows = (response.data.values || []) as string[][];
    const parsedStudents = parseSheetTab(rows);

    if (parsedStudents.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No se encontraron alumnos en la hoja",
        created: 0,
        updated: 0,
      });
    }

    // Load existing students
    const existingSnap = await adminDb.collection("cobros_students").get();
    const existingMap = new Map<string, string>();
    existingSnap.forEach((doc) => {
      const name = normalizeName(doc.data().name || "");
      if (name) existingMap.set(name, doc.id);
    });

    let created = 0;
    let updated = 0;
    const batch = adminDb.batch();

    for (const student of parsedStudents) {
      const normalized = normalizeName(student.name);
      const existingId = existingMap.get(normalized);

      const serviceType = student.weeklyRate <= 250 ? "medio" : "completo";

      if (existingId) {
        // Update existing
        batch.update(adminDb.collection("cobros_students").doc(existingId), {
          school: student.school,
          driver: student.driver,
          weeklyRate: student.weeklyRate,
          parentPhone: student.parentPhone,
          grade: student.grade,
          group: student.group,
          serviceType,
          route: student.route,
          shift: student.shift,
        });
        updated++;
      } else {
        // Create new
        const ref = adminDb.collection("cobros_students").doc();
        batch.set(ref, {
          name: student.name,
          school: student.school,
          driver: student.driver,
          serviceType,
          weeklyRate: student.weeklyRate,
          inscriptionPaid: false,
          startWeek: 1,
          status: "activo",
          parentPhone: student.parentPhone,
          parentPhone2: student.parentPhone2,
          group: "Fortaleza",
          grade: student.grade,
          groupClass: student.group,
          route: student.route,
          shift: student.shift,
          createdAt: new Date(),
        });
        created++;
      }
    }

    await batch.commit();

    return NextResponse.json({
      success: true,
      message: `Sincronización completada`,
      total: parsedStudents.length,
      created,
      updated,
    });
  } catch (error: unknown) {
    console.error("Sync error:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
