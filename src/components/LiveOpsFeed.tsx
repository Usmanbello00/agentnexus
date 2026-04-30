import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, ShieldCheck, Ticket, User, Home, Clock, CheckCircle2, AlertTriangle, Info, XCircle, Search } from 'lucide-react';

interface LiveOpsLog {
  id: string;
  ticket_id?: string;
  message: string;
  type: "info" | "warning" | "error" | "success";
  timestamp: string;
}

interface TicketInteraction {
  id: string;
  ticket_id: string;
  external_id?: string;
  tenant_name: string;
  property_name: string;
  action: string;
  details: string;
  status: string;
  timestamp: string;
}

interface Props {
  theme: 'light' | 'dark';
  socket: any;
}

export const LiveOpsFeed: React.FC<Props> = ({ theme, socket }) => {
  const [logs, setLogs] = useState<LiveOpsLog[]>([]);
  const [interactions, setInteractions] = useState<TicketInteraction[]>([]);
  const [activeTab, setActiveTab] = useState<'feed' | 'history'>('feed');
  const [searchTerm, setSearchTerm] = useState('');
  
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initial load
    fetch('/api/live-ops').then(res => res.json()).then(setLogs);
    fetch('/api/interactions').then(res => res.json()).then(setInteractions);

    if (socket) {
      socket.on('live_ops:log', (log: LiveOpsLog) => {
        setLogs(prev => [log, ...prev].slice(0, 100));
      });
      socket.on('interaction:saved', (interaction: TicketInteraction) => {
        setInteractions(prev => [interaction, ...prev]);
      });
    }

    return () => {
      if (socket) {
        socket.off('live_ops:log');
        socket.off('interaction:saved');
      }
    };
  }, [socket]);

  const filteredInteractions = interactions.filter(i => 
    i.tenant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.property_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.external_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      <div className={`p-4 border-b flex items-center justify-between ${theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'}`}>
        <div className="flex items-center gap-3">
          <Activity className="text-blue-500" size={20} />
          <h2 className="font-bold tracking-tight">Autonomous Support Logic</h2>
        </div>
        <div className="flex bg-black/20 rounded-lg p-1">
          <button 
            onClick={() => setActiveTab('feed')}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'feed' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            LIVE OPS FEED
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'history' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            TICKET HISTORY
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {activeTab === 'feed' ? (
            <motion.div 
              key="feed"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="absolute inset-0 overflow-y-auto p-4 space-y-3 font-mono"
            >
              {logs.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-50 space-y-4">
                  <Clock size={48} className="animate-pulse" />
                  <p className="text-sm font-medium tracking-widest uppercase">Awaiting system heartbeat...</p>
                </div>
              )}
              {logs.map((log) => (
                <motion.div 
                  key={log.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-3 rounded-lg border flex gap-3 text-xs leading-relaxed transition-all ${
                    theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-gray-50 border-gray-100 shadow-sm'
                  }`}
                >
                  <div className="shrink-0 mt-0.5">
                    {log.type === 'info' && <Info size={14} className="text-blue-400" />}
                    {log.type === 'success' && <CheckCircle2 size={14} className="text-green-400" />}
                    {log.type === 'warning' && <AlertTriangle size={14} className="text-yellow-400" />}
                    {log.type === 'error' && <XCircle size={14} className="text-red-400" />}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between items-center opacity-40 text-[10px]">
                       <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                       {log.ticket_id && <span className="bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded uppercase tracking-tighter">ID: {log.ticket_id}</span>}
                    </div>
                    <p className={theme === 'dark' ? 'text-white/80' : 'text-gray-800'}>{log.message}</p>
                  </div>
                </motion.div>
              ))}
              <div ref={bottomRef} />
            </motion.div>
          ) : (
            <motion.div 
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="absolute inset-0 flex flex-col"
            >
              <div className={`p-4 border-b ${theme === 'dark' ? 'border-white/5' : 'border-gray-100'}`}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input 
                    type="text" 
                    placeholder="Search by Tenant or Property..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`w-full pl-9 pr-4 py-2 rounded-xl text-xs outline-none transition-all ${
                      theme === 'dark' ? 'bg-white/5 border border-white/10 focus:border-blue-500' : 'bg-white border border-gray-200 focus:border-blue-500'
                    }`}
                  />
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {filteredInteractions.length === 0 && (
                  <div className="text-center py-20 text-gray-500 italic text-sm">No interaction records found.</div>
                )}
                {filteredInteractions.map((interaction) => (
                  <motion.div 
                    key={interaction.id}
                    layoutId={interaction.id}
                    className={`rounded-2xl border overflow-hidden transition-all ${
                      theme === 'dark' ? 'bg-[#151515] border-white/10' : 'bg-white border-gray-200 shadow-xl shadow-black/5'
                    }`}
                  >
                    <div className={`px-4 py-3 border-b flex justify-between items-center ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="text-blue-500" size={16} />
                        <span className="text-xs font-black uppercase tracking-widest text-blue-500">Autonomous Action</span>
                      </div>
                      <span className="text-[10px] opacity-40 font-mono">{new Date(interaction.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="p-4 grid grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <User size={14} className="opacity-40" />
                          <div>
                            <p className="text-[10px] uppercase tracking-tighter opacity-40 font-bold">Tenant</p>
                            <p className="text-xs font-semibold">{interaction.tenant_name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Home size={14} className="opacity-40" />
                          <div>
                            <p className="text-[10px] uppercase tracking-tighter opacity-40 font-bold">Property</p>
                            <p className="text-xs font-semibold">{interaction.property_name}</p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Ticket size={14} className="opacity-40" />
                          <div>
                            <p className="text-[10px] uppercase tracking-tighter opacity-40 font-bold">Ticket #</p>
                            <p className="text-xs font-mono font-bold tracking-widest">{interaction.external_id || 'N/A'}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-tighter opacity-40 font-bold">Status</p>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            interaction.status.includes('Completed') ? 'bg-green-500/20 text-green-500' : 'bg-blue-500/20 text-blue-500'
                          }`}>
                            {interaction.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className={`m-4 p-3 rounded-xl border font-mono text-[11px] leading-relaxed ${
                      theme === 'dark' ? 'bg-black/40 border-white/5 text-white/60' : 'bg-gray-50 border-gray-100 text-gray-600'
                    }`}>
                      <p className="mb-2 text-blue-400 font-bold uppercase tracking-widest text-[9px]">Execution Details:</p>
                      {interaction.details}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
