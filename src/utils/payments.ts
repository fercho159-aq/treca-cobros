export interface Student {
  id: string;
  name: string;
  school: string;
  driver: string;
  serviceType: "completo" | "medio";
  weeklyRate: number;
  inscriptionPaid: boolean;
  startWeek: number;
  status: "activo" | "baja";
  parentPhone?: string;
  group: string;
}

export interface Payment {
  id: string;
  studentId: string;
  amount: number;
  weekNumber: number; // 0 = inscripción, 1-42 = semanas
  status: "pagado" | "no_aplica" | "cortesia";
  paymentMethod: "efectivo" | "transferencia";
  transferReference?: string;
  timestamp: Date;
  notes?: string;
}

export interface CellStatus {
  label: string;
  color: string;
  bg: string;
  paid: number;
}

/**
 * Algoritmo Waterfall: acumula todos los pagos de un alumno
 * y los va asignando semana por semana en orden.
 */
export function getWeekStatus(
  student: Student,
  weekIndex: number, // 0 = inscripción, 1-42
  payments: Payment[],
  totalWeeks: number = 42
): CellStatus {
  const studentPayments = payments.filter((p) => p.studentId === student.id);

  // Inscripción (week 0)
  if (weekIndex === 0) {
    const inscPayment = studentPayments.find((p) => p.weekNumber === 0);
    if (inscPayment) {
      return { label: "✓", color: "#16a34a", bg: "#dcfce7", paid: inscPayment.amount };
    }
    return { label: "$300", color: "#475569", bg: "transparent", paid: 0 };
  }

  // Si la semana es antes del inicio del alumno
  if (student.startWeek && weekIndex < student.startWeek) {
    return { label: "N/A", color: "#94a3b8", bg: "#f1f5f9", paid: 0 };
  }

  // Checar si tiene estatus especial para esta semana
  const specificPayment = studentPayments.find((p) => p.weekNumber === weekIndex);
  if (specificPayment) {
    if (specificPayment.status === "cortesia") {
      return { label: "Cortesía", color: "#7c3aed", bg: "#ede9fe", paid: 0 };
    }
    if (specificPayment.status === "no_aplica") {
      return { label: "N", color: "#64748b", bg: "#e2e8f0", paid: 0 };
    }
  }

  // Waterfall: construir pool de pagos y asignar semana por semana
  const startWk = student.startWeek || 1;
  const activeWeeks: number[] = [];
  for (let w = startWk; w <= totalWeeks; w++) {
    const spec = studentPayments.find((p) => p.weekNumber === w);
    if (spec && (spec.status === "cortesia" || spec.status === "no_aplica")) {
      continue;
    }
    activeWeeks.push(w);
  }

  // Total de pagos en efectivo/transferencia (excluyendo inscripción y estatus especiales)
  const totalCashPaid = studentPayments
    .filter(
      (p) =>
        p.weekNumber !== 0 &&
        p.status === "pagado"
    )
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  let remainingCash = totalCashPaid;
  const cost = student.weeklyRate;

  for (const w of activeWeeks) {
    if (w === weekIndex) {
      if (remainingCash >= cost) {
        return { label: "Pagado", color: "#16a34a", bg: "#dcfce7", paid: cost };
      } else if (remainingCash > 0) {
        return {
          label: `Abono $${remainingCash}`,
          color: "#ea580c",
          bg: "#ffedd5",
          paid: remainingCash,
        };
      } else {
        return { label: `$${cost}`, color: "#475569", bg: "transparent", paid: 0 };
      }
    }
    remainingCash = Math.max(0, remainingCash - cost);
  }

  return { label: `$${cost}`, color: "#475569", bg: "transparent", paid: 0 };
}

/**
 * Calcula el total pagado, total adeudado y % de cobranza para un conjunto de alumnos
 */
export function calculateSummary(
  students: Student[],
  payments: Payment[],
  currentWeek: number
) {
  let totalPaid = 0;
  let totalOwed = 0;

  for (const student of students) {
    if (student.status === "baja") continue;
    const startWk = student.startWeek || 1;

    for (let w = startWk; w <= currentWeek; w++) {
      const status = getWeekStatus(student, w, payments);
      if (status.label === "Pagado") {
        totalPaid += student.weeklyRate;
      } else if (status.label.startsWith("Abono")) {
        totalPaid += status.paid;
        totalOwed += student.weeklyRate - status.paid;
      } else if (status.label.startsWith("$")) {
        totalOwed += student.weeklyRate;
      }
    }
  }

  const collectionRate = totalPaid + totalOwed > 0
    ? Math.round((totalPaid / (totalPaid + totalOwed)) * 100)
    : 100;

  return { totalPaid, totalOwed, collectionRate };
}
