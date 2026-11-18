import React, { useState, useRef, useEffect } from 'react';
import { SanitizedMarkdown } from './SanitizedMarkdown';
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
  FileText,
  FileSpreadsheet,
  FileCode,
  File,
  Image,
  Film,
  X,
  CheckCircle,
  Loader2,
  AlertCircle,
  Globe,
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

function getFileIcon(filename = '') {
  const ext = (filename || '').split('.').pop()?.toLowerCase();
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(ext)) {
    return <Image className="w-3.5 h-3.5 text-purple-700" />;
  }
  if (['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v'].includes(ext)) {
    return <Film className="w-3.5 h-3.5 text-sky-700" />;
  }
  if (ext === 'pdf') {
    return <FileText className="w-3.5 h-3.5 text-rose-700" />;
  }
  if (['csv', 'xlsx', 'xls'].includes(ext)) {
    return <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />;
  }
  if (['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'html', 'css', 'sql', 'json'].includes(ext)) {
    return <FileCode className="w-3.5 h-3.5 text-blue-700" />;
  }
  return <FileText className="w-3.5 h-3.5 text-amber-700" />;
}

const STARTER_PROMPTS = [
  'My project is named ApexEngine and I am using React 19.',
  'Analyze the attached document and summarize what it contains.',
  'What architecture does CosmoAI use for multi-turn memory?',
  'What did we discuss in our previous conversation?',
];

