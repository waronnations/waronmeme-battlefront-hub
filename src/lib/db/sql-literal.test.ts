import { describe, expect, it } from "vitest";
import { inlineSql, pgArrayLiteral, sqlLiteral } from "./sql-literal";

describe("sql literal inlining", () => {
  it("doubles single quotes so values can't break out of the literal", () => {
    expect(sqlLiteral("O'Brien'); DROP TABLE users; --")).toBe("'O''Brien''); DROP TABLE users; --'");
  });
  it("turns null/undefined/non-finite into NULL", () => {
    expect(sqlLiteral(null)).toBe("NULL");
    expect(sqlLiteral(undefined)).toBe("NULL");
    expect(sqlLiteral(Number.NaN)).toBe("NULL");
  });
  it("quotes numbers, booleans, bigints and dates", () => {
    expect(sqlLiteral(5)).toBe("'5'");
    expect(sqlLiteral(true)).toBe("'true'");
    expect(sqlLiteral(10n ** 20n)).toBe("'100000000000000000000'");
    expect(sqlLiteral(new Date(0))).toBe("'1970-01-01T00:00:00.000Z'");
  });
  it("serialises arrays as Postgres array literals", () => {
    expect(pgArrayLiteral(["a", 'b"c', null, 3])).toBe('{"a","b\\"c",NULL,"3"}');
  });
  it("rejects null bytes", () => {
    expect(() => sqlLiteral("a\u0000b")).toThrow();
  });
  it("inlines template values in order", () => {
    expect(inlineSql(["SELECT * FROM t WHERE a = ", " AND b = ", ""], [1, "x"])).toBe("SELECT * FROM t WHERE a = '1' AND b = 'x'");
  });
});
