/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  History, 
  Brain, 
  Trash2, 
  Plus, 
  Check, 
  Search, 
  Sparkles, 
  MessageSquare, 
  Calendar, 
  Info,
  ChevronRight,
  ShieldAlert,
  Edit2
} from 'lucide-react';
import { ChatSession, MemoryFact } from '../types';

interface MemoryHistoryManagerProps {
  // Session parameters
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onStartNewSession: () => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, newTitle: string) => void;

  // Memory parameters
  memories: MemoryFact[];
  onAddMemory: (fact: string, category: MemoryFact['category']) => void;
  onDeleteMemory: (id: string) => void;
  onClearAllMemories: () => void;
}

export default function MemoryHistoryManager({
  sessions,
  activeSessionId,
  onSelectSession,
  onStartNewSession,
  onDeleteSession,
  onRenameSession,
  memories,
  onAddMemory,
  onDeleteMemory,
  onClearAllMemories
}: MemoryHistoryManagerProps) {
  const [newFact, setNewFact] = useState('');
  const [newCategory, setNewCategory] = useState<MemoryFact['category']>('User Preference');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [memorySearch, setMemorySearch] = useState('');
  const [isMemoryToggled, setIsMemoryToggled] = useState(true);

  const handleCreateMemory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFact.trim()) return;
    onAddMemory(newFact.trim(), newCategory);
    setNewFact('');
  };

  const startRename = (id: string, currentTitle: string) => {
    setEditingSessionId(id);
    setEditTitle(currentTitle);
  };

  const saveRename = (id: string) => {
    if (editTitle.trim()) {
      onRenameSession(id, editTitle.trim());
    }
    setEditingSessionId(null);
  };

  // Filter memories
  const filteredMemories = memories.filter(m => 
    m.fact.toLowerCase().includes(memorySearch.toLowerCase()) || 
    m.category.toLowerCase().includes(memorySearch.toLowerCase())
  );

  // Suggested quick facts for easy training
  const PRESET_MEMORIES = [
    { fact: "Prefer Euro (EUR) baseline rules over USD currency indicators", category: "User Preference" as const },
    { fact: "Hard cutoff threshold of USD 150k for Purchase Orders audits", category: "Scope Limit" as const },
    { fact: "Audit only SAP ABAP scripts and Material Management chapters", category: "SAP Compliance" as const }
  ];

  const handleInjectPreset = (preset: typeof PRESET_MEMORIES[0]) => {
    if (!memories.some(m => m.fact.toLowerCase() === preset.fact.toLowerCase())) {
      onAddMemory(preset.fact, preset.category);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:h-full lg:max-h-[calc(100vh-140px)] min-h-0" id="memory_history_framework">
      
      {/* LEFT COLUMN: Past Conversations & Sessions History List (5 cols) */}
      <div className="lg:col-span-5 p-5 bg-[#0c0d13] border border-zinc-850 rounded-2xl flex flex-col gap-4 lg:h-full min-h-0">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-900 flex-shrink-0">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-amber-400" /> ChatGPT Sessions History
            </h3>
            <p className="text-xs text-zinc-550 mt-1">Multi-session threads loaded from cache memory.</p>
          </div>
          <button 
            onClick={onStartNewSession}
            className="p-1 px-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-[11px] font-mono rounded border border-amber-500/20 transition-all flex items-center gap-1 cursor-pointer font-bold"
          >
            <Plus className="w-3.5 h-3.5" /> New Thread
          </button>
        </div>

        <div className="space-y-2 flex-1 overflow-y-auto pr-1">
          {sessions.map((sess) => {
            const isActive = sess.id === activeSessionId;
            const isEditing = sess.id === editingSessionId;
            return (
              <div 
                key={sess.id}
                className={`group p-3 rounded-xl border text-xs transition-all relative ${
                  isActive 
                    ? 'bg-amber-500/5 border-amber-500/25 shadow-md' 
                    : 'bg-zinc-950/40 border-zinc-900 hover:border-zinc-800 hover:bg-zinc-950/70'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 truncate flex-1 cursor-pointer" onClick={() => !isEditing && onSelectSession(sess.id)}>
                    <MessageSquare className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isActive ? 'text-amber-400' : 'text-zinc-550 group-hover:text-amber-400/80'}`} />
                    
                    <div className="truncate flex-1">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 mt-0.5" onClick={(e) => e.stopPropagation()}>
                          <input 
                            type="text" 
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveRename(sess.id);
                            }}
                            className="bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 text-xs text-zinc-100 font-mono w-full focus:outline-none focus:border-amber-500"
                            autoFocus
                          />
                          <button 
                            onClick={() => saveRename(sess.id)}
                            className="bg-amber-500 hover:bg-amber-400 p-1 text-black rounded"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <span className={`font-semibold block truncate ${isActive ? 'text-zinc-100' : 'text-zinc-350'}`}>
                          {sess.title}
                        </span>
                      )}
                      
                      <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-zinc-650" /> {sess.updatedAt}
                        </span>
                        <span>•</span>
                        <span>{sess.messages.length} utterances</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-zinc-550 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!isEditing && (
                      <button 
                        onClick={() => startRename(sess.id, sess.title)}
                        className="hover:text-amber-400 p-1 rounded transition-colors"
                        title="Rename Chat session"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    )}
                    <button 
                      onClick={() => onDeleteSession(sess.id)}
                      disabled={sessions.length <= 1}
                      className="hover:text-red-400 p-1 rounded transition-colors disabled:opacity-30"
                      title="Discard chat session"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {sessions.length === 0 && (
            <div className="text-center py-8 text-zinc-550 text-xs border border-dashed border-zinc-900 rounded-2xl">
              No previous threads found in cache.
            </div>
          )}
        </div>

        {/* Informative notice block */}
        <div className="p-3 bg-zinc-950 border border-zinc-900/60 rounded-xl flex gap-2.5 text-[11px] text-zinc-500">
          <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Clicking any previous thread loads the complete back-and-forth buffer so you can resume audits cleanly precisely from where you paused.
          </p>
        </div>
      </div>

      {/* RIGHT COLUMN: Long Term System Memory Facts Bank (7 cols) */}
      <div className="lg:col-span-7 flex flex-col gap-4 lg:h-full min-h-0" id="ai_memory_fact_bank">
        
        {/* Memory Panel */}
        <div className="p-5 bg-[#0c0d13] border border-zinc-850 rounded-2xl flex flex-col gap-3.5 flex-1 min-h-0">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-900 flex-shrink-0">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Brain className="w-4 h-4 text-pink-400 animate-pulse" /> AI Long-Term Memory (Persistent Facts)
              </h3>
              <p className="text-xs text-zinc-550 mt-1">
                Ground truths the assistant holds active in mind globally across all context chats.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded border border-pink-500/20 font-bold">
                {memories.length} Memories
              </span>
              {memories.length > 0 && (
                <button 
                  onClick={onClearAllMemories}
                  className="text-[10px] font-mono text-zinc-500 hover:text-red-400 cursor-pointer underline flex items-center gap-0.5"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* Quick Explanation Badge */}
          <div className="p-3 bg-pink-950/15 border border-pink-900/15 rounded-xl text-xs text-pink-100/90 leading-relaxed flex items-start gap-2.5 flex-shrink-0">
            <Sparkles className="w-4 h-4 text-pink-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-pink-400 block mb-0.5">🧠 Active Context grounding is active</span>
              When you submit a chat, the RAG prompt engine queries these facts to dynamically tailor answers, keeping corporate constraints, rules, and preferences consistent indefinitely.
            </div>
          </div>

          {/* Preset injection chips */}
          <div className="flex-shrink-0">
            <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-zinc-500 block mb-2">
              ⚡ Quick-Ground AI Baseline (Presets)
            </span>
            <div className="flex flex-wrap gap-2">
              {PRESET_MEMORIES.map((preset, index) => {
                const alreadyAdded = memories.some(m => m.fact.toLowerCase() === preset.fact.toLowerCase());
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleInjectPreset(preset)}
                    disabled={alreadyAdded}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] border flex items-center gap-1.5 transition-all outline-none ${
                      alreadyAdded 
                        ? 'bg-zinc-900/30 border-zinc-900 text-zinc-600 cursor-not-allowed'
                        : 'bg-zinc-900 border-zinc-800 hover:border-pink-500/30 text-zinc-350 hover:text-zinc-200 cursor-pointer'
                    }`}
                  >
                    <Plus className="w-3 h-3 text-pink-500" />
                    <span>{preset.fact}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Local Search bar */}
          <div className="relative flex-shrink-0">
            <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-zinc-500" />
            <input 
              type="text"
              placeholder="Filter persistent memory entries..."
              value={memorySearch}
              onChange={(e) => setMemorySearch(e.target.value)}
              className="w-full bg-zinc-950/70 border border-zinc-900 text-xs pl-10 pr-3.5 py-2 rounded-xl text-zinc-200 focus:outline-none focus:border-pink-500/40 font-mono transition-all"
            />
          </div>

          {/* Mem List Layout */}
          <div className="space-y-1.5 flex-1 overflow-y-auto pr-1">
            {filteredMemories.map((mem) => (
              <div 
                key={mem.id}
                className="p-2.5 bg-zinc-950 border border-zinc-900/80 hover:border-zinc-850 rounded-xl flex items-center justify-between gap-3 text-xs font-mono"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <div className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                    mem.category === 'SAP Compliance' 
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                      : mem.category === 'Scope Limit' 
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                      : mem.category === 'User Preference'
                      ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                      : 'bg-zinc-900 text-zinc-400'
                  }`}>
                    {mem.category}
                  </div>
                  <span className="text-zinc-300 truncate font-semibold">{mem.fact}</span>
                </div>

                <button 
                  onClick={() => onDeleteMemory(mem.id)}
                  className="text-zinc-650 hover:text-red-400 p-1 rounded transition-colors"
                  title="Forget this memory"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {filteredMemories.length === 0 && (
              <div className="text-center py-6 text-zinc-550 text-xs border border-dashed border-zinc-900 rounded-xl">
                {memorySearch ? 'No matched memories found.' : 'No active memories stored. Insert corporate requirements on the form below!'}
              </div>
            )}
          </div>

          {/* Add Manual memory form */}
          <form onSubmit={handleCreateMemory} className="border-t border-zinc-900 pt-3 flex flex-col gap-2.5 flex-shrink-0">
            <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-zinc-550 block">
              ✍️ Add Custom Memory Fact to AI
            </span>
            <div className="flex gap-2">
              <input 
                type="text"
                value={newFact}
                onChange={(e) => setNewFact(e.target.value)}
                placeholder="Declare a custom fact (e.g. CEO email is executive-ceo@sap.corp)..."
                className="flex-1 bg-zinc-950 border border-zinc-850 text-xs px-3.5 py-2 rounded-xl text-zinc-200 focus:outline-none focus:border-pink-500/40 font-mono"
              />
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as any)}
                className="bg-zinc-950 border border-zinc-850 text-xs px-2 py-2 rounded-xl text-zinc-300 focus:outline-none focus:border-pink-500/40 font-mono"
              >
                <option value="User Preference">User Preference</option>
                <option value="Scope Limit">Scope Limit</option>
                <option value="SAP Compliance">SAP Compliance</option>
                <option value="General">General Option</option>
              </select>
              <button 
                type="submit"
                disabled={!newFact.trim()}
                className="p-2 px-3 bg-pink-500 hover:bg-pink-400 disabled:opacity-40 text-black text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md select-none"
              >
                Inject Fact
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
