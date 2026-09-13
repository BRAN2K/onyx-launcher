import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera,
  Check,
  Download,
  RotateCw,
  RotateCcw,
} from 'lucide-react';
import {
  SkinViewer,
  IdleAnimation,
  WalkingAnimation,
  RunningAnimation,
  FlyingAnimation,
  WaveAnimation,
  type PlayerAnimation,
} from 'skinview3d';
import { useI18n } from '../i18n';
import { createVanillaElytraTexture } from './capePresets';

export type SkinAnimationName = 'idle' | 'walk' | 'run' | 'fly' | 'wave' | 'none';

export interface SkinLayers {
  hat: boolean;
  jacket: boolean;
  leftSleeve: boolean;
  rightSleeve: boolean;
  leftPants: boolean;
  rightPants: boolean;
}

export interface SkinViewer3DProps {
  skinUrl: string;
  variant?: 'classic' | 'slim';
  capeUrl?: string | null;
  backEquipment?: 'cape' | 'elytra' | null;
  animationMode?: SkinAnimationName;
  layers?: SkinLayers;
  playerName?: string;
  onNotify?: (tone: 'success' | 'warning' | 'info', title: string, message: string) => void;
}

function createAnimation(mode: SkinAnimationName): PlayerAnimation | null {
  switch (mode) {
    case 'idle':
      return new IdleAnimation();
    case 'walk':
      return new WalkingAnimation();
    case 'run':
      return new RunningAnimation();
    case 'fly':
      return new FlyingAnimation();
    case 'wave':
      return new WaveAnimation();
    case 'none':
    default:
      return null;
  }
}

