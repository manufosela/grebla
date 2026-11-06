// VENDORIZADO (RMR-TSK-0620): test del portal para notionPeople.js. Es el
// contrato del mapeo: si la copia o el esquema de Notion derivan, falla aquí.
import { describe, expect, it, vi } from "vitest";
import {
  buildPeople,
  dataSourceQueryUrl,
  databaseQueryUrl,
  emailValue,
  fetchRelationNames,
  namesOf,
  notionHeaders,
  pageTitle,
  pageToPerson,
  plainText,
  queryAllPages,
  relIds,
  selectName,
  stripDashes,
  titleText,
} from "./notionPeople.js";
import { fakeResponse, notionPage, samplePages } from "./notionPeople.fixtures.js";

describe("helpers de propiedades de Notion", () => {
  it("selectName devuelve el nombre o null", () => {
    expect(selectName({ select: { name: "Manager" } })).toBe("Manager");
    expect(selectName({ select: null })).toBeNull();
    expect(selectName(undefined)).toBeNull();
  });

  it("namesOf lee select y multi_select (formato antiguo)", () => {
    expect(namesOf({ multi_select: [{ name: "Tech" }, { name: "Data" }] })).toEqual(["Tech", "Data"]);
    expect(namesOf({ multi_select: [] })).toEqual([]);
    expect(namesOf({ select: { name: "Tech" } })).toEqual(["Tech"]);
    expect(namesOf({ select: null })).toEqual([]);
    expect(namesOf(undefined)).toEqual([]);
  });

  it("namesOf resuelve la relation con el mapa y falla con un id sin nombre", () => {
    const names = new Map([["aaaa1111", "Tech"], ["bbbb2222", "Data"]]);
    expect(namesOf({ relation: [{ id: "aaaa-1111" }, { id: "bbbb-2222" }] }, names)).toEqual(["Tech", "Data"]);
    expect(namesOf({ relation: [] }, names)).toEqual([]);
    expect(() => namesOf({ relation: [{ id: "cccc-3333" }] }, names)).toThrow("cccc3333");
    expect(() => namesOf({ relation: [{ id: "aaaa-1111" }] })).toThrow("aaaa1111");
  });

  it("pageTitle coge la propiedad de título se llame como se llame", () => {
    expect(pageTitle({ properties: { Team: { type: "title", title: [{ plain_text: "IA" }] } } })).toBe("IA");
    expect(pageTitle({ properties: {} })).toBe("");
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

  it("con Department y Team como relation, saca los nombres del mapa", () => {
    const page = notionPage("aaaa-1111", "Ana");
    page.properties.Department = { relation: [{ id: "dddd-0001" }] };
    page.properties.Team = { relation: [{ id: "tttt-0001" }, { id: "tttt-0002" }] };
    const names = new Map([["dddd0001", "Tech"], ["tttt0001", "IA"], ["tttt0002", "Mobile"]]);
    const p = pageToPerson(page, names);
    expect([p.department, p.team, p.multiTeam]).toEqual(["Tech", "IA", true]);
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

describe("queryAllPages", () => {
  it("pagina con start_cursor y prueba los endpoints en orden", async () => {
    const [p1, p2] = samplePages();
    const calls = [];
    const fetchImpl = vi.fn(async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body), method: init.method, headers: init.headers });
      if (url.startsWith("https://api.notion.com/v1/data_sources/"))
        return fakeResponse({ ok: false, status: 404, text: "nope" });
      return JSON.parse(init.body).start_cursor
        ? fakeResponse({ json: { results: [p2], has_more: false } })
        : fakeResponse({ json: { results: [p1], has_more: true, next_cursor: "c2" } });
    });
    const pages = await queryAllPages({
      token: "tok",
      urls: [dataSourceQueryUrl("x"), databaseQueryUrl("x")],
      fetchImpl,
    });
    expect(pages).toEqual([p1, p2]);
    expect(calls).toHaveLength(4); // 2 páginas × (data_sources falla + databases ok)
    expect(calls[0].method).toBe("POST");
    expect(calls[0].headers).toEqual(notionHeaders("tok"));
    expect(calls[0].body).toEqual({ page_size: 100 });
    expect(calls[3].url).toBe("https://api.notion.com/v1/databases/x/query");
    expect(calls[3].body.start_cursor).toBe("c2");
  });

  it("fetchRelationNames arma el mapa id→título de las DB indicadas", async () => {
    const row = (id, prop, name) => ({ id, properties: { [prop]: { type: "title", title: [{ plain_text: name }] } } });
    const fetchImpl = async (url) =>
      fakeResponse({ json: { results: url.includes("/a/") ? [row("aa-01", "Department", "Tech")] : [row("bb-01", "Team", "IA")], has_more: false } });
    const names = await fetchRelationNames({ token: "t", dbIds: ["a", "b"], fetchImpl });
    expect([...names]).toEqual([["aa01", "Tech"], ["bb01", "IA"]]);
  });

  it("fetchRelationNames falla si la integración no ve una de las DB", async () => {
    const fetchImpl = async () => fakeResponse({ ok: false, status: 404, text: "object_not_found" });
    await expect(fetchRelationNames({ token: "t", fetchImpl })).rejects.toThrow("Notion 404");
  });

  it("falla con el status del último endpoint cuando ninguno responde ok", async () => {
    const fetchImpl = async () => fakeResponse({ ok: false, status: 500, text: "boom" });
    await expect(queryAllPages({ token: "t", urls: ["u1", "u2"], fetchImpl })).rejects.toThrow(
      "Notion 500: boom"
    );
  });
});
