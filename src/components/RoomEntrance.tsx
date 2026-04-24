import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Hash, Key, Clock, Search, Trash2 } from 'lucide-react';

export interface RecentRoom {
  name: string;
  hash: string;
  lastSeen: number;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  passValue: string;
  onPassChange: (v: string) => void;
  onJoin: (name: string, pass?: string) => void;
  recentRooms: RecentRoom[];
  onRemoveRecent: (hash: string) => void;
}

export function RoomEntrance({ value, onChange, passValue, onPassChange, onJoin, recentRooms, onRemoveRecent }: Props) {
  const [search, setSearch] = useState('');

  const filtered = recentRooms.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#050505' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="tech-card p-8 w-full max-w-lg border-t-2 border-t-[--accent]"
      >
        <div className="flex items-center gap-3 mb-8">
          <Hash className="text-[--accent]" size={32} />
          <div>
            <h2 className="text-xl font-mono uppercase tracking-tighter font-bold text-[--fg-bright]">Acessar Sala</h2>
            <p className="text-xs font-mono text-[--muted]">Insira um ID para entrar ou criar uma sala.</p>
          </div>
        </div>

        <form
          onSubmit={e => { e.preventDefault(); onJoin(value, passValue); }}
          className="space-y-4"
        >
          <div>
            <label className="tech-label block">ID da Sala</label>
            <input
              type="text"
              placeholder="Ex: crypto_hq_01"
              className="w-full tech-input"
              value={value}
              onChange={e => onChange(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className="tech-label block">Senha (Opcional)</label>
            <div className="relative">
              <input
                type="password"
                placeholder="••••••••"
                className="w-full tech-input pr-10"
                value={passValue}
                onChange={e => onPassChange(e.target.value)}
              />
              <Key size={14} className="absolute right-3 top-3.5 text-[#404040]" />
            </div>
          </div>

          <div className="space-y-3 pt-4">
            <button type="submit" className="w-full tech-button py-4 font-bold text-sm tracking-[0.2em] shadow-[0_0_20px_rgba(var(--accent-rgb),0.2)]">
              ENTRAR NA SALA
            </button>
            <button
              type="button"
              className="w-full tech-button-muted py-3 text-[10px] tracking-widest opacity-60 hover:opacity-100"
              onClick={() => onJoin(Math.random().toString(36).substring(2, 9), passValue)}
            >
              CRIAR SALA COM ID ALEATÓRIO
            </button>
          </div>
        </form>

        {recentRooms.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={12} className="text-[--muted]" />
              <span className="tech-label mb-0">Salas Recentes</span>
            </div>

            <div className="relative mb-3">
              <Search size={12} className="absolute left-3 top-3.5 text-[#404040]" />
              <input
                type="text"
                placeholder="Buscar sala..."
                className="w-full tech-input pl-8 py-2 text-xs"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {filtered.length === 0 && (
                <p className="text-[10px] text-[--muted] italic px-2">Nenhuma sala encontrada.</p>
              )}
              {filtered.map(room => (
                <div
                  key={room.hash}
                  className="flex items-center justify-between p-3 bg-white/5 border border-[#1a1a1a] hover:border-[--accent]/30 cursor-pointer transition-colors group"
                  onClick={() => { onChange(room.name); }}
                >
                  <div>
                    <p className="text-xs font-mono text-[--fg-bright] font-bold">{room.name}</p>
                    <p className="text-[9px] text-[--muted]">{room.hash.substring(0, 12)}... · {new Date(room.lastSeen).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); onRemoveRecent(room.hash); }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 text-[--muted] transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
