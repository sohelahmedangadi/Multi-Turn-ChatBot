import React, { useState } from 'react';
import { X, Settings, ShieldCheck, Check } from 'lucide-react';

const PRESET_PERSONAS = [
  {
    name: 'Balanced Assistant (Default)',
    prompt:
      'You are an intelligent, helpful, and concise conversational AI assistant. Maintain context across multi-turn dialogues and deliver accurate, structured responses.',
  },
  {
    name: 'Senior Software Engineer',
    prompt:
      'You are a Senior Full-Stack Engineer and Architect. Provide production-grade code, explain architectural trade-offs, write modular TypeScript/Rust/Python, and maintain state context across steps.',
  },
  {
    name: 'Socratic Academic Tutor',
    prompt:
      'You are an encouraging Socratic tutor. Instead of directly giving final answers, ask guided step-by-step questions, evaluate the user’s reasoning, and help them arrive at solutions.',
  },
  {
    name: 'Concise Bullet Responder',
    prompt:
      'You are a strict, ultra-concise executive assistant. Respond in dense bullet points with maximum signal and zero filler words.',
  },
];

export const SystemPromptModal = ({
  isOpen,
  onClose,
  systemPrompt,
  onSaveSystemPrompt,
}) => {
  const [currentPrompt, setCurrentPrompt] = useState(systemPrompt);
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveSystemPrompt(currentPrompt);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/30 text-indigo-400 flex items-center justify-center">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">System Prompt & Role Isolation</h2>
              <p className="text-xs text-slate-400">
                Guaranteed isolated from user input (never concatenated into user roles)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Presets */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">Preset Personas</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PRESET_PERSONAS.map((p, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentPrompt(p.prompt)}
                className="text-left p-2.5 rounded-lg bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-500/40 transition text-xs space-y-0.5"
              >
                <div className="font-medium text-slate-200">{p.name}</div>
                <div className="text-[11px] text-slate-400 line-clamp-1">{p.prompt}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Custom prompt textarea */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">Active System Prompt</label>
          <textarea
            id="system-prompt-textarea"
            rows={5}
            value={currentPrompt}
            onChange={(e) => setCurrentPrompt(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 font-mono leading-relaxed focus:outline-none focus:border-indigo-500"
            placeholder="Enter instructions for the AI's persona, scope, and behavior..."
          />
        </div>

        {/* Isolation reminder */}
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-indigo-950/20 border border-indigo-500/20 text-indigo-300 text-[11px]">
          <ShieldCheck className="w-4 h-4 flex-shrink-0 text-indigo-400" />
          <span>
            This system instruction is passed strictly through the LLM SDK's dedicated system instruction parameter on the backend.
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 transition"
          >
            Cancel
          </button>
          <button
            id="btn-save-system-prompt"
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition shadow-sm"
          >
            {saved ? <Check className="w-3.5 h-3.5" /> : null}
            <span>{saved ? 'Saved!' : 'Save System Prompt'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
