'use strict';
const { Low, JSONFile } = require('lowdb');
const path  = require('path');
const fs    = require('fs');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const file = new JSONFile(path.join(DATA_DIR, 'psv_pro.json'));
const db   = new Low(file);
let ready  = false;

async function initDB() {
  await db.read();
  db.data ||= { projects: [], cases: [], revisions: [] };
  await db.write();
  ready = true;
}

const initPromise = initDB();
function now() { return new Date().toISOString(); }
function ensure() { if (!ready) throw new Error('DB not initialised'); }
const newId = () => uuidv4();

const projects = {
  list:   () => { ensure(); return [...db.data.projects].sort((a,b)=>b.updated_at.localeCompare(a.updated_at)); },
  get:    (id) => { ensure(); return db.data.projects.find(p=>p.id===id)||null; },
  count:  () => { ensure(); return db.data.projects.length; },
  create: (d) => { ensure(); const p={...d,created_at:now(),updated_at:now()}; db.data.projects.push(p); db.write(); return p; },
  update: (id,d) => { ensure(); const i=db.data.projects.findIndex(p=>p.id===id); if(i<0)return null; db.data.projects[i]={...db.data.projects[i],...d,updated_at:now()}; db.write(); return db.data.projects[i]; },
  delete: (id) => { ensure(); db.data.projects=db.data.projects.filter(p=>p.id!==id); db.data.cases=db.data.cases.filter(c=>c.project_id!==id); db.write(); },
};

const cases = {
  list:   (pid) => { ensure(); return db.data.cases.filter(c=>c.project_id===pid).sort((a,b)=>b.updated_at.localeCompare(a.updated_at)); },
  get:    (id)  => { ensure(); return db.data.cases.find(c=>c.id===id)||null; },
  count:  (pid) => { ensure(); return db.data.cases.filter(c=>c.project_id===pid).length; },
  create: (d)   => { ensure(); const c={...d,created_at:now(),updated_at:now()}; db.data.cases.push(c); db.write(); return c; },
  update: (id,d)=> { ensure(); const i=db.data.cases.findIndex(c=>c.id===id); if(i<0)return null; db.data.cases[i]={...db.data.cases[i],...d,updated_at:now()}; db.write(); return db.data.cases[i]; },
  delete: (id)  => { ensure(); db.data.cases=db.data.cases.filter(c=>c.id!==id); db.data.revisions=db.data.revisions.filter(r=>r.case_id!==id); db.write(); },
};

const revisions = {
  list:   (cid) => { ensure(); return db.data.revisions.filter(r=>r.case_id===cid).sort((a,b)=>b.rev-a.rev); },
  maxRev: (cid) => { ensure(); const rs=db.data.revisions.filter(r=>r.case_id===cid); return rs.length?Math.max(...rs.map(r=>r.rev)):0; },
  create: (d)   => { ensure(); const r={...d,created_at:now()}; db.data.revisions.push(r); db.write(); return r; },
};

module.exports = { initPromise, projects, cases, revisions, newId };
