import { describe, expect, it } from "vitest";
import { banjarkaSplit, editTimeLeft, EDIT_WINDOW_MS, fmtMoney, fmtSlsh, fmtUsd, fmtUsdPrecise, periodRange, rangeToIso, toUsd } from "@/lib/format";
import { errorKey } from "@/lib/errors";
import { loginToEmail } from "@/lib/staff";
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
  it("usernames become synthetic e-mails", () => {
    expect(loginToEmail("Ali")).toBe("ali@staff.kaafiye.local");
    expect(loginToEmail("a@b.com")).toBe("a@b.com");
  });
  it("Somali dictionary covers every English key", () => {
    expect(Object.keys(dictionaries.so).sort()).toEqual(Object.keys(dictionaries.en).sort());
    expect(Object.values(dictionaries.so).every((v) => v.length > 0)).toBe(true);
  });
});
