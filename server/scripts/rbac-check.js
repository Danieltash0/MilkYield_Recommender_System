// Black-box access-control checks (Chapter 5, Table 5.11).
// Starts the API in-process on a random port with no database: every check
// below is decided by authenticateToken / requireRole or input validation
// before any query runs. Run from server/:  node scripts/rbac-check.js
process.env.JWT_SECRET = 'rbac-test-secret';
process.env.DB_PORT = '1'; // no database: these checks must be decided before any query
const path = require('path');
const app = require(path.resolve(__dirname, '..', 'app.js'));
const jwt = require('jsonwebtoken');
const tok = (role) => jwt.sign({ userId: 999, email: role + '@test', role }, 'rbac-test-secret', { expiresIn: '1h' });
const cases = [
  ['RB-01','GET','/api/cattle',null,null,401,'No token'],
  ['RB-02','GET','/api/cattle','invalid',null,401,'Malformed token'],
  ['RB-03','GET','/api/cattle','expired',null,401,'Expired token'],
  ['RB-04','GET','/api/admin/users','worker',null,403,'Worker -> admin user list'],
  ['RB-05','GET','/api/admin/users','manager',null,403,'Manager -> admin user list'],
  ['RB-06','GET','/api/finance','worker',null,403,'Worker -> finance'],
  ['RB-07','GET','/api/finance','vet',null,403,'Vet -> finance'],
  ['RB-08','GET','/api/reports','worker',null,403,'Worker -> reports'],
  ['RB-09','POST','/api/milking','vet',{},403,'Vet -> record milking'],
  ['RB-10','POST','/api/health-records','worker',{},403,'Worker -> create health record'],
  ['RB-11','POST','/api/tasks','worker',{},403,'Worker -> create task'],
  ['RB-12','DELETE','/api/cattle/1','worker',null,403,'Worker -> delete cattle'],
  ['RB-13','PUT','/api/milking/1','worker',{},403,'Worker -> edit milking record'],
  ['RB-14','POST','/api/appointments','worker',{},403,'Worker -> schedule appointment'],
  ['RB-15','POST','/api/qr/generate-missing','vet',null,403,'Vet -> bulk QR generation'],
  ['RB-16','POST','/api/users/signup',null,{name:'X',email:'x@test.com',password:'Secret@123',role:'admin'},400,'Self-signup as admin'],
  ['RB-17','POST','/api/users/signup',null,{email:'x@test.com'},400,'Signup with missing fields'],
  ['RB-18','GET','/api/does-not-exist',null,null,404,'Unknown route'],
  ['RB-19','GET','/api/health',null,null,200,'Health check'],
];
(async () => {
  const server = app.listen(0); await new Promise(r => server.on('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  let pass = 0;
  for (const [id, method, url, who, body, expect, label] of cases) {
    const headers = { 'Content-Type': 'application/json' };
    if (who === 'invalid') headers.Authorization = 'Bearer not.a.jwt';
    else if (who === 'expired') headers.Authorization = 'Bearer ' + jwt.sign({ userId: 1, role: 'admin', exp: Math.floor(Date.now()/1000) - 60 }, 'rbac-test-secret');
    else if (who) headers.Authorization = 'Bearer ' + tok(who);
    let status, msg;
    try {
      const res = await fetch(base + url, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(5000) });
      status = res.status; msg = (await res.text()).slice(0, 80);
    } catch (e) { status = 'ERR'; msg = e.message; }
    const ok = status === expect; if (ok) pass++;
    console.log([id, method, url, who || '-', expect, status, ok ? 'PASS' : 'FAIL', msg].join(' | '));
  }
  // latency of the health endpoint, 100 requests
  const t = [];
  for (let i = 0; i < 100; i++) { const s = performance.now(); await fetch(base + '/api/health'); t.push(performance.now() - s); }
  t.sort((a,b)=>a-b);
  console.log(`latency /api/health n=100 median=${t[49].toFixed(2)}ms p95=${t[94].toFixed(2)}ms max=${t[99].toFixed(2)}ms`);
  console.log(`${pass}/${cases.length} passed`);
  server.close(); process.exit(0);
})();
