import React, { useState, useRef, useEffect } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Send,
  Square,
  Sparkles,
  Bot,
  Layers,
  MessageSquareQuote,
  Terminal,
} from 'lucide-react';
import { MessageItem } from './MessageItem.jsx';

function formatMarkdownContent(text) {
  if (!text) return '';
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  cleaned = cleaned.replace(/<think>[\s\S]*$/gi, '').trim();
  cleaned = cleaned.replace(/\|\s*\|\s*([^\n|])/g, '|\n| $1');
  cleaned = cleaned.replace(/\|\s*\|/g, '|\n|');
  return cleaned || text;
}

const STARTER_PROMPTS = [
  'My project is named ApexEngine and I am using React 19.',
  'What is the name of my project?',
  'I renamed my project from ApexEngine to NebulaCore.',
  'What architecture does CosmoAI use for multi-turn memory?',
];

export const ChatWindow = ({
  currentSession,
  messages,
  isLoading,
  streamingText,
  onSendMessage,
  onStopStreaming,
  onOpenRubric,
  onOpenMemoryModal,
  memoryCount = 0,
  systemPrompt,
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText, isLoading]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    const text = inputText.trim();
    setInputText('');
    onSendMessage(text);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <main id="chat-main-container" className="flex-1 flex flex-col h-full bg-[#FBF9F5] retro-grid text-stone-900 overflow-hidden">
      {/* Retro Classic Header */}
      <header className="h-14 border-b-2 border-stone-800 bg-[#F5EFEB] px-4 sm:px-6 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          {/* Retro Window Dots */}
          <div className="hidden sm:flex items-center gap-1.5 mr-1">
            <span className="w-2.5 h-2.5 rounded-full bg-stone-300 border border-stone-600" />
            <span className="w-2.5 h-2.5 rounded-full bg-stone-300 border border-stone-600" />
            <span className="w-2.5 h-2.5 rounded-full bg-stone-300 border border-stone-600" />
          </div>

          <div className="flex items-center gap-2">
            <span className="font-bold font-mono text-xs sm:text-sm text-stone-900 truncate max-w-xs sm:max-w-md uppercase tracking-wider">
              {currentSession?.title || 'NEW DIALOGUE SESSION'}
            </span>
          </div>

          {messages.length > 0 && (
            <div className="hidden md:flex items-center gap-1 text-xs font-mono text-stone-500">
              <span>•</span>
              <div className="flex items-center gap-1">
                <Layers className="w-3 h-3 text-stone-500" />
                <span>{messages.length} turns</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Active Model Pill */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-stone-900 border-2 border-stone-900 text-xs font-mono text-amber-300 font-bold shadow-[2px_2px_0px_0px_#1C1917]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>GEMINI 2.5</span>
          </div>
        </div>
      </header>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {messages.length === 0 && !streamingText && (
          <div className="max-w-2xl mx-auto my-auto py-10 px-4 text-center space-y-6">
            {/* Vintage Emblem */}
            <div className="w-16 h-16 rounded-2xl bg-amber-100 border-2 border-stone-800 text-stone-900 flex items-center justify-center mx-auto shadow-[4px_4px_0px_0px_#1C1917]">
              <Terminal className="w-8 h-8 text-stone-900" />
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-bold font-serif text-stone-950 tracking-tight">
                CosmoAI Multi-Turn Studio
              </h2>
              <p className="text-xs sm:text-sm text-stone-600 mt-2 max-w-md mx-auto font-sans leading-relaxed">
                Featuring short-term sliding history, persistent LangChain vector user memory with automatic updates, and cross-session past conversation access.
              </p>
            </div>

            {/* Vintage Index Starter Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left pt-2">
              {STARTER_PROMPTS.map((promptText, idx) => (
                <button
                  key={idx}
                  id={`starter-card-${idx}`}
                  onClick={() => onSendMessage(promptText)}
                  className="p-3.5 rounded-lg bg-white hover:bg-amber-50/80 border-2 border-stone-800 text-left transition-all group cursor-pointer shadow-[3px_3px_0px_0px_#1C1917] hover:shadow-[4px_4px_0px_0px_#1C1917] hover:-translate-y-0.5 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                >
                  <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-amber-800 uppercase mb-1">
                    <MessageSquareQuote className="w-3 h-3" />
                    <span>Card #{idx + 1}</span>
                  </div>
                  <div className="text-xs font-medium text-stone-800 group-hover:text-stone-950 transition leading-relaxed">
                    {promptText}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Existing Messages */}
        {messages.map((msg, idx) => (
          <MessageItem key={`${msg.id}-${idx}`} message={msg} onOpenRubric={onOpenRubric} />
        ))}

        {/* Streaming In-Progress Assistant Bubble */}
        {streamingText && (
          <div className="flex gap-3.5 p-4 sm:p-5 rounded-lg bg-white border-2 border-stone-800 shadow-[3px_3px_0px_0px_#1C1917] animate-fade-in">
            <div className="w-8 h-8 rounded border-2 border-stone-800 bg-stone-900 text-amber-300 flex items-center justify-center font-mono text-xs font-bold shadow-[1px_1px_0px_0px_#1C1917] flex-shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 text-xs border-b border-stone-200 pb-1 font-mono">
                <span className="font-bold text-stone-900 uppercase">ASSISTANT</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-bold uppercase">
                  STREAMING
                </span>
              </div>
              <div className="markdown-content text-stone-900 leading-relaxed font-sans">
                <Markdown remarkPlugins={[remarkGfm]}>{formatMarkdownContent(streamingText)}</Markdown>
                <span className="inline-block w-2 h-4 ml-1 bg-amber-500 animate-pulse align-middle" />
              </div>
            </div>
          </div>
        )}

        {/* Awaiting initial response indicator */}
        {isLoading && !streamingText && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-white border-2 border-stone-800 text-stone-700 text-xs font-mono shadow-[2px_2px_0px_0px_#1C1917]">
            <div className="w-5 h-5 rounded border border-stone-800 bg-amber-200 flex items-center justify-center text-stone-900 animate-spin">
              <Sparkles className="w-3 h-3" />
            </div>
            <span className="font-medium">RETRIEVING 3-TIER CONTEXT & GENERATING RESPONSE...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Retro Command Input Dock */}
      <div className="p-4 bg-[#F5EFEB] border-t-2 border-stone-800">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-2">
          <div className="relative flex items-end gap-2 bg-white rounded-lg border-2 border-stone-800 p-2 shadow-[3px_3px_0px_0px_#1C1917] focus-within:border-amber-600 focus-within:shadow-[4px_4px_0px_0px_#D97706] transition-all">
            <textarea
              id="chat-input-textarea"
              ref={textareaRef}
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask CosmoAI anything... (Shift+Enter for new line)"
              maxLength={2000}
              className="flex-1 max-h-32 min-h-[44px] bg-transparent text-sm font-sans text-stone-900 placeholder-stone-400 focus:outline-none resize-none px-2 py-2 leading-relaxed"
            />

            <div className="flex items-center gap-1.5 pb-1">
              {isLoading ? (
                <button
                  type="button"
                  id="btn-stop-streaming"
                  onClick={onStopStreaming}
                  className="p-2.5 rounded border-2 border-stone-900 bg-rose-500 hover:bg-rose-600 text-white font-mono transition shadow-[2px_2px_0px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer"
                  title="Stop generating"
                >
                  <Square className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  id="btn-send-message"
                  disabled={!inputText.trim()}
                  className="px-3.5 py-2.5 rounded border-2 border-stone-900 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:hover:bg-amber-400 text-stone-950 font-mono text-xs font-bold uppercase transition shadow-[2px_2px_0px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer flex items-center gap-1.5"
                  title="Send message (Enter)"
                >
                  <span>SEND</span>
                  <Send className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end text-[11px] font-mono text-stone-500 px-1">
            <span className={inputText.length > 1800 ? 'text-amber-700 font-bold font-mono' : 'font-mono'}>
              {inputText.length} / 2000
            </span>
          </div>
        </form>
      </div>
    </main>
  );
};
