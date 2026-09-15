const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const StreamZip = require("node-stream-zip");
const { downloadFile } = require("./network.cjs");

/**
 * Known blocks that have distinct multi-face textures
 */
const MULTI_FACE_BLOCKS = [
  {
    id: "crafting_table",
    name: "Верстак",
    top: ["crafting_table_top.png"],
    bottom: ["oak_planks.png", "crafting_table_bottom.png"],
    front: ["crafting_table_front.png"],
    sides: ["crafting_table_side.png"],
  },
  {
    id: "furnace",
    name: "Печь",
    top: ["furnace_top.png"],
    bottom: ["cobblestone.png", "furnace_top.png"],
    front: ["furnace_front.png", "furnace_front_on.png"],
    sides: ["furnace_side.png"],
  },
  {
    id: "blast_furnace",
    name: "Плавильная печь",
    top: ["blast_furnace_top.png"],
    bottom: ["smooth_stone.png", "blast_furnace_top.png"],
    front: ["blast_furnace_front.png", "blast_furnace_front_on.png"],
    sides: ["blast_furnace_side.png"],
  },
  {
    id: "smoker",
    name: "Коптильня",
    top: ["smoker_top.png"],
    bottom: ["smoker_bottom.png"],
    front: ["smoker_front.png", "smoker_front_on.png"],
    sides: ["smoker_side.png"],
  },
  {
    id: "grass_block",
    name: "Блок дёрна",
    top: ["grass_block_top.png"],
    bottom: ["dirt.png"],
    sides: ["grass_block_side.png"],
  },
  {
    id: "podzol",
    name: "Подзол",
    top: ["podzol_top.png"],
    bottom: ["dirt.png"],
    sides: ["podzol_side.png"],
  },
  {
    id: "mycelium",
    name: "Мицелий",
    top: ["mycelium_top.png"],
    bottom: ["dirt.png"],
    sides: ["mycelium_side.png"],
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
    id: "ancient_debris",
    name: "Древние обломки",
    top: ["ancient_debris_top.png"],
    bottom: ["ancient_debris_top.png"],
    sides: ["ancient_debris_side.png"],
  },
  {
    id: "barrel",
    name: "Бочка",
    top: ["barrel_top.png", "barrel_top_open.png"],
    bottom: ["barrel_bottom.png"],
    sides: ["barrel_side.png"],
  },
  {
    id: "bee_nest",
    name: "Пчелиное гнездо",
    top: ["bee_nest_top.png"],
    bottom: ["bee_nest_bottom.png"],
    front: ["bee_nest_front.png", "bee_nest_front_honey.png"],
    sides: ["bee_nest_side.png"],
  },
  {
    id: "beehive",
    name: "Улей",
    top: ["beehive_end.png"],
    bottom: ["beehive_end.png"],
    front: ["beehive_front.png", "beehive_front_honey.png"],
    sides: ["beehive_side.png"],
  },
  {
    id: "hay_block",
    name: "Сноп сена",
    top: ["hay_block_top.png"],
    bottom: ["hay_block_top.png"],
    sides: ["hay_block_side.png"],
  },
  {
    id: "carved_pumpkin",
    name: "Вырезанная тыква",
    top: ["pumpkin_top.png"],
    bottom: ["pumpkin_top.png"],
    front: ["carved_pumpkin.png"],
    sides: ["pumpkin_side.png"],
  },
  {
    id: "jack_o_lantern",
    name: "Светильник Джека",
    top: ["pumpkin_top.png"],
    bottom: ["pumpkin_top.png"],
    front: ["jack_o_lantern.png"],
    sides: ["pumpkin_side.png"],
  },
  {
    id: "melon",
    name: "Арбуз",
    top: ["melon_top.png"],
    bottom: ["melon_top.png"],
    sides: ["melon_side.png"],
  },
  {
    id: "target",
    name: "Мишень",
    top: ["target_top.png"],
    bottom: ["target_top.png"],
    sides: ["target_side.png"],
  },
  {
    id: "dispenser",
    name: "Раздатчик",
    top: ["furnace_top.png"],
    bottom: ["furnace_top.png"],
    front: ["dispenser_front.png"],
    sides: ["furnace_side.png"],
  },
  {
    id: "dropper",
    name: "Выбрасыватель",
    top: ["furnace_top.png"],
    bottom: ["furnace_top.png"],
    front: ["dropper_front.png"],
    sides: ["furnace_side.png"],
  },
  {
    id: "observer",
    name: "Наблюдатель",
    top: ["observer_top.png"],
    bottom: ["observer_top.png"],
    front: ["observer_front.png"],
    sides: ["observer_side.png"],
    back: ["observer_back.png", "observer_back_on.png"],
  },
  {
    id: "oak_log",
    name: "Дубовое бревно",
    top: ["oak_log_top.png"],
    bottom: ["oak_log_top.png"],
    sides: ["oak_log.png"],
  },
  {
    id: "birch_log",
    name: "Берёзовое бревно",
    top: ["birch_log_top.png"],
    bottom: ["birch_log_top.png"],
    sides: ["birch_log.png"],
  },
  {
    id: "spruce_log",
    name: "Еловое бревно",
    top: ["spruce_log_top.png"],
    bottom: ["spruce_log_top.png"],
    sides: ["spruce_log.png"],
  },
  {
    id: "dark_oak_log",
    name: "Бревно тёмного дуба",
    top: ["dark_oak_log_top.png"],
    bottom: ["dark_oak_log_top.png"],
    sides: ["dark_oak_log.png"],
  },
];

