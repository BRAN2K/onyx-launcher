const fs = require("node:fs");
const path = require("node:path");
const StreamZip = require("node-stream-zip");

/**
 * Maps known block configurations
 */
const BLOCK_DEFINITIONS = [
  {
    id: "crafting_table",
    name: "Верстак",
    top: ["crafting_table_top.png"],
    bottom: ["oak_planks.png", "crafting_table_bottom.png"],
    front: ["crafting_table_front.png"],
    sides: ["crafting_table_side.png"],
  },
  {
    id: "grass_block",
    name: "Блок дёрна",
    top: ["grass_block_top.png"],
    bottom: ["dirt.png"],
    sides: ["grass_block_side.png"],
  },
  {
    id: "diamond_ore",
    name: "Алмазная руда",
    all: ["diamond_ore.png", "deepslate_diamond_ore.png"],
  },
  {
    id: "furnace",
    name: "Печь",
    top: ["furnace_top.png"],
    bottom: ["furnace_top.png", "cobblestone.png"],
    front: ["furnace_front.png", "furnace_front_on.png"],
    sides: ["furnace_side.png"],
  },
  {
    id: "tnt",
    name: "Динамит (TNT)",
    top: ["tnt_top.png"],
    bottom: ["tnt_bottom.png"],
    sides: ["tnt_side.png"],
  },
  {
    id: "bookshelf",
    name: "Книжная полка",
    top: ["oak_planks.png"],
    bottom: ["oak_planks.png"],
    sides: ["bookshelf.png"],
  },
  {
    id: "glass",
    name: "Стекло",
    all: ["glass.png"],
    transparent: true,
  },
  {
    id: "cobblestone",
    name: "Булыжник",
    all: ["cobblestone.png"],
  },
  {
    id: "oak_planks",
    name: "Дубовые доски",
    all: ["oak_planks.png"],
  },
  {
    id: "bricks",
    name: "Кирпичи",
    all: ["bricks.png"],
  },
  {
    id: "glowstone",
    name: "Светящийся камень",
    all: ["glowstone.png"],
  },
];

const ITEM_DEFINITIONS = [
  { id: "diamond_sword", name: "Алмазный меч", files: ["diamond_sword.png"] },
  { id: "netherite_sword", name: "Незеритовый меч", files: ["netherite_sword.png"] },
  { id: "golden_apple", name: "Золотое яблоко", files: ["golden_apple.png", "enchanted_golden_apple.png"] },
  { id: "diamond_pickaxe", name: "Алмазная кирка", files: ["diamond_pickaxe.png"] },
  { id: "diamond_axe", name: "Алмазный топор", files: ["diamond_axe.png"] },
  { id: "ender_pearl", name: "Жемчуг Края", files: ["ender_pearl.png", "ender_eye.png"] },
  { id: "bow", name: "Лук", files: ["bow.png", "bow_standby.png"] },
  { id: "potion", name: "Зелье", files: ["potion.png", "potion_overlay.png"] },
];

function bufferToDataUrl(buf, mimeType = "image/png") {
  return `data:${mimeType};base64,${buf.toString("base64")}`;
}

