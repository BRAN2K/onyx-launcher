const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const StreamZip = require("node-stream-zip");
const { downloadFile } = require("./network.cjs");

function bufferToDataUrl(buf, mimeType = "image/png") {
  return `data:${mimeType};base64,${buf.toString("base64")}`;
}

/**
 * Parses shader pack zip archive and extracts profiles, configuration, and capabilities
 */
async function inspectShaderPack(archivePath) {
  if (!fs.existsSync(archivePath)) {
    throw new Error(`File not found: ${archivePath}`);
  }

  const zip = new StreamZip.async({ file: archivePath });
  try {
    const entries = await zip.entries();
    const entryKeys = Object.keys(entries);

    // Read icon or preview image if present
    let iconDataUrl = null;
    const previewKey = entryKeys.find((k) => {
      const l = k.toLowerCase();
      return (
        l.endsWith("preview.png") ||
        l.endsWith("pack.png") ||
        l.endsWith("icon.png") ||
        l.endsWith("logo.png")
      );
    });

    if (previewKey) {
      try {
        const iconBuf = await zip.entryData(previewKey);
        iconDataUrl = bufferToDataUrl(iconBuf);
      } catch {}
    }

    // Inspect shaders.properties or *.properties
    let propertiesContent = "";
    const propsKey = entryKeys.find((k) => {
      const l = k.toLowerCase();
      return l.endsWith("shaders.properties") || (l.includes("shaders/") && l.endsWith(".properties"));
    });

    if (propsKey) {
      try {
        const rawProps = await zip.entryData(propsKey);
        propertiesContent = rawProps.toString("utf8");
      } catch {}
    }

    // Detect profiles from shaders.properties
    const profiles = new Set();
    if (propertiesContent) {
      const profileLines = propertiesContent.split(/\r?\n/);
      for (const line of profileLines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("profile.")) {
          const match = trimmed.match(/^profile\.([A-Za-z0-9_]+)/);
          if (match) {
            profiles.add(match[1]);
          }
        } else if (trimmed.startsWith("profiles")) {
          const parts = trimmed.split("=")[1];
          if (parts) {
            parts.split(/\s+/).forEach((p) => {
              if (p.trim()) profiles.add(p.trim());
            });
          }
        }
      }
    }

    // Standard fallback profiles if none explicitly declared
    if (profiles.size === 0) {
      profiles.add("LOW");
      profiles.add("MEDIUM");
      profiles.add("HIGH");
      profiles.add("ULTRA");
    }

    // Scan for shader programs and features
    const lowerKeys = entryKeys.map((k) => k.toLowerCase());
    const hasWaterShader = lowerKeys.some((k) => k.includes("water") || k.includes("gbuffers_water"));
    const hasShadows = lowerKeys.some((k) => k.includes("shadow") || k.includes("composite"));

    const propsLower = propertiesContent.toLowerCase();
    const features = {
      water: hasWaterShader || propsLower.includes("water"),
      shadows: hasShadows || propsLower.includes("shadow"),
      godrays: propsLower.includes("godray") || propsLower.includes("volumetric") || propsLower.includes("sunpath"),
      bloom: propsLower.includes("bloom"),
      waving: propsLower.includes("waving") || propsLower.includes("waving_plants") || propsLower.includes("foliage"),
      dof: propsLower.includes("dof") || propsLower.includes("depth_of_field"),
      motionBlur: propsLower.includes("motion_blur") || propsLower.includes("motionblur"),
      caustics: propsLower.includes("caustic") || propsLower.includes("water_caustics"),
    };

    // Performance rating estimation
    const rawName = path.basename(archivePath, path.extname(archivePath));
    const nameLower = rawName.toLowerCase();

    let performanceTier = {
      tier: "medium",
      label: "Сбалансированный",
      fpsEstimate: "~60-110 FPS",
      recommendation: "Оптимален для большинства современных видеокарт (GTX 1060 / RTX 2060 / RX 580 и выше).",
    };

    if (
      nameLower.includes("potato") ||
      nameLower.includes("lite") ||
      nameLower.includes("fast") ||
      nameLower.includes("vanilla") ||
      nameLower.includes("tea") ||
      nameLower.includes("makeup") ||
      nameLower.includes("mini")
    ) {
      performanceTier = {
        tier: "low",
        label: "Легковесный / Для слабых ПК",
        fpsEstimate: "~90-160+ FPS",
        recommendation: "Идеально для ноутбуков, встроенной графики Intel/AMD и слабых видеокарт.",
      };
    } else if (
      nameLower.includes("ptgi") ||
      nameLower.includes("path tracing") ||
      nameLower.includes("ray tracing") ||
      nameLower.includes("rtx") ||
      nameLower.includes("continuum") ||
      nameLower.includes("kappa")
    ) {
      performanceTier = {
        tier: "rtx",
        label: "Тяжёлый (Трассировка лучей / RTX)",
        fpsEstimate: "~45-75 FPS",
        recommendation: "Требует мощную дискретную видеокарту уровня RTX 3060 / RX 6700 и выше.",
      };
    } else if (nameLower.includes("ultra") || nameLower.includes("extreme") || nameLower.includes("high")) {
      performanceTier = {
        tier: "high",
        label: "Высокая кинематографичность",
        fpsEstimate: "~60-85 FPS",
        recommendation: "Рекомендуется дискретная видеокарта для комфортной плавной игры.",
      };
    }

    const rawShaderCount = lowerKeys.filter(
      (k) => k.endsWith(".fsh") || k.endsWith(".vsh") || k.endsWith(".glsl") || k.endsWith(".csh"),
    ).length;

    return {
      name: rawName,
      profiles: Array.from(profiles),
      features,
      performanceTier,
      rawShaderCount,
      iconDataUrl,
    };
  } finally {
    await zip.close();
  }
}

async function downloadAndInspectShaderPack({ url, projectId }) {
  const safeTemp = path.join(os.tmpdir(), "onyx-preview-shaders");
  await fs.promises.mkdir(safeTemp, { recursive: true });

  const safeName = (projectId || "shader").replace(/[^a-zA-Z0-9_-]/g, "_");
  const tempFilePath = path.join(safeTemp, `${safeName}_${Date.now()}.zip`);

  await downloadFile({
    url,
    destination: tempFilePath,
  });

  const inspectResult = await inspectShaderPack(tempFilePath);
  return {
    ...inspectResult,
    tempFilePath,
  };
}

async function cleanupShaderPreview(tempFilePath) {
  if (!tempFilePath) return;
  const fsp = require("node:fs/promises");
  try {
    if (fs.existsSync(tempFilePath)) {
      await fsp.unlink(tempFilePath);
    }
  } catch (err) {
    console.warn("Failed to cleanup temp shader preview:", err);
  }
}

async function installShaderPreview({ tempFilePath, destinationFolder, filename }) {
  if (!tempFilePath || !fs.existsSync(tempFilePath)) {
    throw new Error("Preview shader file not found");
  }
  const fsp = require("node:fs/promises");
  await fsp.mkdir(destinationFolder, { recursive: true });
  const destName = filename || path.basename(tempFilePath);
  const targetPath = path.join(destinationFolder, destName);
  await fsp.rename(tempFilePath, targetPath);
  return targetPath;
}

module.exports = {
  inspectShaderPack,
  downloadAndInspectShaderPack,
  cleanupShaderPreview,
  installShaderPreview,
};
