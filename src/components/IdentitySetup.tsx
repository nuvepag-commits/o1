import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Shield, Info } from 'lucide-react';

interface Props {
  onGenerate: (alias: string) => void;
  isLoading: boolean;
}

export function IdentitySetup({ onGenerate, isLoading }: Props) {
  const [alias, setAlias] = useState('');

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isLoading) return;
    onGenerate(alias.trim() || 'Anônimo');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#050505' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="tech-card p-8 max-w-md w-full relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-1 h-full bg-[--accent]" />
        <div className="flex items-center gap-3 mb-6">
          <Shield className="text-[--accent]" size={32} />
          <div>
            <h2 className="text-xl font-mono uppercase tracking-tighter font-bold text-[--fg-bright]">Identidade Local</h2>
            <p className="text-xs font-mono text-[--muted]">Gerada no seu navegador. Zero coleta.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="tech-label block">Pseudônimo</label>
            <input
              type="text"
              placeholder="Ex: Shadow_01"
              className="w-full tech-input"
              value={alias}
              onChange={e => setAlias(e.target.value)}
              disabled={isLoading}
              autoFocus
            />
          </div>

          <p className="text-[10px] leading-relaxed font-mono text-[--muted] bg-white/5 p-3 border-l-2 border-white/10">
            <Info size={12} className="inline mr-1 mb-0.5" />
            Chaves RSA-2048 geradas localmente. Somente o alias é transmitido.
          </p>

          <button
            type="submit"
            className="w-full tech-button flex items-center justify-center gap-2 py-4 cursor-pointer"
            disabled={isLoading}
          >
            {isLoading ? <span className="animate-pulse">PROCESSANDO...</span> : 'INICIALIZAR PROTOCOLO'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
