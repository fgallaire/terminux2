import { useState } from 'react';
import Terminal from '@/components/Terminal';
import V86Terminal from '@/components/V86Terminal';

const Index = () => {
  const [mode, setMode] = useState<'simulated' | 'real'>('simulated');

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4" style={{ background: 'hsl(120 10% 3%)' }}>
      <div className="flex gap-2">
        <button
          onClick={() => setMode('simulated')}
          className={`px-4 py-2 rounded font-mono text-sm transition-all ${
            mode === 'simulated'
              ? 'bg-[hsl(120,100%,50%)] text-[hsl(120,10%,4%)] font-bold'
              : 'border border-[hsl(120,60%,35%)] text-[hsl(120,60%,35%)] hover:text-[hsl(120,100%,50%)] hover:border-[hsl(120,100%,50%)]'
          }`}
        >
          Terminal Simulé
        </button>
        <button
          onClick={() => setMode('real')}
          className={`px-4 py-2 rounded font-mono text-sm transition-all ${
            mode === 'real'
              ? 'bg-[hsl(120,100%,50%)] text-[hsl(120,10%,4%)] font-bold'
              : 'border border-[hsl(120,60%,35%)] text-[hsl(120,60%,35%)] hover:text-[hsl(120,100%,50%)] hover:border-[hsl(120,100%,50%)]'
          }`}
        >
          Vrai Linux (v86)
        </button>
      </div>

      <div style={{ display: mode === 'simulated' ? 'block' : 'none' }}>
        <Terminal />
      </div>
      <div style={{ display: mode === 'real' ? 'block' : 'none' }}>
        <V86Terminal visible={mode === 'real'} />
      </div>
    </div>
  );
};

export default Index;
