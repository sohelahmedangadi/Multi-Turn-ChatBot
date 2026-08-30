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
  Paperclip,
  UploadCloud,
} from 'lucide-react';
import { MessageItem } from './MessageItem.jsx';
import { FileAttachmentBadge } from './FileAttachmentBadge.jsx';

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
  const [attachedFile, setAttachedFile] = useState(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [fileError, setFileError] = useState(null);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText, isLoading]);

  const handleFileProcess = async (file) => {
    if (!file) return;
    setFileError(null);
    setIsUploadingFile(true);
    setAttachedFile({
      filename: file.name,
      fileType: file.type || file.name.split('.').pop(),
      sizeFormatted: `${(file.size / 1024).toFixed(1)} KB`,
    });

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to parse and index document.');
      }

      setAttachedFile(data.document);
    } catch (err) {
      console.error('Upload error:', err);
      setFileError(err.message);
      setAttachedFile(null);
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
    // reset input so the same file can be re-selected if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if ((!inputText.trim() && !attachedFile) || isLoading || isUploadingFile) return;
    const text = inputText.trim() || (attachedFile ? `Please analyze and summarize the attached document "${attachedFile.filename}".` : '');
    const currentFileId = attachedFile?.fileId || null;
    setInputText('');
    setAttachedFile(null);
    onSendMessage(text, currentFileId);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <main
      id="chat-main-container"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative flex-1 flex flex-col h-full bg-[#FBF9F5] retro-grid text-stone-900 overflow-hidden ${
        isDraggingFile ? 'ring-4 ring-amber-500 ring-inset bg-amber-50/40' : ''
      }`}
    >
      {/* Drag & Drop Visual Overlay */}
      {isDraggingFile && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-amber-100/90 backdrop-blur-xs border-4 border-dashed border-amber-600 font-mono text-stone-950 p-6 animate-fade-in pointer-events-none">
          <div className="text-center space-y-2">
            <UploadCloud className="w-12 h-12 mx-auto text-amber-800 animate-bounce" />
            <div className="text-lg font-bold uppercase tracking-wide">Drop Document to Analyze</div>
            <p className="text-xs text-stone-700">Supported: PDF, Text, Markdown, CSV, JSON, and Source Code</p>
          </div>
        </div>
      )}

      {/* Retro Classic Header */}
      <header className="h-14 border-b-2 border-stone-800 bg-[#F5EFEB] px-4 sm:px-6 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex items-center gap-2">
            <span className="font-bold font-mono text-xs sm:text-sm text-stone-900 truncate max-w-xs sm:max-w-md uppercase tracking-wider">
              {currentSession?.title || 'NEW DIALOGUE SESSION'}
            </span>
          </div>

          {messages.length > 0 && (
            <div className="hidden md:flex items-center gap-1 text-xs font-mono text-stone-500">
              <span>•</span>
              <div className="flex items-center gap-1">
                <Layers className="w-3 h-3 text-stone-400" />
                <span>{messages.length} turns</span>
              </div>
            </div>
          )}
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
                Featuring short-term sliding history, persistent LangChain vector user memory with automatic updates, LangChain RAG document analysis, and cross-session past conversation access.
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
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-1.5">
          {/* Active File Attachment Chip or Error */}
          {(attachedFile || fileError) && (
            <div className="flex items-center gap-2 pb-1 flex-wrap">
              {attachedFile && (
                <FileAttachmentBadge
                  file={attachedFile}
                  isUploading={isUploadingFile}
                  onRemove={() => setAttachedFile(null)}
                />
              )}
              {fileError && (
                <div className="px-2.5 py-1 rounded bg-rose-100 border border-rose-400 text-rose-900 text-xs font-mono font-bold animate-fade-in flex items-center gap-1.5">
                  <span>⚠️ {fileError}</span>
                  <button type="button" onClick={() => setFileError(null)} className="underline cursor-pointer">
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept=".pdf,.txt,.md,.markdown,.csv,.json,.js,.jsx,.ts,.tsx,.py,.java,.cpp,.c,.html,.css,.sql"
          />

          <div className="relative flex items-end gap-2 bg-white rounded-lg border-2 border-stone-800 p-2 shadow-[3px_3px_0px_0px_#1C1917] focus-within:border-amber-600 focus-within:shadow-[4px_4px_0px_0px_#D97706] transition-all">
            {/* File Attachment Button */}
            <button
              type="button"
              id="btn-attach-file"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingFile}
              title="Attach Document (PDF, TXT, MD, CSV, JSON, Code)"
              className="p-2 text-stone-600 hover:text-stone-950 hover:bg-stone-100 rounded transition cursor-pointer flex-shrink-0"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <textarea
              id="chat-input-textarea"
              ref={textareaRef}
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={attachedFile ? `Ask questions about ${attachedFile.filename}...` : 'Ask CosmoAI or drop a document to analyze... (Shift+Enter for new line)'}
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
                  disabled={(!inputText.trim() && !attachedFile) || isUploadingFile}
                  className="px-3.5 py-2.5 rounded border-2 border-stone-900 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:hover:bg-amber-400 text-stone-950 font-mono text-xs font-bold uppercase transition shadow-[2px_2px_0px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer flex items-center gap-1.5"
                  title="Send message (Enter)"
                >
                  <span>SEND</span>
                  <Send className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Fade in character counter only past 70% of 2000 limit */}
          {inputText.length >= 1400 && (
            <div className="flex items-center justify-end text-[11px] font-mono text-stone-500 px-1 animate-fade-in">
              <span className={inputText.length > 1800 ? 'text-amber-700 font-bold' : ''}>
                {inputText.length} / 2000
              </span>
            </div>
          )}
        </form>
      </div>
    </main>
  );
};
