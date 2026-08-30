import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  User,
  Bot,
  Zap,
  HelpCircle,
  Clock,
  Brain,
  Terminal,
} from 'lucide-react';
import { CopyButton, stripMarkdown } from './CopyButton';

function formatMarkdownContent(text) {
  if (!text) return '';
  // 1. Remove <think>...</think> reasoning blocks if present
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  cleaned = cleaned.replace(/<think>[\s\S]*$/gi, '').trim();

  // 2. Normalize and separate squished markdown table rows into proper newlines
  cleaned = cleaned.replace(/\|\s*\|\s*([^\n|])/g, '|\n| $1');
  cleaned = cleaned.replace(/\|\s*\|/g, '|\n|');

  return cleaned || text;
}

export const MessageItem = ({ message }) => {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const metadata = message.metadata;

  // Plain text representation for copying full message bubble
  const plainTextToCopy = isUser ? message.content : stripMarkdown(message.content);

  return (
    <div
      id={`message-bubble-${message.id}`}
      className={`group relative flex gap-3.5 p-4 sm:p-5 rounded-lg transition-all ${
        isUser
          ? 'bg-[#FEFCE8] border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1C1917]'
          : 'bg-white border-2 border-stone-800 shadow-[3px_3px_0px_0px_#1C1917]'
      }`}
    >
      {/* Retro Avatar Stamp */}
      <div className="flex-shrink-0 pt-0.5">
        {isUser ? (
          <div className="w-8 h-8 rounded border-2 border-stone-800 bg-amber-200 text-stone-900 flex items-center justify-center font-mono text-xs font-bold shadow-[1px_1px_0px_0px_#1C1917]">
            <User className="w-4 h-4 text-stone-900" />
          </div>
        ) : (
          <div
            className={`w-8 h-8 rounded border-2 border-stone-800 flex items-center justify-center font-mono text-xs font-bold shadow-[1px_1px_0px_0px_#1C1917] ${
              metadata?.provider === 'heuristic'
                ? 'bg-amber-400 text-stone-950'
                : metadata?.provider === 'groq'
                ? 'bg-orange-500 text-white'
                : 'bg-stone-900 text-amber-300'
            }`}
          >
            {metadata?.provider === 'heuristic' ? (
              <HelpCircle className="w-4 h-4" />
            ) : metadata?.provider === 'groq' ? (
              <Zap className="w-4 h-4" />
            ) : (
              <Bot className="w-4 h-4" />
            )}
          </div>
        )}
      </div>

      {/* Message Content & Metadata */}
      <div className="flex-1 min-w-0 space-y-2">
        {/* Retro Header Strip */}
        <div className="flex items-center justify-between text-xs border-b border-stone-200 pb-1.5">
          <div className="flex items-center gap-2 flex-wrap font-mono">
            <span className="font-bold text-stone-900 uppercase tracking-wide">
              {isUser ? 'YOU' : 'ASSISTANT'}
            </span>

            {/* Provider and Model Stamp */}
            {isAssistant && metadata?.provider && (
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border ${
                  metadata.provider === 'heuristic'
                    ? 'bg-amber-100 text-amber-900 border-amber-400'
                    : metadata.provider === 'groq'
                    ? 'bg-orange-100 text-orange-950 border-orange-400'
                    : 'bg-stone-100 text-stone-900 border-stone-400'
                }`}
              >
                {metadata.provider === 'groq' && <Zap className="w-2.5 h-2.5 text-orange-600" />}
                <span>{metadata.provider === 'groq' ? `Groq · ${metadata.model || 'LLaMA'}` : metadata.model || metadata.provider}</span>
              </span>
            )}

            {/* Long-Term Memory Retrieval Stamp */}
            {isAssistant && metadata?.retrievedMemoriesCount > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-purple-100 text-purple-950 border border-purple-300 font-bold uppercase">
                <Brain className="w-3 h-3 text-purple-700" />
                <span>Memory Recalled ({metadata.retrievedMemoriesCount})</span>
              </span>
            )}

            {/* Ambiguity Flag Stamp */}
            {metadata?.ambiguityFlag && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-950 border border-amber-400 font-bold uppercase">
                <HelpCircle className="w-3 h-3 text-amber-700" />
                <span>Clarification Triggered</span>
              </span>
            )}
          </div>

          {/* Timestamp & Full Message Copy Button */}
          <div className="flex items-center gap-2 text-stone-500 font-mono">
            <span className="text-[10px]">
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>

            {/* Full Message Copy Stamp Button */}
            <CopyButton
              text={plainTextToCopy}
              title="Copy entire message"
              className="p-1 rounded border border-stone-300 hover:border-stone-800 bg-stone-100 hover:bg-stone-200 text-stone-700 hover:text-stone-900 opacity-80 group-hover:opacity-100 transition-all shadow-[1px_1px_0px_0px_#292524]"
              iconClassName="w-3 h-3"
            />
          </div>
        </div>

        {/* Content Body */}
        <div className="text-sm text-stone-900 leading-relaxed break-words">
          {isUser ? (
            <p className="whitespace-pre-wrap font-sans text-stone-900 font-medium">{message.content}</p>
          ) : (
            <div className="markdown-content">
              <Markdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    const codeString = String(children).replace(/\n$/, '');

                    // Block Code Renderer
                    if (!inline && (match || codeString.includes('\n'))) {
                      const language = match ? match[1] : '';

                      return (
                        <div className="relative group/code my-3.5 rounded-lg overflow-hidden border-2 border-stone-900 bg-stone-950 shadow-[3px_3px_0px_0px_#1C1917]">
                          {/* Code Header Bar with Language Label & Copy Stamp Button */}
                          <div className="flex items-center justify-between px-3.5 py-1.5 bg-stone-900 border-b-2 border-stone-800 text-[11px] font-mono text-stone-300">
                            <div className="flex items-center gap-2">
                              <Terminal className="w-3.5 h-3.5 text-amber-400" />
                              <span className="font-bold text-amber-300 uppercase tracking-wider">{language || 'CODE'}</span>
                            </div>
                            <CopyButton
                              text={codeString}
                              showLabel={true}
                              label="COPY"
                              copiedLabel="COPIED!"
                              className="px-2.5 py-0.5 rounded border border-stone-700 hover:border-amber-400 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-amber-200 text-[10px] font-mono uppercase transition-all shadow-[1px_1px_0px_0px_#000]"
                              iconClassName="w-3 h-3"
                            />
                          </div>

                          {/* Code Content */}
                          <pre className="p-3.5 overflow-x-auto text-xs font-mono text-stone-100 leading-relaxed m-0 bg-stone-950">
                            <code className={className} {...props}>
                              {children}
                            </code>
                          </pre>
                        </div>
                      );
                    }

                    // Inline Code Renderer
                    return (
                      <code
                        className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-mono text-xs font-bold border border-amber-300"
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {formatMarkdownContent(message.content)}
              </Markdown>
            </div>
          )}
        </div>

        {/* Subtle Latency Footer */}
        {isAssistant && metadata?.latencyMs !== undefined && (
          <div className="pt-1.5 flex items-center justify-end text-[10px] text-stone-500 font-mono">
            <div className="flex items-center gap-1 text-stone-500">
              <Clock className="w-2.5 h-2.5" />
              <span>{metadata.latencyMs}ms</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
