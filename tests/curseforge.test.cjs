const test = require("node:test");
const assert = require("node:assert/strict");
const {
  resolveFileUrl,
  parseManifestLoader,
  normalizeCurseForgeProject,
  CLASS_IDS,
  MOD_LOADER_TYPES,
} = require("../electron/services/curseforge.cjs");

test("resolveFileUrl uses direct downloadUrl when present", () => {
  const file = {
    id: 5678901,
    fileName: "jei-1.21.1-forge.jar",
    downloadUrl: "https://mediafilez.forgecdn.net/files/5678/901/jei-1.21.1-forge.jar",
  };
  assert.equal(
    resolveFileUrl(file),
    "https://mediafilez.forgecdn.net/files/5678/901/jei-1.21.1-forge.jar",
  );
});

test("resolveFileUrl reconstructs Edge CDN URL when downloadUrl is null", () => {
  const file = {
    id: 5678901,
    fileName: "Sodium-mc1.21.1-0.6.0.jar",
    downloadUrl: null,
  };
  assert.equal(
    resolveFileUrl(file),
    "https://edge.forgecdn.net/files/5678/901/Sodium-mc1.21.1-0.6.0.jar",
  );
});

test("resolveFileUrl properly URL-encodes special characters in fileName", () => {
  const file = {
    id: 4123456,
    fileName: "Mod [Forge & Fabric] + Extra.jar",
    downloadUrl: null,
  };
  assert.equal(
    resolveFileUrl(file),
    "https://edge.forgecdn.net/files/4123/456/Mod%20%5BForge%20%26%20Fabric%5D%20%2B%20Extra.jar",
  );
});

test("resolveFileUrl handles null and invalid files safely", () => {
  assert.equal(resolveFileUrl(null), null);
  assert.equal(resolveFileUrl({ id: 123 }), null);
  assert.equal(resolveFileUrl({ fileName: "test.jar" }), null);
});

test("parseManifestLoader parses Forge manifest accurately", () => {
  const manifest = {
    minecraft: {
      version: "1.20.1",
      modLoaders: [{ id: "forge-47.3.0", primary: true }],
    },
  };
  const parsed = parseManifestLoader(manifest);
  assert.equal(parsed.minecraftVersion, "1.20.1");
  assert.equal(parsed.loader, "forge");
  assert.equal(parsed.loaderVersion, "47.3.0");
});

test("parseManifestLoader parses NeoForge manifest accurately", () => {
  const manifest = {
    minecraft: {
      version: "1.21.1",
      modLoaders: [{ id: "neoforge-21.1.50", primary: true }],
    },
  };
  const parsed = parseManifestLoader(manifest);
  assert.equal(parsed.minecraftVersion, "1.21.1");
  assert.equal(parsed.loader, "neoforge");
  assert.equal(parsed.loaderVersion, "21.1.50");
});

test("parseManifestLoader parses Fabric manifest accurately", () => {
  const manifest = {
    minecraft: {
      version: "1.21.4",
      modLoaders: [{ id: "fabric-0.16.9", primary: true }],
    },
  };
  const parsed = parseManifestLoader(manifest);
  assert.equal(parsed.minecraftVersion, "1.21.4");
  assert.equal(parsed.loader, "fabric");
  assert.equal(parsed.loaderVersion, "0.16.9");
});

test("parseManifestLoader parses Quilt manifest accurately", () => {
  const manifest = {
    minecraft: {
      version: "1.20.4",
      modLoaders: [{ id: "quilt-0.25.0", primary: true }],
    },
  };
  const parsed = parseManifestLoader(manifest);
  assert.equal(parsed.minecraftVersion, "1.20.4");
  assert.equal(parsed.loader, "quilt");
  assert.equal(parsed.loaderVersion, "0.25.0");
});

test("parseManifestLoader falls back to vanilla when no modLoaders present", () => {
  const manifest = {
    minecraft: {
      version: "1.21.1",
    },
  };
  const parsed = parseManifestLoader(manifest);
  assert.equal(parsed.minecraftVersion, "1.21.1");
  assert.equal(parsed.loader, "vanilla");
  assert.equal(parsed.loaderVersion, null);
});

test("normalizeCurseForgeProject normalizes modpack data into CatalogProject schema", () => {
  const rawMod = {
    id: 123456,
    classId: CLASS_IDS.modpack,
    name: "All The Mods 10",
    slug: "all-the-mods-10",
    summary: "ATM10 delivers the newest mods for Minecraft 1.21",
    downloadCount: 5200000,
    thumbsUpCount: 42000,
    authors: [{ name: "ATMTeam" }],
    categories: [{ name: "Extra Large", slug: "extra-large" }],
    logo: {
      thumbnailUrl: "https://media.forgecdn.net/avatars/thumbnails/1/2/256/256/atm10.png",
    },
    latestFilesIndexes: [
      { gameVersion: "1.21.1", modLoader: MOD_LOADER_TYPES.neoforge },
      { gameVersion: "1.21", modLoader: MOD_LOADER_TYPES.neoforge },
    ],
  };

  const normalized = normalizeCurseForgeProject(rawMod);
  assert.equal(normalized.project_id, "123456");
  assert.equal(normalized.project_type, "modpack");
  assert.equal(normalized.title, "All The Mods 10");
  assert.equal(normalized.slug, "all-the-mods-10");
  assert.equal(normalized.author, "ATMTeam");
  assert.equal(normalized.downloads, 5200000);
  assert.equal(normalized.follows, 42000);
  assert.equal(normalized.source, "curseforge");
  assert.equal(normalized.curseforgeId, 123456);
  assert.ok(normalized.categories.includes("neoforge"));
  assert.ok(normalized.versions.includes("1.21.1"));
});
