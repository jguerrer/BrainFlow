import type { CardinalityMode, DrawingTool } from '../../types/brainflow';

export const COLOR_PALETTE = [
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#8b5cf6', // Violet
  '#ef4444', // Red
];

interface ToolbarProps {
  projectName: string;
  ideaName: string;
  hasActiveIdea: boolean;
  tool: DrawingTool;
  activeColor: string;
  cardinalityMode: CardinalityMode;
  zoom: number;
  saving: boolean;
  exporting: boolean;
  inspectorCollapsed?: boolean;
  onToggleInspector?: () => void;
  onSelectTool: (tool: DrawingTool) => void;
  onSelectColor: (color: string) => void;
  onSelectCardinality: (mode: CardinalityMode) => void;
  onZoomChange: (delta: number) => void;
  onResetView: () => void;
  onExportImage: () => void;
  onExportPdf: () => void;
}

export function Toolbar({
  projectName,
  ideaName,
  hasActiveIdea,
  tool,
  activeColor,
  cardinalityMode,
  zoom,
  saving,
  exporting,
  inspectorCollapsed = false,
  onToggleInspector,
  onSelectTool,
  onSelectColor,
  onSelectCardinality,
  onZoomChange,
  onResetView,
  onExportImage,
  onExportPdf,
}: ToolbarProps) {
  const toolButtonClass = (t: DrawingTool) =>
    tool === t
      ? 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-blue-600 text-white shadow-sm cursor-pointer'
      : 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer';

  return (
    <header className="h-14 border-b border-slate-800 bg-slate-900 px-4 flex items-center justify-between gap-4 shrink-0">
      {/* Brand & Active Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-base shrink-0">
          B
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-slate-100">BrainFlow</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                saving
                  ? 'bg-amber-500/15 text-amber-400'
                  : 'bg-emerald-500/15 text-emerald-400'
              }`}
            >
              {saving ? 'Saving...' : 'Saved'}
            </span>
          </div>
          <div className="text-xs text-slate-400 truncate">
            {projectName ? `${projectName} / ${ideaName || 'Select an Idea'}` : 'No project selected'}
          </div>
        </div>
      </div>

      {/* Drawing Tools & Colors */}
      <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg p-1">
        <button
          type="button"
          onClick={() => onSelectTool('select')}
          className={toolButtonClass('select')}
          title="Move & Select (pan canvas, drag boxes and labels)"
        >
          <svg
            viewBox="0 0 24 24"
            className="w-4 h-4 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.85}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2" />
            <path d="M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2" />
            <path d="M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8" />
            <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
          </svg>
          <span>Move</span>
        </button>
        <button
          type="button"
          onClick={() => onSelectTool('box')}
          className={toolButtonClass('box')}
          title="Add Idea Box (click on canvas to place)"
        >
          <svg
            viewBox="0 0 24 24"
            className="w-4 h-4 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.85}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 4H19A2 2 0 0 1 21 6V15A2 2 0 0 1 19 17H9L5 20.5V17A2 2 0 0 1 3 15V6A2 2 0 0 1 5 4Z" />
            <path d="M8 9h8" />
            <path d="M8 12.5h5" />
          </svg>
          <span>Ideas</span>
        </button>
        <button
          type="button"
          onClick={() => onSelectTool('group')}
          className={toolButtonClass('group')}
          title="Add Group Container (click canvas to place a container that groups other ideas behind them)"
        >
          <svg
            viewBox="0 0 24 24"
            className="w-4 h-4 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.85}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="18" height="18" rx="3" strokeDasharray="3 3" />
            <rect x="6" y="6" width="6" height="5" rx="1.5" fill="currentColor" fillOpacity="0.4" />
            <rect x="13" y="13" width="5" height="5" rx="1.5" fill="currentColor" fillOpacity="0.4" />
          </svg>
          <span>Group</span>
        </button>
        <button
          type="button"
          onClick={() => onSelectTool('line')}
          className={toolButtonClass('line')}
          title="Connector (draw a one-way directed line between ideas)"
        >
          <svg
            viewBox="0 0 24 24"
            className="w-4 h-4 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.85}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="5" cy="18" r="2.2" />
            <path d="M7 16.5 C 11 16.5, 13 7.5, 19 7.5" />
            <path d="M15.5 4.5 L 19.5 7.5 L 15.5 10.5" />
          </svg>
          <span>Connector</span>
        </button>
        <button
          type="button"
          onClick={() => onSelectTool('bidirectional')}
          className={toolButtonClass('bidirectional')}
          title="Bidirectional Connector (double parallel dashed lines between ideas)"
        >
          <svg
            viewBox="0 0 24 24"
            className="w-4 h-4 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 9.5h15" strokeDasharray="3 2.5" />
            <path d="M16.5 6.5 20 9.5l-3.5 3" />
            <path d="M5 14.5h15" strokeDasharray="3 2.5" />
            <path d="M7.5 11.5 4 14.5l3.5 3" />
          </svg>
          <span>Bidirectional</span>
        </button>

        <div className="h-5 w-px bg-slate-800 mx-1" />

        <div className="flex items-center gap-1.5 px-1.5" title="Color for new or selected item">
          <span className="text-xs text-slate-400">Color:</span>
          {COLOR_PALETTE.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onSelectColor(color)}
              aria-label={`Select color ${color}`}
              className={`w-5 h-5 rounded-full border-2 transition cursor-pointer ${
                activeColor === color ? 'border-white scale-110' : 'border-transparent opacity-80 hover:opacity-100'
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      {/* Cardinality & Zoom Controls */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1">
          <span className="text-xs text-slate-400">Cardinality:</span>
          <select
            value={cardinalityMode}
            onChange={(e) => onSelectCardinality(e.target.value as CardinalityMode)}
            className="bg-slate-950 text-slate-100 text-xs font-medium focus:outline-none cursor-pointer"
          >
            <option value="off">Off</option>
            <option value="degree">Highlight by Degree</option>
            <option value="hubs">Highlight Hubs (3+)</option>
            <option value="isolated">Highlight Isolated (0)</option>
          </select>
        </div>

        <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-1">
          <button
            type="button"
            onClick={() => onZoomChange(-0.15)}
            className="px-2 py-1 rounded hover:bg-slate-800 text-xs font-semibold text-slate-200 cursor-pointer"
            title="Zoom Out"
          >
            −
          </button>
          <span className="text-xs font-mono w-12 text-center text-slate-200">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => onZoomChange(0.15)}
            className="px-2 py-1 rounded hover:bg-slate-800 text-xs font-semibold text-slate-200 cursor-pointer"
            title="Zoom In"
          >
            +
          </button>
          <button
            type="button"
            onClick={onResetView}
            className="px-2 py-1 rounded hover:bg-slate-800 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
          >
            Reset
          </button>
        </div>

        <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-1">
          <button
            type="button"
            disabled={!hasActiveIdea || exporting}
            onClick={onExportImage}
            title="Export active idea diagram as PNG Image"
            className="px-2.5 py-1 rounded text-xs font-medium text-emerald-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {exporting ? '...' : 'PNG'}
          </button>
          <button
            type="button"
            disabled={!hasActiveIdea || exporting}
            onClick={onExportPdf}
            title="Export active idea diagram as PDF"
            className="px-2.5 py-1 rounded text-xs font-medium text-sky-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {exporting ? '...' : 'PDF'}
          </button>
        </div>

        {onToggleInspector && (
          <button
            type="button"
            onClick={onToggleInspector}
            title={inspectorCollapsed ? 'Show Inspector panel' : 'Hide Inspector panel'}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition cursor-pointer ${
              inspectorCollapsed
                ? 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                : 'bg-blue-600/20 border-blue-500/50 text-blue-300 hover:bg-blue-600/30'
            }`}
            aria-label={inspectorCollapsed ? 'Show Inspector panel' : 'Hide Inspector panel'}
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.85}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M15 3v18" />
              {inspectorCollapsed ? (
                <path d="M11 9l-3 3 3 3" />
              ) : (
                <path d="M7 9l3 3-3 3" />
              )}
            </svg>
            <span className="hidden sm:inline">
              {inspectorCollapsed ? 'Inspector (Hidden)' : 'Inspector'}
            </span>
          </button>
        )}
      </div>
    </header>
  );
}
