import React, { useState } from 'react';
import {
  MessageSquare,
  Plus,
  Trash2,
  Cpu,
  Settings,
  Sparkles,
  BarChart3,
  User,
  LogOut,
  Database,
  Brain,
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
    <aside className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col h-screen select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-semibold text-sm text-slate-100 leading-none">OmniTurn AI</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">Multi-Turn Conversational Capstone</p>
          </div>
        </div>

        <button
          id="btn-system-prompt"
          onClick={onOpenSystemPromptModal}
          title="Configure System Prompt"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* New Session Button */}
      <div className="p-3 pb-1">
        <button
          id="btn-new-conversation"
          onClick={onNewSession}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition shadow-sm hover:shadow active:scale-[0.99]"
        >
          <Plus className="w-4 h-4" />
          <span>New Conversation</span>
        </button>
      </div>

      {/* Engine Status Card */}
      <div className="px-3 py-2">
        <div className="bg-slate-800/60 rounded-lg p-2.5 border border-slate-750">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-medium text-slate-300">
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              <span>AI Engine</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Gemini 2.5 Flash</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase px-2 mb-1.5">
          History ({sessions.length})
        </div>

        {sessions.length === 0 ? (
          <div className="text-center py-8 px-4 text-slate-500 text-xs">
            <MessageSquare className="w-6 h-6 mx-auto mb-2 opacity-40" />
            <p>No conversations yet.</p>
            <p className="mt-1 text-slate-600">Start typing to begin dialogue.</p>
          </div>
        ) : (
          sessions.map((sess) => {
            const isSelected = sess.id === currentSessionId;
            return (
              <div
                key={sess.id}
                id={`session-item-${sess.id}`}
                onClick={() => onSelectSession(sess.id)}
                className={`group relative flex items-center justify-between px-3 py-2.5 rounded-lg text-sm cursor-pointer transition ${
                  isSelected
                    ? 'bg-indigo-600/15 text-indigo-200 font-medium border border-indigo-500/30'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-slate-100 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <MessageSquare
                    className={`w-4 h-4 flex-shrink-0 ${
                      isSelected ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-400'
                    }`}
                  />
                  <span className="truncate text-xs">{sess.title || 'Untitled Chat'}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-500 font-mono">
                    {sess.messageCount || 0}
                  </span>
                  <button
                    id={`btn-delete-session-${sess.id}`}
                    onClick={(e) => handleDelete(e, sess.id)}
                    disabled={isDeletingId === sess.id}
                    title="Delete session"
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 rounded transition"
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
      <div className="px-3 py-2 border-t border-slate-800 space-y-1.5">
        <button
          id="btn-open-memory-store"
          onClick={onOpenMemoryModal}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-750 text-xs font-medium text-slate-200 border border-slate-700/60 transition"
        >
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-indigo-400" />
            <span>3-Tier Memory Store</span>
          </div>
          <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded font-mono">
            {memoryCount} facts
          </span>
        </button>

        <button
          id="btn-open-evaluation-suite"
          onClick={onOpenEvalModal}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-750 text-xs font-medium text-slate-200 border border-slate-700/60 transition"
        >
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            <span>Evaluation & Benchmarks</span>
          </div>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono">
            Suite
          </span>
        </button>
      </div>

      {/* Footer / User Profile & Database Status */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40 text-xs space-y-2">
        {/* DB Status */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
          <div className="flex items-center gap-1.5">
            <Database className="w-3 h-3 text-slate-400" />
            <span className="capitalize">{systemStatus?.dbType === 'mongodb' ? 'MongoDB Atlas' : 'In-Memory Store'}</span>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Active
          </span>
        </div>

        {/* User Account / Auth status */}
        <div className="flex items-center justify-between pt-1">
          {currentUser ? (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-[10px] font-bold">
                  {currentUser.username[0].toUpperCase()}
                </div>
                <div className="overflow-hidden">
                  <div className="text-xs font-medium text-slate-200 truncate">{currentUser.username}</div>
                  <div className="text-[10px] text-slate-400 truncate">{currentUser.email}</div>
                </div>
              </div>
              <button
                id="btn-logout"
                onClick={onLogout}
                title="Log out"
                className="p-1 text-slate-400 hover:text-rose-400 transition"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-1.5 text-slate-400">
                <User className="w-3.5 h-3.5" />
                <span>Guest Mode</span>
              </div>
              <button
                id="btn-open-auth"
                onClick={onOpenAuth}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition"
              >
                Sign In / Up
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
