import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Hash, Key, Clock, Trash2, Plus, LogIn, Lock, Camera, X } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { cn } from '../lib/utils';
import { AnimatePresence } from 'motion/react';

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
  onCreate: (name: string, pass?: string, msgKey?: string) => void;
  recentRooms: RecentRoom[];
  onRemoveRecent: (hash: string) => void;
}

export function RoomEntrance({ value, onChange, passValue, onPassChange, onJoin, onCreate, recentRooms, onRemoveRecent }: Props) {
  const [mode, setMode] = useState<'join' | 'create'>('join');
  const [messageKey, setMessageKey] = useState('');
  const [search, setSearch] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [scannerRef, setScannerRef] = useState<Html5Qrcode | null>(null);

  const stopScanner = async () => {
    if (scannerRef) {
      try {
        await scannerRef.stop();
      } catch (e) {
        console.error("Erro ao parar scanner:", e);
      }
      setScannerRef(null);
    }
    setShowScanner(false);
  };

  const startScanner = () => {
    setShowScanner(true);
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode("reader");
        setScannerRef(html5QrCode);
        
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        
        await html5QrCode.start(
          { facingMode: "environment" }, 
          config,
          (decodedText) => {
            let id = decodedText;
            if (id.includes('#')) {
              id = id.split('#').pop() || id;
            }
            onChange(id);
            stopScanner();
          },
          (errorMessage) => {
            // console.log(errorMessage);
          }
        );
      } catch (err) {
        console.error("Erro ao iniciar câmera:", err);
        alert("Não foi possível acessar a câmera. Verifique as permissões.");
        setShowScanner(false);
      }
    }, 300);
  };

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
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
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
          {mode === 'join' && (
            <button
              onClick={startScanner}
              className="p-3 bg-[--accent]/10 text-[--accent] rounded-full hover:bg-[--accent]/20 transition-all border border-[--accent]/20"
              title="Ler QR Code"
            >
              <Camera size={20} />
            </button>
          )}
        </div>

        {/* Scanner Modal */}
        <AnimatePresence>
          {showScanner && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/95 z-[200] flex flex-col items-center justify-center p-6 backdrop-blur-xl"
            >
              <div className="w-full max-w-sm tech-card p-4 border-t-4 border-t-[--accent]">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-[--fg-bright] uppercase tracking-widest">Leitor de QR Code</h3>
                  <button onClick={stopScanner} className="text-[--muted] hover:text-white p-2">
                    <X size={20} />
                  </button>
                </div>
                <div id="reader" className="overflow-hidden rounded-lg border border-white/10"></div>
                <p className="text-[10px] text-[--muted] mt-4 text-center uppercase tracking-[0.2em]">Aponte a câmera para o QR Code da sala</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
            else onCreate(value, passValue, messageKey);
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
            <label className="tech-label block">
              {mode === 'join' ? 'Senha da Sala' : 'Definir Senha de Entrada (Opcional)'}
            </label>
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
            {mode === 'create' && (
              <p className="text-[9px] text-[#404040] mt-1 uppercase tracking-wider">Usada apenas para permitir que membros peçam acesso.</p>
            )}
          </div>

          {mode === 'create' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-2 pt-2 border-t border-white/5"
            >
              <label className="tech-label block text-[--accent]">Definir Chave de Mensagens (E2EE)</label>
              <div className="relative">
                <input
                  type="password"
                  placeholder="CHAVE SECRETA PARA CRIPTOGRAFIA"
                  className="w-full tech-input pr-10 border-[--accent]/30 focus:border-[--accent]"
                  value={messageKey}
                  onChange={e => setMessageKey(e.target.value)}
                  required
                />
                <Lock size={14} className="absolute right-3 top-3.5 text-[--accent]/50" />
              </div>
              <p className="text-[9px] text-[--muted] uppercase tracking-wider">Esta chave NUNCA é enviada ao servidor. Guarde-a bem!</p>
            </motion.div>
          )}

          <div className="pt-2 relative z-50">
            <button 
              type="submit" 
              className={cn(
                "w-full py-4 font-bold text-sm tracking-[0.2em] uppercase transition-all flex items-center justify-center gap-3 active:scale-[0.98]",
                "bg-[#00FF41] text-black shadow-[0_0_20px_rgba(0,255,65,0.3)] hover:brightness-110"
              )}
            >
              {mode === 'join' ? <LogIn size={18} /> : <Plus size={18} />}
              {mode === 'join' ? 'Conectar ao Canal Agora' : 'Criar Canal Seguro'}
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
