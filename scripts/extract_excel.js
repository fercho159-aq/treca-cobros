const XLSX = require('xlsx');
const fs = require('fs');

const wb = XLSX.readFile('/Users/aldotrejo/Downloads/Registro_Consolidado (1) (1).xlsx');
const SHIFT_MAP = { MAT: 'Matutino', VESP: 'Vespertino', VES: 'Vespertino' };

// ==========================================
// 1. FORTALEZA LISTAS
// ==========================================
const ws1 = wb.Sheets['Fortaleza Listas'];
const rows1 = XLSX.utils.sheet_to_json(ws1, { header: 1, defval: '' });

const fortalezaListas = [];
let currentSection = null;
let sectionNum = 0;

for (const row of rows1) {
  const r = row.map(c => String(c || '').trim());

  if (r.some(c => /ESCUELA\s*:/i.test(c))) {
    sectionNum++;
    currentSection = { section_num: sectionNum, escuela: '', turno: '', custodio: '', students: [] };
    for (const cell of r) {
      if (/ESCUELA\s*:/i.test(cell)) currentSection.escuela = cell.replace(/ESCUELA\s*:\s*/i, '').trim();
      if (/TURNO\s*:/i.test(cell)) {
        const raw = cell.replace(/TURNO\s*:\s*/i, '').trim().toUpperCase();
        currentSection.turno = SHIFT_MAP[raw] || raw;
      }
      if (/CUSTODIO\s*:/i.test(cell)) currentSection.custodio = cell.replace(/CUSTODIO\s*:\s*/i, '').trim();
    }
    fortalezaListas.push(currentSection);
    continue;
  }

  if (r.some(c => /^ALUMNO$/i.test(c))) continue;

  const num = String(row[0] || '').trim();
  const name = String(row[1] || '').trim();
  if (currentSection && /^\d+$/.test(num) && name.length > 1) {
    currentSection.students.push({
      num: parseInt(num),
      nombre: name,
      grado: String(row[2] || '').trim(),
      grupo: String(row[3] || '').trim().toUpperCase(),
      tel1: String(row[4] || '').replace(/\s/g, ''),
      tel2: String(row[5] || '').replace(/\s/g, ''),
      ingreso: String(row[6] || '').trim(),
      tarifa: parseFloat(String(row[7] || '0').replace(/[^0-9.]/g, '')) || 0,
      inscripcion: String(row[8] || '').trim(),
      observaciones: String(row[9] || '').trim(),
    });
  }
}

// ==========================================
// 2. PAGO SEMANAL - FORTALEZA
// ==========================================
const ws2 = wb.Sheets['Pago semanal - Fortaleza'];
const rows2 = XLSX.utils.sheet_to_json(ws2, { header: 1, defval: '' });

const WEEK_START_COL = 9;

const pagoSections = [];
let currentPaySection = null;
let paySectionNum = 0;
let lastTurno = 'Matutino';

