export interface SchoolWeek {
  week: number;
  startDate: Date;
  endDate: Date;
  isVacation?: boolean;
}

const ONE_DAY = 24 * 60 * 60 * 1000;

export function getSchoolWeeks(): SchoolWeek[] {
  // Semana 1: August 31, 2026 (Ciclo Escolar SEP 2026-2027)
  const week1Start = new Date("2026-08-31T00:00:00");

  // Vacaciones de invierno
  const xmasStart = new Date("2026-12-21T00:00:00");
  const xmasEnd = new Date("2027-01-02T23:59:59");

  // Vacaciones Semana Santa
  const easterStart = new Date("2027-03-22T00:00:00");
  const easterEnd = new Date("2027-04-02T23:59:59");

  const weeks: SchoolWeek[] = [];
  let currentStart = week1Start;

  for (let i = 1; i <= 42; i++) {
    // Saltar semanas de vacaciones
    while (
      (currentStart >= xmasStart && currentStart <= xmasEnd) ||
      (currentStart >= easterStart && currentStart <= easterEnd)
    ) {
      currentStart = new Date(currentStart.getTime() + 7 * ONE_DAY);
    }

    weeks.push({
      week: i,
      startDate: new Date(currentStart),
      endDate: new Date(currentStart.getTime() + 4 * ONE_DAY), // Lun a Vie
    });

    currentStart = new Date(currentStart.getTime() + 7 * ONE_DAY);
  }

  return weeks;
}

export function getCurrentWeek(): number {
  const weeks = getSchoolWeeks();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const w of weeks) {
    if (today >= w.startDate && today <= w.endDate) {
      return w.week;
    }
  }

  let lastPassed = 0;
  for (const w of weeks) {
    if (today > w.endDate) {
      lastPassed = w.week;
    }
  }
  return lastPassed || 1;
}

export function formatWeekDate(date: Date): string {
  return date
    .toLocaleDateString("es-MX", { day: "2-digit", month: "short" })
    .replace(".", "");
}

export function getWeekLabel(weekNumber: number): string {
  const weeks = getSchoolWeeks();
  const week = weeks.find((w) => w.week === weekNumber);
  if (!week) return `Sem ${weekNumber}`;

  const s = formatWeekDate(week.startDate);
  const e = formatWeekDate(week.endDate);
  return `${s} - ${e}`;
}
