import { Hash, Key, Clock, Trash2, Plus, LogIn } from 'lucide-react';
import { cn } from '../lib/utils';

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
  onJoin: (id: string, pass?: string) => void;
  onCreate: (name: string, pass?: string) => void;
  recentRooms: RecentRoom[];
  onRemoveRecent: (hash: string) => void;
}

export function RoomEntrance({ value, onChange, passValue, onPassChange, onJoin, onCreate, recentRooms, onRemoveRecent }: Props) {
  const [mode, setMode] = useState<'join' | 'create'>('join');
  const [search, setSearch] = useState('');

  const filtered = recentRooms.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) || r.hash.toLowerCase().includes(search.toLowerCase())
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
            <h2 className="text-xl font-mono uppercase tracking-tighter font-bold text-[--fg-bright]">
              {mode === 'join' ? 'Acessar Canal' : 'Criar Canal'}
            </h2>
            <p className="text-xs font-mono text-[--muted]">
              {mode === 'join' ? 'Insira o ID secreto para entrar.' : 'Crie um novo canal criptografado.'}
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-[#0a0a0a] border border-[#1a1a1a] mb-6 p-1">
          <button
            onClick={() => { setMode('join'); onChange(''); }}
            className={cn(
              "flex-1 py-2.5 text-[10px] font-bold tracking-[0.2em] flex items-center justify-center gap-2 transition-all",
              mode === 'join' ? "bg-[--accent] text-black shadow-[0_0_15px_rgba(var(--accent-rgb),0.3)]" : "text-[--muted] hover:text-white"
            )}
          >
            <LogIn size={12} /> ENTRAR
          </button>
          <button
            onClick={() => { setMode('create'); onChange(''); }}
            className={cn(
              "flex-1 py-2.5 text-[10px] font-bold tracking-[0.2em] flex items-center justify-center gap-2 transition-all",
              mode === 'create' ? "bg-[--accent] text-black shadow-[0_0_15px_rgba(var(--accent-rgb),0.3)]" : "text-[--muted] hover:text-white"
            )}
          >
            <Plus size={12} /> NOVO
          </button>
        </div>

        <form
          onSubmit={e => {
            e.preventDefault();
            if (mode === 'join') onJoin(value, passValue);
            else onCreate(value, passValue);
          }}
          className="space-y-5"
        >
          <div>
            <label className="tech-label block">
              {mode === 'join' ? 'ID Secreto (Hash)' : 'Nome do Canal'}
            </label>
            <input
              type="text"
              placeholder={mode === 'join' ? "Cole o ID da sala aqui..." : "Ex: Operação Sigma"}
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

          <div className="pt-2">
            <button type="submit" className="w-full tech-button py-4 font-bold text-sm tracking-[0.2em] shadow-[0_0_20px_rgba(var(--accent-rgb),0.2)] uppercase">
              {mode === 'join' ? 'Conectar ao Canal' : 'Gerar ID Secreto'}
            </button>
          </div>
        </form>

        {recentRooms.length > 0 && mode === 'join' && (
          <div className="mt-8">
            <div className="flex items-center gap-2 mb-3 px-1">
              <Clock size={12} className="text-[--muted]" />
              <span className="tech-label mb-0 uppercase text-[9px]">Salas Acessadas Recentemente</span>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
              {filtered.map(room => (
                <div
                  key={room.hash}
                  className="flex items-center justify-between p-3 bg-[#0a0a0a] border border-[#1a1a1a] hover:border-[--accent]/40 cursor-pointer transition-all group"
                  onClick={() => { onJoin(room.hash, passValue); }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-mono text-[--fg-bright] font-bold truncate">{room.name}</p>
                    <p className="text-[9px] text-[--muted] font-mono tracking-tighter truncate">ID: {room.hash}</p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); onRemoveRecent(room.hash); }}
                    className="opacity-0 group-hover:opacity-100 p-2 hover:text-red-400 text-[--muted] transition-all ml-2"
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
