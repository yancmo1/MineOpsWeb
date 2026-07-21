/**
 * Catalog Package Contract Tests
 *
 * Verifies the immutable, versioned JSON catalog package contract:
 *   - Deterministic serialization (stable key ordering, stable hashing)
 *   - SHA-256 content-addressed integrity for all artifacts
 *   - Manifest links all artifacts and detects missing/mismatched files
 *   - Canonical JSON round-trip stability
 *   - Schema conformance for all 8 artifact types
 *   - Example bundle integrity (no fabricated game data)
 *
 * Usage: node --test tests/catalog-package.test.mjs
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const ROOT = resolve(import.meta.dirname, "..");
const EXAMPLE_DIR = resolve(ROOT, "catalogs", "example");
const SCHEMAS_DIR = resolve(ROOT, "shared", "schemas");

// ---------------------------------------------------------------------------
// AJV (loaded via createRequire for CJS compat)
// ---------------------------------------------------------------------------
const require = createRequire(import.meta.url);
let Ajv;
try {
  Ajv = require("ajv/dist/2020").default || require("ajv/dist/2020");
} catch {
  Ajv = require("ajv").default || require("ajv");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function sha256(content) {
  return createHash("sha256").update(content, "utf-8").digest("hex");
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])])
    );
  }
  return value;
}

function canonicalJson(value) {
  return `${JSON.stringify(stableValue(value), null, 2)}\n`;
}

function loadJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Deterministic serialization", () => {
  it("stableValue sorts object keys recursively", () => {
    const input = { zebra: 1, apple: { mango: 2, banana: 3 }, cat: 4 };
    const output = stableValue(input);
    const keys = Object.keys(output);
    assert.deepEqual(keys, ["apple", "cat", "zebra"]);
    assert.deepEqual(Object.keys(output.apple), ["banana", "mango"]);
  });

  it("stableValue handles arrays without reordering", () => {
    const input = { items: [{ b: 2, a: 1 }, { d: 4, c: 3 }] };
    const output = stableValue(input);
    // Array order preserved, but object keys within each item sorted
    assert.deepEqual(Object.keys(output.items[0]), ["a", "b"]);
    assert.deepEqual(Object.keys(output.items[1]), ["c", "d"]);
  });

  it("canonicalJson produces stable output across multiple invocations", () => {
    const input = { c: 3, a: 1, b: { z: 26, y: 25 } };
    const out1 = canonicalJson(input);
    const out2 = canonicalJson(JSON.parse(out1));
    assert.equal(out1, out2);
  });

  it("canonicalJson produces stable SHA-256 hash", () => {
    const input = { managers: [{ id: "m1", name: "Test" }, { id: "m2", name: "Other" }] };
    const hash1 = sha256(canonicalJson(input));
    const hash2 = sha256(canonicalJson(JSON.parse(canonicalJson(input))));
    assert.equal(hash1, hash2);
  });

  it("different key orders produce the same canonical JSON", () => {
    const a = { b: 2, a: 1 };
    const b = { a: 1, b: 2 };
    assert.equal(canonicalJson(a), canonicalJson(b));
  });

  it("includes trailing newline in canonical form", () => {
    const output = canonicalJson({ a: 1 });
    assert.ok(output.endsWith("\n"));
  });
});

describe("SHA-256 content addressing", () => {
  it("produces lowercase 64-char hex digest", () => {
    const hash = sha256("test content");
    assert.equal(hash.length, 64);
    assert.ok(/^[a-f0-9]{64}$/.test(hash));
  });

  it("same content produces same hash", () => {
    // Use deterministic serialization for content
    const content = canonicalJson({ a: 1, b: 2 });
    assert.equal(sha256(content), sha256(content));
  });

  it("different content produces different hash", () => {
    const h1 = sha256(canonicalJson({ a: 1 }));
    const h2 = sha256(canonicalJson({ a: 2 }));
    assert.notEqual(h1, h2);
  });

  it("hash is sensitive to byte-level changes", () => {
    const h1 = sha256('{"a":1}\n');
    const h2 = sha256('{"a":2}\n');
    assert.notEqual(h1, h2);
  });
});

describe("Manifest artifact integrity", () => {
  const manifest = loadJson(resolve(EXAMPLE_DIR, "manifest.json"));

  it("manifest has manifestSchemaVersion 2.0.0", () => {
    assert.equal(manifest.manifestSchemaVersion, "2.0.0");
  });

  it("manifest has an artifacts array with 7 entries", () => {
    assert.ok(Array.isArray(manifest.artifacts));
    assert.equal(manifest.artifacts.length, 7);
  });

  it("each artifact has required fields", () => {
    const required = ["filename", "contentType", "sha256", "bytes", "schemaVersion", "required", "path"];
    for (const entry of manifest.artifacts) {
      for (const field of required) {
        assert.ok(entry[field] !== undefined, `${entry.filename}: missing ${field}`);
      }
      assert.equal(entry.contentType, "application/json");
    }
  });

  it("required artifacts are correctly marked", () => {
    const requiredFiles = ["catalog-core.json", "validation-report.json"];
    const optionalFiles = ["relationships.json", "mappings.json", "localization.json", "assets.json", "changelog.json"];
    for (const entry of manifest.artifacts) {
      if (requiredFiles.includes(entry.filename)) {
        assert.equal(entry.required, true, `${entry.filename}: should be required`);
      } else if (optionalFiles.includes(entry.filename)) {
        assert.equal(entry.required, false, `${entry.filename}: should be optional`);
      }
    }
  });

  it("all artifacts in manifest exist on disk", () => {
    for (const entry of manifest.artifacts) {
      const filePath = resolve(EXAMPLE_DIR, entry.filename);
      assert.ok(existsSync(filePath), `${entry.filename}: file not found`);
    }
  });

  it("all artifact SHA-256 hashes match actual file content", () => {
    for (const entry of manifest.artifacts) {
      const filePath = resolve(EXAMPLE_DIR, entry.filename);
      const content = readFileSync(filePath, "utf-8");
      const actualHash = sha256(content);
      assert.equal(actualHash, entry.sha256, `${entry.filename}: hash mismatch`);
    }
  });

  it("all artifact byte sizes match actual file sizes", () => {
    for (const entry of manifest.artifacts) {
      const filePath = resolve(EXAMPLE_DIR, entry.filename);
      const content = readFileSync(filePath, "utf-8");
      const actualBytes = Buffer.byteLength(content, "utf-8");
      assert.equal(actualBytes, entry.bytes, `${entry.filename}: byte size mismatch`);
    }
  });

  it("manifest status is 'candidate' (not 'active')", () => {
    assert.equal(manifest.status, "candidate");
  });

  it("manifest includes storage section with baseUrl", () => {
    assert.ok(manifest.storage);
    assert.ok(manifest.storage.baseUrl);
  });

  it("manifest has previousCatalogVersion null (first version)", () => {
    assert.equal(manifest.previousCatalogVersion, null);
  });

  it("all artifact paths are safe relative paths", () => {
    // Reject traversal, absolute paths, URL schemes, encoded sequences
    const unsafe = [
      "../etc/passwd",
      "/etc/passwd",
      "C:\\windows\\system32",
      "http://evil.com/bad.json",
      "..%2f..%2fetc%2fpasswd",
      "%2e%2e%2f%2e%2e%2fetc",
      "file.json%00.html",
      "....//....//etc",
      "foo\\bar\\baz.json",
    ];
    for (const entry of manifest.artifacts) {
      // Each path should be safe
      const p = entry.path;
      assert.ok(!p.startsWith("/"), `${entry.filename}: path must not be absolute`);
      assert.ok(!p.includes(".."), `${entry.filename}: path must not contain ..`);
      assert.ok(!p.includes("\\"), `${entry.filename}: path must not contain backslash`);
      assert.ok(!/%2[ef]/i.test(p), `${entry.filename}: path must not contain encoded slash`);
      assert.ok(!p.includes(":"), `${entry.filename}: path must not contain scheme separator`);
      // None of the unsafe patterns should appear
      for (const bad of unsafe) {
        assert.ok(!p.includes(bad.replace(/%/g, "").replace(/\.\./g, "")), `${entry.filename}: path should not resemble traversal`);
      }
    }
  });
});

describe("Example bundle fixture safety", () => {
  it("catalog-core has zero game records", () => {
    const catalogCore = loadJson(resolve(EXAMPLE_DIR, "catalog-core.json"));
    assert.equal(catalogCore.managers.length, 0);
    assert.equal(catalogCore.mines.length, 0);
    assert.equal(catalogCore.equipment.length, 0);
    assert.equal(catalogCore.research.length, 0);
    assert.equal(catalogCore.collectibles.length, 0);
    assert.equal(catalogCore.artifacts.length, 0);
  });

  it("catalog-core source kind is 'fixture'", () => {
    const catalogCore = loadJson(resolve(EXAMPLE_DIR, "catalog-core.json"));
    assert.equal(catalogCore.source.kind, "fixture");
  });

  it("relationships has zero records", () => {
    const rels = loadJson(resolve(EXAMPLE_DIR, "relationships.json"));
    assert.equal(rels.relationships.length, 0);
  });

  it("mappings has zero records", () => {
    const mappings = loadJson(resolve(EXAMPLE_DIR, "mappings.json"));
    assert.equal(mappings.idMappings.length, 0);
    assert.equal(mappings.aliases.length, 0);
  });

  it("localization has empty entries", () => {
    const loc = loadJson(resolve(EXAMPLE_DIR, "localization.json"));
    assert.equal(Object.keys(loc.entries).length, 0);
    assert.equal(loc.locale, "en");
  });

  it("assets has zero records", () => {
    const assets = loadJson(resolve(EXAMPLE_DIR, "assets.json"));
    assert.equal(assets.assets.length, 0);
  });

  it("changelog has zero changes", () => {
    const changelog = loadJson(resolve(EXAMPLE_DIR, "changelog.json"));
    assert.equal(changelog.changes.added.length, 0);
    assert.equal(changelog.changes.removed.length, 0);
    assert.equal(changelog.changes.changed.length, 0);
    assert.equal(changelog.changes.unresolved.length, 0);
  });

  it("no fabricated manager names or game data", () => {
    // Read all artifacts and verify no plausible game data exists
    const files = [
      "catalog-core.json",
      "relationships.json",
      "mappings.json",
      "localization.json",
      "assets.json",
      "changelog.json",
    ];
    for (const file of files) {
      const content = readFileSync(resolve(EXAMPLE_DIR, file), "utf-8");
      // No "Super Manager" or "Gold Mine" style fabricated names
      assert.ok(!content.includes("Super Manager"), `${file}: contains fabricated data`);
      assert.ok(!content.includes("Gold Mine"), `${file}: contains fabricated data`);
    }
  });
});

describe("Schema conformance", () => {
  // Synchronously load schemas — they're needed at test time, not compile time
  const schemas = [
    "catalog_manifest.schema.json",
    "catalog_core.schema.json",
    "relationships.schema.json",
    "mappings.schema.json",
    "localization.schema.json",
    "assets.schema.json",
    "catalog_validation.schema.json",
    "changelog.schema.json",
    "normalized_catalog.schema.json",
    "catalog_diff.schema.json",
  ];

  const av = new Ajv({ allErrors: true, strict: false });
  av.addFormat("date-time", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/);
  for (const schemaFile of schemas) {
    const schemaPath = resolve(SCHEMAS_DIR, schemaFile);
    if (existsSync(schemaPath)) {
      av.addSchema(loadJson(schemaPath), schemaFile);
    }
  }

  const schemaTests = [
    { file: "manifest.json", schema: "catalog_manifest.schema.json", label: "manifest" },
    { file: "catalog-core.json", schema: "catalog_core.schema.json", label: "catalog-core" },
    { file: "relationships.json", schema: "relationships.schema.json", label: "relationships" },
    { file: "mappings.json", schema: "mappings.schema.json", label: "mappings" },
    { file: "localization.json", schema: "localization.schema.json", label: "localization" },
    { file: "assets.json", schema: "assets.schema.json", label: "assets" },
    { file: "validation-report.json", schema: "catalog_validation.schema.json", label: "validation-report" },
    { file: "changelog.json", schema: "changelog.schema.json", label: "changelog" },
  ];

  for (const { file, schema, label } of schemaTests) {
    it(`${label} conforms to ${schema}`, () => {
      const data = loadJson(resolve(EXAMPLE_DIR, file));
      const validate = av.getSchema(schema);
      assert.ok(validate, `Schema not compiled: ${schema}`);
      const valid = validate(data);
      if (!valid) {
        assert.fail(`${label}: ${av.errorsText(validate.errors)}`);
      }
    });
  }
});

describe("Manifest consistency with catalog artifacts", () => {
  const manifest = loadJson(resolve(EXAMPLE_DIR, "manifest.json"));
  const catalogCore = loadJson(resolve(EXAMPLE_DIR, "catalog-core.json"));
  const relationships = loadJson(resolve(EXAMPLE_DIR, "relationships.json"));

  it("manifest catalogVersion matches catalog-core", () => {
    assert.equal(manifest.catalogVersion, catalogCore.catalogVersion);
  });

  it("manifest releaseId matches catalog-core", () => {
    assert.equal(manifest.releaseId, catalogCore.releaseId);
  });

  it("manifest counts match actual catalog-core entity counts", () => {
    assert.equal(manifest.counts.managers, catalogCore.managers.length);
    assert.equal(manifest.counts.mines, catalogCore.mines.length);
    assert.equal(manifest.counts.equipment, catalogCore.equipment.length);
    assert.equal(manifest.counts.research, catalogCore.research.length);
    assert.equal(manifest.counts.collectibles, catalogCore.collectibles.length);
    assert.equal(manifest.counts.artifacts, catalogCore.artifacts.length);
    assert.equal(manifest.counts.relationships, relationships.relationships.length);
  });
});

describe("Canonical JSON round-trip stability", () => {
  it("all example artifacts are in canonical form", () => {
    const files = [
      "catalog-core.json",
      "relationships.json",
      "mappings.json",
      "localization.json",
      "assets.json",
      "validation-report.json",
      "changelog.json",
    ];

    for (const file of files) {
      const filePath = resolve(EXAMPLE_DIR, file);
      const raw = readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      const canonical = canonicalJson(parsed);
      assert.equal(raw, canonical, `${file}: not in canonical form`);
    }
  });

  it("canonical form is stable for objects with nested arrays", () => {
    const complex = {
      items: [
        { id: "b", tags: ["x", "y"] },
        { id: "a", tags: ["z"] },
      ],
      meta: { version: 2, name: "test" },
    };
    const c1 = canonicalJson(complex);
    const c2 = canonicalJson(JSON.parse(c1));
    const c3 = canonicalJson(JSON.parse(c2));
    assert.equal(sha256(c1), sha256(c2));
    assert.equal(sha256(c2), sha256(c3));
  });
});
