import React from 'react';
import {
  FileText,
  FileCode,
  FileSpreadsheet,
  File,
  X,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

function getFileIcon(fileType = '', filename = '') {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (fileType === 'pdf' || ext === 'pdf') {
    return <FileText className="w-3.5 h-3.5 text-rose-700" />;
  }
  if (fileType === 'csv' || ext === 'csv' || ext === 'xlsx') {
    return <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />;
  }
  if (fileType === 'code' || ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'html', 'css', 'sql'].includes(ext)) {
    return <FileCode className="w-3.5 h-3.5 text-blue-700" />;
  }
  return <File className="w-3.5 h-3.5 text-amber-700" />;
}

export const FileAttachmentBadge = ({
  file,
  isUploading = false,
  onRemove,
}) => {
  if (!file) return null;

  return (
    <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded bg-white border-2 border-stone-800 text-xs font-mono text-stone-900 shadow-[2px_2px_0px_0px_#1C1917] animate-fade-in max-w-full">
      <div className="flex items-center gap-1.5 overflow-hidden">
        {isUploading ? (
          <Loader2 className="w-3.5 h-3.5 text-amber-600 animate-spin flex-shrink-0" />
        ) : (
          getFileIcon(file.fileType, file.filename)
        )}
        <span className="font-bold truncate max-w-[180px] sm:max-w-[280px]">
          {file.filename}
        </span>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {isUploading ? (
          <span className="text-[10px] text-amber-700 font-bold uppercase">
            Indexing...
          </span>
        ) : (
          <span className="text-[10px] bg-stone-100 text-stone-700 border border-stone-300 px-1.5 py-0.2 rounded font-bold">
            {file.totalChunks ? `${file.totalChunks} chunks` : file.sizeFormatted || 'Ready'}
          </span>
        )}

        <button
          type="button"
          onClick={onRemove}
          title="Remove attached file"
          className="p-0.5 rounded text-stone-500 hover:text-stone-950 hover:bg-stone-100 transition cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
