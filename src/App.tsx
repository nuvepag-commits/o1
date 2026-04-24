/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield, Hash, Send, Image as ImageIcon,
  Copy, CheckCircle2, Terminal, LogOut,
  Settings, UserPlus, Clock, Check, X, Key, Search, Mic, Square, Menu, QrCode
} from 'lucide-react';
import { cn } from './lib/utils';
import {
  generateIdentityKeys, exportPublicKey, hashString,
  stripImageMetadata, deriveRoomKey, encryptText, decryptText, KeyPair
} from './lib/crypto';
import { supabase } from './lib/supabase';

import { IdentitySetup } from './components/IdentitySetup';
import { RoomEntrance, RecentRoom } from './components/RoomEntrance';

interface Message {
  id: string;
  senderId: string;
  senderAlias: string;
  content: string;
  type: 'text' | 'image' | 'audio';
  timestamp: any;
}

interface RoomData {
  id: string;
  ownerId: string;
  password?: string;
  allowedUsers: string[];
}

interface JoinRequest {
  userId: string;
  alias: string;
  status: 'pending' | 'approved' | 'rejected';
}

const RECENT_ROOMS_KEY = 'krypto_recent_rooms';

function getRecentRooms(): RecentRoom[] {
  try { return JSON.parse(localStorage.getItem(RECENT_ROOMS_KEY) || '[]'); }
  catch { return []; }
}

function saveRecentRoom(name: string, hash: string) {
  const rooms = getRecentRooms().filter(r => r.hash !== hash);
  rooms.unshift({ name, hash, lastSeen: Date.now() });
  localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(rooms.slice(0, 20)));
}

function removeRecentRoom(hash: string) {
  const rooms = getRecentRooms().filter(r => r.hash !== hash);
  localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(rooms));
}