/**
 * Universal Russian translations for Minecraft textures
 */
const TRANSLATION_MAP = {
  // Ores
  diamond_ore: "Алмазная руда",
  deepslate_diamond_ore: "Глубинная алмазная руда",
  gold_ore: "Золотая руда",
  deepslate_gold_ore: "Глубинная золотая руда",
  iron_ore: "Железная руда",
  deepslate_iron_ore: "Глубинная железная руда",
  copper_ore: "Медная руда",
  deepslate_copper_ore: "Глубинная медная руда",
  coal_ore: "Угольная руда",
  deepslate_coal_ore: "Глубинная угольная руда",
  emerald_ore: "Изумрудная руда",
  deepslate_emerald_ore: "Глубинная изумрудная руда",
  lapis_ore: "Лазуритовая руда",
  deepslate_lapis_ore: "Глубинная лазуритовая руда",
  redstone_ore: "Редстоуновая руда",
  deepslate_redstone_ore: "Глубинная редстоуновая руда",
  nether_gold_ore: "Золотая руда Незера",
  nether_quartz_ore: "Кварцевая руда",
  ancient_debris: "Древние обломки",
  raw_iron_block: "Блок сырого железа",
  raw_copper_block: "Блок сырой меди",
  raw_gold_block: "Блок сырого золота",

  // Modded ores
  zinc_ore: "Цинковая руда",
  deepslate_zinc_ore: "Глубинная цинковая руда",
  lead_ore: "Свинцовая руда",
  deepslate_lead_ore: "Глубинная свинцовая руда",
  tin_ore: "Оловянная руда",
  deepslate_tin_ore: "Глубинная оловянная руда",
  osmium_ore: "Осмиевая руда",
  deepslate_osmium_ore: "Глубинная осмиевая руда",
  uranium_ore: "Урановая руда",
  deepslate_uranium_ore: "Глубинная урановая руда",
  fluorite_ore: "Флюоритовая руда",
  deepslate_fluorite_ore: "Глубинная флюоритовая руда",
  ruby_ore: "Рубиновая руда",
  sapphire_ore: "Сапфировая руда",

  // Minerals & Precious Blocks
  diamond_block: "Алмазный блок",
  netherite_block: "Незеритовый блок",
  gold_block: "Золотой блок",
  iron_block: "Железный блок",
  copper_block: "Медный блок",
  emerald_block: "Изумрудный блок",
  lapis_block: "Лазуритовый блок",
  redstone_block: "Редстоун блок",
  coal_block: "Угольный блок",
  amethyst_block: "Блок аметиста",
  obsidian: "Обсидиан",
  crying_obsidian: "Плачущий обсидиан",

  // Building & Natural Blocks
  glass: "Стекло",
  tinted_glass: "Тонированное стекло",
  sponge: "Губка",
  wet_sponge: "Мокрая губка",
  sculk: "Скалк",
  sculk_catalyst: "Скалк-катализатор",
  sculk_shrieker: "Скалк-крикун",
  glowstone: "Светящийся камень",
  sea_lantern: "Морской фонарь",
  magma_block: "Блок магмы",
  ice: "Лёд",
  packed_ice: "Плотный лёд",
  blue_ice: "Синий лёд",
  slime_block: "Блок слизи",
  honey_block: "Блок мёда",
  stone: "Камень",
  cobblestone: "Булыжник",
  mossy_cobblestone: "Замшелый булыжник",
  stone_bricks: "Каменные кирпичи",
  mossy_stone_bricks: "Замшелые кирпичи",
  cracked_stone_bricks: "Потрескавшиеся кирпичи",
  deepslate: "Глубинный сланец",
  cobbled_deepslate: "Дроблёный сланец",
  deepslate_bricks: "Кирпичи глубинного сланца",
  deepslate_tiles: "Плитка глубинного сланца",
  bricks: "Кирпичи",
  mud_bricks: "Саманные кирпичи",
  prismarine: "Призмарин",
  dark_prismarine: "Тёмный призмарин",
  end_stone: "Эндерняк",
  end_stone_bricks: "Кирпичи Энда",
  purpur_block: "Пурпурный блок",
  netherrack: "Незерак",
  nether_bricks: "Незеритовые кирпичи",
  blackstone: "Чернит",
  gilded_blackstone: "Золочёный чернит",
  basalt: "Базальт",
  smooth_basalt: "Гладкий базальт",
  sandstone: "Песчаник",
  red_sandstone: "Красный песчаник",
  chiseled_bookshelf: "Резная книжная полка",

  // Planks
  oak_planks: "Дубовые доски",
  spruce_planks: "Еловые доски",
  birch_planks: "Берёзовые доски",
  jungle_planks: "Доски джунглей",
  acacia_planks: "Акациевые доски",
  dark_oak_planks: "Доски тёмного дуба",
  mangrove_planks: "Мангровые доски",
  cherry_planks: "Вишнёвые доски",
  bamboo_planks: "Бамбуковые доски",
  crimson_planks: "Багровые доски",
  warped_planks: "Искажённые доски",

  // Swords
  wooden_sword: "Деревянный меч",
  stone_sword: "Каменный меч",
  iron_sword: "Железный меч",
  golden_sword: "Золотой меч",
  diamond_sword: "Алмазный меч",
  netherite_sword: "Незеритовый меч",
  copper_sword: "Медный меч",

  // Tools
  wooden_pickaxe: "Деревянная кирка",
  stone_pickaxe: "Каменная кирка",
  iron_pickaxe: "Железная кирка",
  golden_pickaxe: "Золотая кирка",
  diamond_pickaxe: "Алмазная кирка",
  netherite_pickaxe: "Незеритовая кирка",

  wooden_axe: "Деревянный топор",
  stone_axe: "Каменный топор",
  iron_axe: "Железный топор",
  golden_axe: "Золотой топор",
  diamond_axe: "Алмазный топор",
  netherite_axe: "Незеритовый топор",

  wooden_shovel: "Деревянная лопата",
  stone_shovel: "Каменная лопата",
  iron_shovel: "Железная лопата",
  golden_shovel: "Золотая лопата",
  diamond_shovel: "Алмазная лопата",
  netherite_shovel: "Незеритовая лопата",

  wooden_hoe: "Деревянная мотыга",
  stone_hoe: "Каменная мотыга",
  iron_hoe: "Железная мотыга",
  golden_hoe: "Золотая мотыга",
  diamond_hoe: "Алмазная мотыга",
  netherite_hoe: "Незеритовая мотыга",

  // Combat & Utility
  bow: "Лук",
  crossbow: "Арбалет",
  arrow: "Стрела",
  spectral_arrow: "Спектральная стрела",
  trident: "Трезубец",
  mace: "Булава",
  shield: "Щит",
  wind_charge: "Ветровой заряд",
  totem_of_undying: "Тотем бессмертия",
  golden_apple: "Золотое яблоко",
  enchanted_golden_apple: "Зачарованное золотое яблоко",
  ender_pearl: "Жемчуг Края",
  ender_eye: "Око Края",
  fire_charge: "Огненный шар",
  flint_and_steel: "Огниво",
  shears: "Ножницы",
  fishing_rod: "Удочка",
  lead: "Поводок",
  name_tag: "Бирка",
  compass: "Компас",
  clock: "Часы",
  recovery_compass: "Компас возрождения",
  spyglass: "Подзорная труба",
  elytra: "Элитры",

  // Armor
  netherite_helmet: "Незеритовый шлем",
  netherite_chestplate: "Незеритовый нагрудник",
  netherite_leggings: "Незеритовые поножи",
  netherite_boots: "Незеритовые ботинки",
  diamond_helmet: "Алмазный шлем",
  diamond_chestplate: "Алмазный нагрудник",
  diamond_leggings: "Алмазные поножи",
  diamond_boots: "Алмазные ботинки",
  iron_helmet: "Железный шлем",
  iron_chestplate: "Железный нагрудник",
  iron_leggings: "Железные поножи",
  iron_boots: "Железные ботинки",
  golden_helmet: "Золотой шлем",
  golden_chestplate: "Золотой нагрудник",
  golden_leggings: "Золотые поножи",
  golden_boots: "Золотые ботинки",
  turtle_helmet: "Черепаший панцирь",

  // Materials & Drops
  diamond: "Алмаз",
  emerald: "Изумруд",
  netherite_ingot: "Незеритовый слиток",
  netherite_scrap: "Незеритовый лом",
  gold_ingot: "Золотой слиток",
  iron_ingot: "Железный слиток",
  copper_ingot: "Медный слиток",
  raw_iron: "Сырое железо",
  raw_gold: "Сырое золото",
  raw_copper: "Сырая медь",
  lapis_lazuli: "Лазурит",
  redstone: "Редстоун",
  coal: "Уголь",
  charcoal: "Древесный уголь",
  amethyst_shard: "Осколок аметиста",
  echo_shard: "Осколок эха",
  quartz: "Кварц",
  blaze_rod: "Стержень ифрита",
  blaze_powder: "Огненный порошок",
  nether_star: "Звезда Незера",
  ghast_tear: "Слеза гаста",
  shulker_shell: "Панцирь шалкера",
  heart_of_the_sea: "Сердце моря",
  nautilus_shell: "Раковина наутилуса",
  feather: "Перо",
  gunpowder: "Порох",
  string: "Нить",
  bone: "Кость",
  slime_ball: "Сгусток слизи",
  magma_cream: "Сгусток магмы",
  leather: "Кожа",
  phantom_membrane: "Мембрана фантома",

  // Food
  apple: "Яблоко",
  golden_carrot: "Золотая морковь",
  bread: "Хлеб",
  cooked_beef: "Стейк",
  cooked_porkchop: "Жареная свинина",
  cooked_mutton: "Жареная баранина",
  cooked_chicken: "Жареная курица",
  honey_bottle: "Бутылочка мёда",

  // Potions & Brews
  potion: "Зелье",
  splash_potion: "Взрывное зелье",
  lingering_potion: "Оседающее зелье",
  glass_bottle: "Стеклянная колба",
  experience_bottle: "Пузырёк опыта",
};

