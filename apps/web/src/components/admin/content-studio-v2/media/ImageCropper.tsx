'use client';

import { useCallback, useState } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { RotateCw, Undo2, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '../primitives';

const RATIOS: Array<{ key: string; label: string; value: number | undefined }> = [
  { key: 'free', label: 'Libre', value: undefined },
  { key: '1:1', label: '1 : 1', value: 1 },
  { key: '4:5', label: '4 : 5', value: 4 / 5 },
  { key: '9:16', label: '9 : 16', value: 9 / 16 },
  { key: '16:9', label: '16 : 9', value: 16 / 9 },
];

export interface ImageCropperResult {
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  rotation: number;
  aspectRatio: string;
}

interface Props {
  src: string;
  defaultRatio?: '1:1' | '4:5' | '9:16' | '16:9' | 'free';
  onConfirm: (result: ImageCropperResult) => void;
  onCancel: () => void;
}

export function ImageCropper({ src, defaultRatio = '4:5', onConfirm, onCancel }: Props) {
  const [ratioKey, setRatioKey] = useState<string>(defaultRatio);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pixelArea, setPixelArea] = useState<Area | null>(null);

  const activeRatio = RATIOS.find((r) => r.key === ratioKey) ?? RATIOS[2]!;

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setPixelArea(areaPixels);
  }, []);

  function reset() {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
  }

  function confirm() {
    if (!pixelArea) return;
    onConfirm({
      cropX: pixelArea.x,
      cropY: pixelArea.y,
      cropWidth: pixelArea.width,
      cropHeight: pixelArea.height,
      rotation,
      aspectRatio: activeRatio.key,
    });
  }

  return (
    <div className="cs-cropper" style={{ display: 'flex', flexDirection: 'column', gap: 18, minHeight: 480 }}>
      <div
        style={{
          position: 'relative',
          background: 'var(--cs-bg-sunken)',
          borderRadius: 'var(--cs-radius-md)',
          height: 380,
          overflow: 'hidden',
        }}
      >
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={activeRatio.value}
          showGrid
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onRotationChange={setRotation}
          onCropComplete={onCropComplete}
          style={{
            containerStyle: { background: 'transparent' },
          }}
        />
      </div>

      <div
        className="cs-cropper-toolbar"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
          padding: '12px 0',
          borderTop: '1px solid var(--cs-border-hair)',
          borderBottom: '1px solid var(--cs-border-hair)',
        }}
      >
        <div style={{ display: 'inline-flex', background: 'var(--cs-bg-elevated)', borderRadius: 'var(--cs-radius)', padding: 3, border: '1px solid var(--cs-border)' }}>
          {RATIOS.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRatioKey(r.key)}
              style={{
                padding: '6px 12px',
                fontFamily: 'var(--cs-font-mono)',
                fontSize: 11,
                background: ratioKey === r.key ? 'var(--cs-fg-primary)' : 'transparent',
                color: ratioKey === r.key ? 'var(--cs-bg-base)' : 'var(--cs-fg-secondary)',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                transition: 'all var(--cs-motion-fast) var(--cs-easing)',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
        <span style={{ width: 1, height: 24, background: 'var(--cs-border-hair)' }} />
        <button type="button" onClick={() => setZoom((z) => Math.max(1, z - 0.1))} aria-label="Zoom −" style={iconBtnStyle}>
          <ZoomOut size={14} />
        </button>
        <input
          type="range"
          min="1"
          max="3"
          step="0.05"
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          style={{ width: 120 }}
          aria-label="Zoom"
        />
        <button type="button" onClick={() => setZoom((z) => Math.min(3, z + 0.1))} aria-label="Zoom +" style={iconBtnStyle}>
          <ZoomIn size={14} />
        </button>
        <span style={{ width: 1, height: 24, background: 'var(--cs-border-hair)' }} />
        <button type="button" onClick={() => setRotation((r) => (r + 90) % 360)} aria-label="Rotation 90°" style={iconBtnStyle}>
          <RotateCw size={14} />
        </button>
        <button type="button" onClick={reset} aria-label="Annuler les ajustements" style={iconBtnStyle}>
          <Undo2 size={14} />
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Button variant="ghost" onClick={onCancel}>Annuler</Button>
        <Button onClick={confirm} disabled={!pixelArea}>Recadrer et importer</Button>
      </div>
    </div>
  );
}

const iconBtnStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  background: 'var(--cs-bg-elevated)',
  border: '1px solid var(--cs-border)',
  borderRadius: 'var(--cs-radius-sm)',
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
  color: 'var(--cs-fg-secondary)',
};
