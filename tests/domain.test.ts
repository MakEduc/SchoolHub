import assert from "node:assert/strict";
import { test } from "node:test";
import { balancedAssignments, debateSchema, questionSchema, schoolDateTimeToIso, studySchema } from "../src/lib/domain";

test("balanced assignment preserves every student and keeps 2–4 sides within one student", () => {
  for (let n = 0; n <= 100; n++) for (let k = 2; k <= 4; k++) {
    const students = Array.from({ length: n }, (_, i) => ({ id: i }));
    const sides = Array.from({ length: k }, (_, i) => `side-${i}`);
    const result = balancedAssignments(students, sides);
    assert.equal(new Set(result.map(a => a.student.id)).size, n);
    assert.deepEqual([...result.map(a => a.student.id)].sort((a, b) => a - b), students.map(s => s.id));
    const counts = sides.map(s => result.filter(a => a.stanceId === s).length);
    assert.ok(Math.max(...counts) - Math.min(...counts) <= 1);
    assert.equal(students[0]?.id, n ? 0 : undefined, "original roster is not mutated");
  }
});
test("shuffle is reproducible with an injected source and rejects invalid stance counts", () => {
  const participants = [1, 2, 3, 4, 5];
  assert.deepEqual(balancedAssignments(participants, ["a", "b"], () => .1), balancedAssignments(participants, ["a", "b"], () => .1));
  assert.throws(() => balancedAssignments(participants, ["a"]));
  assert.throws(() => balancedAssignments(participants, ["a", "b", "c", "d", "e"]));
});
test("questions require an appropriate destination, concise text, and an empty honeypot", () => {
  const valid = { body: "Could we have more study spaces?", recipientType: "general", recipientId: null };
  assert.ok(questionSchema.safeParse(valid).success);
  assert.ok(!questionSchema.safeParse({ ...valid, recipientType: "teacher" }).success);
  assert.ok(!questionSchema.safeParse({ ...valid, body: "a".repeat(281) }).success);
  assert.ok(!questionSchema.safeParse({ ...valid, body: "   " }).success);
  assert.ok(!questionSchema.safeParse({ ...valid, website: "spam" }).success);
  assert.ok(!questionSchema.safeParse({ ...valid, recipientId: "10000000-0000-4000-8000-000000000001" }).success);
});
test("study validation enforces programme, grade, meeting place, end time, capacity, and maximum duration", () => {
  const session = { programme: "IB", grade: "Grade I", subjectId: "10000000-0000-4000-8000-000000000001", focus: "Vectors", meetingPlace: "Library, upstairs table", startsAt: "2026-10-06T12:00:00.000Z", endsAt: "2026-10-06T13:00:00.000Z", openSpots: null, hostName: null, contact: null };
  assert.ok(studySchema.safeParse(session).success);
  assert.ok(!studySchema.safeParse({ ...session, grade: "MYP 3" }).success);
  assert.ok(!studySchema.safeParse({ ...session, programme: "DP" }).success);
  assert.ok(!studySchema.safeParse({ ...session, meetingPlace: "   " }).success);
  assert.ok(studySchema.safeParse({ ...session, programme: "National", grade: "Grade IV" }).success);
  assert.ok(studySchema.safeParse({ ...session, grade: "Grade IV" }).success);
  assert.ok(!studySchema.safeParse({ ...session, endsAt: session.startsAt }).success);
  assert.ok(!studySchema.safeParse({ ...session, openSpots: 0 }).success);
  assert.ok(!studySchema.safeParse({ ...session, endsAt: "2026-10-07T13:00:00.000Z" }).success);
});
test("school timezone conversion handles winter, summer, and missing DST times", () => {
  assert.equal(schoolDateTimeToIso("2026-10-06T15:00", "Europe/Warsaw"), "2026-10-06T13:00:00.000Z");
  assert.equal(schoolDateTimeToIso("2026-12-06T15:00", "Europe/Warsaw"), "2026-12-06T14:00:00.000Z");
  assert.throws(() => schoolDateTimeToIso("2026-03-29T02:30", "Europe/Warsaw"), /daylight saving/);
  assert.throws(() => schoolDateTimeToIso("invalid"));
});
test("debates reject duplicate stances and out-of-range preparation times", () => {
  const debate = { prompt: "Should schools change assessment?", stances: ["For", "Against"], prepSeconds: 300 };
  assert.ok(debateSchema.safeParse(debate).success);
  assert.ok(!debateSchema.safeParse({ ...debate, stances: ["For", "for"] }).success);
  assert.ok(!debateSchema.safeParse({ ...debate, prepSeconds: 0 }).success);
});
