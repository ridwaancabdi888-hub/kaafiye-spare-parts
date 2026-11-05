import { describe, expect, it } from "vitest";
import { banjarkaSplit, editTimeLeft, EDIT_WINDOW_MS, fmtMoney, fmtSlsh, fmtUsd, fmtUsdPrecise, periodRange, rangeToIso, toUsd } from "@/lib/format";
import { errorKey } from "@/lib/errors";
import { isValidUsername, usernameToEmail } from "@/lib/staff";
import { passwordProblem } from "@/lib/password";
import { fmtDate, fmtDateTime, fmtDuration, fmtLongDate, pickMoney, weekStart } from "@/lib/format";
import { dictionaries } from "@/lib/i18n/dict";

describe("formatting", () => {
  it("formats thousands as specified", () => {
    expect(fmtSlsh(118000)).toBe("118,000 SlSh");
    expect(fmtUsd(1180)).toBe("$1,180.00");
    expect(fmtUsdPrecise(0.625)).toBe("$0.625");
    expect(fmtMoney(11800, "SLSH")).toBe("11,800 SlSh");
  });
});

describe("currency conversion", () => {
  it("converts SLSH to USD with the snapshot rate", () => {
    expect(toUsd(118000, "SLSH", 11800)).toBe(10);
    expect(toUsd(10, "USD", 11800)).toBe(10);
  });
});

describe("banjarka split (UI preview mirrors SQL)", () => {
  it("40 − 6 = 34 → 17 / 17", () => {
    expect(banjarkaSplit(40, 6)).toEqual({ ok: true, gross: 40, expenses: 6, net: 34, worker: 17, shop: 17 });
  });
  it("odd cents sum exactly", () => {
    const r = banjarkaSplit(10.01, 0);
    expect(r.ok && r.worker + r.shop).toBeCloseTo(10.01, 10);
  });
  it("expenses above gross → no payout", () => {
    expect(banjarkaSplit(5, 6)).toEqual({ ok: false, reason: "EXPENSES_EXCEED_GROSS" });
  });
});

describe("edit window", () => {
  it("is exactly 5h from creation", () => {
    const created = new Date("2026-11-02T08:00:00Z");
    expect(editTimeLeft(created.toISOString(), created.getTime() + EDIT_WINDOW_MS - 1)).toBe(1);
    expect(editTimeLeft(created.toISOString(), created.getTime() + EDIT_WINDOW_MS)).toBe(0);
  });
});

describe("periods (Hargeisa time)", () => {
  it("custom range maps to UTC+3 bounds", () => {
    const iso = rangeToIso(periodRange("custom", "2026-11-01", "2026-11-02"));
    expect(iso.start).toBe("2026-10-31T21:00:00.000Z");
    expect(iso.end).toBe("2026-11-02T21:00:00.000Z");
  });
  it("rejects malformed dates", () => {
    expect(periodRange("custom", "x'; drop", "2026-11-02").from).toBeNull();
  });
});

describe("errors + logins + i18n", () => {
  it("maps database codes, hides raw messages", () => {
    expect(errorKey({ message: "INSUFFICIENT_STOCK" })).toBe("err.INSUFFICIENT_STOCK");
    expect(errorKey({ message: "EDIT_WINDOW_CLOSED", code: "42501" })).toBe("err.EDIT_WINDOW_CLOSED");
    expect(errorKey({ message: "some internal detail" })).toBe("err.generic");
  });
  it("usernames: format and synthetic auth e-mail", () => {
    expect(usernameToEmail(" Kaafiye01 ")).toBe("kaafiye01@staff.kaafiye.local");
    expect(isValidUsername("kaafiye01")).toBe(true);
    expect(isValidUsername("ab")).toBe(false);
    expect(isValidUsername("ali@x.com")).toBe(false);
  });
  it("Somali dictionary covers every English key", () => {
    expect(Object.keys(dictionaries.so).sort()).toEqual(Object.keys(dictionaries.en).sort());
    expect(Object.values(dictionaries.so).every((v) => v.length > 0)).toBe(true);
  });
});

describe("password policy", () => {
  it("min 8, no forced symbols, blocks the obvious", () => {
    expect(passwordProblem("1234")).toBe("err.PASSWORD_SHORT");
    expect(passwordProblem("12345678")).toBe("err.PASSWORD_WEAK");
    expect(passwordProblem("98765432")).toBe("err.PASSWORD_WEAK");
    expect(passwordProblem("aaaaaaaa")).toBe("err.PASSWORD_WEAK");
    expect(passwordProblem("password")).toBe("err.PASSWORD_WEAK");
    expect(passwordProblem("kaafiye01pass", "kaafiye01")).toBe("err.PASSWORD_HAS_USERNAME");
    expect(passwordProblem("geel iyo ari")).toBeNull();
    expect(passwordProblem("hargeisa2026")).toBeNull();
  });
});

describe("Somali dates never use English month names", () => {
  const d = "2026-11-02T11:05:00Z"; // 14:05 in Hargeisa
  it("formats per language", () => {
    expect(fmtDate(d, "so")).toBe("2 Nof 2026");
    expect(fmtDate(d, "en")).toBe("2 Nov 2026");
    expect(fmtDateTime(d, "so")).toBe("2 Nof 2026, 14:05");
    expect(fmtLongDate(d, "so")).toBe("Isniin, 2 Nofembar 2026");
    expect(fmtLongDate(d, "en")).toBe("Monday, 2 November 2026");
    expect(fmtDuration(3 * 3600000 + 20 * 60000, "so")).toBe("3 saac 20 daq");
    expect(fmtDuration(3 * 3600000 + 20 * 60000, "en")).toBe("3h 20m");
  });
});

describe("display currency + work week", () => {
  it("picks the stored USD or SlSh twin without converting at today's rate", () => {
    const row = { sales_usd: 6.78, sales_slsh: 80000 };
    expect(pickMoney(row, "sales", "USD")).toBe("$6.78");
    expect(pickMoney(row, "sales", "SLSH")).toBe("80,000 SlSh");
    expect(pickMoney(null, "sales", "SLSH")).toBe("0 SlSh");
  });

  it("the work week starts on Saturday in Hargeisa time", () => {
    expect(weekStart(new Date("2026-11-05T09:00:00Z"))).toBe("2026-10-31"); // Thursday → Saturday
    expect(weekStart(new Date("2026-10-31T09:00:00Z"))).toBe("2026-10-31"); // Saturday itself
    expect(weekStart(new Date("2026-11-06T22:30:00Z"))).toBe("2026-11-07"); // 01:30 Saturday local
  });
});
