import { useState } from 'react';

// Stored sheets keep their extension in the URL; local previews (blob:) are only made for images
function isPdfUrl(url) {
  return /\.pdf$/i.test((url || '').split(/[?#]/)[0]);
}

/**
 * The student's original answer sheet (PDF or image), so faculty can check the marks
 * against what was actually written. PDFs use the browser's own viewer (pages, zoom, search).
 */
export default function AnswerSheetViewer({ url, title = 'Original answer sheet', onClose, className = '' }) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const pdf = isPdfUrl(url);

  return (
    <div className={`card overflow-hidden flex flex-col ${className}`}>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-outline-variant bg-surface-bright">
        <span className="material-symbols-outlined text-[18px] text-on-surface-variant">description</span>
        <span className="text-label-md font-semibold text-on-surface flex-1 truncate">{title}</span>
        {url && !pdf && (
          <>
            <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="p-1 rounded hover:bg-surface-container-high text-on-surface-variant" title="Zoom out" aria-label="Zoom out">
              <span className="material-symbols-outlined text-[18px]">zoom_out</span>
            </button>
            <span className="text-[11px] text-on-surface-variant w-9 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(4, z + 0.25))} className="p-1 rounded hover:bg-surface-container-high text-on-surface-variant" title="Zoom in" aria-label="Zoom in">
              <span className="material-symbols-outlined text-[18px]">zoom_in</span>
            </button>
            <button onClick={() => setRotation(r => (r + 90) % 360)} className="p-1 rounded hover:bg-surface-container-high text-on-surface-variant" title="Rotate" aria-label="Rotate">
              <span className="material-symbols-outlined text-[18px]">rotate_right</span>
            </button>
          </>
        )}
        {url && (
          <a href={url} target="_blank" rel="noreferrer" className="p-1 rounded hover:bg-surface-container-high text-on-surface-variant" title="Open in new tab" aria-label="Open in new tab">
            <span className="material-symbols-outlined text-[18px]">open_in_new</span>
          </a>
        )}
        {onClose && (
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-container-high text-on-surface-variant" title="Close" aria-label="Close">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 bg-surface-container-low overflow-auto">
        {!url ? (
          <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6 text-on-surface-variant">
            <span className="material-symbols-outlined text-[40px] text-outline mb-2">hide_image</span>
            <p className="text-body-sm">The original sheet is not available.</p>
            <p className="text-[11px] mt-1">It was not saved to storage when it was evaluated.</p>
          </div>
        ) : pdf ? (
          <iframe src={`${url}#view=FitH`} title={title} className="w-full h-full min-h-[500px] bg-white" />
        ) : (
          <div className="p-3 flex justify-center">
            <img
              src={url}
              alt={title}
              style={{ width: `${zoom * 100}%`, transform: `rotate(${rotation}deg)` }}
              className="max-w-none h-auto rounded shadow-sm border border-outline-variant bg-white transition-[width] duration-150"
            />
          </div>
        )}
      </div>
    </div>
  );
}
