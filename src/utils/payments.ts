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
 * Suma lo que se pagó exactamente en una semana (como en el Excel:
 * cada celda muestra lo cobrado esa semana, sin repartir pagos dobles).
 */
export function getPaidInWeek(studentPayments: Payment[], weekIndex: number): number {
  return studentPayments
    .filter((p) => p.weekNumber === weekIndex && p.status === "pagado")
    .reduce((sum, p) => sum + (p.amount || 0), 0);
}

export function getWeekStatus(
  student: Student,
  weekIndex: number, // 0 = inscripción, 1-42
  payments: Payment[]
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

  const cost = student.weeklyRate;
  const paid = getPaidInWeek(studentPayments, weekIndex);

  if (paid >= cost && paid > 0) {
    return { label: "Pagado", color: "#16a34a", bg: "#dcfce7", paid };
  }
  if (paid > 0) {
    return { label: `Abono $${paid}`, color: "#ea580c", bg: "#ffedd5", paid };
  }

  // Checar si tiene estatus especial para esta semana
  const specificPayment = studentPayments.find((p) => p.weekNumber === weekIndex);
  if (specificPayment?.status === "cortesia") {
    return { label: "Cortesía", color: "#7c3aed", bg: "#ede9fe", paid: 0 };
  }
  if (specificPayment?.status === "no_aplica") {
    return { label: "N", color: "#64748b", bg: "#e2e8f0", paid: 0 };
  }

  return { label: `$${cost}`, color: "#475569", bg: "transparent", paid: 0 };
}

/**
 * Saldo de un alumno hasta una semana: lo que debía pagar (tarifa por cada
 * semana que aplica) contra lo que realmente pagó en esas semanas.
 * Un pago doble en la semana 8 cubre la deuda de la semana 7.
 */
export function getStudentBalance(
  student: Student,
  payments: Payment[],
  upToWeek: number
) {
  const studentPayments = payments.filter((p) => p.studentId === student.id);
  const startWk = student.startWeek || 1;
  let expected = 0;
  let paid = 0;

  for (let w = startWk; w <= upToWeek; w++) {
    const weekPaid = getPaidInWeek(studentPayments, w);
    paid += weekPaid;
    if (weekPaid > 0) {
      expected += student.weeklyRate;
      continue;
    }
    const spec = studentPayments.find((p) => p.weekNumber === w);
    if (spec && (spec.status === "cortesia" || spec.status === "no_aplica")) continue;
    expected += student.weeklyRate;
  }

  return { paid, owed: Math.max(0, expected - paid), credit: Math.max(0, paid - expected) };
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
    const balance = getStudentBalance(student, payments, currentWeek);
    totalPaid += balance.paid;
    totalOwed += balance.owed;
  }

  const collectionRate = totalPaid + totalOwed > 0
    ? Math.round((totalPaid / (totalPaid + totalOwed)) * 100)
    : 100;

  return { totalPaid, totalOwed, collectionRate };
}