export default function App() {
  const [identity, setIdentity] = useState<{ keys: KeyPair; id: string; alias: string } | null>(null);
  const [roomHash, setRoomHash] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string>('');
  const [roomPassword, setRoomPassword] = useState<string>('');
  const [roomKey, setRoomKey] = useState<CryptoKey | null>(null);
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [decryptedMessages, setDecryptedMessages] = useState<Record<string, string>>({});
  const [inputRoom, setInputRoom] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [messageText, setMessageText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<JoinRequest[]>([]);
  const [isPendingApproval, setIsPendingApproval] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [recentRooms, setRecentRooms] = useState<RecentRoom[]>(getRecentRooms());
  const [logs, setLogs] = useState<string[]>(['SISTEMA INICIALIZADO...', 'AUTENTICANDO...']);
  const [copied, setCopied] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /** Ensures we have an authenticated Supabase user. Returns the user or throws. */
  const getOrEnsureAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) return session.user;
    
    addLog('AGUARDANDO AUTENTICAÇÃO...');
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    return data.user;
  };

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 8));
  };

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auth & Identity Init
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        addLog('AUTENTICADO ANONIMAMENTE.');
        setAuthReady(true);
      } else {
        setUser(null);
        setAuthReady(false);
        supabase.auth.signInAnonymously().catch(() => addLog('FALHA NA AUTENTICAÇÃO.'));
      }
    });

    const savedAlias = localStorage.getItem('krypto_alias');
    if (savedAlias) handleGenerateIdentity(savedAlias);

    return () => subscription.unsubscribe();
  }, []);

  // Decrypt new messages when roomKey or messages change
  useEffect(() => {
    if (!roomKey) return;
    messages.forEach(async m => {
      if (decryptedMessages[m.id] !== undefined) return;
      if (m.type !== 'text') return;
      try {
        const plain = await decryptText(m.content, roomKey);
        setDecryptedMessages(prev => ({ ...prev, [m.id]: plain }));
      } catch {
        setDecryptedMessages(prev => ({ ...prev, [m.id]: '[Mensagem criptografada — chave inválida]' }));
      }
    });
  }, [messages, roomKey]);

  const handleGenerateIdentity = async (alias: string) => {
    setIsGenerating(true);
    addLog('GERANDO PAR DE CHAVES RSA-2048...');
    try {
      const keys = await generateIdentityKeys();
      const pubKeyJwk = await exportPublicKey(keys.publicKey);
      const id = await hashString(pubKeyJwk);
      setIdentity({ keys, id, alias });
      localStorage.setItem('krypto_alias', alias);
      addLog(`IDENTIDADE GERADA: ${id?.substring(0, 16)}...`);
    } catch (err) {
      addLog('ERRO NA GERAÇÃO DE CHAVES.');
    } finally {
      setIsGenerating(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('krypto_alias');
    setIdentity(null);
    setRoomHash(null);
    setRoomKey(null);
    addLog('SESSÃO ENCERRADA.');
  };

  // Room & Message Subscriptions
  useEffect(() => {
    let user: any = null;
    supabase.auth.getSession().then(({ data }) => {
      user = data.session?.user;
    });

    if (!roomHash) return;

    // Room Subscription
    const roomChannel = supabase
      .channel(`room:${roomHash}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomHash}` }, (payload) => {
        const data = payload.new as any;
        setRoomData({
          id: data.id,
          ownerId: data.owner_id,
          password: data.password_hash,
          allowedUsers: data.allowed_users || []
        });
        
        if (user && !data.allowed_users?.includes(user.id) && data.owner_id !== user.id) {
          setIsPendingApproval(true);
        } else {
          setIsPendingApproval(false);
        }
      })
      .subscribe();

    // Initial Room Load
    supabase.from('rooms').select('*').eq('id', roomHash).single().then(({ data }) => {
      if (data) {
        setRoomData({
          id: data.id,
          ownerId: data.owner_id,
          password: data.password_hash,
          allowedUsers: data.allowed_users || []
        });
        supabase.auth.getSession().then(({ data: sessionData }) => {
          const u = sessionData.session?.user;
          if (u && !data.allowed_users?.includes(u.id) && data.owner_id !== u.id) {
            setIsPendingApproval(true);
          }
        });
      }
    });

    // Messages Subscription
    const messagesChannel = supabase
      .channel(`messages:${roomHash}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomHash}` }, (payload) => {
        setMessages(prev => [...prev, payload.new as any]);
        addLog('NOVA MENSAGEM RECEBIDA.');
      })
      .subscribe();

    // Initial Messages Load
    supabase.from('messages').select('*').eq('room_id', roomHash).order('timestamp', { ascending: true }).then(({ data }) => {
      if (data) setMessages(data as any);
    });

    // Join Requests Subscription (For Owners)
    const requestsChannel = supabase
      .channel(`requests:${roomHash}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'join_requests', filter: `room_id=eq.${roomHash}` }, () => {
        loadPendingRequests();
      })
      .subscribe();

    const loadPendingRequests = () => {
      supabase.from('join_requests').select('*').eq('room_id', roomHash).eq('status', 'pending').then(({ data }) => {
        if (data) setPendingRequests(data as any);
      });
    };

    // Initial Load
    loadPendingRequests();

    // My Request Subscription
    let myRequestChannel: any = null;
    supabase.auth.getSession().then(({ data: sessionData }) => {
      const u = sessionData.session?.user;
      if (u) {
        myRequestChannel = supabase
          .channel(`my_request:${roomHash}`)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'join_requests', filter: `user_id=eq.${u.id}` }, (payload) => {
            const data = payload.new as any;
            if (data.status === 'approved') {
              addLog('ACESSO APROVADO.');
              setIsPendingApproval(false);
            } else if (data.status === 'rejected') {
              addLog('ACESSO REJEITADO.');
              setRoomHash(null);
              setIsPendingApproval(false);
            }
          })
          .subscribe();
      }
    });

    return () => {
      roomChannel.unsubscribe();
      messagesChannel.unsubscribe();
      requestsChannel.unsubscribe();
      if (myRequestChannel) myRequestChannel.unsubscribe();
    };
  }, [roomHash]);

  const joinRoom = async (roomId: string, password?: string) => {
    const trimmedId = roomId.trim();
    if (!trimmedId) { addLog('ID DA SALA INVÁLIDO.'); return; }
    try {
      const currentUser = await getOrEnsureAuth();
      const hashedPass = password?.trim() ? await hashString(password.trim()) : null;
      addLog(`LOCALIZANDO CANAL: ${trimmedId.substring(0, 8)}...`);

      const { data: roomSnap, error: fetchError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', trimmedId)
        .maybeSingle();

      if (!roomSnap) {
        addLog('SALA NÃO ENCONTRADA. VERIFIQUE O ID.');
        alert('ID da Sala não encontrado. Peça o ID correto ao proprietário.');
        return;
      }

      const derivedKey = await deriveRoomKey(roomSnap.name, password?.trim());
      setRoomKey(derivedKey);
      setRoomName(roomSnap.name);
      setRoomPassword(password?.trim() || '');

      addLog('SALA LOCALIZADA. VERIFICANDO ACESSO...');
      if (roomSnap.allowed_users?.includes(currentUser.id)) {
        addLog('ACESSO AUTORIZADO.');
        saveRecentRoom(roomSnap.name, trimmedId);
        setRecentRooms(getRecentRooms());
        setRoomHash(trimmedId);
        return;
      }

      if (roomSnap.password_hash && roomSnap.password_hash !== hashedPass) {
        addLog('SENHA INCORRETA.');
        alert('Senha incorreta para esta sala.');
        return;
      }

      addLog('ENVIANDO SOLICITAÇÃO AO DONO...');
      const { error: reqError } = await supabase
        .from('join_requests')
        .upsert({
          room_id: trimmedId,
          user_id: currentUser.id,
          alias: identity!.alias,
          status: 'pending'
        }, { onConflict: 'room_id,user_id' });

      if (reqError) throw reqError;

      setIsPendingApproval(true);
      saveRecentRoom(roomSnap.name, trimmedId);
      setRecentRooms(getRecentRooms());
      setRoomHash(trimmedId);
      addLog('AGUARDANDO APROVAÇÃO.');
    } catch (err: any) {
      addLog('FALHA AO ENTRAR.');
      console.error('joinRoom error:', err);
    }
  };

  const createRoom = async (displayName: string, password?: string) => {
    const name = displayName.trim() || 'Nova Sala';
    try {
      const currentUser = await getOrEnsureAuth();
      // Generate a random unique ID (12 chars)
      const randomId = Math.random().toString(36).substring(2, 8) + '-' + Math.random().toString(36).substring(2, 8);
      const hashedPass = password?.trim() ? await hashString(password.trim()) : null;
      
      addLog('GERANDO CANAL SEGURO...');
      const { error: insertError } = await supabase
        .from('rooms')
        .insert({
          id: randomId,
          name: name,
          owner_id: currentUser.id,
          password_hash: hashedPass,
          allowed_users: [currentUser.id]
        });

      if (insertError) throw insertError;

      const derivedKey = await deriveRoomKey(name, password?.trim());
      setRoomKey(derivedKey);
      setRoomName(name);
      setRoomPassword(password?.trim() || '');
      setRoomHash(randomId);
      
      saveRecentRoom(name, randomId);
      setRecentRooms(getRecentRooms());
      addLog('SALA CRIADA COM SUCESSO.');
    } catch (err: any) {
      addLog('ERRO AO CRIAR SALA.');
      console.error(err);
    }
  };

  const approveUser = async (userId: string) => {
    if (!roomHash || !roomData) return;
    try {
      await supabase.from('join_requests').update({ status: 'approved' }).eq('room_id', roomHash).eq('user_id', userId);
      const { data: room } = await supabase.from('rooms').select('allowed_users').eq('id', roomHash).single();
      const currentList = room?.allowed_users || [];
      const updatedList = Array.from(new Set([...currentList, userId]));
      await supabase.from('rooms').update({ allowed_users: updatedList }).eq('id', roomHash);
      addLog('USUÁRIO APROVADO.');
    } catch { addLog('ERRO NA APROVAÇÃO.'); }
  };

  const rejectUser = async (userId: string) => {
    if (!roomHash) return;
    try {
      await supabase.from('join_requests').update({ status: 'rejected' }).eq('room_id', roomHash).eq('user_id', userId);
      addLog('USUÁRIO REJEITADO.');
    } catch { addLog('ERRO NA REJEIÇÃO.'); }
  };

  const handleSendMessage = async (text: string) => {
    const session = await supabase.auth.getSession();
    const currentUser = session.data.session?.user;
    if (!roomHash || !currentUser || !text.trim() || !roomKey) return;
    try {
      const encrypted = await encryptText(text.trim(), roomKey);
      
      // 1. Insert message (Must work for all members)
      const { error: msgError } = await supabase.from('messages').insert({
        room_id: roomHash,
        sender_id: currentUser.id,
        sender_alias: identity!.alias,
        content: encrypted,
        type: 'text'
      });
      
      if (msgError) throw msgError;

      // 2. Try to update room activity (Might fail if not owner, that's okay)
      try {
        await supabase.from('rooms').update({ last_activity: new Date().toISOString() }).eq('id', roomHash);
      } catch (e) {
        // Ignore room update error
      }

      setMessageText('');
    } catch (err: any) {
      addLog('FALHA NO ENVIO.');
      console.error('SendMessage error:', err);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const session = await supabase.auth.getSession();
    const currentUser = session.data.session?.user;
    if (!file || !roomHash || !currentUser || !roomKey) return;
    addLog('LIMPANDO METADADOS (EXIF)...');
    try {
      const cleanBlob = await stripImageMetadata(file);
      const reader = new FileReader();
      reader.onload = async re => {
        const base64 = re.target?.result as string;
        try {
          const encrypted = await encryptText(base64, roomKey);
          await supabase.from('messages').insert({
            room_id: roomHash,
            sender_id: currentUser.id,
            sender_alias: identity!.alias,
            content: encrypted,
            type: 'image'
          });
          addLog('IMAGEM ENVIADA.');
        } catch { addLog('ERRO (IMAGEM).'); }
      };
      reader.readAsDataURL(cleanBlob);
    } catch { addLog('FALHA AO PROCESSAR IMAGEM.'); }
    e.target.value = '';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await handleAudioSend(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsRecording(true);
      addLog('GRAVANDO ÁUDIO...');
    } catch (err) {
      addLog('ERRO AO ACESSAR MICROFONE.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      addLog('PROCESSANDO ÁUDIO...');
    }
  };

  const handleAudioSend = async (blob: Blob) => {
    if (!roomHash || !user || !roomKey) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        const encrypted = await encryptText(base64, roomKey);
        await supabase.from('messages').insert({
          room_id: roomHash,
          sender_id: user.id,
          sender_alias: identity!.alias,
          content: encrypted,
          type: 'audio'
        });
        addLog('MENSAGEM DE VOZ ENVIADA.');
      } catch (err: any) {
        addLog('ERRO AO ENVIAR ÁUDIO.');
        console.error(err);
      }
    };
    reader.readAsDataURL(blob);
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomName);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ─── Screens ──────────────────────────────────────────

  if (!identity) {
    return <IdentitySetup onGenerate={handleGenerateIdentity} isLoading={isGenerating} />;
  }

  if (!roomHash) {
    return (
      <RoomEntrance
        value={inputRoom} onChange={setInputRoom}
        passValue={inputPassword} onPassChange={setInputPassword}
        onJoin={joinRoom} onCreate={createRoom}
        recentRooms={recentRooms}
        onRemoveRecent={hash => { removeRecentRoom(hash); setRecentRooms(getRecentRooms()); }}
      />
    );
  }

  if (isPendingApproval) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#050505' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="tech-card p-8 max-w-md w-full relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-1 h-full bg-[--accent]" />
          <div className="flex items-center gap-3 mb-6">
            <Clock className="text-[--accent]" size={32} />
            <div>
              <h2 className="text-xl font-mono uppercase font-bold text-[--fg-bright]">Aguardando Acesso</h2>
              <p className="text-xs font-mono text-[--muted]">Permissão pendente do proprietário.</p>
            </div>
          </div>
          <div className="p-4 bg-white/5 border-l-2 border-[--accent] mb-6">
            <p className="text-xs font-mono text-[--fg]">Sala: <strong>{roomName}</strong></p>
            <p className="text-[10px] font-mono text-[--muted] mt-1">Aguarde o proprietário aprovar sua entrada.</p>
          </div>
          <button onClick={() => { setRoomHash(null); setIsPendingApproval(false); }} className="w-full tech-button-muted">
            CANCELAR SOLICITAÇÃO
          </button>
        </motion.div>
      </div>
    );
  }

  if (!roomData) {
    return (
      <div className="min-h-screen bg-black text-[--accent] font-mono flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-[--accent] border-t-transparent rounded-full animate-spin" />
          <p className="text-[10px] uppercase tracking-[0.3em] animate-pulse">Sincronizando Canal...</p>
        </div>
      </div>
    );
  }

  // ─── Main Chat ────────────────────────────────────────

  return (
    <div className="flex h-screen bg-black text-[--fg] font-mono overflow-hidden relative">
      {/* Mobile Overlay */}
      <AnimatePresence>
        {showSidebar && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowSidebar(false)}
            className="fixed inset-0 bg-black/80 z-30 md:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 w-72 border-r border-[#1a1a1a] bg-[#080808] flex flex-col z-40 transition-transform duration-300 md:relative md:translate-x-0 md:flex md:w-64",
        showSidebar ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 border-b border-[#1a1a1a] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[--accent] animate-pulse" />
            <h2 className="text-[11px] font-bold text-[--accent] uppercase tracking-[0.2em]">KryptoAnon</h2>
          </div>
          <button onClick={() => setShowSidebar(false)} className="md:hidden text-[--muted]"><X size={16} /></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="p-4 bg-white/5 border-l-2 border-[--accent]">
            <p className="text-[9px] text-[--muted] uppercase tracking-widest mb-1">Identidade Local</p>
            <p className="text-xs text-[--fg-bright] truncate">{identity.alias}</p>
            <p className="text-[9px] text-[#404040] mt-1 break-all">{identity.id?.substring(0, 24)}...</p>
          </div>

          <div className="p-4 bg-[--accent]/5 border-l-2 border-[--accent]">
            <p className="text-[9px] text-[--accent] uppercase tracking-widest mb-2">Canal Atual</p>
            <div className="space-y-3">
              <div>
                <p className="text-[10px] text-[--muted] uppercase text-[8px] mb-1">ID Secreto</p>
                <div className="flex items-center gap-2">
                  <code className="text-[10px] text-[--fg-bright] font-mono truncate flex-1">{roomHash}</code>
                  <button
                    onClick={() => { navigator.clipboard.writeText(roomHash || ''); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                    className="p-1.5 hover:bg-white/10 text-[--muted] hover:text-[--accent] transition-all"
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                </div>
              </div>
              <button
                className="w-full flex items-center justify-center gap-2 py-2 border border-[--accent]/20 text-[--accent] text-[10px] hover:bg-[--accent]/10 transition-all uppercase tracking-widest"
                onClick={() => alert(`QR Code Link: ${window.location.origin}/#${roomHash}`)}
              >
                <QrCode size={12} /> Gerar QR Code
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-[9px] text-[--muted] uppercase tracking-widest mb-4 px-2">Salas Recentes</h3>
            <div className="space-y-1">
              {recentRooms.map(room => (
                <button
                  key={room.hash}
                  onClick={() => { setRoomHash(room.hash); setShowSidebar(false); }}
                  className={cn(
                    "w-full text-left p-3 text-xs transition-all border-l-2",
                    roomHash === room.hash ? "bg-[#111] border-[--accent] text-[--fg-bright]" : "border-transparent text-[--muted] hover:bg-[#111] hover:text-[--fg-bright]"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span># {room.name}</span>
                    <Hash size={10} className="opacity-20" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-[#1a1a1a]">
          <button
            onClick={() => {
              if (confirm('Sua identidade local será apagada. Continuar?')) {
                localStorage.removeItem('krypto_alias');
                window.location.reload();
              }
            }}
            className="w-full flex items-center justify-center gap-2 p-3 text-[10px] text-red-500 hover:bg-red-500/10 transition-colors uppercase tracking-widest"
          >
            <LogOut size={12} /> Encerrar Sessão
          </button>
        </div>
      </aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
          {/* Header */}
          <header className="h-14 border-b border-[#1a1a1a] flex items-center justify-between px-4 md:px-6 bg-[#080808] flex-shrink-0">
            <div className="flex items-center gap-3">
              <button onClick={() => setShowSidebar(true)} className="md:hidden text-[--muted] hover:text-white p-2 -ml-2">
                <Menu size={20} />
              </button>
              <div className="flex items-center gap-2">
                <Hash className="text-[--accent]" size={16} />
                <h1 className="text-sm font-bold text-[--fg-bright] uppercase tracking-wider truncate max-w-[120px] md:max-w-none">
                  {roomName}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-mono hidden sm:flex">
              <span className={cn('uppercase', roomData?.ownerId === user?.id ? 'text-[--accent]' : 'text-[--muted]')}>
                {roomData?.ownerId === user?.id ? 'Proprietário' : 'Membro'}
              </span>
              <span className="text-[--accent]">● Online</span>
            </div>
          </header>

          {/* Config overlay */}
          <AnimatePresence>
            {showConfig && roomData?.ownerId === user?.id && (
              <motion.div
                initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50 }}
                className="absolute top-14 right-0 bottom-0 w-72 bg-[#080808] border-l border-[#1a1a1a] p-5 z-20"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-[11px] font-bold text-[--accent] uppercase tracking-wider">Painel de Controle</h3>
                  <button onClick={() => setShowConfig(false)} className="text-[--muted] hover:text-white"><X size={14} /></button>
                </div>
                <div className="space-y-4">
                  <div>
                    <h4 className="tech-label mb-2 flex items-center gap-2"><UserPlus size={10} /> Solicitações ({pendingRequests.length})</h4>
                    {pendingRequests.length === 0
                      ? <p className="text-[10px] text-[--muted] italic">Nenhuma pendente.</p>
                      : pendingRequests.map(req => (
                          <div key={req.user_id} className="flex items-center justify-between p-2 bg-[#0a0a0a] border border-[#222] mb-2">
                            <span className="text-[11px] text-[--fg-bright] font-mono">{req.alias}</span>
                            <div className="flex gap-1">
                              <button onClick={() => approveUser(req.user_id)} className="p-1 bg-[--accent]/20 text-[--accent] hover:bg-[--accent]/30 rounded"><Check size={12} /></button>
                              <button onClick={() => rejectUser(req.user_id)} className="p-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded"><X size={12} /></button>
                            </div>
                          </div>
                        ))
                    }
                  </div>
                  <div>
                    <h4 className="tech-label mb-2 flex items-center gap-2"><Shield size={10} /> Membros ({roomData.allowedUsers.length})</h4>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {roomData.allowedUsers.map(uid => (
                        <div key={uid} className="text-[10px] font-mono p-1.5 text-[--muted]">
                          {uid === user?.id ? <span className={cn('text-[--accent]')}>VOCÊ (OWNER)</span> : uid?.substring(0, 12) + '...'}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mini Logs (Mobile friendly) */}
          <div className="bg-[#080808] border-b border-[#1a1a1a] px-4 py-1.5 flex gap-4 overflow-x-auto no-scrollbar scroll-smooth">
            {logs.slice(-2).map((log, i) => (
              <div key={i} className="flex items-center gap-2 whitespace-nowrap">
                <Terminal size={8} className="text-[--accent]" />
                <span className="text-[8px] text-[--muted] uppercase tracking-[0.2em]">{log}</span>
              </div>
            ))}
          </div>

          {/* Messages */}
          <main className="flex-1 overflow-y-auto p-6 space-y-4 font-mono text-sm bg-[#050505]">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center opacity-30">
                <Hash size={32} className="text-[--accent] mb-4" />
                <p className="text-xs font-mono uppercase tracking-widest">Canal seguro estabelecido</p>
                <p className="text-[10px] text-[--muted] mt-1">AES-256-GCM · Sem metadados</p>
              </div>
            )}
            <AnimatePresence initial={false}>
              {messages.map(m => {
                const isMe = m.senderId === user?.id;
                const decrypted = decryptedMessages[m.id];
                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn('flex flex-col max-w-lg', isMe ? 'ml-auto items-end' : 'mr-auto items-start')}
                  >
                    <span className="text-[9px] text-[#404040] mb-1 font-mono">
                      {m.senderAlias} · {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {isMe && ' · (você)'}
                    </span>
                    <div className={cn(
                      'px-4 py-3 text-sm leading-relaxed border-l-2',
                      isMe ? 'bg-[#1a1a1a] border-[#404040] text-[--fg-bright]' : 'bg-[#111] border-[--accent] text-[--fg-bright]'
                    )}>
                      {m.type === 'text' && (decrypted ?? <span className="animate-pulse text-[--muted]">Descriptografando...</span>)}
                      {m.type === 'image' && decrypted && (
                        <div className="flex flex-col gap-1">
                          <img src={decrypted} alt="img" className="max-w-xs rounded border border-[#262626]" />
                          <span className="text-[9px] text-[--muted] uppercase tracking-widest">Metadados Removidos</span>
                        </div>
                      )}
                      {m.type === 'image' && !decrypted && <span className="animate-pulse text-[--muted]">Carregando imagem...</span>}
                      {m.type === 'audio' && decrypted && (
                        <audio src={decrypted} controls className="max-w-full h-8" />
                      )}
                      {m.type === 'audio' && !decrypted && <span className="animate-pulse text-[--muted]">Carregando áudio...</span>}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </main>

          {/* Input */}
          <footer className="border-t border-[#1a1a1a] p-4 bg-[#050505] flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder={isRecording ? "Gravando áudio..." : "Mensagem criptografada..."}
                  className={cn(
                    "w-full bg-[#0a0a0a] border border-[#262626] px-4 py-3 text-sm font-mono text-[--fg-bright] placeholder-[#333] focus:outline-none focus:border-[--accent]/50 transition-colors pr-24",
                    isRecording && "border-red-500/50 animate-pulse"
                  )}
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(messageText); }
                  }}
                  disabled={isRecording}
                />
                <span className="absolute right-3 top-3.5 text-[#333] font-mono text-[9px] uppercase tracking-widest">AES-256</span>
              </div>
              
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={cn(
                  "p-3 transition-all border border-[#262626]",
                  isRecording ? "bg-red-500 text-white animate-pulse" : "bg-[#1a1a1a] text-[--muted] hover:bg-[#222] hover:text-white"
                )}
              >
                {isRecording ? <Square size={16} /> : <Mic size={16} />}
              </button>

              <label className="p-3 bg-[#1a1a1a] text-[--muted] cursor-pointer hover:bg-[#222] hover:text-[--fg-bright] transition-colors border border-[#262626]">
                <ImageIcon size={16} />
                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={isRecording} />
              </label>

              <button
                onClick={() => handleSendMessage(messageText)}
                disabled={!messageText.trim() || isRecording}
                className="p-3 bg-[--accent] text-black font-bold hover:brightness-90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Send size={16} />
              </button>
            </div>
          </footer>
        </div>
      </div>
    );
  }
