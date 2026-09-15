import React, { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";
import {
  Box,
  Check,
  Download,
  Flame,
  Layers,
  LoaderCircle,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Sparkles,
  Swords,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import type {
  GameInstance,
  ResourcePackBlockPreview,
  ResourcePackInspectResult,
  ResourcePackItemPreview,
} from "../types";

interface ResourcePack3DViewerProps {
  packData: ResourcePackInspectResult;
  instances?: GameInstance[];
  onInstall?: (instanceId: string, tempFilePath: string) => Promise<void>;
  onClose: () => void;
}

export function ResourcePack3DViewer({
  packData,
  instances = [],
  onInstall,
  onClose,
}: ResourcePack3DViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const currentMeshRef = useRef<THREE.Object3D | null>(null);

  const [activeTab, setActiveTab] = useState<"blocks" | "items">("blocks");
  const [selectedBlockId, setSelectedBlockId] = useState<string>(
    packData.blocks[0]?.id || "",
  );
  const [selectedItemId, setSelectedItemId] = useState<string>(
    packData.items[0]?.id || "",
  );

  const [autoRotate, setAutoRotate] = useState(true);
  const [isInstalling, setIsInstalling] = useState(false);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>(
    instances[0]?.id || "",
  );
  const [installedSuccess, setInstalledSuccess] = useState(false);

  // Rotation & Drag state
  const isDraggingRef = useRef(false);
  const prevMousePosRef = useRef({ x: 0, y: 0 });
  const rotationVelocityRef = useRef({ x: 0, y: 0.006 });
  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;

  const currentBlock = useMemo(
    () => packData.blocks.find((b) => b.id === selectedBlockId) || packData.blocks[0],
    [packData.blocks, selectedBlockId],
  );

  const currentItem = useMemo(
    () => packData.items.find((i) => i.id === selectedItemId) || packData.items[0],
    [packData.items, selectedItemId],
  );

  // Three.js Scene Setup
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 500;
    const height = container.clientHeight || 420;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 1.2, 3.8);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.1);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.6);
    dirLight1.position.set(3, 6, 4);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xaaccff, 0.6);
    dirLight2.position.set(-3, -2, -3);
    scene.add(dirLight2);

    // Subtle floor shadow circle
    const shadowGeo = new THREE.CircleGeometry(1.2, 32);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.25,
    });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -1.1;
    scene.add(shadow);

    let animationFrameId: number;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      if (currentMeshRef.current) {
        if (autoRotateRef.current && !isDraggingRef.current) {
          currentMeshRef.current.rotation.y += 0.008;
        } else if (!isDraggingRef.current) {
          // Damping rotation velocity
          currentMeshRef.current.rotation.y += rotationVelocityRef.current.y;
          currentMeshRef.current.rotation.x += rotationVelocityRef.current.x;
          rotationVelocityRef.current.x *= 0.92;
          rotationVelocityRef.current.y *= 0.92;
        }
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

  // Texture Loader helper with Minecraft NearestFilter
  const loadPixelTexture = (dataUrl: string): THREE.Texture => {
    const loader = new THREE.TextureLoader();
    const texture = loader.load(dataUrl);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  };

  // Build Block Mesh
  useEffect(() => {
    if (activeTab !== "blocks" || !currentBlock || !sceneRef.current) return;

    const scene = sceneRef.current;
    if (currentMeshRef.current) {
      scene.remove(currentMeshRef.current);
    }

    const { textures, transparent } = currentBlock;
    const texRight = loadPixelTexture(textures.right || textures.sides || textures.top);
    const texLeft = loadPixelTexture(textures.left || textures.sides || textures.top);
    const texTop = loadPixelTexture(textures.top);
    const texBottom = loadPixelTexture(textures.bottom || textures.top);
    const texFront = loadPixelTexture(textures.front || textures.sides || textures.top);
    const texBack = loadPixelTexture(textures.back || textures.sides || textures.top);

    const makeMat = (map: THREE.Texture) =>
      new THREE.MeshStandardMaterial({
        map,
        roughness: 0.85,
        metalness: 0.05,
        transparent: Boolean(transparent),
        opacity: transparent ? 0.75 : 1.0,
      });

    // Materials order for BoxGeometry: [right, left, top, bottom, front, back]
    const materials = [
      makeMat(texRight),
      makeMat(texLeft),
      makeMat(texTop),
      makeMat(texBottom),
      makeMat(texFront),
      makeMat(texBack),
    ];

    const geometry = new THREE.BoxGeometry(1.6, 1.6, 1.6);
    const mesh = new THREE.Mesh(geometry, materials);
    mesh.position.set(0, 0, 0);
    mesh.rotation.x = 0.35;
    mesh.rotation.y = 0.55;

    scene.add(mesh);
    currentMeshRef.current = mesh;
  }, [activeTab, currentBlock]);

  // Build 3D Extruded Voxel Item Mesh
  useEffect(() => {
    if (activeTab !== "items" || !currentItem || !sceneRef.current) return;

    const scene = sceneRef.current;
    if (currentMeshRef.current) {
      scene.remove(currentMeshRef.current);
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = currentItem.texture;

    img.onload = () => {
      const imgWidth = img.width;
      const imgHeight = img.height;
      const canvas = document.createElement("canvas");
      canvas.width = imgWidth;
      canvas.height = imgHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, imgWidth, imgHeight).data;

      const group = new THREE.Group();
      const pixelSize = 1.8 / Math.max(imgWidth, imgHeight);
      const thickness = pixelSize * 0.9;
      const boxGeo = new THREE.BoxGeometry(pixelSize, pixelSize, thickness);

      const colorMap = new Map<string, THREE.Vector3>();

      for (let y = 0; y < imgHeight; y++) {
        for (let x = 0; x < imgWidth; x++) {
          const idx = (y * imgWidth + x) * 4;
          const alpha = imgData[idx + 3];
          if (alpha > 20) {
            const r = imgData[idx] / 255;
            const g = imgData[idx + 1] / 255;
            const b = imgData[idx + 2] / 255;

            const mat = new THREE.MeshStandardMaterial({
              color: new THREE.Color(r, g, b),
              roughness: 0.6,
              metalness: 0.1,
            });

            const pixelMesh = new THREE.Mesh(boxGeo, mat);
            pixelMesh.position.set(
              (x - imgWidth / 2) * pixelSize,
              (imgHeight / 2 - y) * pixelSize,
              0,
            );
            group.add(pixelMesh);
          }
        }
      }

      // Tilt like in Minecraft hand
      group.rotation.z = -Math.PI / 4;
      group.rotation.x = 0.2;
      group.position.set(0, 0, 0);

      scene.add(group);
      currentMeshRef.current = group;
    };
  }, [activeTab, currentItem]);

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    prevMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !currentMeshRef.current) return;
    const deltaX = e.clientX - prevMousePosRef.current.x;
    const deltaY = e.clientY - prevMousePosRef.current.y;

    currentMeshRef.current.rotation.y += deltaX * 0.012;
    currentMeshRef.current.rotation.x += deltaY * 0.012;

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
      Math.max(cameraRef.current.position.z + e.deltaY * 0.003, 1.8),
      6.0,
    );
  };

  const handleResetCamera = () => {
    if (cameraRef.current) cameraRef.current.position.set(0, 1.2, 3.8);
    if (currentMeshRef.current) {
      currentMeshRef.current.rotation.set(0.35, 0.55, 0);
    }
  };

  const handleCloseAndCleanup = async () => {
    if (packData.tempFilePath) {
      try {
        await window.onyx.resourcepack.cleanupPreview(packData.tempFilePath);
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
        await window.onyx.resourcepack.installPreview({
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

  return (
    <div className="rpack-preview-modal-overlay">
      <div className="rpack-preview-modal glass-panel">
        {/* Header */}
        <div className="rpack-preview-header">
          <div className="rpack-preview-title-box">
            <div className="rpack-preview-icon-frame">
              {packData.iconDataUrl ? (
                <img src={packData.iconDataUrl} alt="" />
              ) : (
                <Box size={22} color="#38d68f" />
              )}
            </div>
            <div>
              <div className="rpack-badge-row">
                <span className="lzt-tag lzt-tag--green">3D WebGL Engine</span>
                {packData.packFormat ? (
                  <span className="lzt-tag">Формат {packData.packFormat}</span>
                ) : null}
                <span className="lzt-tag">{packData.totalTextures} текстур</span>
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

        {/* Body Grid: 3D Stage + Texture Selector */}
        <div className="rpack-preview-body">
          {/* Left: Interactive 3D Canvas */}
          <div
            className="rpack-3d-stage"
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            {/* View Controls Toolbar */}
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
            </div>

            {/* Hint overlay */}
            <div className="rpack-stage-hint">
              <span>Крути мышью · Колесико — зум</span>
            </div>

            <div className="rpack-stage-current-label">
              <strong>
                {activeTab === "blocks"
                  ? currentBlock?.name || "Блок"
                  : currentItem?.name || "Предмет"}
              </strong>
            </div>
          </div>

          {/* Right: Category Tabs & Selectable Items */}
          <div className="rpack-selector-sidebar">
            <div className="rpack-tab-switch">
              <button
                type="button"
                className={`rpack-tab-btn ${activeTab === "blocks" ? "is-active" : ""}`}
                onClick={() => setActiveTab("blocks")}
              >
                <Box size={14} />
                <span>Блоки ({packData.blocks.length})</span>
              </button>
              <button
                type="button"
                className={`rpack-tab-btn ${activeTab === "items" ? "is-active" : ""}`}
                onClick={() => setActiveTab("items")}
              >
                <Swords size={14} />
                <span>Предметы ({packData.items.length})</span>
              </button>
            </div>

            {/* List of items/blocks */}
            <div className="rpack-elements-scroll">
              {activeTab === "blocks" ? (
                <div className="rpack-elements-grid">
                  {packData.blocks.map((block) => (
                    <button
                      key={block.id}
                      type="button"
                      className={`rpack-thumb-card ${
                        selectedBlockId === block.id ? "is-selected" : ""
                      }`}
                      onClick={() => setSelectedBlockId(block.id)}
                    >
                      <div className="rpack-thumb-img">
                        <img src={block.textures.top} alt={block.name} />
                      </div>
                      <span className="rpack-thumb-name">{block.name}</span>
                    </button>
                  ))}
                  {packData.blocks.length === 0 && (
                    <div className="rpack-empty-list">
                      <span>В ресурспаке нет измененных стандартных блоков</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rpack-elements-grid">
                  {packData.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`rpack-thumb-card ${
                        selectedItemId === item.id ? "is-selected" : ""
                      }`}
                      onClick={() => setSelectedItemId(item.id)}
                    >
                      <div className="rpack-thumb-img">
                        <img src={item.texture} alt={item.name} />
                      </div>
                      <span className="rpack-thumb-name">{item.name}</span>
                    </button>
                  ))}
                  {packData.items.length === 0 && (
                    <div className="rpack-empty-list">
                      <span>В ресурспаке нет измененных стандартных предметов</span>
                    </div>
                  )}
                </div>
              )}
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
                        : "Установить в сборку"}
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
