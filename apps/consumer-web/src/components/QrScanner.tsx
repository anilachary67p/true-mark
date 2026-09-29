'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';

interface QrScannerProps {
  onScan: (decodedText: string) => void;
  disabled?: boolean;
}

function cameraErrorMessage(err: unknown): string {
  const text = err instanceof Error ? `${err.name} ${err.message}` : String(err ?? '');
  if (/NotAllowed|Permission|denied/i.test(text)) {
    return 'Camera access was denied. Allow camera permission in your browser settings, or enter the code manually.';
  }
  if (/NotFound|no camera|Requested device not found/i.test(text)) return 'No camera found on this device.';
  if (/NotReadable|in use|TrackStart/i.test(text)) {
    return 'The camera is being used by another app. Close it and try again.';
  }
  return 'Could not access the camera. Please try again or enter the code manually.';
}

export function QrScanner({ onScan, disabled }: QrScannerProps) {
  const reactId = useId();
  const regionId = `truemark-qr-${reactId.replace(/:/g, '')}`;
  const [active, setActive] = useState(false);
  const [error, setError] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    if (!active || disabled) return;

    let cancelled = false;
    handledRef.current = false;
    setError('');

    const scanner = new Html5Qrcode(regionId);
    scannerRef.current = scanner;

    async function start() {
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (cancelled) return;

        if (!cameras.length) {
          setError('No camera found on this device.');
          setActive(false);
          return;
        }

        const backCamera = cameras.find((camera) => /back|rear|environment/i.test(camera.label));
        const cameraId = backCamera?.id ?? cameras[0].id;

        await scanner.start(
          cameraId,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1,
          },
          (decodedText) => {
            if (cancelled || handledRef.current || disabled) return;
            handledRef.current = true;
            void scanner.stop().finally(() => {
              if (!cancelled) {
                setActive(false);
                onScan(decodedText);
              }
            });
          },
          () => {
            // Ignore per-frame decode misses.
          },
        );
      } catch (err) {
        if (cancelled) return;
        setError(cameraErrorMessage(err));
        setActive(false);
      }
    }

    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setError('Camera scanning requires a secure (HTTPS) connection. Enter the code manually below.');
      setActive(false);
      return;
    }

    void start();

    return () => {
      cancelled = true;
      const state = scanner.getState();
      if (state === Html5QrcodeScannerState.SCANNING) {
        void scanner.stop().catch(() => {});
      }
      try {
        scanner.clear();
      } catch {
        // Element may already be removed.
      }
      if (scannerRef.current === scanner) {
        scannerRef.current = null;
      }
    };
  }, [active, disabled, onScan, regionId]);

  return (
    <div>
      <div
        id={regionId}
        data-testid="qr-scanner-region"
        style={{
          width: '100%',
          minHeight: active ? 280 : 0,
          overflow: 'hidden',
          borderRadius: 8,
          background: active ? '#000' : 'transparent',
        }}
      />
      {!active ? (
        <button
          type="button"
          onClick={() => setActive(true)}
          disabled={disabled}
          style={{
            width: '100%',
            padding: '0.875rem',
            background: disabled ? '#93c5fd' : '#16a34a',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 16,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          Scan QR Code
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setActive(false)}
          style={{
            width: '100%',
            marginTop: '0.75rem',
            padding: '0.75rem',
            background: '#f3f4f6',
            border: 'none',
            borderRadius: 8,
            fontWeight: 500,
          }}
        >
          Cancel scan
        </button>
      )}
      {error && (
        <p style={{ color: '#dc2626', fontSize: 13, marginTop: '0.75rem', textAlign: 'center' }}>
          {error}
        </p>
      )}
      {!active && !error && (
        <p style={{ fontSize: 12, color: '#888', marginTop: '0.5rem', textAlign: 'center' }}>
          Point your camera at the product QR code
        </p>
      )}
    </div>
  );
}
