import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

declare global {
  interface Window {
    V86: any;
  }
}

interface V86TerminalProps {
  visible?: boolean;
}

export default function V86Terminal({ visible }: V86TerminalProps) {
  const termRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const emulatorRef = useRef<any>(null);
  const initedRef = useRef(false);
  const [status, setStatus] = useState<'loading' | 'booting' | 'ready' | 'error'>('loading');

  // Init once, never cleanup
  useEffect(() => {
    if (initedRef.current || !termRef.current) return;
    initedRef.current = true;

    const term = new Terminal({
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

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(termRef.current);
    fitAddon.fit();
    xtermRef.current = term;
    fitRef.current = fitAddon;

    term.writeln('\x1b[1;32m╔══════════════════════════════════════╗');
    term.writeln('║   Linux Edu — Émulateur x86 (v86)    ║');
    term.writeln('║   Démarrage en cours...               ║');
    term.writeln('║   Login: root (pas de mot de passe)   ║');
    term.writeln('╚══════════════════════════════════════╝\x1b[0m');
    term.writeln('');

    // Load v86 script only once
    const existing = document.querySelector('script[src="/v86/libv86.js"]');
    const boot = () => {
      setStatus('booting');
      try {
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
        emulatorRef.current = emulator;

        emulator.add_listener('serial0-output-byte', (byte: number) => {
          term.write(String.fromCharCode(byte));
        });

        term.onData((data: string) => {
          for (let i = 0; i < data.length; i++) {
            emulator.bus.send('serial0-input', data.charCodeAt(i));
          }
        });

        emulator.add_listener('emulator-ready', () => setStatus('ready'));
      } catch (e: any) {
        setStatus('error');
        term.writeln(`\x1b[1;31mErreur: ${e.message}\x1b[0m`);
      }
    };

    if (window.V86) {
      boot();
    } else if (existing) {
      existing.addEventListener('load', boot);
    } else {
      const script = document.createElement('script');
      script.src = '/v86/libv86.js';
      script.onload = boot;
      script.onerror = () => {
        setStatus('error');
        term.writeln('\x1b[1;31mErreur: impossible de charger v86.\x1b[0m');
      };
      document.head.appendChild(script);
    }

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);
    // No cleanup — keep alive forever
  }, []);

  // Re-fit when becoming visible
  useEffect(() => {
    if (visible) {
      setTimeout(() => fitRef.current?.fit(), 50);
    }
  }, [visible]);

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
