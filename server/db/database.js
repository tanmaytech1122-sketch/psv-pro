'use strict';
const path  = require('path');
const fs    = require('fs');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_FILE = path.join(DATA_DIR, 'psv_pro.json');

const defaultData = { projects: [], cases: [], revisions: [] };

function readData() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('DB read error:', e.message);
  }
  return { ...defaultData };
}

function writeData(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('DB write error:', e.message);
  }
}

let dbData = readData();
if (!dbData.projects) dbData.projects = [];
if (!dbData.cases) dbData.cases = [];
if (!dbData.revisions) dbData.revisions = [];
writeData(dbData);

const initPromise = Promise.resolve();

function now() { return new Date().toISOString(); }
const newId = () => uuidv4();

const projects = {
  list:   () => [...dbData.projects].sort((a,b)=>b.updated_at.localeCompare(a.updated_at)),
  get:    (id) => dbData.projects.find(p=>p.id===id)||null,
  count:  () => dbData.projects.length,
  create: (d) => { const p={...d,created_at:now(),updated_at:now()}; dbData.projects.push(p); writeData(dbData); return p; },
  update: (id,d) => { const i=dbData.projects.findIndex(p=>p.id===id); if(i<0)return null; dbData.projects[i]={...dbData.projects[i],...d,updated_at:now()}; writeData(dbData); return dbData.projects[i]; },
  delete: (id) => { dbData.projects=dbData.projects.filter(p=>p.id!==id); dbData.cases=dbData.cases.filter(c=>c.project_id!==id); writeData(dbData); },
};

const cases = {
  list:   (pid) => dbData.cases.filter(c=>c.project_id===pid).sort((a,b)=>b.updated_at.localeCompare(a.updated_at)),
  get:    (id)  => dbData.cases.find(c=>c.id===id)||null,
  count:  (pid) => dbData.cases.filter(c=>c.project_id===pid).length,
  create: (d)   => { const c={...d,created_at:now(),updated_at:now()}; dbData.cases.push(c); writeData(dbData); return c; },
  update: (id,d)=> { const i=dbData.cases.findIndex(c=>c.id===id); if(i<0)return null; dbData.cases[i]={...dbData.cases[i],...d,updated_at:now()}; writeData(dbData); return dbData.cases[i]; },
  delete: (id)  => { dbData.cases=dbData.cases.filter(c=>c.id!==id); dbData.revisions=dbData.revisions.filter(r=>r.case_id!==id); writeData(dbData); },
};

const revisions = {
  list:   (cid) => dbData.revisions.filter(r=>r.case_id===cid).sort((a,b)=>b.rev-a.rev),
  maxRev: (cid) => { const rs=dbData.revisions.filter(r=>r.case_id===cid); return rs.length?Math.max(...rs.map(r=>r.rev)):0; },
  create: (d)   => { const r={...d,created_at:now()}; dbData.revisions.push(r); writeData(dbData); return r; },
};

module.exports = { initPromise, projects, cases, revisions, newId };
