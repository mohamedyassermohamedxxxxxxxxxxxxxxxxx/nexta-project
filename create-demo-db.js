const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dir = path.join(__dirname, 'data', 'etiam-demo');
fs.mkdirSync(path.join(dir, 'hl7'), { recursive: true });
fs.mkdirSync(path.join(dir, 'pdf'), { recursive: true });

const file = path.join(dir, 'sqlite.db');
const db = new Database(file);
db.exec(`CREATE TABLE IF NOT EXISTS PrintJob (
  pjb_StudyDate TEXT, pjb_PatientsName TEXT, pjb_AccessionNumber TEXT,
  pjb_PatientID TEXT, pjb_Modality TEXT, pjb_StudyDescription TEXT, pjb_JobUID TEXT
)`);

const count = db.prepare('SELECT COUNT(*) AS n FROM PrintJob').get().n;
if (count === 0) {
  db.prepare('INSERT INTO PrintJob VALUES (?,?,?,?,?,?,?)')
    .run('20260924', 'TEST^PATIENT', 'ACC1000', 'P1000', 'CT', 'CT Head', '1.2.3.1000');
}

console.log('Database file:', file);
console.log('Jobs in it:', db.prepare('SELECT COUNT(*) AS n FROM PrintJob').get().n);
db.close();