import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

declare global {
  interface Window {
    V86: any;
    __v86instance: any;
    __v86term: Terminal | null;
    __v86fit: FitAddon | null;
    __v86status: 'loading' | 'booting' | 'ready' | 'error';
  }
}

function loadV86Script(): Promise<void> {
  if (window.V86) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (document.querySelector('script[src="/v86/libv86.js"]')) {
      const check = setInterval(() => {
        if (window.V86) { clearInterval(check); resolve(); }
      }, 100);
      return;
    }
    const script = document.createElement('script');
    script.src = '/v86/libv86.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load v86'));
    document.head.appendChild(script);
  });
}

function getOrCreateEmulator(): { emulator: any; isNew: boolean } {
  if (window.__v86instance) return { emulator: window.__v86instance, isNew: false };

  const emulator = new window.V86({
    wasm_path: '/v86/v86.wasm',
    bios: { url: '/v86/seabios.bin' },
    vga_bios: { url: '/v86/vgabios.bin' },
    cdrom: { url: '/v86/linux.iso' },
    autostart: true,
    memory_size: 64 * 1024 * 1024,
    vga_memory_size: 2 * 1024 * 1024,
    disable_keyboard: true,
    disable_mouse: true,
    disable_speaker: true,
    screen_dummy: true,
  });

  window.__v86instance = emulator;
  return { emulator, isNew: true };
}

export default function V86Terminal() {
  const termRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'booting' | 'ready' | 'error'>(
    window.__v86status || 'loading'
  );

  useEffect(() => {
    if (!termRef.current) return;

    // Reuse existing terminal or create new one
    let term: Terminal;
    let fitAddon: FitAddon;

    if (window.__v86term) {
      term = window.__v86term;
      fitAddon = window.__v86fit!;
      // Re-attach to new DOM element
      termRef.current.innerHTML = '';
      term.open(termRef.current);
      fitAddon.fit();
    } else {
      term = new Terminal({
        cursorBlink: true,
        fontFamily: "'VT323', 'Fira Code', monospace",
        fontSize: 18,
        theme: {
          background: '#0a1a0a',
          foreground: '#33ff33',
          cursor: '#33ff33',
          cursorAccent: '#0a1a0a',
          selectionBackground: '#33ff3340',
          black: '#0a1a0a',
          green: '#33ff33',
          brightGreen: '#66ff66',
          white: '#33ff33',
          brightWhite: '#66ff66',
          red: '#ff3333',
          yellow: '#ffff33',
          blue: '#3333ff',
          cyan: '#33ffff',
          magenta: '#ff33ff',
          brightBlack: '#1a3a1a',
          brightRed: '#ff6666',
          brightYellow: '#ffff66',
          brightBlue: '#6666ff',
          brightCyan: '#66ffff',
          brightMagenta: '#ff66ff',
        },
        scrollback: 1000,
        convertEol: true,
      });

      fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(termRef.current);
      fitAddon.fit();

      window.__v86term = term;
      window.__v86fit = fitAddon;

      term.writeln('\x1b[1;32m╔══════════════════════════════════════╗');
      term.writeln('║   Linux Edu — Émulateur x86 (v86)    ║');
      term.writeln('║   Démarrage en cours...               ║');
      term.writeln('║   Login: root (pas de mot de passe)   ║');
      term.writeln('╚══════════════════════════════════════╝\x1b[0m');
      term.writeln('');

      // Load v86 and start emulator
      loadV86Script()
        .then(() => {
          window.__v86status = 'booting';
          setStatus('booting');
          const { emulator, isNew } = getOrCreateEmulator();

          if (isNew) {
            emulator.add_listener('serial0-output-byte', (byte: number) => {
              window.__v86term?.write(String.fromCharCode(byte));
            });

            term.onData((data: string) => {
              for (let i = 0; i < data.length; i++) {
                window.__v86instance?.bus.send('serial0-input', data.charCodeAt(i));
              }
            });

            emulator.add_listener('emulator-ready', () => {
              window.__v86status = 'ready';
              setStatus('ready');
            });
          }
        })
        .catch(() => {
          window.__v86status = 'error';
          setStatus('error');
          term.writeln('\x1b[1;31mErreur: impossible de charger v86.\x1b[0m');
        });
    }

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      // DON'T destroy the emulator or terminal — keep them alive
    };
  }, []);

  return (
    <div className="terminal-window">
      <div className="terminal-scanlines" />
      <div className="terminal-titlebar">
        <div className="terminal-titlebar-dots">
          <span className="terminal-dot terminal-dot--red" />
          <span className="terminal-dot terminal-dot--yellow" />
          <span className="terminal-dot terminal-dot--green" />
        </div>
        <span className="terminal-titlebar-text">
          linux-edu — v86 x86 Emulator
          {status === 'loading' && ' (chargement...)'}
          {status === 'booting' && ' (démarrage...)'}
          {status === 'error' && ' (erreur)'}
        </span>
      </div>
      <div
        ref={termRef}
        className="terminal-body"
        style={{ padding: '8px', overflow: 'hidden' }}
      />
    </div>
  );
}
