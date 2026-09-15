const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { ZipArchive } = require("archiver");

const {
  inspectResourcePack,
  cleanupPreviewPack,
  installPreviewPack,
} = require("../electron/services/resourcepack.cjs");

function createMockZip(destPath, entries) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(destPath);
    const zip = new ZipArchive({ zlib: { level: 1 } });

    output.once("close", resolve);
    output.once("error", reject);
    zip.once("error", reject);

    zip.pipe(output);

    for (const [entryPath, content] of Object.entries(entries)) {
      zip.append(content, { name: entryPath });
    }

    void zip.finalize();
  });
}

test("resourcepack: cleanupPreviewPack deletes temporary file safely", async () => {
  const tmpDir = path.join(os.tmpdir(), `onyx-rpack-test-${Date.now()}`);
  await fsp.mkdir(tmpDir, { recursive: true });

  try {
    const testFile = path.join(tmpDir, "temp_pack.zip");
    await fsp.writeFile(testFile, "test data");
    assert.equal(fs.existsSync(testFile), true);

    await cleanupPreviewPack(testFile);
    assert.equal(fs.existsSync(testFile), false);

    // Should not throw if called again on non-existent file
    await cleanupPreviewPack(testFile);
  } finally {
    await fsp.rm(tmpDir, { recursive: true, force: true });
  }
});

test("resourcepack: installPreviewPack moves preview pack to destination folder", async () => {
  const tmpDir = path.join(os.tmpdir(), `onyx-rpack-test-${Date.now()}`);
  const destDir = path.join(tmpDir, "instances", "default", "resourcepacks");
  await fsp.mkdir(tmpDir, { recursive: true });

  try {
    const testFile = path.join(tmpDir, "temp_pack.zip");
    await fsp.writeFile(testFile, "zip binary data");

    const installedPath = await installPreviewPack({
      tempFilePath: testFile,
      destinationFolder: destDir,
      filename: "MyPack.zip",
    });

    assert.equal(fs.existsSync(testFile), false, "Source temp file should be moved");
    assert.equal(fs.existsSync(installedPath), true, "Target file should exist in destination");
    assert.equal(path.basename(installedPath), "MyPack.zip");
  } finally {
    await fsp.rm(tmpDir, { recursive: true, force: true });
  }
});

test("resourcepack: inspectResourcePack extracts pack info, blocks, and items", async () => {
  const tmpDir = path.join(os.tmpdir(), `onyx-rpack-test-${Date.now()}`);
  await fsp.mkdir(tmpDir, { recursive: true });

  try {
    const packZip = path.join(tmpDir, "Faithful_Test.zip");

    const mcmeta = JSON.stringify({
      pack: {
        pack_format: 15,
        description: "Faithful 32x for 1.20",
      },
    });

    // 1x1 base64 transparent PNG
    const dummyPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64",
    );

    await createMockZip(packZip, {
      "pack.mcmeta": mcmeta,
      "pack.png": dummyPng,
      "assets/minecraft/textures/block/diamond_ore.png": dummyPng,
      "assets/minecraft/textures/block/furnace_top.png": dummyPng,
      "assets/minecraft/textures/block/furnace_front.png": dummyPng,
      "assets/minecraft/textures/block/furnace_side.png": dummyPng,
      "assets/minecraft/textures/item/diamond_sword.png": dummyPng,
      "assets/minecraft/textures/item/golden_apple.png": dummyPng,
    });

    const res = await inspectResourcePack(packZip);

    assert.equal(res.name, "Faithful_Test");
    assert.equal(res.packFormat, 15);
    assert.equal(res.description, "Faithful 32x for 1.20");
    assert.ok(res.iconDataUrl?.startsWith("data:image/png;base64,"));
    assert.ok(res.totalTextures >= 6);

    // Check diamond ore
    const diamondOre = res.blocks.find((b) => b.id === "diamond_ore");
    assert.ok(diamondOre, "Diamond ore should be identified");
    assert.ok(diamondOre.textures?.top?.startsWith("data:image/png;base64,"));

    // Check furnace
    const furnace = res.blocks.find((b) => b.id === "furnace");
    assert.ok(furnace, "Furnace should be identified");
    assert.ok(furnace.textures?.top?.startsWith("data:image/png;base64,"));
    assert.ok(furnace.textures?.front?.startsWith("data:image/png;base64,"));

    // Check items
    const sword = res.items.find((i) => i.id === "diamond_sword");
    assert.ok(sword, "Diamond sword item should be found");
    assert.equal(sword.name, "Алмазный меч");
    assert.ok(sword.texture.startsWith("data:image/png;base64,"));

    const apple = res.items.find((i) => i.id === "golden_apple");
    assert.ok(apple, "Golden apple item should be found");
    assert.equal(apple.name, "Золотое яблоко");
  } finally {
    await fsp.rm(tmpDir, { recursive: true, force: true });
  }
});