export function SkinViewer3D({
  skinUrl,
  variant = 'classic',
  capeUrl = null,
  backEquipment = null,
  animationMode = 'idle',
  layers = {
    hat: true,
    jacket: true,
    leftSleeve: true,
    rightSleeve: true,
    leftPants: true,
    rightPants: true,
  },
  playerName = 'Player',
  onNotify,
}: SkinViewer3DProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<SkinViewer | null>(null);
  const currentAnimationRef = useRef<PlayerAnimation | null>(null);

  const [autoRotate, setAutoRotate] = useState(true);
  const [copied, setCopied] = useState(false);

  // Initialize viewer once
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 320;
    const height = containerRef.current.clientHeight || 460;

    const viewer = new SkinViewer({
      canvas: canvasRef.current,
      width,
      height,
      preserveDrawingBuffer: true,
    });

    viewer.fov = 70;
    viewer.zoom = 0.9;
    viewer.autoRotate = true;
    viewer.autoRotateSpeed = 0.6;
    viewer.camera.position.set(16, 8, 42);
    viewer.camera.lookAt(0, 0, 0);
    viewer.controls.target.set(0, 0, 0);

    viewerRef.current = viewer;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          viewer.setSize(entry.contentRect.width, entry.contentRect.height);
        }
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      viewer.dispose();
      viewerRef.current = null;
    };
  }, []);

  // Update skin and model variant
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !skinUrl) return;

    const normalizedSkinUrl = skinUrl.replace(
      /^http:\/\/textures\.minecraft\.net\//i,
      'https://textures.minecraft.net/',
    );

    void viewer
      .loadSkin(normalizedSkinUrl, {
        model: variant === 'slim' ? 'slim' : 'default',
      })
      .catch((err) => {
        console.warn('SkinViewer3D loadSkin error:', err);
      });
  }, [skinUrl, variant]);

  // Update Cape / Elytra
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const normalizedCapeUrl = capeUrl?.replace(
      /^http:\/\/textures\.minecraft\.net\//i,
      'https://textures.minecraft.net/',
    );

    if (backEquipment === 'elytra') {
      const textureToLoad = normalizedCapeUrl || createVanillaElytraTexture();
      void viewer
        .loadCape(textureToLoad, { backEquipment: 'elytra' })
        .catch((err) => {
          console.warn('SkinViewer3D loadElytra error:', err);
        });
    } else if (backEquipment === 'cape' && normalizedCapeUrl) {
      void viewer
        .loadCape(normalizedCapeUrl, { backEquipment: 'cape' })
        .catch((err) => {
          console.warn('SkinViewer3D loadCape error:', err);
        });
    } else {
      viewer.resetCape();
    }
  }, [capeUrl, backEquipment]);

  // Update animation mode
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const anim = createAnimation(animationMode);
    currentAnimationRef.current = anim;
    viewer.animation = anim;

    if (!anim) {
      viewer.playerObject.resetJoints();
    }
  }, [animationMode]);

  // Update auto-rotate
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.autoRotate = autoRotate;
  }, [autoRotate]);

  // Update layer visibility
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer?.playerObject?.skin) return;

    const skin = viewer.playerObject.skin;
    if (skin.head?.outerLayer) skin.head.outerLayer.visible = layers.hat;
    if (skin.body?.outerLayer) skin.body.outerLayer.visible = layers.jacket;
    if (skin.leftArm?.outerLayer) skin.leftArm.outerLayer.visible = layers.leftSleeve;
    if (skin.rightArm?.outerLayer) skin.rightArm.outerLayer.visible = layers.rightSleeve;
    if (skin.leftLeg?.outerLayer) skin.leftLeg.outerLayer.visible = layers.leftPants;
    if (skin.rightLeg?.outerLayer) skin.rightLeg.outerLayer.visible = layers.rightPants;
  }, [layers]);

  // Reset camera view
  const handleResetCamera = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.resetCameraPose();
    viewer.camera.position.set(16, 8, 42);
    viewer.camera.lookAt(0, 0, 0);
    viewer.controls.target.set(0, 0, 0);
    viewer.zoom = 0.9;
  }, []);

  // Copy 3D render snapshot to clipboard
  const handleCopySnapshot = useCallback(async () => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    try {
      viewer.render();
      const canvas = viewer.canvas;
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob }),
          ]);
          setCopied(true);
          setTimeout(() => setCopied(false), 2200);
          onNotify?.(
            'success',
            t('settings.skins.copiedTitle'),
            t('settings.skins.copiedDesc'),
          );
        } catch {
          // Fallback if clipboard fails: trigger download
          const url = canvas.toDataURL('image/png');
          const a = document.createElement('a');
          a.href = url;
          a.download = `${playerName}-3d.png`;
          a.click();
        }
      }, 'image/png');
    } catch (err) {
      onNotify?.(
        'warning',
        t('settings.skins.copyFailed'),
        err instanceof Error ? err.message : String(err),
      );
    }
  }, [playerName, onNotify, t]);

  // Download high-res PNG file
  const handleDownloadSnapshot = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.render();
    const url = viewer.canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${playerName.toLowerCase().replace(/\s+/g, '-')}-3d-render.png`;
    a.click();
    onNotify?.(
      'success',
      t('settings.skins.downloadedTitle'),
      t('settings.skins.downloadedDesc'),
    );
  }, [playerName, onNotify, t]);

  return (
    <div className="skin-viewer-3d" ref={containerRef}>
      {/* 3D WebGL Canvas */}
      <canvas ref={canvasRef} className="skin-viewer-3d__canvas" />

      {/* Subtle glowing pedestal disc beneath character */}
      <div className="skin-viewer-3d__pedestal" aria-hidden="true" />

      {/* Floating control overlays */}
      <div className="skin-viewer-3d__controls">
        <button
          type="button"
          className={`skin-viewer-3d__btn ${autoRotate ? 'is-active' : ''}`}
          title={t('settings.skins.toggleRotate')}
          onClick={() => setAutoRotate((prev) => !prev)}
        >
          <RotateCw size={14} className={autoRotate ? 'spin-slow' : ''} />
        </button>

        <button
          type="button"
          className="skin-viewer-3d__btn"
          title={t('settings.skins.resetCamera')}
          onClick={handleResetCamera}
        >
          <RotateCcw size={14} />
        </button>

        <div className="skin-viewer-3d__divider" />

        <button
          type="button"
          className={`skin-viewer-3d__btn ${copied ? 'is-success' : ''}`}
          title={t('settings.skins.copyAvatar')}
          onClick={() => void handleCopySnapshot()}
        >
          {copied ? <Check size={14} /> : <Camera size={14} />}
        </button>

        <button
          type="button"
          className="skin-viewer-3d__btn"
          title={t('settings.skins.downloadAvatar')}
          onClick={handleDownloadSnapshot}
        >
          <Download size={14} />
        </button>
      </div>

      <div className="skin-viewer-3d__hint">
        <span>{t('settings.skins.dragHint')}</span>
      </div>
    </div>
  );
}