for (let i = 0; i < rows2.length; i++) {
  const row = rows2[i];
  const r = row.map(c => String(c || '').trim());

  // Turno header
  if (r.some(c => /^MATUTINO$/i.test(c))) { lastTurno = 'Matutino'; continue; }
  if (r.some(c => /^VESPERTINO$/i.test(c))) { lastTurno = 'Vespertino'; continue; }

  // Section header (ESCUELA:)
  if (r.some(c => /ESCUELA\s*:/i.test(c))) {
    paySectionNum++;
    currentPaySection = { section_num: paySectionNum, escuela: '', turno: lastTurno, custodio: '', students: [] };
    for (const cell of r) {
      if (/ESCUELA\s*:/i.test(cell)) currentPaySection.escuela = cell.replace(/ESCUELA\s*:\s*/i, '').trim();
      if (/CUSTODIO\s*:/i.test(cell)) currentPaySection.custodio = cell.replace(/CUSTODIO\s*:\s*/i, '').trim();
    }
    pagoSections.push(currentPaySection);
    continue;
  }

  // Column header row
  if (r.some(c => /^ALUMNO$/i.test(c) || /^#$/.test(c))) continue;

  // Student data row
  const name = String(row[1] || '').trim();
  if (currentPaySection && name.length > 1) {
    const student = {
      num: String(row[0] || '').trim(),
      nombre: name,
      tel1: String(row[2] || '').replace(/\s/g, ''),
      tel2: String(row[3] || '').replace(/\s/g, ''),
      inscripcion: String(row[4] || '').trim(),
      tarifa: String(row[5] || '').trim(),
      abono1: String(row[6] || '').trim(),
      abono2: String(row[7] || '').trim(),
      abono3: String(row[8] || '').trim(),
      pagos_semanales: {},
    };

    for (let w = 1; w <= 42; w++) {
      const colIdx = WEEK_START_COL + (w - 1);
      const val = String(row[colIdx] || '').trim();
      if (val && val !== '0') {
        student.pagos_semanales[w] = val;
      }
    }

    currentPaySection.students.push(student);
  }
}

// ==========================================
// 3. WEEK LABELS
// ==========================================
const weekLabels = {};
for (const row of rows2) {
  const r = row.map(c => String(c || '').trim());
  if (r.some(c => /^ALUMNO$/i.test(c))) {
    for (let w = 1; w <= 42; w++) {
      const colIdx = WEEK_START_COL + (w - 1);
      const raw = String(row[colIdx] || '').trim();
      const parts = raw.split('\n');
      weekLabels[w] = parts.length > 1 ? parts.slice(1).join(' ').trim() : raw;
    }
    break;
  }
}

let totalListas = 0;
fortalezaListas.forEach(s => totalListas += s.students.length);
let totalPagos = 0;
pagoSections.forEach(s => totalPagos += s.students.length);

console.log('Fortaleza Listas:', fortalezaListas.length, 'sections,', totalListas, 'students');
console.log('Pago Semanal:', pagoSections.length, 'sections,', totalPagos, 'students');

pagoSections.forEach((s, i) => {
  console.log(`  Pay Section ${i+1}: ${s.escuela} / ${s.turno} / ${s.custodio} - ${s.students.length} students`);
});

// Sample
const sample = pagoSections[0]?.students[0];
if (sample) {
  console.log('\nSample:', sample.nombre);
  console.log('Inscripcion:', sample.inscripcion, 'Tarifa:', sample.tarifa);
  console.log('Pagos:', JSON.stringify(sample.pagos_semanales));
}

// ==========================================
// 3b. CUENTAS GENERAL FORTALEZA
// ==========================================
const ws3 = wb.Sheets['Cuentas General Fortaleza'];
const rows3 = XLSX.utils.sheet_to_json(ws3, { header: 1, defval: '' });

const cuentasGeneral = [];
let currentWeekData = null;

for (let i = 0; i < rows3.length; i++) {
  const row = rows3[i];
  const r = row.map(c => String(c || '').trim());

  // Week number (solo un número en col A)
  if (/^\d+$/.test(r[0]) && !r[1] && !r[2]) {
    currentWeekData = { semana: parseInt(r[0]), custodios: [], inscripciones: [], dividendos: {}, totales: {} };
    cuentasGeneral.push(currentWeekData);
    continue;
  }

  // Header row - skip
  if (r[0] === 'NOMBRE' && r[1] === 'ESCUELA') continue;

  if (!currentWeekData) continue;

  // Custodio row (has NOMBRE in col 0 and ESCUELA in col 1 with numbers)
  if (r[0] && r[1] && !r[0].startsWith('TOTAL') && !r[0].startsWith('DIVIE') && !r[0].startsWith('INSCRI') && !r[0].startsWith('0.')) {
    // Check if it's a sub-school row (no name in col 0 but school in col 1)
    if (!r[0] && r[1]) {
      // Sub-school of last custodio
      if (currentWeekData.custodios.length > 0) {
        const last = currentWeekData.custodios[currentWeekData.custodios.length - 1];
        last.sub_escuelas = last.sub_escuelas || [];
        last.sub_escuelas.push({ escuela: r[1], ingreso: parseFloat(r[2]) || 0 });
      }
      continue;
    }

    const ingreso = parseFloat(r[2]) || 0;
    const otrosIngresos = parseFloat(r[3]) || 0;
    const totalIngresos = parseFloat(r[4]) || 0;
    const gasolina = parseFloat(r[5]) || 0;
    const otrosGastos = parseFloat(r[6]) || 0;
    const totalGastos = parseFloat(r[7]) || 0;
    const totalNeto = parseFloat(r[8]) || 0;
    const dividendos = parseFloat(r[9]) || 0;

    currentWeekData.custodios.push({
      nombre: r[0],
      escuela: r[1],
      ingreso, otrosIngresos, totalIngresos, gasolina, otrosGastos, totalGastos, totalNeto, dividendos,
      sub_escuelas: [],
    });
    continue;
  }

  // TOTAL row
  if (r[0] === 'TOTAL' || (r[4] && !r[0] && !r[1] && !r[2] && !r[3])) {
    if (parseFloat(r[4])) {
      currentWeekData.totales = {
        totalIngresos: parseFloat(r[4]) || 0,
        gasolina: parseFloat(r[5]) || 0,
        otrosGastos: parseFloat(r[6]) || 0,
        totalGastos: parseFloat(r[7]) || 0,
        totalNeto: parseFloat(r[8]) || 0,
      };
    }
    continue;
  }

  // INSCRIPCIONES section
  if (r[0] === 'INSCRIPCIONES') continue;
  if (r[0] && r[1] && r[0] !== 'TOTAL' && currentWeekData.custodios.length > 0) {
    // Could be inscription row
    const monto = parseFloat(r[1]);
    if (!isNaN(monto) && (r[0].includes('DANIEL') || r[0].includes('EDUARDO') || r[0].includes('FERNANDO') || r[0].includes('OSCAR'))) {
      currentWeekData.inscripciones.push({ custodio: r[0], monto });
    }
  }
}

console.log('Cuentas General:', cuentasGeneral.length, 'weeks');
cuentasGeneral.forEach(w => {
  console.log(`  Semana ${w.semana}: ${w.custodios.length} custodios, total ingresos: ${w.totales.totalIngresos || 0}`);
});

// Cross-reference turnos from listas to pago sections
for (const paySection of pagoSections) {
  const matchingLista = fortalezaListas.find(
    l => l.escuela === paySection.escuela && l.custodio === paySection.custodio && l.section_num === paySection.section_num
  );
  if (matchingLista && matchingLista.turno) {
    paySection.turno = matchingLista.turno;
  }
}

const output = {
  fortaleza_listas: fortalezaListas,
  pago_semanal_fortaleza: pagoSections,
  cuentas_general_fortaleza: cuentasGeneral,
  week_labels: weekLabels,
};

fs.writeFileSync('/Users/aldotrejo/treca-cobros/public/fortaleza_data.json', JSON.stringify(output, null, 2));
console.log('\nSaved to public/fortaleza_data.json');
