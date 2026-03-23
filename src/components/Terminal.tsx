import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import { executeCommand, createInitialState, type TerminalState } from '@/lib/terminal/commands';

interface TerminalLine {
  type: 'input' | 'output' | 'system';
  content: string;
  prompt?: string;
}

const BOOT_LINES = [
  '██╗     ██╗███╗   ██╗██╗   ██╗██╗  ██╗    ███████╗██████╗ ██╗   ██╗',
  '██║     ██║████╗  ██║██║   ██║╚██╗██╔╝    ██╔════╝██╔══██╗██║   ██║',
  '██║     ██║██╔██╗ ██║██║   ██║ ╚███╔╝     █████╗  ██║  ██║██║   ██║',
  '██║     ██║██║╚██╗██║██║   ██║ ██╔██╗     ██╔══╝  ██║  ██║██║   ██║',
  '███████╗██║██║ ╚████║╚██████╔╝██╔╝ ██╗    ███████╗██████╔╝╚██████╔╝',
  '╚══════╝╚═╝╚═╝  ╚═══╝ ╚═════╝ ╚═╝  ╚═╝    ╚══════╝╚═════╝  ╚═════╝ ',
  '',
  'Linux Edu v1.0 — Terminal éducatif',
  'Tapez "help" pour voir les commandes disponibles.',
  '',
];

export default function Terminal() {
  const [state, setState] = useState<TerminalState>(createInitialState);
  const [lines, setLines] = useState<TerminalLine[]>(
    BOOT_LINES.map(l => ({ type: 'system' as const, content: l }))
  );
  const [input, setInput] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const prompt = `${state.user}@${state.hostname}:${state.cwd}$ `;

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [lines]);

  const focusInput = useCallback(() => inputRef.current?.focus(), []);

  const handleSubmit = useCallback(() => {
    const newLines: TerminalLine[] = [
      ...lines,
      { type: 'input', content: input, prompt },
    ];

    const result = executeCommand(input, state);
    setState(result.state);

    if (result.clear) {
      setLines([]);
    } else {
      if (result.output) {
        newLines.push({ type: 'output', content: result.output });
      }
      setLines(newLines);
    }

    setInput('');
    setHistoryIndex(-1);
  }, [input, lines, prompt, state]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const hist = state.history;
      if (hist.length === 0) return;
      const newIndex = historyIndex === -1 ? hist.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(newIndex);
      setInput(hist[newIndex]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const hist = state.history;
      if (historyIndex === -1) return;
      const newIndex = historyIndex + 1;
      if (newIndex >= hist.length) {
        setHistoryIndex(-1);
        setInput('');
      } else {
        setHistoryIndex(newIndex);
        setInput(hist[newIndex]);
      }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      setLines([]);
    }
  }, [handleSubmit, historyIndex, state.history]);

  return (
    <div className="terminal-window" onClick={focusInput}>
      {/* CRT scanline overlay */}
      <div className="terminal-scanlines" />
      
      {/* Title bar */}
      <div className="terminal-titlebar">
        <div className="terminal-titlebar-dots">
          <span className="terminal-dot terminal-dot--red" />
          <span className="terminal-dot terminal-dot--yellow" />
          <span className="terminal-dot terminal-dot--green" />
        </div>
        <span className="terminal-titlebar-text">eleve@linux-edu: ~</span>
      </div>

      {/* Terminal body */}
      <div className="terminal-body" ref={scrollRef}>
        {lines.map((line, i) => (
          <div key={i} className="terminal-line">
            {line.type === 'input' && (
              <span className="terminal-prompt">{line.prompt}</span>
            )}
            <span className={
              line.type === 'system' ? 'terminal-system' :
              line.type === 'output' ? 'terminal-output' : ''
            }>
              {line.content}
            </span>
          </div>
        ))}

        {/* Current input line */}
        <div className="terminal-line terminal-input-line">
          <span className="terminal-prompt">{prompt}</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="terminal-input"
            autoFocus
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
          />
        </div>
      </div>
    </div>
  );
}
