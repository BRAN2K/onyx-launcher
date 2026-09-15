const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { ZipArchive } = require("archiver");

const {
  inspectShaderPack,
  cleanupShaderPreview,
  installShaderPreview,
} = require("../electron/services/shaderpack.cjs");

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

test("shaderpack: cleanupShaderPreview deletes temporary file safely", async () => {
  const tmpDir = path.join(os.tmpdir(), `onyx-shader-test-${Date.now()}`);
  await fsp.mkdir(tmpDir, { recursive: true });

  try {
    const testFile = path.join(tmpDir, "temp_shader.zip");
    await fsp.writeFile(testFile, "dummy shader data");
    assert.equal(fs.existsSync(testFile), true);

    await cleanupShaderPreview(testFile);
    assert.equal(fs.existsSync(testFile), false);

    // Should not throw if called on deleted file
    await cleanupShaderPreview(testFile);
  } finally {
    await fsp.rm(tmpDir, { recursive: true, force: true });
  }
});

test("shaderpack: installShaderPreview moves pack to instance shaderpacks folder", async () => {
  const tmpDir = path.join(os.tmpdir(), `onyx-shader-test-${Date.now()}`);
  const destDir = path.join(tmpDir, "instances", "survival", "shaderpacks");
  await fsp.mkdir(tmpDir, { recursive: true });

  try {
    const testFile = path.join(tmpDir, "temp_bsl.zip");
    await fsp.writeFile(testFile, "zip data");

    const installed = await installShaderPreview({
      tempFilePath: testFile,
      destinationFolder: destDir,
      filename: "BSL_v8.2.zip",
    });

    assert.equal(fs.existsSync(testFile), false);
    assert.equal(fs.existsSync(installed), true);
    assert.equal(path.basename(installed), "BSL_v8.2.zip");
  } finally {
    await fsp.rm(tmpDir, { recursive: true, force: true });
  }
});

test("shaderpack: inspectShaderPack extracts profiles, features, and performance tier", async () => {
  const tmpDir = path.join(os.tmpdir(), `onyx-shader-test-${Date.now()}`);
  await fsp.mkdir(tmpDir, { recursive: true });

  try {
    const bslZip = path.join(tmpDir, "BSL_Shaders_v8.zip");

    const propsContent = `
# BSL Shaders Configuration
profile.LOW=SHADOW_RES=512 BLOOM=false
profile.MEDIUM=SHADOW_RES=1024 BLOOM=true WATER_MODE=1
profile.HIGH=SHADOW_RES=2048 BLOOM=true WATER_MODE=2 VOLUMETRIC_CLOUDS=true
profile.ULTRA=SHADOW_RES=4096 BLOOM=true WATER_MODE=3 WAVING_PLANTS=true

option.WATER_MODE=2
option.SHADOW_RES=2048
option.BLOOM=true
option.WAVING_PLANTS=true
option.VOLUMETRIC_LIGHT=true
`;

    const dummyPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64",
    );

    await createMockZip(bslZip, {
      "pack.png": dummyPng,
      "shaders/shaders.properties": propsContent,
      "shaders/composite.fsh": "// composite shader\nvoid main() { gl_FragColor = vec4(1.0); }",
      "shaders/gbuffers_water.fsh": "// water shader",
      "shaders/shadow.fsh": "// shadow shader",
    });

    const res = await inspectShaderPack(bslZip);

    assert.equal(res.name, "BSL_Shaders_v8");
    assert.ok(res.iconDataUrl?.startsWith("data:image/png;base64,"));
    assert.ok(res.profiles.includes("LOW"));
    assert.ok(res.profiles.includes("MEDIUM"));
    assert.ok(res.profiles.includes("HIGH"));
    assert.ok(res.profiles.includes("ULTRA"));

    assert.equal(res.features.water, true);
    assert.equal(res.features.shadows, true);
    assert.equal(res.features.bloom, true);
    assert.equal(res.features.waving, true);

    assert.equal(res.performanceTier.tier, "medium");
    assert.ok(res.rawShaderCount >= 3);
  } finally {
    await fsp.rm(tmpDir, { recursive: true, force: true });
  }
});

test("shaderpack: detects potato/light and rtx performance tiers", async () => {
  const tmpDir = path.join(os.tmpdir(), `onyx-shader-test-${Date.now()}`);
  await fsp.mkdir(tmpDir, { recursive: true });

  try {
    const potatoZip = path.join(tmpDir, "MakeUp-UltraFast_Lite.zip");
    await createMockZip(potatoZip, {
      "shaders/composite.fsh": "// fast composite",
    });

    const resPotato = await inspectShaderPack(potatoZip);
    assert.equal(resPotato.performanceTier.tier, "low");

    const rtxZip = path.join(tmpDir, "SEUS_PTGI_HRR3.zip");
    await createMockZip(rtxZip, {
      "shaders/composite.fsh": "// path tracing composite",
    });

    const resRtx = await inspectShaderPack(rtxZip);
    assert.equal(resRtx.performanceTier.tier, "rtx");
  } finally {
    await fsp.rm(tmpDir, { recursive: true, force: true });
  }
});
