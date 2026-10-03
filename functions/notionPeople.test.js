// VENDORIZADO (RMR-TSK-0620): test del portal para notionPeople.js. Es el
// contrato del mapeo: si la copia o el esquema de Notion derivan, falla aquí.
import { describe, expect, it } from "vitest";
import {
  buildPeople,
  emailValue,
  firstMultiSelect,
  hasMultipleValues,
  pageToPerson,
  plainText,
  relIds,
  selectName,
  stripDashes,
  titleText,
} from "./notionPeople.js";
import { notionPage, samplePages } from "./notionPeople.fixtures.js";

describe("helpers de propiedades de Notion", () => {
  it("selectName devuelve el nombre o null", () => {
    expect(selectName({ select: { name: "Manager" } })).toBe("Manager");
    expect(selectName({ select: null })).toBeNull();
    expect(selectName(undefined)).toBeNull();
  });

  it("firstMultiSelect y hasMultipleValues leen el multi_select", () => {
    const two = { multi_select: [{ name: "Tech" }, { name: "Data" }] };
    expect(firstMultiSelect(two)).toBe("Tech");
    expect(hasMultipleValues(two)).toBe(true);
    expect(firstMultiSelect({ multi_select: [] })).toBeNull();
    expect(hasMultipleValues({ multi_select: [{ name: "Tech" }] })).toBe(false);
    expect(hasMultipleValues(undefined)).toBe(false);
  });

  it("titleText concatena fragmentos y recorta espacios", () => {
    expect(titleText({ title: [{ plain_text: " Ana " }, { plain_text: "Root" }] })).toBe("Ana Root");
    expect(titleText({ title: [] })).toBe("");
    expect(titleText(undefined)).toBe("");
  });

  it("relIds y stripDashes quitan los guiones de los ids", () => {
    expect(stripDashes("aaaa-1111-bb")).toBe("aaaa1111bb");
    expect(relIds({ relation: [{ id: "aaaa-1111" }, { id: "bbbb-2222" }] })).toEqual([
      "aaaa1111",
      "bbbb2222",
    ]);
    expect(relIds({})).toEqual([]);
  });

  it("emailValue devuelve el email o null", () => {
    expect(emailValue({ email: "a@example.com" })).toBe("a@example.com");
    expect(emailValue({ email: null })).toBeNull();
    expect(emailValue(undefined)).toBeNull();
  });

  it("plainText concatena el rich_text, recorta y vacío es null", () => {
    expect(plainText({ rich_text: [{ plain_text: "U12" }, { plain_text: "3AB" }] })).toBe("U123AB");
    expect(plainText({ rich_text: [{ plain_text: "  " }] })).toBeNull();
    expect(plainText({ rich_text: [] })).toBeNull();
    expect(plainText(undefined)).toBeNull();
  });
});

describe("pageToPerson", () => {
  it("mapea todas las propiedades de la página a la persona", () => {
    const page = notionPage(
      "aaaa-1111",
      "Ana Root",
      {
        role: "CEO",
        teams: ["Executive Office", "Legal"],
        department: "Executive Office & Public Affairs",
        type: "Externo",
        level: "C-level",
        leadership: "Yes",
        founder: "Yes",
        email: "ana@example.com",
        slackId: "U123ANA",
      },
      "Activo",
      "bbbb-2222"
    );
    expect(pageToPerson(page)).toEqual({
      id: "aaaa1111",
      name: "Ana Root",
      role: "CEO",
      team: "Executive Office",
      multiTeam: true,
      department: "Executive Office & Public Affairs",
      type: "Externo",
      level: "C-level",
      leadership: "Yes",
      founder: "Yes",
      managerId: "bbbb2222",
      email: "ana@example.com",
      slackId: "U123ANA",
    });
  });

  it("sin manager ni tipo deja null (email y slackId también)", () => {
    const p = pageToPerson(notionPage("cccc-3333", "Solo"));
    expect(p.managerId).toBeNull();
    expect(p.type).toBeNull();
    expect(p.founder).toBeNull();
    expect(p.multiTeam).toBe(false);
    expect(p.email).toBeNull();
    expect(p.slackId).toBeNull();
  });
});

describe("buildPeople", () => {
  it("excluye los Status indicados y las páginas sin nombre, en orden", () => {
    const snapshot = buildPeople(samplePages(), ["Baja"]);
    expect(snapshot.map((p) => p.id)).toEqual(["aaaa1111", "bbbb2222", "dddd4444", "ffff6666"]);
    const live = buildPeople(samplePages(), ["Baja", "Inactive"]);
    expect(live.map((p) => p.id)).toEqual(["aaaa1111", "bbbb2222", "ffff6666"]);
  });

  it("anula managerId cuando el manager no está entre las personas resultantes", () => {
    const people = buildPeople(samplePages(), ["Baja"]);
    const byId = Object.fromEntries(people.map((p) => [p.id, p]));
    expect(byId.bbbb2222.managerId).toBe("aaaa1111");
    expect(byId.dddd4444.managerId).toBeNull(); // su manager está de baja
    expect(byId.ffff6666.managerId).toBeNull(); // su manager no existe
  });

  it("sin páginas devuelve una lista vacía", () => {
    expect(buildPeople([], ["Baja"])).toEqual([]);
  });
});
