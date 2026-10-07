import assert from "node:assert/strict";
const base = process.argv[2] || "http://localhost:3000";
for (const path of ["/", "/ask", "/library", "/library/new", "/debate", "/noise", "/login", "/verify-school", "/terms", "/privacy", "/question/20000000-0000-4000-8000-000000000001"]) {
  const response = await fetch(`${base}${path}`);
  assert.equal(response.status, 200, `${path} should render`);
  assert.ok((await response.text()).includes("SchoolHub"));
  console.log(`PASS ${path}`);
}
for (const path of ["/teacher", "/admin", "/teacher/debates/new"]) {
  const response = await fetch(`${base}${path}`, { redirect: "manual" });
  assert.equal(response.status,307,`${path} should require sign-in`);
  assert.equal(new URL(response.headers.get("location"),base).pathname,"/login");
  console.log(`PASS ${path} redirects to sign-in`);
}
const unauthorized = await fetch(`${base}/api/teacher`);
assert.equal(unauthorized.status,401);
const invalid = await fetch(`${base}/api/questions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: "", recipientType: "general", recipientId: null }) });
assert.equal(invalid.status,401);
const crossSite = await fetch(`${base}/api/questions`, { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://untrusted.invalid" }, body: JSON.stringify({ body: "A test that must not be saved", recipientType: "general", recipientId: null }) });
assert.equal(crossSite.status,403);
console.log("PASS unauthorized reads, invalid submissions, and cross-site submissions are rejected");
console.log("HTTP smoke checks passed. No database records were created.");

for (const path of ['config','questions','studies','boards','board/test-board','debate/join/ABC123','admin']) {
 const response = await fetch(`${base}/api/${path}`); assert.equal(response.status,401,`${path} requires school verification`);
}
console.log('PASS all school data endpoints require verification');
