import assert from "node:assert/strict";
import { test } from "node:test";
import { bosnian } from "../src/lib/bosnian";
import { localizedDate } from "../src/lib/localization";
test("Bosnian dates use readable month and weekday names in the school timezone", () => {
  const date = new Date("2026-10-07T23:30:00Z");
  const options: Intl.DateTimeFormatOptions = { timeZone: "Europe/Warsaw", weekday: "short", day: "numeric", month: "short" };
  assert.match(localizedDate("en", date, options), /^Thu,? 8 Oct$/);
  assert.match(localizedDate("bs", date, options), /^čet,? 8 okt$/);
  assert.equal(bosnian["Private"], "Privatno");
  assert.equal(bosnian["Teacher’s answer"], "Odgovor nastavnika");
});