export const ChatWindow = ({
  currentSession,
  messages,
  isLoading,
  streamingText,
  isDegradedVision = false,
  allowWebSearch = true,
  onToggleWebSearch,
  onSendMessage,
  onRegenerate,
  onStopStreaming,
  onOpenRubric,
  onOpenMemoryModal,
  memoryCount = 0,
  systemPrompt,
}) => {
  const [inputText, setInputText] = useState('');
  const [attachedFile, setAttachedFile] = useState(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText, isLoading]);

  // Handle file upload and background extraction polling
  const handleFileProcess = async (file) => {
    if (!file) return;

    // Validate size (max 20MB)
    if (file.size > 20 * 1024 * 1024) {
      setUploadError('File exceeds maximum 20MB size limit.');
      return;
    }

    const ext = (file.name || '').split('.').pop()?.toLowerCase();
    const isVideo = ['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v'].includes(ext);
    const isImageOrPdf = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(ext);

    // Dynamic max attempts: videos perform OpenCV frame sampling, PyAV audio decoding,
    // Faster-Whisper speech-to-text, and Gemini multimodal scene breakdown (takes 30-80s)
    const maxAttempts = isVideo ? 200 : isImageOrPdf ? 100 : 60; // 200 * 700ms = 140s for video

    setUploadError(null);
    setIsUploadingFile(true);
    setAttachedFile({
      filename: file.name,
      size: file.size,
      isUploading: true,
      progress: 10,
      statusText: isVideo ? 'Extracting audio & scenes...' : 'Extracting...',
    });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('sessionId', currentSession?.id || 'default');

    try {
      const res = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload document.');
      }

      const jobId = data.jobId;
      const fileId = data.fileId;

      // Poll extraction job status
      let attempts = 0;
      let consecutiveErrors = 0;
      const pollInterval = setInterval(async () => {
        attempts++;
        if (attempts > maxAttempts) {
          clearInterval(pollInterval);
          setIsUploadingFile(false);
          setAttachedFile(null);
          setUploadError(
            isVideo
              ? 'Video extraction timed out. The video processing pipeline (Faster-Whisper audio transcription + multimodal scene analysis) took too long. Please try a shorter video clip.'
              : 'Document extraction timed out. Please try uploading again.'
          );
          return;
        }

        try {
          const statusRes = await fetch(`/api/files/status/${jobId}`);
          if (!statusRes.ok) {
            consecutiveErrors++;
            if (consecutiveErrors >= 10) {
              clearInterval(pollInterval);
              setIsUploadingFile(false);
              setAttachedFile(null);
              setUploadError('Lost connection to extraction server. Please check the backend.');
            }
            return;
          }
          consecutiveErrors = 0;

          const statusData = await statusRes.json();
          const job = statusData.job;

          if (job.status === 'completed') {
            clearInterval(pollInterval);
            setIsUploadingFile(false);
            setAttachedFile({
              fileId,
              filename: file.name,
              size: file.size,
              totalChunks: job.document?.totalChunks || 1,
              summary: job.document?.summary || '',
              entities: job.document?.entities || [],
              isUploading: false,
            });

            // If input is empty, prefill a natural document/image/video analysis prompt
            if (!inputText.trim()) {
              if (isVideo) {
                setInputText('Analyze this video and provide a summary of scenes, actions, and key events.');
              } else if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(ext)) {
                setInputText('Analyze this image and describe what it contains, including objects, text, and details.');
              } else {
                setInputText('Analyze this document and summarize what it contains.');
              }
            }
          } else if (job.status === 'failed') {
            clearInterval(pollInterval);
            setIsUploadingFile(false);
            setAttachedFile(null);
            setUploadError(job.error || 'Failed to extract text from document.');
          } else {
            // Update progress smoothly based on backend job progress or calculated time
            const calculatedProgress = Math.min(95, Math.round(15 + (attempts / maxAttempts) * 80));
            const progress = job.progress || calculatedProgress;
            let statusText = 'Extracting...';
            if (isVideo) {
              if (progress < 40) statusText = 'Decoding video & audio...';
              else if (progress < 75) statusText = 'Whisper transcribing...';
              else statusText = 'Analyzing scenes...';
            }
            setAttachedFile((prev) => prev ? { ...prev, progress, statusText } : null);
          }
        } catch (pollErr) {
          consecutiveErrors++;
          if (consecutiveErrors >= 10 || attempts > maxAttempts) {
            clearInterval(pollInterval);
            setIsUploadingFile(false);
            setAttachedFile(null);
            setUploadError(
              isVideo
                ? 'Video extraction timed out or server unavailable.'
                : 'Document extraction timed out or server unavailable.'
            );
          }
        }
      }, 700);
    } catch (err) {
      console.error('File upload error:', err);
      setIsUploadingFile(false);
      setAttachedFile(null);
      setUploadError(err.message || 'Error uploading document.');
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFileProcess(file);
    e.target.value = '';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileProcess(file);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading || isUploadingFile) return;

    const text = inputText.trim();
    const fileIdToSend = attachedFile?.fileId || null;
    const filenameToSend = attachedFile?.filename || null;

    setInputText('');
    setAttachedFile(null); // Detach after sending; server session maintains context
    onSendMessage(text, fileIdToSend, filenameToSend);
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
      className="relative flex-1 flex flex-col h-full bg-[#FBF9F5] retro-grid text-stone-900 overflow-hidden"
    >
      {/* Drag & Drop Visual Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-amber-50/90 border-4 border-dashed border-amber-500 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none animate-fade-in">
          <UploadCloud className="w-16 h-16 text-amber-700 animate-bounce mb-3" />
          <h3 className="text-xl font-mono font-bold text-stone-900 uppercase">Drop File to Analyze</h3>
          <p className="text-xs font-mono text-stone-600 mt-1">Supports PDF, DOCX, CSV, TXT, Images, and Videos</p>
        </div>
      )}

      {/* Retro Classic Header */}
      <header className="h-14 border-b-2 border-stone-800 bg-[#F5EFEB] px-4 sm:px-6 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-stone-900 animate-pulse"></span>
            <h2 className="font-mono text-xs sm:text-sm font-bold text-stone-900 truncate tracking-tight uppercase">
              {currentSession?.title || 'Active Dialogue'}
            </h2>
          </div>
          {currentSession?.providerUsed && (
            <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded border border-stone-700 bg-stone-200/80 text-stone-800">
              {currentSession.providerUsed}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Allow Web Search User Setting Toggle */}
          <button
            type="button"
            id="btn-toggle-web-search"
            onClick={() => onToggleWebSearch && onToggleWebSearch(!allowWebSearch)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold uppercase rounded border transition shadow-[1px_1px_0px_0px_#000] cursor-pointer ${
              allowWebSearch
                ? 'border-sky-800 bg-sky-100 hover:bg-sky-200 text-sky-950'
                : 'border-stone-400 bg-stone-100 hover:bg-stone-200 text-stone-500'
            }`}
            title={allowWebSearch ? 'Web search enabled (Click to disable)' : 'Web search disabled (Click to allow)'}
          >
            <Globe className={`w-3.5 h-3.5 ${allowWebSearch ? 'text-sky-700' : 'text-stone-400'}`} />
            <span className="hidden sm:inline">Search:</span>
            <span
              className={`px-1.5 py-0.2 rounded font-bold text-[10px] border ${
                allowWebSearch
                  ? 'bg-sky-200 text-sky-950 border-sky-400'
                  : 'bg-stone-200 text-stone-600 border-stone-300'
              }`}
            >
              {allowWebSearch ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* Quick Memory Inspector Pill */}
          <button
            type="button"
            onClick={onOpenMemoryModal}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold uppercase rounded border border-stone-800 bg-white hover:bg-amber-100 transition shadow-[1px_1px_0px_0px_#000] cursor-pointer"
            title="Inspect 3-Tier Long-Term Memories"
          >
            <Layers className="w-3.5 h-3.5 text-amber-700" />
            <span className="hidden md:inline">Memories:</span>
            <span className="px-1.5 py-0.2 rounded bg-amber-200 text-stone-900 font-bold border border-amber-400">
              {memoryCount}
            </span>
          </button>
        </div>
      </header>

      {/* Messages Scroll Area */}
      <div id="messages-scroll-area" className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-lg mx-auto py-12 px-4 space-y-6">
            <div className="w-16 h-16 rounded-xl border-2 border-stone-800 bg-amber-300 text-stone-950 flex items-center justify-center shadow-[4px_4px_0px_0px_#1C1917]">
              <Bot className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="font-mono text-base sm:text-lg font-bold text-stone-900 uppercase tracking-tight">
                Welcome to CosmoAI
              </h3>
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed font-sans">
                A multi-turn conversational AI with 3-tier memory, document analysis RAG, and real-time search grounding.
              </p>
            </div>

            {/* Quick Starter Prompts */}
            <div className="w-full space-y-2 text-left pt-2">
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-stone-500 block px-1">
                Suggested Prompts:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {STARTER_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setInputText(prompt);
                      textareaRef.current?.focus();
                    }}
                    className="p-2.5 rounded-lg border-2 border-stone-800 bg-white hover:bg-amber-100 text-left transition shadow-[2px_2px_0px_0px_#1C1917] hover:shadow-[3px_3px_0px_0px_#1C1917] cursor-pointer text-xs font-sans text-stone-800 flex items-start gap-2"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-700 flex-shrink-0 mt-0.5" />
                    <span>{prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, index) => (
              <MessageItem
                key={msg.id || index}
                message={msg}
                onOpenRubric={onOpenRubric}
                onRegenerate={onRegenerate}
              />
            ))}

            {/* Live SSE Streaming Assistant Message */}
            {streamingText && (
              <div className="flex gap-3 justify-start max-w-4xl mx-auto">
                <div className="w-8 h-8 rounded border border-stone-800 bg-amber-400 text-stone-950 flex items-center justify-center flex-shrink-0 font-mono text-xs font-bold shadow-[1px_1px_0px_0px_#000]">
                  AI
                </div>
                <div className="flex-1 bg-white border-2 border-stone-800 p-4 rounded-lg shadow-[3px_3px_0px_0px_#1C1917] max-w-3xl">
                  <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-stone-200">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                    <span className="font-mono text-[11px] uppercase tracking-wider text-amber-800 font-bold">
                      Streaming Response...
                    </span>
                  </div>
                  <div className="markdown-prose text-stone-900 text-sm leading-relaxed overflow-x-auto">
                    <SanitizedMarkdown content={formatMarkdownContent(streamingText)} />
                  </div>
                </div>
              </div>
            )}

            {/* Loading Indicator */}
            {isLoading && !streamingText && (
              <div className="flex gap-3 justify-start max-w-4xl mx-auto">
                <div className="w-8 h-8 rounded border border-stone-800 bg-amber-300 text-stone-900 flex items-center justify-center flex-shrink-0 font-mono text-xs font-bold shadow-[1px_1px_0px_0px_#000]">
                  AI
                </div>
                <div className="bg-white border-2 border-stone-800 p-3.5 rounded-lg shadow-[3px_3px_0px_0px_#1C1917] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-stone-700 animate-bounce"></span>
                  <span className="w-2 h-2 rounded-full bg-stone-700 animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-2 h-2 rounded-full bg-stone-700 animate-bounce [animation-delay:0.4s]"></span>
                  <span className="font-mono text-xs text-stone-600 pl-2">
                    Synthesizing response & retrieving context...
                  </span>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Retro Command Input Dock */}
      <div className="p-4 bg-[#F5EFEB] border-t-2 border-stone-800">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-2">
          {/* Degraded Vision Notice Banner */}
          {isDegradedVision && (
            <div className="p-2 rounded bg-amber-100 border border-amber-400 text-amber-900 text-xs flex items-center gap-2 font-mono animate-fade-in shadow-sm">
              <AlertCircle className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />
              <span>
                <strong>Notice:</strong> Multimodal vision is unavailable. Responding based on extracted OCR text / transcript only.
              </span>
            </div>
          )}

          {/* Upload Error Banner */}
          {uploadError && (
            <div className="p-2 rounded bg-rose-100 border border-rose-300 text-rose-900 text-xs flex items-center justify-between font-mono animate-fade-in">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                <span>{uploadError}</span>
              </div>
              <button
                type="button"
                onClick={() => setUploadError(null)}
                className="hover:text-rose-950 font-bold p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Attached Document Pill Badge */}
          {attachedFile && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-100 border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1C1917] font-mono text-xs">
              <div className="flex items-center gap-1.5 text-stone-900">
                {attachedFile.isUploading ? (
                  <Loader2 className="w-3.5 h-3.5 text-amber-700 animate-spin" />
                ) : (
                  getFileIcon(attachedFile.filename)
                )}
                <span className="font-bold truncate max-w-[200px] sm:max-w-xs">{attachedFile.filename}</span>
              </div>

              <span className="text-[10px] text-stone-600 uppercase font-bold px-1.5 py-0.5 bg-amber-200 rounded border border-amber-400">
                {attachedFile.isUploading ? (attachedFile.statusText || 'Extracting...') : `${attachedFile.totalChunks} chunks ready`}
              </span>

              <button
                type="button"
                onClick={() => setAttachedFile(null)}
                className="p-0.5 hover:bg-amber-200 rounded text-stone-700 hover:text-stone-900 transition"
                title="Remove attached document"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="relative flex items-end gap-2 bg-white rounded-lg border-2 border-stone-800 p-2 shadow-[3px_3px_0px_0px_#1C1917] focus-within:border-amber-600 focus-within:shadow-[4px_4px_0px_0px_#D97706] transition-all">
            {/* Hidden Native File Input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".pdf,.docx,.txt,.csv,.png,.jpg,.jpeg,.webp,.gif,.mp4,.mov,.webm,.mkv,.avi"
              className="hidden"
            />

            {/* Paperclip Document/Media Attach Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingFile || isLoading}
              className="p-2 rounded border border-stone-300 hover:border-stone-800 bg-stone-100 hover:bg-stone-200 text-stone-700 hover:text-stone-900 transition mb-0.5 shadow-[1px_1px_0px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer disabled:opacity-40"
              title="Attach document, image, or video (PDF, DOCX, CSV, PNG, JPG, MP4, MOV, WEBM)"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Allow Web Search Quick Toggle Button */}
            <button
              type="button"
              onClick={() => onToggleWebSearch && onToggleWebSearch(!allowWebSearch)}
              disabled={isLoading}
              className={`p-2 rounded border transition mb-0.5 shadow-[1px_1px_0px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer ${
                allowWebSearch
                  ? 'border-sky-700 bg-sky-100 hover:bg-sky-200 text-sky-900'
                  : 'border-stone-300 hover:border-stone-800 bg-stone-100 hover:bg-stone-200 text-stone-400'
              }`}
              title={allowWebSearch ? 'Web search enabled (Click to disable)' : 'Web search disabled (Click to enable)'}
            >
              <Globe className="w-4 h-4" />
            </button>

            <textarea
              id="chat-input-textarea"
              ref={textareaRef}
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                attachedFile
                  ? `Ask a question about ${attachedFile.filename}...`
                  : 'Ask CosmoAI a question or attach a document... (Shift+Enter for new line)'
              }
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
                  disabled={!inputText.trim() || isUploadingFile}
                  className="px-3.5 py-2.5 rounded border-2 border-stone-900 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:hover:bg-amber-400 text-stone-950 font-mono text-xs font-bold uppercase transition shadow-[2px_2px_0px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer flex items-center gap-1.5"
                  title="Send message (Enter)"
                >
                  <span>SEND</span>
                  <Send className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Character counter */}
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