/**
 * High priority keywords for sorting relevant items/blocks to the top
 */
const POPULAR_KEYWORDS = [
  "ore", "diamond", "netherite", "gold", "iron", "emerald", "copper", "amethyst",
  "crafting_table", "furnace", "tnt", "bookshelf", "obsidian", "glass", "planks",
  "brick", "stone", "cobblestone", "sculk", "sponge", "ice", "sandstone",
  "sword", "pickaxe", "axe", "shovel", "hoe", "apple", "totem", "bow", "pearl",
  "eye", "mace", "trident", "shield", "helmet", "chestplate", "leggings", "boots",
  "elytra", "potion", "bottle", "star", "ingot"
];

function scorePopularity(id) {
  const lower = id.toLowerCase();
  const parts = lower.split("_");
  for (let i = 0; i < POPULAR_KEYWORDS.length; i++) {
    const kw = POPULAR_KEYWORDS[i];
    if (parts.includes(kw) || lower.startsWith(kw) || lower.endsWith(kw)) {
      return 200 - i;
    }
  }
  return 0;
}

function formatDisplayName(id) {
  if (TRANSLATION_MAP[id]) return TRANSLATION_MAP[id];
  return id
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function bufferToDataUrl(buf, mimeType = "image/png") {
  return `data:${mimeType};base64,${buf.toString("base64")}`;
}

const MAX_BLOCKS = 80;
const MAX_ITEMS = 80;
const MAX_GUI = 60;

const GUI_TRANSLATIONS = {
  // Classic GUI containers (both flat and container/ subpath)
  "inventory": "Инвентарь игрока (Survival Inventory)",
  "container/inventory": "Инвентарь игрока (Survival Inventory)",
  "crafting_table": "Верстак (Crafting Table)",
  "container/crafting_table": "Верстак (Crafting Table)",
  "furnace": "Печь (Furnace)",
  "container/furnace": "Печь (Furnace)",
  "blast_furnace": "Плавильная печь (Blast Furnace)",
  "container/blast_furnace": "Плавильная печь (Blast Furnace)",
  "smoker": "Коптильня (Smoker)",
  "container/smoker": "Коптильня (Smoker)",
  "generic_54": "Большой сундук (Double Chest)",
  "container/generic_54": "Большой сундук (Double Chest)",
  "shulker_box": "Шалкеровый ящик (Shulker Box)",
  "container/shulker_box": "Шалкеровый ящик (Shulker Box)",
  "anvil": "Наковальня (Anvil)",
  "container/anvil": "Наковальня (Anvil)",
  "enchanting_table": "Стол зачарования (Enchanting Table)",
  "container/enchanting_table": "Стол зачарования (Enchanting Table)",
  "brewing_stand": "Зельеварочная стойка (Brewing Stand)",
  "container/brewing_stand": "Зельеварочная стойка (Brewing Stand)",
  "beacon": "Маяк (Beacon)",
  "container/beacon": "Маяк (Beacon)",
  "hopper": "Воронка (Hopper)",
  "container/hopper": "Воронка (Hopper)",
  "dispenser": "Раздатчик / Выбрасыватель (Dispenser)",
  "container/dispenser": "Раздатчик / Выбрасыватель (Dispenser)",
  "villager2": "Торговля жителя (Villager Trade)",
  "container/villager2": "Торговля жителя (Villager Trade)",
  "merchant": "Торговля жителя (Merchant)",
  "container/merchant": "Торговля жителя (Merchant)",
  "grindstone": "Точило (Grindstone)",
  "container/grindstone": "Точило (Grindstone)",
  "stonecutter": "Камнерез (Stonecutter)",
  "container/stonecutter": "Камнерез (Stonecutter)",
  "cartography_table": "Стол картографа (Cartography Table)",
  "container/cartography_table": "Стол картографа (Cartography Table)",
  "smithing": "Стол кузнеца (Smithing Table)",
  "container/smithing": "Стол кузнеца (Smithing Table)",
  "loom": "Ткацкий станок (Loom)",
  "container/loom": "Ткацкий станок (Loom)",
  "crafter": "Авто-верстак (Crafter)",
  "container/crafter": "Авто-верстак (Crafter)",
  "horse": "Интерфейс лошади (Horse GUI)",
  "container/horse": "Интерфейс лошади (Horse GUI)",
  "container/creative_inventory/tab_items": "Креативный инвентарь (Items)",
  "container/creative_inventory/tab_inventory": "Креативный инвентарь (Survival)",
  "container/creative_inventory/tabs": "Вкладки креатива (Tabs)",
  "recipe_book": "Книга рецептов (Recipe Book)",
  "container/recipe_book": "Книга рецептов (Recipe Book)",
  // Classic HUD & Widgets
  "widgets": "Хотбар и кнопки (Widgets)",
  "icons": "Индикаторы здоровья, брони и прицел (Icons)",
  "bars": "Полосы боссов и опыта (Bars)",
  "book": "Интерфейс книги (Book GUI)",
  "demo_background": "Фон демо-меню",
  // Title / Logos
  "title/minecraft": "Главный логотип Minecraft",
  "minecraft": "Главный логотип Minecraft",
  "title/edition": "Логотип Edition",
  "title/mojangstudios": "Заставка Mojang Studios",
  // 1.20.2+ modern sprites
  "sprites/hud/hotbar": "Хотбар (Hotbar)",
  "sprites/hud/hotbar_selection": "Выбор слота хотбара",
  "sprites/hud/crosshair": "Прицел (Crosshair)",
  "sprites/hud/crosshair_attack_indicator_full": "Индикатор атаки",
  "sprites/hud/heart/full": "Сердце здоровья",
  "sprites/hud/heart/hardcore_full": "Сердце хардкора",
  "sprites/hud/armor_full": "Иконка брони",
  "sprites/hud/food_full": "Иконка сытости",
  "sprites/hud/air": "Иконка воздуха",
  "sprites/hud/experience_bar_background": "Фон полосы опыта",
  "sprites/hud/experience_bar_progress": "Прогресс полосы опыта",
  "sprites/hud/jump_bar_background": "Полоса прыжка лошади",
};

function formatGuiDisplayName(relId) {
  if (GUI_TRANSLATIONS[relId]) {
    return GUI_TRANSLATIONS[relId];
  }
  const basename = path.basename(relId);
  if (GUI_TRANSLATIONS[basename]) {
    return GUI_TRANSLATIONS[basename];
  }
  if (basename.includes("tab_top_selected") || basename.includes("tab_bottom_selected")) {
    return "Вкладка креатива (Выбранная)";
  }
  if (basename.includes("tab_top_unselected") || basename.includes("tab_bottom_unselected")) {
    return "Вкладка креатива";
  }
  return basename
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function classifyGuiCategory(relId) {
  const p = relId.toLowerCase();
  if (
    p.includes("container") ||
    p.includes("inventory") ||
    p.includes("crafting") ||
    p.includes("furnace") ||
    p.includes("chest") ||
    p.includes("generic_54") ||
    p.includes("anvil") ||
    p.includes("shulker") ||
    p.includes("table") ||
    p.includes("trade") ||
    p.includes("villager")
  ) {
    return "container";
  }
  if (
    p.includes("hud") ||
    p.includes("widgets") ||
    p.includes("icons") ||
    p.includes("hotbar") ||
    p.includes("crosshair") ||
    p.includes("heart") ||
    p.includes("armor") ||
    p.includes("food") ||
    p.includes("bar") ||
    p.includes("air")
  ) {
    return "hud";
  }
  if (p.includes("title") || p.includes("logo") || p.includes("mojang")) {
    return "title";
  }
  return "misc";
}

function scoreGuiPopularity(relId) {
  const p = relId.toLowerCase();
  const basename = path.basename(p, ".png");
  if (basename === "inventory" || p.includes("container/inventory")) return 1000;
  if (basename === "widgets" || basename === "hotbar" || p.includes("hud/hotbar")) return 950;
  if (basename === "icons" || basename === "crosshair" || p.includes("hud/crosshair")) return 900;
  if (basename === "crafting_table" || basename === "furnace" || basename === "generic_54" || basename === "chest") return 850;
  if (basename === "anvil" || basename === "enchanting_table" || basename === "brewing_stand" || basename === "shulker_box") return 800;
  if (basename.includes("heart") || basename.includes("armor") || basename.includes("food")) return 750;
  if (p.includes("title/minecraft") || basename === "minecraft") return 700;
  if (p.startsWith("container/") || p.includes("/container/")) return 500;
  if (p.startsWith("sprites/hud/") || p.includes("/hud/")) return 400;
  if (p.includes("creative_inventory")) return 300;
  return 100;
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
    const mcmetaKey = entryKeys.find((k) => k.toLowerCase().endsWith("pack.mcmeta"));
    if (mcmetaKey) {
      try {
        const rawMeta = await zip.entryData(mcmetaKey);
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
    const iconKey = entryKeys.find((k) => k.toLowerCase().endsWith("pack.png"));
    if (iconKey) {
      try {
        const iconBuf = await zip.entryData(iconKey);
        iconDataUrl = bufferToDataUrl(iconBuf);
      } catch {}
    }

    // Index all textures
    const textureMap = new Map(); // normalized lower key -> entryKey
    const blockCandidates = new Map(); // id -> entryKey
    const itemCandidates = new Map();  // id -> entryKey
    const guiCandidates = new Map();   // relId -> entryKey

    for (const k of entryKeys) {
      if (!k.toLowerCase().endsWith(".png")) continue;
      const lower = k.toLowerCase().replace(/\\/g, "/");

      textureMap.set(lower, k);
      const filename = path.basename(lower);
      if (!textureMap.has(filename)) {
        textureMap.set(filename, k);
      }

      // Skip non-gameplay / metadata suffixes
      if (
        lower.endsWith("_e.png") ||
        lower.endsWith("_n.png") ||
        lower.endsWith("_s.png") ||
        lower.includes("destroy_stage") ||
        lower.includes("/mask/") ||
        lower.includes("_trim.png") ||
        lower.includes("_top_overlay.png")
      ) {
        continue;
      }

      // Block texture
      const bMatch = lower.match(/(?:^|\/)textures\/blocks?\/([^/]+)\.png$/);
      if (bMatch) {
        const id = bMatch[1];
        if (!blockCandidates.has(id)) {
          blockCandidates.set(id, k);
        }
        continue;
      }

      // Item texture
      const iMatch = lower.match(/(?:^|\/)textures\/items?\/([^/]+)\.png$/);
      if (iMatch) {
        const id = iMatch[1];
        if (!itemCandidates.has(id)) {
          itemCandidates.set(id, k);
        }
        continue;
      }

      // GUI texture
      const gMatch = lower.match(/(?:^|\/)textures\/gui\/(.+)\.png$/);
      if (gMatch) {
        const id = gMatch[1];
        if (!guiCandidates.has(id)) {
          guiCandidates.set(id, k);
        }
        continue;
      }
    }

    async function loadEntryDataUrl(entryKey) {
      if (!entryKey) return null;
      try {
        const buf = await zip.entryData(entryKey);
        return bufferToDataUrl(buf);
      } catch {
        return null;
      }
    }

    async function findTexture(candidates, dirPrefix = "assets/minecraft/textures/block/") {
      for (const name of candidates) {
        const specificKey = `${dirPrefix}${name}`.toLowerCase();
        let targetEntry = textureMap.get(specificKey);
        if (!targetEntry) {
          targetEntry = textureMap.get(name.toLowerCase());
        }
        if (targetEntry) {
          const res = await loadEntryDataUrl(targetEntry);
          if (res) return res;
        }
      }
      return null;
    }

    const blocks = [];
    const usedBlockIds = new Set();

    // 1. Process multi-face blocks
    for (const def of MULTI_FACE_BLOCKS) {
      const top = await findTexture(def.top, "assets/minecraft/textures/block/");
      const bottom = def.bottom ? await findTexture(def.bottom, "assets/minecraft/textures/block/") : top;
      const sides = def.sides ? await findTexture(def.sides, "assets/minecraft/textures/block/") : top;
      const front = def.front ? await findTexture(def.front, "assets/minecraft/textures/block/") : sides;

      if (top || sides || front) {
        const fallback = top || sides || front;
        blocks.push({
          id: def.id,
          name: def.name,
          transparent: false,
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

        // Mark candidate filenames as consumed
        for (const list of [def.top, def.bottom, def.sides, def.front]) {
          if (list) {
            for (const f of list) {
              usedBlockIds.add(path.basename(f, ".png"));
            }
          }
        }
        usedBlockIds.add(def.id);
      }
    }

    // 2. Process all remaining block candidates dynamically
    const sortedBlockCandidates = Array.from(blockCandidates.entries())
      .filter(([id]) => !usedBlockIds.has(id))
      .sort(([idA], [idB]) => scorePopularity(idB) - scorePopularity(idA));

    for (const [id, entryKey] of sortedBlockCandidates) {
      if (blocks.length >= MAX_BLOCKS) break;
      // Skip sub-face textures that are parts of multi-face blocks
      if (id.endsWith("_top") || id.endsWith("_bottom") || id.endsWith("_front") || id.endsWith("_side")) {
        const baseId = id.replace(/_(?:top|bottom|front|side)$/, "");
        if (usedBlockIds.has(baseId)) continue;
      }

      const tex = await loadEntryDataUrl(entryKey);
      if (tex) {
        const isGlass = id.includes("glass");
        blocks.push({
          id,
          name: formatDisplayName(id),
          transparent: isGlass,
          textures: {
            top: tex,
            bottom: tex,
            sides: tex,
            front: tex,
            back: tex,
            left: tex,
            right: tex,
          },
        });
      }
    }

    // 3. Process item candidates dynamically
    const items = [];
    const sortedItemCandidates = Array.from(itemCandidates.entries())
      .sort(([idA], [idB]) => scorePopularity(idB) - scorePopularity(idA));

    for (const [id, entryKey] of sortedItemCandidates) {
      if (items.length >= MAX_ITEMS) break;
      const tex = await loadEntryDataUrl(entryKey);
      if (tex) {
        items.push({
          id,
          name: formatDisplayName(id),
          texture: tex,
        });
      }
    }

    // 4. Process GUI candidates dynamically
    const gui = [];
    const sortedGuiCandidates = Array.from(guiCandidates.entries())
      .sort(([idA], [idB]) => scoreGuiPopularity(idB) - scoreGuiPopularity(idA));

    for (const [id, entryKey] of sortedGuiCandidates) {
      if (gui.length >= MAX_GUI) break;
      const tex = await loadEntryDataUrl(entryKey);
      if (tex) {
        gui.push({
          id,
          name: formatGuiDisplayName(id),
          category: classifyGuiCategory(id),
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
      gui,
      totalTextures: textureMap.size,
    };
  } finally {
    await zip.close();
  }
}

async function downloadAndInspectResourcePack({ url, projectId }) {
  const safeTemp = path.join(os.tmpdir(), "onyx-preview-packs");
  await fs.promises.mkdir(safeTemp, { recursive: true });

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
