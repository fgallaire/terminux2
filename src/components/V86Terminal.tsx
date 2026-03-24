import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

declare global {
  interface Window {
    V86: any;
  }
}

export default function V86Terminal() {
  const termRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const emulatorRef = useRef<any>(null);
  const [status, setStatus] = useState<'loading' | 'booting' | 'ready' | 'error'>('loading');

  useEffect(() => {
    if (!termRef.current) return;

    // Set up xterm.js
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

    term.writeln('\x1b[1;32m╔══════════════════════════════════════╗');
    term.writeln('║   Linux Edu — Émulateur x86 (v86)    ║');
    term.writeln('║   Démarrage en cours...               ║');
    term.writeln('╚══════════════════════════════════════╝\x1b[0m');
    term.writeln('');

    // Load v86 script
    const script = document.createElement('script');
    script.src = '/v86/libv86.js';
    script.onload = () => {
      setStatus('booting');
      startEmulator(term);
    };
    script.onerror = () => {
      setStatus('error');
      term.writeln('\x1b[1;31mErreur: impossible de charger v86.\x1b[0m');
    };
    document.head.appendChild(script);

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      emulatorRef.current?.destroy?.();
      term.dispose();
    };
  }, []);

  function startEmulator(term: Terminal) {
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

      // v86 serial output → xterm
      emulator.add_listener('serial0-output-byte', (byte: number) => {
        const char = String.fromCharCode(byte);
        term.write(char);
      });

      // xterm input → v86 serial
      term.onData((data: string) => {
        for (let i = 0; i < data.length; i++) {
          emulator.serial0_send(data.charCodeAt(i));
        }
      });

      // Wait for emulator to be ready
      emulator.add_listener('emulator-ready', () => {
        setStatus('ready');
      });
    } catch (e: any) {
      setStatus('error');
      term.writeln(`\x1b[1;31mErreur: ${e.message}\x1b[0m`);
    }
  }

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
