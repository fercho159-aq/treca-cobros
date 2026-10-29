const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, Timestamp } = require('firebase/firestore');
const fs = require('fs');

const firebaseConfig = {
  apiKey: "AIzaSyCJJZeYQPdeDAVu3kfGqb639QLcRQjMMWY",
  authDomain: "treca-d1169.firebaseapp.com",
  projectId: "treca-d1169",
  storageBucket: "treca-d1169.firebasestorage.app",
  messagingSenderId: "720685033715",
  appId: "1:720685033715:web:d2f78b5ce65538a5aa6f86",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const SHIFT_MAP = { MAT: 'Matutino', VESP: 'Vespertino', VES: 'Vespertino' };

function normalizeName(name) {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

async function seed() {
  const data = JSON.parse(fs.readFileSync('public/fortaleza_data.json', 'utf-8'));
  const studentIdMap = new Map(); // normalized name -> docId

  // 1. Load students from fortaleza_listas
  console.log('--- Cargando alumnos ---');
  let studentCount = 0;
  for (const section of data.fortaleza_listas) {
    for (const student of section.students) {
      const normalized = normalizeName(student.nombre);
      const docId = `fortaleza_${section.section_num}_${String(student.num).padStart(3, '0')}`;

      const inscPaid = (student.inscripcion || '').toUpperCase().includes('PAG') ||
                       (student.inscripcion || '').toUpperCase().includes('PADAGA');
      const tarifa = student.tarifa || 350;
      const serviceType = tarifa <= 250 ? 'medio' : 'completo';

      await setDoc(doc(db, 'cobros_students', docId), {
        name: student.nombre,
        school: section.escuela,
        shift: section.turno,
        driver: section.custodio,
        serviceType,
        weeklyRate: tarifa,
        inscriptionPaid: inscPaid,
        startWeek: 1,
        status: 'activo',
        parentPhone: (student.tel1 || '').replace(/\D/g, ''),
        parentPhone2: (student.tel2 || '').replace(/\D/g, ''),
        group: 'Fortaleza',
        grade: student.grado || '',
        groupClass: (student.grupo || '').toUpperCase(),
        sectionNum: section.section_num,
        numInSection: student.num,
        notes: student.observaciones || '',
        inscripcionText: student.inscripcion || '',
      });

      studentIdMap.set(normalized, docId);
      studentCount++;
      if (studentCount % 20 === 0) process.stdout.write(`  ${studentCount} alumnos...\r`);
    }
  }
  console.log(`  ${studentCount} alumnos cargados`);

  // 2. Load payments from pago_semanal_fortaleza
  console.log('--- Cargando pagos ---');
  let paymentCount = 0;
  let extras = 0;

  for (const section of data.pago_semanal_fortaleza) {
    for (const student of section.students) {
      const normalized = normalizeName(student.nombre);
      let studentId = studentIdMap.get(normalized);

      // Fuzzy match
      if (!studentId) {
        for (const [key, id] of studentIdMap.entries()) {
          if (key.includes(normalized) || normalized.includes(key)) {
            studentId = id;
            break;
          }
        }
      }

      // Create new if not found
      if (!studentId) {
        studentId = `fortaleza_${section.section_num}_x_${String(extras++).padStart(3, '0')}`;
        const tarifa = parseInt(student.tarifa) || 350;
        await setDoc(doc(db, 'cobros_students', studentId), {
          name: student.nombre,
          school: section.escuela,
          shift: section.turno || 'Matutino',
          driver: section.custodio,
          serviceType: tarifa <= 250 ? 'medio' : 'completo',
          weeklyRate: tarifa,
          inscriptionPaid: false,
          startWeek: 1,
          status: 'activo',
          parentPhone: (student.tel1 || '').replace(/\D/g, ''),
          parentPhone2: (student.tel2 || '').replace(/\D/g, ''),
          group: 'Fortaleza',
          grade: '',
          groupClass: '',
          sectionNum: section.section_num,
          numInSection: parseInt(student.num) || 0,
          notes: 'Agregado desde pagos',
        });
        studentIdMap.set(normalized, studentId);
        console.log(`  Extra: ${student.nombre}`);
      }

      // Inscription
      const insVal = (student.inscripcion || '').trim();
      if (insVal && insVal !== '0' && insVal !== '') {
        const insAmount = parseInt(insVal) || 300;
        if (insAmount > 0) {
          await setDoc(doc(db, 'cobros_payments', `${studentId}_ins`), {
            studentId,
            amount: insAmount,
            weekNumber: 0,
            status: 'pagado',
            paymentMethod: 'efectivo',
            timestamp: Timestamp.now(),
            notes: 'Inscripción',
          });
          paymentCount++;

          // Also mark inscriptionPaid on student
          await setDoc(doc(db, 'cobros_students', studentId), { inscriptionPaid: true }, { merge: true });
        }
      }

      // Weekly payments
      for (const [weekStr, value] of Object.entries(student.pagos_semanales)) {
        const weekNum = parseInt(weekStr);
        const val = String(value || '').trim();
        if (!val || val.startsWith('-')) continue;

        const payDocId = `${studentId}_w${weekNum}`;
        const numVal = parseFloat(val);

        if (!isNaN(numVal) && numVal > 0) {
          await setDoc(doc(db, 'cobros_payments', payDocId), {
            studentId,
            amount: numVal,
            weekNumber: weekNum,
            status: 'pagado',
            paymentMethod: 'efectivo',
            timestamp: Timestamp.now(),
            notes: 'Importado de Excel',
          });
          paymentCount++;
        } else if (val.toUpperCase() === 'N') {
          await setDoc(doc(db, 'cobros_payments', payDocId), {
            studentId,
            amount: 0,
            weekNumber: weekNum,
            status: 'no_aplica',
            paymentMethod: 'efectivo',
            timestamp: Timestamp.now(),
            notes: 'N - No asistió',
          });
          paymentCount++;
        } else if (val.toUpperCase().includes('CORTESIA')) {
          await setDoc(doc(db, 'cobros_payments', payDocId), {
            studentId,
            amount: 0,
            weekNumber: weekNum,
            status: 'cortesia',
            paymentMethod: 'efectivo',
            timestamp: Timestamp.now(),
            notes: val,
          });
          paymentCount++;
        } else if (val.toUpperCase() === 'BAJA' || val.toUpperCase() === 'BJ') {
          await setDoc(doc(db, 'cobros_students', studentId), { status: 'baja' }, { merge: true });
          await setDoc(doc(db, 'cobros_payments', payDocId), {
            studentId,
            amount: 0,
            weekNumber: weekNum,
            status: 'no_aplica',
            paymentMethod: 'efectivo',
            timestamp: Timestamp.now(),
            notes: 'BAJA',
          });
          paymentCount++;
        } else {
          console.log(`  ? ${student.nombre} sem${weekNum}: "${val}"`);
        }

        if (paymentCount % 50 === 0) process.stdout.write(`  ${paymentCount} pagos...\r`);
      }
    }
  }

  console.log(`  ${paymentCount} pagos cargados`);
  console.log(`  ${extras} alumnos extra creados`);
  console.log('\n=== LISTO ===');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
