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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-fade-in font-sans">
      <div className="w-full max-w-2xl bg-[#FBF9F5] border-2 border-stone-900 rounded-lg shadow-[6px_6px_0px_0px_#1C1917] overflow-hidden text-stone-900 p-6 space-y-4">
        <div className="flex items-center justify-between border-b-2 border-stone-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded border-2 border-stone-900 bg-amber-400 text-stone-950 flex items-center justify-center shadow-[2px_2px_0px_0px_#000]">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold font-mono text-stone-950 uppercase tracking-tight">System Persona & Prompt</h2>
              <p className="text-xs font-mono text-stone-600">
                Directly configures the LLM's systemInstruction parameter
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded border border-stone-400 hover:border-stone-900 bg-white hover:bg-stone-100 text-stone-900 shadow-[1px_1px_0px_0px_#000] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Presets */}
        <div>
          <label className="block text-xs font-mono font-bold text-stone-700 uppercase mb-1.5">Preset Personas</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PRESET_PERSONAS.map((p, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentPrompt(p.prompt)}
                className="text-left p-3 rounded bg-white hover:bg-amber-50 border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1C1917] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition text-xs space-y-1 cursor-pointer"
              >
                <div className="font-bold font-mono text-stone-950 uppercase">{p.name}</div>
                <div className="text-[11px] font-sans text-stone-600 line-clamp-1">{p.prompt}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Custom prompt textarea */}
        <div>
          <label className="block text-xs font-mono font-bold text-stone-700 uppercase mb-1.5">Active Persona Prompt</label>
          <textarea
            id="system-prompt-textarea"
            rows={5}
            value={currentPrompt}
            onChange={(e) => setCurrentPrompt(e.target.value)}
            className="w-full bg-white border-2 border-stone-800 rounded p-3 text-xs text-stone-950 font-mono leading-relaxed focus:outline-none focus:border-amber-600 shadow-[2px_2px_0px_0px_#1C1917]"
            placeholder="Enter instructions for the AI's persona, scope, and behavior..."
          />
        </div>

        {/* Isolation reminder */}
        <div className="flex items-center gap-2 p-2.5 rounded bg-amber-50 border-2 border-amber-300 text-amber-950 text-[11px] font-mono shadow-[1px_1px_0px_0px_#D97706]">
          <ShieldCheck className="w-4 h-4 flex-shrink-0 text-amber-800" />
          <span>
            System instructions are isolated and delivered securely through native SDK parameters.
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t-2 border-stone-800">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded text-xs font-mono font-bold text-stone-600 hover:text-stone-900 cursor-pointer"
          >
            Cancel
          </button>
          <button
            id="btn-save-system-prompt"
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-stone-950 border-2 border-stone-900 rounded text-xs font-mono font-bold uppercase transition shadow-[2px_2px_0px_0px_#000] cursor-pointer"
          >
            {saved ? <Check className="w-3.5 h-3.5" /> : null}
            <span>{saved ? 'SAVED!' : 'SAVE PERSONA'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
