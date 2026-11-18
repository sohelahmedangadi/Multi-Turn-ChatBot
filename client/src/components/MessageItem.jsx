import React from 'react';
import {
  User,
  Bot,
  Zap,
  HelpCircle,
  Brain,
  Terminal,
  Paperclip,
  FileText,
  Image,
  Film,
  Search,
  ExternalLink,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { CopyButton, stripMarkdown } from './CopyButton';
import {
  SanitizedMarkdown,
  isSafeUrl,
  sanitizeText,
  sanitizeFilename,
} from './SanitizedMarkdown';

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

export const MessageItem = ({ message, onOpenRubric, onRegenerate }) => {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const metadata = message.metadata;
  const isIncompleteOrError = isAssistant && (
    metadata?.incomplete ||
    metadata?.error ||
    metadata?.errorCode ||
    message.content?.includes('⚠️') ||
    message.content?.includes('_[generation stopped by user]_')
  );

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
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-purple-100 text-purple-950 border border-purple-300 font-bold uppercase">
                <Brain className="w-3 h-3 text-purple-700" />
                <span>Memory Recalled ({metadata.retrievedMemoriesCount})</span>
              </span>
            )}

            {/* Ambiguity Flag Stamp */}
            {metadata?.ambiguityFlag && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-amber-100 text-amber-950 border border-amber-400 font-bold uppercase">
                <HelpCircle className="w-3 h-3 text-amber-700" />
                <span>Clarification Triggered</span>
              </span>
            )}

            {/* Web Search Indicator Badge */}
            {isAssistant && metadata?.usedWebSearch && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] bg-sky-100 text-sky-950 border border-sky-400 font-bold uppercase shadow-[1px_1px_0px_0px_#0284c7]">
                <Search className="w-3 h-3 text-sky-700" />
                <span>Web Search</span>
                {metadata?.searchQuery && (
                  <span
                    className="font-mono font-normal normal-case text-sky-800 bg-sky-50 px-1 py-0.2 rounded border border-sky-200 max-w-[200px] truncate"
                    title={`Exact search query sent: "${sanitizeText(metadata.searchQuery)}"`}
                  >
                    &quot;{sanitizeText(metadata.searchQuery)}&quot;
                  </span>
                )}
              </span>
            )}

            {/* Unverified Claim Alert Badge */}
            {isAssistant && metadata?.unverifiedClaim && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-amber-100 text-amber-950 border border-amber-400 font-bold uppercase shadow-[1px_1px_0px_0px_#f59e0b]"
                title={metadata.unverifiedWarning || 'This claim could not be verified by search'}
              >
                <AlertTriangle className="w-3 h-3 text-amber-700" />
                <span>Unverified Fact Warning</span>
              </span>
            )}

            {/* Incomplete / Interrupted Indicator Badge */}
            {isAssistant && metadata?.incomplete && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-950 border border-amber-400 font-bold uppercase shadow-[1px_1px_0px_0px_#f59e0b]">
                <AlertTriangle className="w-2.5 h-2.5 text-amber-700" />
                <span>Incomplete</span>
              </span>
            )}

            {/* User Attached Media/Document Pill */}
            {isUser && metadata?.attachedFilename && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-amber-200 text-stone-900 border border-stone-800 font-bold uppercase shadow-[1px_1px_0px_0px_#000]">
                {metadata.attachedFileType === 'video' || /\.(mp4|mov|webm|mkv|avi)$/i.test(metadata.attachedFilename) ? (
                  <Film className="w-3 h-3 text-sky-800" />
                ) : metadata.attachedFileType === 'image' || /\.(png|jpe?g|webp|gif|bmp)$/i.test(metadata.attachedFilename) ? (
                  <Image className="w-3 h-3 text-purple-800" />
                ) : (
                  <Paperclip className="w-3 h-3 text-stone-800" />
                )}
                <span>{metadata.attachedFilename}</span>
              </span>
            )}

            {/* Assistant Grounded Badge */}
            {isAssistant && metadata?.attachedFilename && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-950 border border-emerald-400 font-bold uppercase">
                {metadata.attachedFileType === 'video' || /\.(mp4|mov|webm|mkv|avi)$/i.test(metadata.attachedFilename) ? (
                  <>
                    <Film className="w-3 h-3 text-sky-700" />
                    <span>Grounded Video: {metadata.attachedFilename}</span>
                  </>
                ) : metadata.attachedFileType === 'image' || /\.(png|jpe?g|webp|gif|bmp)$/i.test(metadata.attachedFilename) ? (
                  <>
                    <Image className="w-3 h-3 text-purple-700" />
                    <span>Grounded Image: {metadata.attachedFilename}</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-3 h-3 text-emerald-700" />
                    <span>Grounded: {metadata.attachedFilename}</span>
                  </>
                )}
              </span>
            )}
          </div>

          {/* Timestamp (Shows on Hover) & Full Message Copy Button */}
          <div className="flex items-center gap-2 text-stone-500 font-mono">
            <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>

            {/* Full Message Copy Stamp Button */}
            <CopyButton
              text={plainTextToCopy}
              title="Copy entire message"
              className="p-1 rounded border border-stone-300 hover:border-stone-800 bg-stone-100 hover:bg-stone-200 text-stone-700 hover:text-stone-900 opacity-0 group-hover:opacity-100 transition-opacity shadow-[1px_1px_0px_0px_#292524]"
              iconClassName="w-3 h-3"
            />
          </div>
        </div>

        {/* Content Body */}
        <div className="text-sm text-stone-900 leading-relaxed break-words">
          {isUser ? (
            <div className="space-y-2">
              <p className="whitespace-pre-wrap font-sans text-stone-900 font-medium">{message.content}</p>

              {/* User Attached Image Preview */}
              {metadata?.attachedFileId &&
                (metadata?.attachedFileType === 'image' ||
                  /\.(png|jpe?g|webp|gif|bmp)$/i.test(metadata?.attachedFilename || '')) && (
                  <div className="pt-1">
                    <a
                      href={`/api/files/preview/${metadata.attachedFileId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block overflow-hidden rounded-lg border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1C1917] hover:opacity-95 transition"
                    >
                      <img
                        src={`/api/files/preview/${metadata.attachedFileId}`}
                        alt={sanitizeFilename(metadata.attachedFilename || 'Attached Image')}
                        className="max-h-56 max-w-xs object-cover rounded bg-stone-100"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </a>
                  </div>
                )}

              {/* User Attached Video Player */}
              {metadata?.attachedFileId &&
                (metadata?.attachedFileType === 'video' ||
                  /\.(mp4|mov|webm|mkv|avi)$/i.test(metadata?.attachedFilename || '')) && (
                  <div className="pt-1 max-w-sm">
                    <video
                      src={`/api/files/preview/${metadata.attachedFileId}`}
                      controls
                      className="w-full max-h-60 rounded-lg border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1C1917] bg-black"
                    />
                  </div>
                )}
            </div>
          ) : (
            <div>
              <SanitizedMarkdown content={formatMarkdownContent(message.content)} />

              {/* Web Search Sources / Citations */}
              {isAssistant && metadata?.sources && metadata.sources.length > 0 && (
                <div className="mt-3.5 pt-2.5 border-t border-stone-200">
                  <div className="flex items-center justify-between gap-1.5 text-[11px] font-mono font-bold text-stone-600 uppercase tracking-wider mb-2">
                    <div className="flex items-center gap-1.5">
                      <Search className="w-3 h-3 text-sky-600" />
                      <span>Verified Web Sources ({metadata.sources.length}):</span>
                    </div>
                    {metadata?.searchQuery && (
                      <span
                        className="text-[10px] font-normal normal-case text-stone-500 italic truncate max-w-[260px]"
                        title={`Exact search query sent: "${sanitizeText(metadata.searchQuery)}"`}
                      >
                        Query: &quot;{sanitizeText(metadata.searchQuery)}&quot;
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {metadata.sources.map((source, idx) => {
                      if (!isSafeUrl(source.url)) return null;
                      const safeTitle = sanitizeText(source.title) || sanitizeText(source.url);
                      return (
                        <a
                          key={idx}
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-stone-100 hover:bg-sky-50 text-stone-700 hover:text-sky-900 border border-stone-300 hover:border-sky-400 transition-colors max-w-full truncate shadow-[1px_1px_0px_0px_#e7e5e4]"
                          title={sanitizeText(source.url)}
                        >
                          <span className="truncate max-w-[220px]">{safeTitle}</span>
                          <ExternalLink className="w-2.5 h-2.5 flex-shrink-0 text-stone-400" />
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Document Sources & Page/Section Citations */}
              {isAssistant && metadata?.citations && metadata.citations.length > 0 && (
                <div className="mt-3.5 pt-2.5 border-t border-stone-200">
                  <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-emerald-800 uppercase tracking-wider mb-2">
                    <FileText className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Document Citations ({metadata.citations.length}):</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {metadata.citations.map((c, idx) => {
                      const safeFilename = sanitizeFilename(c.filename || 'Document');
                      const pageLabel = c.page ? `Page ${sanitizeText(String(c.page))}` : null;
                      const sectionLabel = c.heading ? `Section: ${sanitizeText(c.heading)}` : (c.section ? sanitizeText(c.section) : null);
                      const sheetLabel = c.sheet ? `Sheet: ${sanitizeText(c.sheet)}` : null;
                      const details = [pageLabel, sheetLabel, sectionLabel].filter(Boolean).join(' · ');
                      return (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-50 text-emerald-950 border border-emerald-300 shadow-[1px_1px_0px_0px_#10b981]"
                          title={`Excerpt from ${safeFilename}`}
                        >
                          <span className="font-bold">{safeFilename}</span>
                          {details && <span className="text-emerald-700">({details})</span>}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Degraded Vision Notice Banner */}
              {isAssistant && metadata?.degraded && (
                <div className="mt-2.5 p-2 rounded bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center gap-2 font-mono">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-amber-600" />
                  <span>Vision unavailable: Responded using extracted OCR text / transcript only.</span>
                </div>
              )}

              {/* Unverified Claim Alert Banner */}
              {isAssistant && metadata?.unverifiedWarning && (
                <div className="mt-2.5 p-2 rounded bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center gap-2 font-mono">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-amber-600" />
                  <span>{metadata.unverifiedWarning}</span>
                </div>
              )}

              {/* Incomplete / Error Retry Action Banner */}
              {isAssistant && isIncompleteOrError && typeof onRegenerate === 'function' && (
                <div className="mt-3 pt-2.5 border-t border-stone-200 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-amber-900 font-mono">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                    <span>Response was interrupted or stopped.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRegenerate(message)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-bold uppercase border-2 border-stone-800 bg-amber-200 hover:bg-amber-300 text-stone-900 shadow-[1px_1px_0px_0px_#000] cursor-pointer transition active:translate-x-0.5 active:translate-y-0.5"
                    title="Retry or regenerate response"
                  >
                    <RotateCcw className="w-3 h-3 text-stone-900" />
                    <span>Retry / Regenerate</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
