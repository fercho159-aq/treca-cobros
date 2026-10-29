const XLSX = require('xlsx');
const fs = require('fs');

const wb = XLSX.readFile('/Users/aldotrejo/Downloads/Registro_Consolidado (1) (1).xlsx');
const ws = wb.Sheets['Cuentas General Fortaleza'];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

const weeks = [];
let i = 0;

while (i < rows.length) {
  const r = rows[i].map(c => String(c || '').trim());

  // Find week number (solo un número en col A, nada más)
  if (/^\d+$/.test(r[0]) && !r[1] && !r[2] && !r[3]) {
    const weekNum = parseInt(r[0]);
    i++; // skip to NOMBRE header

    // Skip NOMBRE header row
    if (i < rows.length) {
      const headerRow = rows[i].map(c => String(c || '').trim());
      if (headerRow[0] === 'NOMBRE') i++;
    }

    const week = {
      semana: weekNum,
      custodios: [],
      totales_row: null,
      dividendo_socios_4: null,
      porcentaje_20: null,
      socios_table: [],
      inscripciones: [],
      inscripciones_total: null,
      para_daniel: null,
      para_socios: null,
    };

    // Parse custodios rows until we hit the totals row (no name in col 0 but numbers in col 4+)
    while (i < rows.length) {
      const cr = rows[i].map(c => String(c || '').trim());

      // Totales row: no name/school but has TOTAL INGRESOS in col 4
      if (!cr[0] && !cr[1] && !cr[2] && !cr[3] && cr[4]) {
        week.totales_row = {
          totalIngresos: parseFloat(cr[4]) || 0,
          gasolina: parseFloat(cr[5]) || 0,
          otrosGastos: parseFloat(cr[6]) || 0,
          totalGastos: parseFloat(cr[7]) || 0,
          totalNeto: parseFloat(cr[8]) || 0,
          dividendos: parseFloat(cr[9]) || 0,
        };
        i++;
        break;
      }

      // Sub-school row (no name in col 0, school name in col 1)
      if (!cr[0] && cr[1] && cr[2]) {
        if (week.custodios.length > 0) {
          const last = week.custodios[week.custodios.length - 1];
          last.sub_escuelas.push({ escuela: cr[1], ingreso: parseFloat(cr[2]) || 0 });
        }
        i++;
        continue;
      }

      // Main custodio row
      if (cr[0] && cr[1]) {
        week.custodios.push({
          nombre: cr[0],
          escuela: cr[1],
          ingreso: parseFloat(cr[2]) || 0,
          otrosIngresos: parseFloat(cr[3]) || 0,
          totalIngresos: parseFloat(cr[4]) || 0,
          gasolina: parseFloat(cr[5]) || 0,
          otrosGastos: parseFloat(cr[6]) || 0,
          totalGastos: parseFloat(cr[7]) || 0,
          totalNeto: parseFloat(cr[8]) || 0,
          dividendos: parseFloat(cr[9]) || 0,
          extra: cr[10] || '',
          sub_escuelas: [],
        });
        i++;
        continue;
      }

      i++;
      // If we've gone too far with empty rows, break
      if (!cr.some(c => c)) { continue; }
    }

    // Parse DIVIDENDO SOCIOS (4) and 0.2 row
    while (i < rows.length) {
      const cr = rows[i].map(c => String(c || '').trim());

      if (cr[0] && cr[0].includes('DIVIENDO SOCIOS')) {
        week.dividendo_socios_4 = { label: cr[0], monto: parseFloat(cr[1]) || 0 };
        i++;
        continue;
      }

      if (cr[0] === '0.2') {
        week.porcentaje_20 = { label: '20%', monto: parseFloat(cr[1]) || 0 };
        i++;
        // Now comes socios distribution header (RECIBE, COBRO, AHORRO, TOTAL, GASOLINA, TOTAL)
        continue;
      }

      // Socios distribution rows
      if (cr[0] && (cr[0].includes('DIVIENDO 4') || cr[0].includes('DIVIDENDO'))) {
        week.socios_table.push({
          label: cr[0],
          monto: parseFloat(cr[1]) || 0,
          socio: cr[4] || '',
          recibe: parseFloat(cr[5]) || 0,
          cobro: parseFloat(cr[6]) || 0,
          ahorro: parseFloat(cr[7]) || 0,
          total: parseFloat(cr[8]) || 0,
          gasolina: parseFloat(cr[9]) || 0,
          totalFinal: parseFloat(cr[10]) || 0,
        });
        i++;
        continue;
      }

      // Rows that only have data from col 4+ (continuation of socios table)
      if (!cr[0] && !cr[1] && !cr[2] && !cr[3] && cr[4]) {
        week.socios_table.push({
          label: '',
          monto: 0,
          socio: cr[4] || '',
          recibe: parseFloat(cr[5]) || 0,
          cobro: parseFloat(cr[6]) || 0,
          ahorro: parseFloat(cr[7]) || 0,
          total: parseFloat(cr[8]) || 0,
          gasolina: parseFloat(cr[9]) || 0,
          totalFinal: parseFloat(cr[10]) || 0,
        });
        i++;
        continue;
      }

      // INSCRIPCIONES section
      if (cr[0] === 'INSCRIPCIONES') {
        i++;
        continue;
      }

      // Inscription rows (DANIEL, EDUARDO, etc.)
      if (cr[0] && (cr[0].includes('DANIEL') || cr[0].includes('EDUARDO') || cr[0].includes('FERNANDO') || cr[0].includes('OSCAR'))) {
        week.inscripciones.push({
          custodio: cr[0],
          monto: parseFloat(cr[1]) || 0,
          para_daniel: cr[2] || '',
          para_socios: cr[3] || '',
        });
        i++;
        continue;
      }

      // TOTAL row for inscriptions
      if (cr[0] === 'TOTAL') {
        week.inscripciones_total = {
          total: parseFloat(cr[1]) || 0,
          para_daniel: parseFloat(cr[2]) || 0,
          para_socios: parseFloat(cr[3]) || 0,
        };
        i++;
        break; // End of this week
      }

      i++;
      // Safety: if we've gone more than 5 empty rows, break
    }

    weeks.push(week);
  } else {
    i++;
  }
}

console.log(`Extracted ${weeks.length} weeks`);
weeks.forEach(w => {
  console.log(`  Semana ${w.semana}: ${w.custodios.length} custodios, total: ${w.totales_row?.totalIngresos || 0}, ${w.socios_table.length} socios rows, ${w.inscripciones.length} inscripciones`);
});

// Save
const existingData = JSON.parse(fs.readFileSync('public/fortaleza_data.json', 'utf-8'));
existingData.cuentas_general_fortaleza = weeks;
fs.writeFileSync('public/fortaleza_data.json', JSON.stringify(existingData, null, 2));
console.log('Updated public/fortaleza_data.json');
