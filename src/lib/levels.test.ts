import { describe, expect, it } from "vitest";
import { charCountTone, levelFromXp, XP_PER_LEVEL } from "./quests";

describe("levelFromXp", () => {
  it("empieza en el nivel 1 con 0 XP (nunca NaN)", () => {
    expect(levelFromXp(0)).toEqual({ level: 1, xpIntoLevel: 0, xpToNext: XP_PER_LEVEL, percent: 0 });
    expect(levelFromXp(Number.NaN).level).toBe(1);
    expect(levelFromXp(-20).xpIntoLevel).toBe(0);
  });

  it("sube un nivel cada 100 XP", () => {
    expect(levelFromXp(85)).toEqual({ level: 1, xpIntoLevel: 85, xpToNext: 15, percent: 85 });
    expect(levelFromXp(100)).toEqual({ level: 2, xpIntoLevel: 0, xpToNext: 100, percent: 0 });
    expect(levelFromXp(260)).toEqual({ level: 3, xpIntoLevel: 60, xpToNext: 40, percent: 60 });
  });

  it("ignora un tamaño de nivel inválido", () => {
    expect(levelFromXp(150, 0).level).toBe(2);
  });
});

describe("charCountTone", () => {
  it("ok por debajo del 90 %, near desde el 90 % y limit al máximo", () => {
    expect(charCountTone(0, 80)).toBe("ok");
    expect(charCountTone(71, 80)).toBe("ok");
    expect(charCountTone(72, 80)).toBe("near");
    expect(charCountTone(79, 80)).toBe("near");
    expect(charCountTone(80, 80)).toBe("limit");
    expect(charCountTone(252, 280)).toBe("near");
  });
});
