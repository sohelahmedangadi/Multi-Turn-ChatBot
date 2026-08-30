import React, { useState, useRef, useEffect } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Send,
  Square,
  Sparkles,
  Bot,
  Layers,
  Zap,
  Brain,
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
  'What architecture does OmniTurn use for multi-turn memory?',
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

  const totalTokensEstimated = messages.reduce(
    (sum, m) => sum + (m.metadata?.tokensEstimated || Math.ceil(m.content.length / 4)),
    0
  );

  return (
    <main id="chat-main-container" className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Header Bar */}
      <header className="h-14 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-slate-100 truncate max-w-md">
              {currentSession?.title || 'New Conversation'}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
            <span className="text-slate-600">•</span>
            <div className="flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>{messages.length} turns</span>
            </div>
            <span className="text-slate-600">•</span>
            <div className="flex items-center gap-1 font-mono text-[11px]">
              <Zap className="w-3 h-3 text-amber-400" />
              <span>~{totalTokensEstimated} tokens</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Memory Store Pill */}
          <button
            id="btn-header-memory-store"
            onClick={onOpenMemoryModal}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-750 border border-slate-700/70 text-xs text-indigo-300 hover:text-indigo-200 transition cursor-pointer"
            title="View 3-Tier Long-Term Memory"
          >
            <Brain className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-medium">{memoryCount} Memories</span>
          </button>

          {/* Active Model Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700/70 text-xs">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            <span className="font-medium text-slate-200">Gemini 2.5 Flash</span>
          </div>
        </div>
      </header>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {messages.length === 0 && !streamingText && (
          <div className="max-w-2xl mx-auto my-auto py-12 px-4 text-center space-y-6">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/10">
              <Bot className="w-6 h-6" />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-slate-100">3-Tier Conversational Memory</h2>
              <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
                Features token-bounded session history (Tier 1), persistent vector user memory with automatic conflict updates (Tier 2), and domain knowledge (Tier 3).
              </p>
            </div>

            {/* Quick Starters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left pt-2">
              {STARTER_PROMPTS.map((promptText, idx) => (
                <button
                  key={idx}
                  id={`starter-card-${idx}`}
                  onClick={() => onSendMessage(promptText)}
                  className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/40 text-left transition group cursor-pointer"
                >
                  <div className="text-xs text-slate-300 group-hover:text-indigo-200 transition leading-relaxed">
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
          <div className="flex gap-3.5 py-4 px-4 rounded-xl bg-slate-900/90 border border-indigo-500/30 shadow-sm animate-fade-in">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm flex-shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-slate-200">AI Assistant</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-500/20 text-indigo-300 font-mono">
                  Streaming SSE
                </span>
              </div>
              <div className="markdown-content text-slate-100 leading-relaxed">
                <Markdown remarkPlugins={[remarkGfm]}>{formatMarkdownContent(streamingText)}</Markdown>
                <span className="inline-block w-1.5 h-4 ml-1 bg-indigo-400 animate-pulse align-middle" />
              </div>
            </div>
          </div>
        )}

        {/* Awaiting initial response indicator */}
        {isLoading && !streamingText && (
          <div className="flex items-center gap-3 py-4 px-4 rounded-xl bg-slate-900/50 border border-slate-800/80 text-slate-400 text-xs">
            <div className="w-6 h-6 rounded-md bg-indigo-600/30 flex items-center justify-center text-indigo-400 animate-spin">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <span>Retrieving relevant context and generating response with Gemini...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-slate-900/80 border-t border-slate-800 backdrop-blur-md">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-2">
          <div className="relative flex items-end gap-2 bg-slate-950 rounded-xl border border-slate-800 focus-within:border-indigo-500/60 transition p-2 shadow-inner">
            <textarea
              id="chat-input-textarea"
              ref={textareaRef}
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message... (Shift+Enter for new line)"
              maxLength={2000}
              className="flex-1 max-h-32 min-h-[44px] bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none resize-none px-2 py-2.5 leading-relaxed"
            />

            <div className="flex items-center gap-1.5 pb-1">
              {isLoading ? (
                <button
                  type="button"
                  id="btn-stop-streaming"
                  onClick={onStopStreaming}
                  className="p-2.5 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white transition shadow-sm"
                  title="Stop generating"
                >
                  <Square className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  id="btn-send-message"
                  disabled={!inputText.trim()}
                  className="p-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white transition shadow-sm"
                  title="Send message (Enter)"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
            <div className="flex items-center gap-2">
              <span>Press <kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-400">Enter</kbd> to send</span>
              <span>•</span>
              <span>3-Tier Memory: Active</span>
            </div>
            <span className={inputText.length > 1800 ? 'text-amber-400 font-mono' : 'font-mono'}>
              {inputText.length} / 2000
            </span>
          </div>
        </form>
      </div>
    </main>
  );
};