async function inspectResourcePack(archivePath) {
  if (!fs.existsSync(archivePath)) {
    throw new Error(`File not found: ${archivePath}`);
  }

  const zip = new StreamZip.async({ file: archivePath });
  try {
    const entries = await zip.entries();
    const entryKeys = Object.keys(entries);

    // Read mcmeta
    let description = "";
    let packFormat = 0;
    if (entries["pack.mcmeta"]) {
      try {
        const rawMeta = await zip.entryData("pack.mcmeta");
        const json = JSON.parse(rawMeta.toString("utf8"));
        description = json.pack?.description || "";
        if (typeof description === "object") {
          description = description.text || JSON.stringify(description);
        }
        packFormat = json.pack?.pack_format || 0;
      } catch {}
    }

    // Read pack.png icon
    let iconDataUrl = null;
    if (entries["pack.png"]) {
      try {
        const iconBuf = await zip.entryData("pack.png");
        iconDataUrl = bufferToDataUrl(iconBuf);
      } catch {}
    }

    // Build entry lookup map for case-insensitive and normalized paths
    const textureMap = new Map();
    for (const key of entryKeys) {
      const lower = key.toLowerCase().replaceAll("\\", "/");
      if (lower.endsWith(".png")) {
        textureMap.set(lower, key);
        // Also map just the filename
        const filename = path.basename(lower);
        if (!textureMap.has(filename)) {
          textureMap.set(filename, key);
        }
      }
    }

    async function getTextureData(candidateNames, dirPrefix = "assets/minecraft/textures/") {
      for (const name of candidateNames) {
        const specificKey = `${dirPrefix}${name}`.toLowerCase();
        let targetEntry = textureMap.get(specificKey);
        if (!targetEntry) {
          targetEntry = textureMap.get(name.toLowerCase());
        }
        if (targetEntry) {
          try {
            const buf = await zip.entryData(targetEntry);
            return bufferToDataUrl(buf);
          } catch {}
        }
      }
      return null;
    }

    // Inspect blocks
    const blocks = [];
    for (const def of BLOCK_DEFINITIONS) {
      if (def.all) {
        const allTexture = await getTextureData(def.all, "assets/minecraft/textures/block/");
        if (allTexture) {
          blocks.push({
            id: def.id,
            name: def.name,
            transparent: Boolean(def.transparent),
            textures: {
              top: allTexture,
              bottom: allTexture,
              sides: allTexture,
              front: allTexture,
              back: allTexture,
              left: allTexture,
              right: allTexture,
            },
          });
        }
      } else {
        const top = await getTextureData(def.top, "assets/minecraft/textures/block/");
        const bottom = def.bottom ? await getTextureData(def.bottom, "assets/minecraft/textures/block/") : top;
        const sides = def.sides ? await getTextureData(def.sides, "assets/minecraft/textures/block/") : top;
        const front = def.front ? await getTextureData(def.front, "assets/minecraft/textures/block/") : sides;

        if (top || sides || front) {
          const fallback = top || sides || front;
          blocks.push({
            id: def.id,
            name: def.name,
            transparent: Boolean(def.transparent),
            textures: {
              top: top || fallback,
              bottom: bottom || fallback,
              sides: sides || fallback,
              front: front || fallback,
              back: sides || fallback,
              left: sides || fallback,
              right: sides || fallback,
            },
          });
        }
      }
    }

    // Inspect items
    const items = [];
    for (const def of ITEM_DEFINITIONS) {
      const tex = await getTextureData(def.files, "assets/minecraft/textures/item/");
      if (tex) {
        items.push({
          id: def.id,
          name: def.name,
          texture: tex,
        });
      }
    }

    return {
      name: path.basename(archivePath, path.extname(archivePath)),
      description,
      packFormat,
      iconDataUrl,
      blocks,
      items,
      totalTextures: textureMap.size,
    };
  } finally {
    await zip.close();
  }
}

async function downloadAndInspectResourcePack({ url, projectId, tempDir }) {
  const fsp = require("node:fs/promises");
  const { downloadFile } = require("./network.cjs");

  const safeTemp = tempDir || path.join(require("node:os").tmpdir(), "onyx-preview-packs");
  await fsp.mkdir(safeTemp, { recursive: true });

  const safeName = (projectId || "pack").replace(/[^a-zA-Z0-9_-]/g, "_");
  const tempFilePath = path.join(safeTemp, `${safeName}_${Date.now()}.zip`);

  await downloadFile({
    url,
    destination: tempFilePath,
  });

  const inspectResult = await inspectResourcePack(tempFilePath);
  return {
    ...inspectResult,
    tempFilePath,
  };
}

async function cleanupPreviewPack(tempFilePath) {
  if (!tempFilePath) return;
  const fsp = require("node:fs/promises");
  try {
    if (fs.existsSync(tempFilePath)) {
      await fsp.unlink(tempFilePath);
    }
  } catch (err) {
    console.warn("Failed to cleanup temp preview pack:", err);
  }
}

async function installPreviewPack({ tempFilePath, destinationFolder, filename }) {
  if (!tempFilePath || !fs.existsSync(tempFilePath)) {
    throw new Error("Preview pack file not found");
  }
  const fsp = require("node:fs/promises");
  await fsp.mkdir(destinationFolder, { recursive: true });
  const destName = filename || path.basename(tempFilePath);
  const targetPath = path.join(destinationFolder, destName);
  await fsp.rename(tempFilePath, targetPath);
  return targetPath;
}

module.exports = {
  inspectResourcePack,
  downloadAndInspectResourcePack,
  cleanupPreviewPack,
  installPreviewPack,
};

