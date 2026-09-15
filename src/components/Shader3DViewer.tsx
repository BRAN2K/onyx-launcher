import React, { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";
import {
  Check,
  CloudRain,
  Cpu,
  Download,
  Eye,
  Flame,
  Layers,
  LoaderCircle,
  Moon,
  Pause,
  Play,
  RotateCcw,
  Sliders,
  Sparkles,
  Sun,
  Sunset,
  Trash2,
  Waves,
  Wind,
  X,
  Zap,
} from "lucide-react";
import type { GameInstance, ShaderPackInspectResult } from "../types";

import texGrassTop from "../assets/minecraft/grass_block_top_tinted.png";
import texGrassSide from "../assets/minecraft/grass_block_side_composite.png";
import texDirt from "../assets/minecraft/dirt.png";
import texStone from "../assets/minecraft/stone.png";
import texStoneN from "../assets/minecraft/stone_n.png";
import texCoalOre from "../assets/minecraft/coal_ore.png";
import texCoalOreN from "../assets/minecraft/coal_ore_n.png";
import texIronOre from "../assets/minecraft/iron_ore.png";
import texIronOreN from "../assets/minecraft/iron_ore_n.png";
import texDiamondOre from "../assets/minecraft/diamond_ore.png";
import texDiamondOreN from "../assets/minecraft/diamond_ore_n.png";
import texCobble from "../assets/minecraft/cobblestone.png";
import texCobbleN from "../assets/minecraft/cobblestone_n.png";
import texOakLog from "../assets/minecraft/oak_log.png";
import texOakLogN from "../assets/minecraft/oak_log_n.png";
import texOakLogTop from "../assets/minecraft/oak_log_top.png";
import texOakLeaves from "../assets/minecraft/oak_leaves_tinted.png";
import texOakPlanks from "../assets/minecraft/oak_planks.png";
import texOakPlanksN from "../assets/minecraft/oak_planks_n.png";
import texSand from "../assets/minecraft/sand.png";
import texTorchStick from "../assets/minecraft/torch_stick.png";
import texTorchTop from "../assets/minecraft/torch_top.png";
import texTorchFlame from "../assets/minecraft/torch_flame.png";
import texWater from "../assets/minecraft/water_still_frame.png";
import texPoppy from "../assets/minecraft/poppy.png";
import texDandelion from "../assets/minecraft/dandelion.png";

interface Shader3DViewerProps {
  packData: ShaderPackInspectResult;
  instances?: GameInstance[];
  onInstall?: (instanceId: string, tempFilePath: string) => Promise<void>;
  onClose: () => void;
}

type TimeOfDay = "noon" | "sunset" | "night" | "rain";

export function Shader3DViewer({
  packData,
  instances = [],
  onInstall,
  onClose,
}: Shader3DViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const worldGroupRef = useRef<THREE.Group | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight | null>(null);
  const torchLightRef = useRef<THREE.PointLight | null>(null);
  const torchFlameGroupRef = useRef<THREE.Group | null>(null);
  const waterMeshRef = useRef<THREE.Mesh | null>(null);
  const leavesMeshesRef = useRef<THREE.Mesh[]>([]);
  const flowerMeshesRef = useRef<THREE.Group[]>([]);
  const normalUpdatersRef = useRef<Array<(enabled: boolean) => void>>([]);

  // Interactive controls state
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>("noon");
  const [activeProfile, setActiveProfile] = useState<string>(() => {
    const list = packData.profiles || [];
    if (list.includes("MEDIUM")) return "MEDIUM";
    if (list.includes("HIGH")) return "HIGH";
    return list[0] || "MEDIUM";
  });

  const [isVanillaMode, setIsVanillaMode] = useState(false);
  const [waterEnabled, setWaterEnabled] = useState(true);
  const [godRaysEnabled, setGodRaysEnabled] = useState(true);
  const [wavingEnabled, setWavingEnabled] = useState(true);
  const [softShadowsEnabled, setSoftShadowsEnabled] = useState(true);
  const [autoRotate, setAutoRotate] = useState(true);

  const [isInstalling, setIsInstalling] = useState(false);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>(
    instances[0]?.id || "",
  );
  const [installedSuccess, setInstalledSuccess] = useState(false);

  // Rotation & Drag state
  const isDraggingRef = useRef(false);
  const prevMousePosRef = useRef({ x: 0, y: 0 });
  const rotationVelocityRef = useRef({ x: 0, y: 0.005 });
  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;

  // Scene setup
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 500;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(6.5, 5.5, 7.5);
    camera.lookAt(0, 0.8, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    const hemiLight = new THREE.HemisphereLight(0x70a0d0, 0x3d3020, 0.6);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);
    hemiLightRef.current = hemiLight;

    const sunLight = new THREE.DirectionalLight(0xfff5e0, 2.2);
    sunLight.position.set(5, 9, 5);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 30;
    const d = 6;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0008;
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    // Build the Minecraft Voxel Island Diorama with Real Textures
    const worldGroup = new THREE.Group();
    worldGroupRef.current = worldGroup;
    scene.add(worldGroup);

    const boxGeo = new THREE.BoxGeometry(1, 1, 1);

    // Pixel texture loader helper (NearestFilter for authentic 16x16 Minecraft pixels)
    const texLoader = new THREE.TextureLoader();
    const loadPixelTex = (url: string) => {
      const tex = texLoader.load(url);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };

    // Load authentic Minecraft textures
    const grassTopTex = loadPixelTex(texGrassTop);
    const grassSideTex = loadPixelTex(texGrassSide);
    const dirtTex = loadPixelTex(texDirt);
    const stoneTex = loadPixelTex(texStone);
    const stoneNTex = loadPixelTex(texStoneN);
    const coalOreTex = loadPixelTex(texCoalOre);
    const coalOreNTex = loadPixelTex(texCoalOreN);
    const ironOreTex = loadPixelTex(texIronOre);
    const ironOreNTex = loadPixelTex(texIronOreN);
    const diamondOreTex = loadPixelTex(texDiamondOre);
    const diamondOreNTex = loadPixelTex(texDiamondOreN);
    const cobbleTex = loadPixelTex(texCobble);
    const cobbleNTex = loadPixelTex(texCobbleN);
    const oakLogTex = loadPixelTex(texOakLog);
    const oakLogNTex = loadPixelTex(texOakLogN);
    const oakLogTopTex = loadPixelTex(texOakLogTop);
    const oakLeavesTex = loadPixelTex(texOakLeaves);
    const oakPlanksTex = loadPixelTex(texOakPlanks);
    const oakPlanksNTex = loadPixelTex(texOakPlanksN);
    const sandTex = loadPixelTex(texSand);
    const torchStickTex = loadPixelTex(texTorchStick);
    const torchTopTex = loadPixelTex(texTorchTop);
    const torchFlameTex = loadPixelTex(texTorchFlame);
    const waterTex = loadPixelTex(texWater);

    // Shared Minecraft voxel materials with real textures
    // Grass block: BoxGeometry order [+X, -X, +Y, -Y, +Z, -Z]
    const matGrassSide = new THREE.MeshStandardMaterial({ map: grassSideTex, roughness: 0.85 });
    const matGrassTop = new THREE.MeshStandardMaterial({ map: grassTopTex, roughness: 0.85 });
    const matDirt = new THREE.MeshStandardMaterial({ map: dirtTex, roughness: 0.95 });
    const grassBlockMats = [matGrassSide, matGrassSide, matGrassTop, matDirt, matGrassSide, matGrassSide];

    // Stone & Ores with PBR normal maps
    const matStone = new THREE.MeshStandardMaterial({
      map: stoneTex,
      normalMap: stoneNTex,
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughness: 0.9,
    });
    const matCoalOre = new THREE.MeshStandardMaterial({
      map: coalOreTex,
      normalMap: coalOreNTex,
      normalScale: new THREE.Vector2(0.7, 0.7),
      roughness: 0.85,
    });
    const matIronOre = new THREE.MeshStandardMaterial({
      map: ironOreTex,
      normalMap: ironOreNTex,
      normalScale: new THREE.Vector2(0.7, 0.7),
      roughness: 0.8,
    });
    const matDiamondOre = new THREE.MeshStandardMaterial({
      map: diamondOreTex,
      normalMap: diamondOreNTex,
      normalScale: new THREE.Vector2(0.8, 0.8),
      roughness: 0.75,
      emissive: 0x003344,
      emissiveIntensity: 0.35,
    });
    const matCobble = new THREE.MeshStandardMaterial({
      map: cobbleTex,
      normalMap: cobbleNTex,
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughness: 0.9,
    });
    const matSand = new THREE.MeshStandardMaterial({
      map: sandTex,
      roughness: 0.95,
    });

    // Oak Log: side bark vs top rings
    const matOakLogSide = new THREE.MeshStandardMaterial({
      map: oakLogTex,
      normalMap: oakLogNTex,
      normalScale: new THREE.Vector2(0.6, 0.6),
      roughness: 0.8,
    });
    const matOakLogTop = new THREE.MeshStandardMaterial({
      map: oakLogTopTex,
      roughness: 0.85,
    });
    const logBlockMats = [matOakLogSide, matOakLogSide, matOakLogTop, matOakLogTop, matOakLogSide, matOakLogSide];

    // Foliage (alpha cutout like real Minecraft leaves)
    const matLeaves = new THREE.MeshStandardMaterial({
      map: oakLeavesTex,
      roughness: 0.6,
      transparent: true,
      alphaTest: 0.15,
    });

    // Planks (Fence / Post)
    const matPlanks = new THREE.MeshStandardMaterial({
      map: oakPlanksTex,
      normalMap: oakPlanksNTex,
      normalScale: new THREE.Vector2(0.5, 0.5),
      roughness: 0.8,
    });

    // Register normal map updaters for Vanilla vs Shader toggle
    normalUpdatersRef.current = [
      (on: boolean) => { matStone.normalMap = on ? stoneNTex : null; matStone.needsUpdate = true; },
      (on: boolean) => { matCoalOre.normalMap = on ? coalOreNTex : null; matCoalOre.needsUpdate = true; },
      (on: boolean) => { matIronOre.normalMap = on ? ironOreNTex : null; matIronOre.needsUpdate = true; },
      (on: boolean) => { matDiamondOre.normalMap = on ? diamondOreNTex : null; matDiamondOre.needsUpdate = true; },
      (on: boolean) => { matCobble.normalMap = on ? cobbleNTex : null; matCobble.needsUpdate = true; },
      (on: boolean) => { matOakLogSide.normalMap = on ? oakLogNTex : null; matOakLogSide.needsUpdate = true; },
      (on: boolean) => { matPlanks.normalMap = on ? oakPlanksNTex : null; matPlanks.needsUpdate = true; },
    ];

    const addBlock = (x: number, y: number, z: number, mat: THREE.Material | THREE.Material[]) => {
      const mesh = new THREE.Mesh(boxGeo, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      worldGroup.add(mesh);
      return mesh;
    };

    // 1. Bedrock & Stone base (5x5)
    for (let x = -2; x <= 2; x++) {
      for (let z = -2; z <= 2; z++) {
        // Deep foundation: stone and cobblestone accents
        if (Math.abs(x) === 2 && Math.abs(z) === 2) {
          addBlock(x, -1, z, matCobble);
        } else {
          addBlock(x, -1, z, matStone);
        }

        // Mid layer: mix in diamond/iron/coal ores, sand under pond
        const isPond = x >= 0 && x <= 1 && z >= 0 && z <= 1;
        if (isPond) {
          if (x === 0 && z === 0) addBlock(x, 0, z, matCobble);
          else addBlock(x, 0, z, matSand);
        } else if (x === 1 && z === -1) {
          addBlock(x, 0, z, matCoalOre);
        } else if (x === -2 && z === 1) {
          addBlock(x, 0, z, matIronOre);
        } else if (x === 2 && z === -1) {
          addBlock(x, 0, z, matDiamondOre);
        } else {
          addBlock(x, 0, z, matDirt);
        }

        // Top surface layer: grass blocks, or sand near water
        if (!isPond) {
          if ((x === -1 && z === 0) || (x === 2 && z === 1)) {
            addBlock(x, 1, z, matSand);
          } else {
            addBlock(x, 1, z, grassBlockMats);
          }
        }
      }
    }

    // Elevated cliff steps
    addBlock(-2, 1, -2, matDirt);
    addBlock(-2, 2, -2, grassBlockMats);
    addBlock(-1, 2, -2, grassBlockMats);
    addBlock(-2, 2, -1, grassBlockMats);

    // 2. Oak Tree (at -1, 1, 0)
    const treeX = -1;
    const treeZ = 0;
    addBlock(treeX, 2, treeZ, logBlockMats);
    addBlock(treeX, 3, treeZ, logBlockMats);
    addBlock(treeX, 4, treeZ, logBlockMats);

    const leaves: THREE.Mesh[] = [];
    for (let lx = -1; lx <= 1; lx++) {
      for (let lz = -1; lz <= 1; lz++) {
        for (let ly = 4; ly <= 5; ly++) {
          if (lx === 0 && lz === 0 && ly === 4) continue; // tree trunk
          const leafMesh = addBlock(treeX + lx, ly, treeZ + lz, matLeaves);
          leaves.push(leafMesh);
        }
      }
    }
    // Tree top cap
    leaves.push(addBlock(treeX, 6, treeZ, matLeaves));
    leaves.push(addBlock(treeX + 1, 5, treeZ, matLeaves));
    leaves.push(addBlock(treeX - 1, 5, treeZ, matLeaves));
    leavesMeshesRef.current = leaves;

    // 3. Flowers on grass (Poppy and Dandelion)
    const flowerGeo = new THREE.PlaneGeometry(0.7, 0.7);
    const flowerGroups: THREE.Group[] = [];
    const addFlower = (x: number, y: number, z: number, tex: string) => {
      const group = new THREE.Group();
      const fMat = new THREE.MeshStandardMaterial({
        map: loadPixelTex(tex),
        transparent: true,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
        roughness: 0.7,
      });
      const p1 = new THREE.Mesh(flowerGeo, fMat);
      p1.rotation.y = Math.PI / 4;
      p1.castShadow = true;
      const p2 = new THREE.Mesh(flowerGeo, fMat);
      p2.rotation.y = -Math.PI / 4;
      p2.castShadow = true;
      group.add(p1, p2);
      group.position.set(x, y + 0.35, z);
      worldGroup.add(group);
      flowerGroups.push(group);
      return group;
    };
    addFlower(1.2, 1.0, -0.6, texPoppy);
    addFlower(-1.4, 1.0, 1.3, texDandelion);
    addFlower(-2.0, 2.0, -1.0, texPoppy);
    flowerMeshesRef.current = flowerGroups;

    // 4. Wooden Fence Post & Authentic Minecraft Torch
    const fenceGeo = new THREE.BoxGeometry(0.22, 0.85, 0.22);
    const fenceMesh = new THREE.Mesh(fenceGeo, matPlanks);
    fenceMesh.position.set(1.4, 1.925, -1.4);
    fenceMesh.castShadow = true;
    fenceMesh.receiveShadow = true;
    worldGroup.add(fenceMesh);

    // Authentic Minecraft Torch stick (2x10 pixel standard)
    const torchGeo = new THREE.BoxGeometry(0.125, 0.625, 0.125);
    const matTorchSide = new THREE.MeshStandardMaterial({
      map: torchStickTex,
      roughness: 0.8,
    });
    const matTorchTop = new THREE.MeshStandardMaterial({
      map: torchTopTex,
      emissive: 0xffaa00,
      emissiveIntensity: 1.6,
      roughness: 0.3,
    });
    // Box order: [+X, -X, +Y, -Y, +Z, -Z]
    const torchMats = [matTorchSide, matTorchSide, matTorchTop, matTorchSide, matTorchSide, matTorchSide];
    const torchMesh = new THREE.Mesh(torchGeo, torchMats);
    torchMesh.position.set(1.4, 2.6625, -1.4);
    torchMesh.castShadow = true;
    worldGroup.add(torchMesh);

    // Dancing fire flame particle sprite on top of the torch
    const flameGroup = new THREE.Group();
    flameGroup.position.set(1.4, 3.02, -1.4);
    const flameGeo = new THREE.PlaneGeometry(0.24, 0.28);
    const matFlame = new THREE.MeshBasicMaterial({
      map: torchFlameTex,
      transparent: true,
      alphaTest: 0.1,
      side: THREE.DoubleSide,
    });
    const fp1 = new THREE.Mesh(flameGeo, matFlame);
    fp1.rotation.y = Math.PI / 4;
    const fp2 = new THREE.Mesh(flameGeo, matFlame);
    fp2.rotation.y = -Math.PI / 4;
    const flameCore = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.08, 0.06),
      new THREE.MeshBasicMaterial({ color: 0xfff6c0 })
    );
    flameGroup.add(fp1, fp2, flameCore);
    worldGroup.add(flameGroup);
    torchFlameGroupRef.current = flameGroup;

    // Torch warm point light casting dynamic soft shadows
    const torchLight = new THREE.PointLight(0xff9922, 2.7, 8, 1.4);
    torchLight.position.set(1.4, 3.05, -1.4);
    torchLight.castShadow = true;
    worldGroup.add(torchLight);
    torchLightRef.current = torchLight;

    // 5. Realistic Shader Water Pool with animated texture
    const waterGeo = new THREE.BoxGeometry(1.96, 0.78, 1.96, 16, 1, 16);
    const waterMat = new THREE.MeshPhysicalMaterial({
      map: waterTex,
      color: 0x1f74a8,
      transparent: true,
      opacity: 0.74,
      roughness: 0.08,
      metalness: 0.05,
      transmission: 0.65,
      ior: 1.333,
      reflectivity: 0.9,
    });
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.position.set(0.5, 0.65, 0.5);
    waterMesh.receiveShadow = true;
    worldGroup.add(waterMesh);
    waterMeshRef.current = waterMesh;

    // Floor shadow circle
    const shadowGeo = new THREE.CircleGeometry(4.2, 32);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.32,
    });
    const groundShadow = new THREE.Mesh(shadowGeo, shadowMat);
    groundShadow.rotation.x = -Math.PI / 2;
    groundShadow.position.y = -1.6;
    scene.add(groundShadow);

    // Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Auto-rotation & drag inertia
      if (worldGroupRef.current) {
        if (autoRotateRef.current && !isDraggingRef.current) {
          worldGroupRef.current.rotation.y += 0.005;
        } else if (!isDraggingRef.current) {
          worldGroupRef.current.rotation.y += rotationVelocityRef.current.y;
          worldGroupRef.current.rotation.x += rotationVelocityRef.current.x;
          rotationVelocityRef.current.x *= 0.92;
          rotationVelocityRef.current.y *= 0.92;
        }
      }

      // Waving leaves & flowers procedural animation
      if (leavesMeshesRef.current.length > 0) {
        const amp = 0.035;
        leavesMeshesRef.current.forEach((leaf, idx) => {
          leaf.position.y =
            leaf.userData.origY ??
            (leaf.userData.origY = leaf.position.y);
          const offset = idx * 0.4;
          leaf.position.y = leaf.userData.origY + Math.sin(elapsed * 2.5 + offset) * amp;
          leaf.rotation.z = Math.sin(elapsed * 1.8 + offset) * 0.04;
        });
      }

      if (flowerMeshesRef.current.length > 0) {
        flowerMeshesRef.current.forEach((flower, idx) => {
          flower.rotation.z = Math.sin(elapsed * 2.6 + idx * 1.4) * 0.08;
          flower.rotation.x = Math.cos(elapsed * 2.1 + idx * 1.1) * 0.05;
        });
      }

      // Torch animated dancing flame and dynamic flicker
      if (torchFlameGroupRef.current) {
        const pulse = 1.0 + Math.sin(elapsed * 12) * 0.08;
        torchFlameGroupRef.current.scale.set(pulse, 1.0 + Math.cos(elapsed * 10) * 0.1, pulse);
        torchFlameGroupRef.current.rotation.y = elapsed * 1.5;
      }
      if (torchLightRef.current) {
        const flicker = Math.sin(elapsed * 8) * 0.18 + Math.cos(elapsed * 15) * 0.12;
        torchLightRef.current.intensity = Math.max(1.8, 2.6 + flicker);
      }

      // Animated water flowing UVs & ripple
      if (waterMeshRef.current) {
        const wMat = waterMeshRef.current.material as THREE.MeshPhysicalMaterial;
        if (wMat.map) {
          wMat.map.offset.x = (elapsed * 0.04) % 1;
          wMat.map.offset.y = (elapsed * 0.03) % 1;
        }
        waterMeshRef.current.position.y = 0.65 + Math.sin(elapsed * 2.2) * 0.015;
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update Environment / Lighting based on Time of Day & Vanilla toggle
  useEffect(() => {
    const sun = sunLightRef.current;
    const amb = ambientLightRef.current;
    const hemi = hemiLightRef.current;
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const water = waterMeshRef.current;
    if (!sun || !amb || !hemi || !renderer || !scene) return;

    // Toggle normal maps for PBR shader simulation vs flat vanilla
    if (normalUpdatersRef.current.length > 0) {
      normalUpdatersRef.current.forEach((fn) => fn(!isVanillaMode));
    }

    if (isVanillaMode) {
      // Flat vanilla Minecraft lighting (no shadows, harsh full-bright ambient)
      renderer.shadowMap.enabled = false;
      sun.intensity = 0.8;
      sun.position.set(2, 8, 2);
      sun.color.set(0xffffff);
      amb.intensity = 1.3;
      amb.color.set(0xffffff);
      hemi.intensity = 0.5;
      scene.fog = null;
      if (water) {
        const wMat = water.material as THREE.MeshPhysicalMaterial;
        wMat.opacity = 0.85;
        wMat.roughness = 0.6;
        wMat.transmission = 0;
        wMat.needsUpdate = true;
      }
      return;
    }

    // Shader active lighting
    renderer.shadowMap.enabled = softShadowsEnabled;

    if (water) {
      const wMat = water.material as THREE.MeshPhysicalMaterial;
      wMat.transmission = waterEnabled ? 0.65 : 0;
      wMat.roughness = waterEnabled ? 0.08 : 0.4;
      wMat.opacity = waterEnabled ? 0.74 : 0.9;
      wMat.needsUpdate = true;
    }

    switch (timeOfDay) {
      case "noon":
        sun.position.set(4, 9, 4);
        sun.color.set(0xfff8ea);
        sun.intensity = 2.4;
        amb.color.set(0x90b8e8);
        amb.intensity = 0.75;
        hemi.color.set(0x78b0f0);
        hemi.groundColor.set(0x403525);
        hemi.intensity = 0.65;
        scene.fog = null;
        break;

      case "sunset":
        sun.position.set(8, 2.4, 1.2);
        sun.color.set(0xff7722);
        sun.intensity = 2.9;
        amb.color.set(0x4a2a60);
        amb.intensity = 0.65;
        hemi.color.set(0x904030);
        hemi.groundColor.set(0x201525);
        hemi.intensity = 0.55;
        scene.fog = new THREE.FogExp2(0x351a40, 0.045);
        break;

      case "night":
        sun.position.set(-4, 7, -3);
        sun.color.set(0x5a7ab8);
        sun.intensity = 0.7;
        amb.color.set(0x0a1428);
        amb.intensity = 0.35;
        hemi.color.set(0x18243c);
        hemi.groundColor.set(0x060810);
        hemi.intensity = 0.3;
        scene.fog = null;
        break;

      case "rain":
        sun.position.set(2, 6, 2);
        sun.color.set(0x7a8a9a);
        sun.intensity = 1.2;
        amb.color.set(0x243040);
        amb.intensity = 0.8;
        hemi.color.set(0x384858);
        hemi.groundColor.set(0x182028);
        hemi.intensity = 0.5;
        scene.fog = new THREE.FogExp2(0x1d2836, 0.08);
        break;
    }
  }, [timeOfDay, isVanillaMode, waterEnabled, softShadowsEnabled]);

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    prevMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !worldGroupRef.current) return;
    const deltaX = e.clientX - prevMousePosRef.current.x;
    const deltaY = e.clientY - prevMousePosRef.current.y;

    worldGroupRef.current.rotation.y += deltaX * 0.012;
    worldGroupRef.current.rotation.x += deltaY * 0.012;

    rotationVelocityRef.current = {
      x: deltaY * 0.005,
      y: deltaX * 0.005,
    };

    prevMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!cameraRef.current) return;
    cameraRef.current.position.z = Math.min(
      Math.max(cameraRef.current.position.z + e.deltaY * 0.004, 3.5),
      12.0,
    );
  };

  const handleResetCamera = () => {
    if (cameraRef.current) cameraRef.current.position.set(6.5, 5.5, 7.5);
    if (worldGroupRef.current) {
      worldGroupRef.current.rotation.set(0, 0, 0);
    }
  };

  const handleCloseAndCleanup = async () => {
    if (packData.tempFilePath) {
      try {
        await window.onyx.shaderpack.cleanupPreview(packData.tempFilePath);
      } catch {}
    }
    onClose();
  };

  const handleApplyInstall = async () => {
    if (!packData.tempFilePath || !selectedInstanceId) return;
    setIsInstalling(true);
    try {
      if (onInstall) {
        await onInstall(selectedInstanceId, packData.tempFilePath);
      } else {
        await window.onyx.shaderpack.installPreview({
          tempFilePath: packData.tempFilePath,
          instanceId: selectedInstanceId,
          filename: `${packData.name}.zip`,
        });
      }
      setInstalledSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err) {
      console.error(err);
    } finally {
      setIsInstalling(false);
    }
  };

  const getSkyBackgroundClass = () => {
    if (isVanillaMode) return "shader-bg--vanilla";
    switch (timeOfDay) {
      case "noon":
        return "shader-bg--noon";
      case "sunset":
        return "shader-bg--sunset";
      case "night":
        return "shader-bg--night";
      case "rain":
        return "shader-bg--rain";
    }
  };

  return (
    <div className="rpack-preview-modal-overlay">
      <div className="rpack-preview-modal shader-preview-modal glass-panel">
        {/* Header */}
        <div className="rpack-preview-header">
          <div className="rpack-preview-title-box">
            <div className="rpack-preview-icon-frame shader-icon-frame">
              {packData.iconDataUrl ? (
                <img src={packData.iconDataUrl} alt="" />
              ) : (
                <Sparkles size={22} color="#4fd1c5" />
              )}
            </div>
            <div>
              <div className="rpack-badge-row">
                <span className="rpack-tag rpack-tag--teal">3D Shader Studio</span>
                <span
                  className={`rpack-tag ${
                    packData.performanceTier?.tier === "low"
                      ? "rpack-tag--green"
                      : packData.performanceTier?.tier === "rtx"
                        ? "rpack-tag--purple"
                        : "rpack-tag--blue"
                  }`}
                >
                  {packData.performanceTier?.label || "Шейдер"}
                </span>
                <span className="rpack-tag">{packData.profiles?.length || 4} профиля</span>
              </div>
              <h2>{packData.name}</h2>
            </div>
          </div>

          <button
            type="button"
            className="icon-button rpack-close-btn"
            onClick={handleCloseAndCleanup}
            title="Закрыть и очистить кэш"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body: 3D Stage + Shader Controls */}
        <div className="rpack-preview-body">
          {/* Left: Interactive 3D Canvas with Sky backdrop */}
          <div
            className={`rpack-3d-stage shader-stage ${getSkyBackgroundClass()}`}
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            {/* Stage Toolbar */}
            <div className="rpack-stage-toolbar">
              <button
                type="button"
                className={`rpack-tool-btn ${autoRotate ? "is-active" : ""}`}
                onClick={() => setAutoRotate(!autoRotate)}
                title={autoRotate ? "Пауза вращения" : "Включить авто-вращение"}
              >
                {autoRotate ? <Pause size={13} /> : <Play size={13} />}
                <span>{autoRotate ? "Вращение" : "Стоп"}</span>
              </button>

              <button
                type="button"
                className="rpack-tool-btn"
                onClick={handleResetCamera}
                title="Сбросить камеру"
              >
                <RotateCcw size={13} />
                <span>Сброс</span>
              </button>

              {/* Vanilla Comparison Mode Toggle */}
              <button
                type="button"
                className={`rpack-tool-btn shader-compare-btn ${isVanillaMode ? "is-vanilla" : "is-shaded"}`}
                onClick={() => setIsVanillaMode(!isVanillaMode)}
                title="Сравнить освещение ванильного Minecraft и шейдера"
              >
                <Eye size={13} />
                <span>{isVanillaMode ? "Ваниль (Без шейдера)" : "Шейдер Active"}</span>
              </button>
            </div>

            {/* Hint overlay */}
            <div className="rpack-stage-hint">
              <span>Крути мышью · Колесико — зум</span>
            </div>

            {/* Atmospheric Mood Badge */}
            <div className="rpack-stage-current-label">
              <strong>
                {isVanillaMode
                  ? "Ванильный рендеринг (Плоский)"
                  : timeOfDay === "noon"
                    ? "☀️ Полдень · Чистое небо"
                    : timeOfDay === "sunset"
                      ? "🌅 Золотой час · Закатные тени"
                      : timeOfDay === "night"
                        ? "🌙 Полнолуние · Свет факела"
                        : "🌧️ Дождь · Кинематографичный туман"}
              </strong>
            </div>
          </div>

          {/* Right: Shader Control Center & Diagnostics */}
          <div className="rpack-selector-sidebar shader-sidebar">
            {/* Performance Tier Card */}
            <div className="shader-perf-card">
              <div className="shader-perf-header">
                <Cpu size={16} className="shader-perf-icon" />
                <strong>Производительность</strong>
                <span className="shader-fps-badge">
                  {packData.performanceTier?.fpsEstimate || "~60-120 FPS"}
                </span>
              </div>
              <p className="shader-perf-desc">
                {packData.performanceTier?.recommendation ||
                  "Оптимален для большинства игровых видеокарт."}
              </p>
            </div>

            {/* Time of Day Switcher */}
            <div className="shader-section">
              <span className="shader-section-title">
                <Sun size={14} /> Время суток и атмосфера
              </span>
              <div className="shader-time-grid">
                <button
                  type="button"
                  className={`shader-time-btn ${timeOfDay === "noon" ? "is-active" : ""}`}
                  onClick={() => setTimeOfDay("noon")}
                >
                  <Sun size={15} />
                  <span>День</span>
                </button>
                <button
                  type="button"
                  className={`shader-time-btn ${timeOfDay === "sunset" ? "is-active" : ""}`}
                  onClick={() => setTimeOfDay("sunset")}
                >
                  <Sunset size={15} />
                  <span>Закат</span>
                </button>
                <button
                  type="button"
                  className={`shader-time-btn ${timeOfDay === "night" ? "is-active" : ""}`}
                  onClick={() => setTimeOfDay("night")}
                >
                  <Moon size={15} />
                  <span>Ночь</span>
                </button>
                <button
                  type="button"
                  className={`shader-time-btn ${timeOfDay === "rain" ? "is-active" : ""}`}
                  onClick={() => setTimeOfDay("rain")}
                >
                  <CloudRain size={15} />
                  <span>Дождь</span>
                </button>
              </div>
            </div>

            {/* Profiles / Presets */}
            {packData.profiles && packData.profiles.length > 0 && (
              <div className="shader-section">
                <span className="shader-section-title">
                  <Sliders size={14} /> Профиль качества (Пресет)
                </span>
                <div className="shader-profile-row">
                  {packData.profiles.slice(0, 5).map((profile) => (
                    <button
                      key={profile}
                      type="button"
                      className={`shader-profile-btn ${activeProfile === profile ? "is-active" : ""}`}
                      onClick={() => setActiveProfile(profile)}
                    >
                      {profile}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Feature Toggles */}
            <div className="shader-section">
              <span className="shader-section-title">
                <Zap size={14} /> Эффекты шейдера
              </span>
              <div className="shader-toggle-list">
                <label className="shader-toggle-item">
                  <div className="shader-toggle-label">
                    <Waves size={14} />
                    <span>Физика и прозрачность воды</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={waterEnabled}
                    onChange={(e) => setWaterEnabled(e.target.checked)}
                    disabled={isVanillaMode}
                  />
                </label>

                <label className="shader-toggle-item">
                  <div className="shader-toggle-label">
                    <Wind size={14} />
                    <span>Качание листвы и растений</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={wavingEnabled}
                    onChange={(e) => setWavingEnabled(e.target.checked)}
                    disabled={isVanillaMode}
                  />
                </label>

                <label className="shader-toggle-item">
                  <div className="shader-toggle-label">
                    <Sparkles size={14} />
                    <span>Мягкие тени и полутень</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={softShadowsEnabled}
                    onChange={(e) => setSoftShadowsEnabled(e.target.checked)}
                    disabled={isVanillaMode}
                  />
                </label>
              </div>
            </div>

            {/* Detected capabilities checklist */}
            <div className="shader-section shader-section--caps">
              <span className="shader-section-title">
                <Layers size={14} /> Возможности шейдерпака
              </span>
              <div className="shader-caps-grid">
                <span className={`shader-cap-chip ${packData.features?.water ? "is-supported" : ""}`}>
                  {packData.features?.water ? "✓" : "–"} Отражения воды
                </span>
                <span className={`shader-cap-chip ${packData.features?.shadows ? "is-supported" : ""}`}>
                  {packData.features?.shadows ? "✓" : "–"} Динамические тени
                </span>
                <span className={`shader-cap-chip ${packData.features?.bloom ? "is-supported" : ""}`}>
                  {packData.features?.bloom ? "✓" : "–"} HDR Свечение (Bloom)
                </span>
                <span className={`shader-cap-chip ${packData.features?.godrays ? "is-supported" : ""}`}>
                  {packData.features?.godrays ? "✓" : "–"} Солнечные лучи
                </span>
                <span className={`shader-cap-chip ${packData.features?.waving ? "is-supported" : ""}`}>
                  {packData.features?.waving ? "✓" : "–"} Анимация листвы
                </span>
                <span className={`shader-cap-chip ${packData.features?.dof ? "is-supported" : ""}`}>
                  {packData.features?.dof ? "✓" : "–"} Глубина резкости (DoF)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer: Install or Discard */}
        <div className="rpack-preview-footer">
          <div className="rpack-footer-left">
            {packData.tempFilePath && (
              <span className="rpack-temp-note">
                <Trash2 size={12} />
                При закрытии временный файл скачивания удалится без следа
              </span>
            )}
          </div>

          <div className="rpack-footer-actions">
            <button
              type="button"
              className="button button--ghost"
              onClick={handleCloseAndCleanup}
              disabled={isInstalling}
            >
              Отмена
            </button>

            {packData.tempFilePath && instances.length > 0 && (
              <div className="rpack-install-combo">
                <select
                  value={selectedInstanceId}
                  onChange={(e) => setSelectedInstanceId(e.target.value)}
                  className="rpack-instance-select"
                >
                  {instances.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.name} ({inst.version})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  className="button button--primary"
                  onClick={handleApplyInstall}
                  disabled={isInstalling || installedSuccess}
                >
                  {isInstalling ? (
                    <LoaderCircle size={14} className="spin" />
                  ) : installedSuccess ? (
                    <Check size={14} />
                  ) : (
                    <Download size={14} />
                  )}
                  <span>
                    {installedSuccess
                      ? "Установлено!"
                      : isInstalling
                        ? "Установка..."
                        : "Установить шейдер"}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
