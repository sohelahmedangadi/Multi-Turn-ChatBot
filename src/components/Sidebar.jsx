import React, { useState } from 'react';
import {
  MessageSquare,
  Plus,
  Trash2,
  Settings,
  Terminal,
  BarChart3,
  User,
  LogOut,
  Brain,
  Folder,
} from 'lucide-react';

export const Sidebar = ({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  systemStatus,
  currentUser,
  onOpenAuth,
  onLogout,
  onOpenEvalModal,
  onOpenSystemPromptModal,
  onOpenMemoryModal,
  memoryCount = 0,
}) => {
  const [isDeletingId, setIsDeletingId] = useState(null);

  const handleDelete = (e, id) => {
    e.stopPropagation();
    setIsDeletingId(id);
    onDeleteSession(id);
    setTimeout(() => setIsDeletingId(null), 500);
  };

  return (
    <aside className="w-72 bg-[#F5EFEB] border-r-2 border-stone-800 flex flex-col h-screen select-none font-sans text-stone-900">
      {/* Brand Header */}
      <div className="p-4 border-b-2 border-stone-800 bg-[#EFE9E2] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded border-2 border-stone-900 bg-amber-400 flex items-center justify-center text-stone-950 shadow-[2px_2px_0px_0px_#000]">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-bold font-mono text-sm text-stone-950 leading-none tracking-tight">COSMOAI</h1>
            <p className="text-[10px] font-mono text-stone-600 mt-0.5 uppercase">Conversational Studio</p>
          </div>
        </div>
      </div>

      {/* New Session Button */}
      <div className="p-3 pb-2">
        <button
          id="btn-new-conversation"
          onClick={onNewSession}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-stone-950 border-2 border-stone-900 rounded text-xs font-mono font-bold uppercase transition shadow-[2px_2px_0px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ New Dialogue</span>
        </button>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        <div className="text-[10px] font-bold font-mono tracking-wider text-stone-600 uppercase px-1 mb-1">
          DIALOGUE LOGS ({sessions.length})
        </div>

        {sessions.length === 0 ? (
          <div className="text-center py-8 px-4 text-stone-500 text-xs font-mono">
            <Folder className="w-6 h-6 mx-auto mb-2 opacity-50 text-stone-600" />
            <p>NO ACTIVE SESSIONS.</p>
            <p className="mt-1 text-stone-500 text-[11px]">Type a query to begin.</p>
          </div>
        ) : (
          sessions.map((sess) => {
            const isSelected = sess.id === currentSessionId;
            return (
              <div
                key={sess.id}
                id={`session-item-${sess.id}`}
                onClick={() => onSelectSession(sess.id)}
                className={`group relative flex items-center justify-between px-3 py-2 rounded text-xs cursor-pointer transition ${
                  isSelected
                    ? 'bg-[#FEF3C7] text-stone-950 font-bold border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1C1917]'
                    : 'text-stone-800 hover:bg-white hover:text-stone-950 border border-stone-300 hover:border-stone-800'
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <MessageSquare
                    className={`w-3.5 h-3.5 flex-shrink-0 ${
                      isSelected ? 'text-amber-800' : 'text-stone-500'
                    }`}
                  />
                  <span className="truncate text-xs font-mono">{sess.title || 'Untitled Session'}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-stone-400 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                    [{sess.messageCount || 0}]
                  </span>
                  <button
                    id={`btn-delete-session-${sess.id}`}
                    onClick={(e) => handleDelete(e, sess.id)}
                    disabled={isDeletingId === sess.id}
                    title="Delete session"
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-stone-500 hover:text-rose-600 rounded transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Navigation Buttons: Memory & Evaluation */}
      <div className="px-3 py-2 border-t-2 border-stone-800 space-y-1.5 bg-[#EFE9E2]">
        <button
          id="btn-open-memory-store"
          onClick={onOpenMemoryModal}
          className="w-full flex items-center justify-between px-3 py-2 rounded bg-white hover:bg-amber-50 text-xs font-mono font-bold text-stone-900 border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1C1917] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-purple-700" />
            <span>3-TIER MEMORY</span>
          </div>
          <span className="text-[10px] bg-purple-100 text-purple-900 border border-purple-300 px-1.5 py-0.5 rounded font-mono font-bold">
            {memoryCount} FACTS
          </span>
        </button>

        <button
          id="btn-open-evaluation-suite"
          onClick={onOpenEvalModal}
          className="w-full flex items-center justify-between px-3 py-2 rounded bg-white hover:bg-emerald-50 text-xs font-mono font-bold text-stone-900 border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1C1917] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-700" />
            <span>EVALUATION SUITE</span>
          </div>
          <span className="text-[10px] bg-emerald-100 text-emerald-900 border border-emerald-300 px-1.5 py-0.5 rounded font-mono font-bold">
            5 BENCH
          </span>
        </button>
      </div>

      {/* Footer / User Profile Area & Settings */}
      <div className="p-3 border-t-2 border-stone-800 bg-[#E8E1D9] text-xs font-mono">
        <div className="flex items-center justify-between w-full">
          {currentUser ? (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-7 h-7 rounded border border-stone-800 bg-amber-300 text-stone-950 flex items-center justify-center text-xs font-bold">
                  {currentUser.username[0].toUpperCase()}
                </div>
                <div className="overflow-hidden">
                  <div className="text-xs font-bold text-stone-900 truncate">{currentUser.username}</div>
                  <div className="text-[10px] text-stone-600 truncate">{currentUser.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  id="btn-system-prompt-user"
                  onClick={onOpenSystemPromptModal}
                  title="Configure System Prompt"
                  className="p-1 text-stone-600 hover:text-stone-950 hover:bg-white rounded transition cursor-pointer"
                >
                  <Settings className="w-4 h-4" />
                </button>
                <button
                  id="btn-logout"
                  onClick={onLogout}
                  title="Log out"
                  className="p-1 text-stone-600 hover:text-rose-700 hover:bg-white rounded transition cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-1.5 text-stone-700">
                <div className="w-6 h-6 rounded border border-stone-600 bg-stone-200 flex items-center justify-center text-stone-700">
                  <User className="w-3.5 h-3.5" />
                </div>
                <button
                  id="btn-open-auth"
                  onClick={onOpenAuth}
                  className="text-xs text-amber-800 hover:text-amber-950 font-bold underline transition cursor-pointer"
                >
                  Sign In / Register
                </button>
              </div>
              <button
                id="btn-system-prompt-guest"
                onClick={onOpenSystemPromptModal}
                title="Configure System Persona"
                className="p-1.5 text-stone-600 hover:text-stone-950 hover:bg-white rounded transition cursor-pointer"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
