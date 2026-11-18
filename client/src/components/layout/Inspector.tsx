import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import type {
  ActionLink,
  IdeaConnection,
  IdeaDetail,
  IdeaNode,
  PortMetadata,
  PortSide,
  Selection,
} from '../../types/brainflow';
import type { NodeDegree } from '../../utils/cardinality';
import {
  encodeImageFile,
  extractImageFromDataTransfer,
  formatEncodedSizeKb,
  isEncodedImageDataUrl,
} from '../../utils/imageEncoding';
import { COLOR_PALETTE } from './Toolbar';
import { getContainedIdeas } from '../../utils/geometry';

function ImageUploadButton({
  label,
  onEncoded,
  onError,
  className,
}: {
  label: string;
  onEncoded: (result: { dataUrl: string; defaultLabel: string }) => void;
  onError: (message: string) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      onError('');
      const encoded = await encodeImageFile(file);
      onEncoded(encoded);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to encode image.');
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={(e) => void handleChange(e)}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={
          className ??
          'px-2 py-1 rounded border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 cursor-pointer'
        }
      >
        {label}
      </button>
    </>
  );
}

const PORT_SIDES: { side: PortSide; short: string; label: string }[] = [
  { side: 'left', short: 'Left', label: 'Left edge' },
  { side: 'top', short: 'Top', label: 'Top edge' },
  { side: 'right', short: 'Right', label: 'Right edge' },
  { side: 'bottom', short: 'Bottom', label: 'Bottom edge' },
];

function PortSidePicker({
  value,
  accent,
  onChange,
}: {
  value: PortSide;
  accent: 'input' | 'output';
  onChange: (side: PortSide) => void;
}) {
  const activeCls =
    accent === 'input'
      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
      : 'bg-blue-500/20 border-blue-500 text-blue-300';

  return (
    <div className="grid grid-cols-4 gap-1">
      {PORT_SIDES.map((item) => (
        <button
          key={item.side}
          type="button"
          title={item.label}
          onClick={(e) => {
            e.stopPropagation();
            onChange(item.side);
          }}
          className={`py-1 rounded border text-[11px] font-medium cursor-pointer transition-colors ${
            value === item.side
              ? activeCls
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          {item.short}
        </button>
      ))}
    </div>
  );
}

interface InspectorProps {
  idea: IdeaDetail | null;
  selection: Selection;
  degrees: Record<number, NodeDegree>;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onSelect: (selection: Selection) => void;
  onUpdateIdeaMeta: (ideaId: number, patch: { name?: string; description?: string }) => void;
  onAttachImageToIdea: (imageUrl: string, label?: string) => void;
  onUpdateNode: (
    nodeId: number,
    patch: Partial<
      Pick<
        IdeaNode,
        | 'label'
        | 'description'
        | 'imageUrl'
        | 'width'
        | 'height'
        | 'color'
        | 'actions'
        | 'inputPort'
        | 'outputPort'
      >
    >
  ) => void;
  onDeleteNode: (nodeId: number) => void;
  onUpdateConnection: (
    connectionId: number,
    patch: Partial<
      Pick<
        IdeaConnection,
        'fromSide' | 'toSide' | 'bidirectional' | 'label' | 'color' | 'properties' | 'actions'
      >
    >
  ) => void;
  onDeleteConnection: (connectionId: number) => void;
}

function ActionLinksSection({
  actions,
  onAdd,
  onRemove,
}: {
  actions: ActionLink[];
  onAdd: (action: ActionLink) => void;
  onRemove: (index: number) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('https://');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!label.trim() || !url.trim()) return;
    onAdd({ label: label.trim(), url: url.trim() });
    setLabel('');
    setUrl('https://');
    setAdding(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-semibold text-slate-200">Attached Actions (Links)</span>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="text-blue-400 hover:underline cursor-pointer"
        >
          + Add Action
        </button>
      </div>

      {adding && (
        <form onSubmit={handleSubmit} className="mb-2 p-2 rounded bg-slate-950 border border-slate-800 space-y-1.5">
          <input
            type="text"
            placeholder="Action label (e.g. Open Spec)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <input
            type="url"
            placeholder="https://..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="px-2 py-0.5 text-xs text-slate-400 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-2.5 py-0.5 rounded bg-blue-600 text-white text-xs cursor-pointer"
            >
              Add
            </button>
          </div>
        </form>
      )}

      <div className="space-y-1.5">
        {actions.length === 0 ? (
          <div className="text-slate-500 italic">No action links attached.</div>
        ) : (
          actions.map((action, idx) => (
            <div
              key={`${action.label}-${idx}`}
              className="flex items-center justify-between gap-2 p-2 rounded bg-slate-950 border border-slate-800"
            >
              <a
                href={action.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline truncate"
                title={action.url}
              >
                ⚡ {action.label} ↗
              </a>
              <button
                type="button"
                onClick={() => onRemove(idx)}
                className="text-slate-500 hover:text-rose-400 cursor-pointer shrink-0"
                title="Remove action"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function Inspector({
  idea,
  selection,
  degrees,
  isCollapsed = false,
  onToggleCollapse,
  onSelect,
  onUpdateIdeaMeta,
  onAttachImageToIdea,
  onUpdateNode,
  onDeleteNode,
  onUpdateConnection,
  onDeleteConnection,
}: InspectorProps) {
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newImageLabel, setNewImageLabel] = useState('');
  const [summaryUploadError, setSummaryUploadError] = useState('');
  const [nodeUploadError, setNodeUploadError] = useState('');
  const [isInspectorDragOver, setIsInspectorDragOver] = useState(false);
  const [addingProp, setAddingProp] = useState(false);
  const [propKey, setPropKey] = useState('');
  const [propVal, setPropVal] = useState('');

  if (isCollapsed) {
    return (
      <aside
        className="w-12 border-l border-slate-800 bg-slate-900/95 flex flex-col items-center py-3 justify-between shrink-0 select-none shadow-lg cursor-pointer transition-colors hover:bg-slate-800/80 group"
        onClick={onToggleCollapse}
        title="Inspector is collapsed — click to expand"
        aria-label="Inspector is collapsed — click to expand"
      >
        <div className="flex flex-col items-center gap-2.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse?.();
            }}
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-800 text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm cursor-pointer"
            title="Expand Inspector (Collapsed)"
            aria-label="Expand Inspector"
          >
            {/* Collapsed Inspector panel icon */}
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.85}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M15 3v18" />
              <path d="M10 9l-3 3 3 3" />
            </svg>
          </button>
          <span
            className="text-[9px] font-bold tracking-wider px-1 py-0.5 rounded bg-slate-800/90 text-slate-400 group-hover:text-blue-300"
            title="Inspector status: Collapsed"
          >
            HIDE
          </span>
        </div>

        {/* Rotated text label */}
        <div className="flex-1 flex items-center justify-center py-4">
          <span
            className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 group-hover:text-slate-200 transition-colors pointer-events-none"
            style={{
              writingMode: 'vertical-rl',
              transform: 'rotate(180deg)',
            }}
          >
            Inspector
          </span>
        </div>

        {/* Bottom indicator */}
        <div className="flex flex-col items-center gap-1.5">
          {selection && (
            <span
              className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-blue-500/30 animate-pulse"
              title="Active element selected"
            />
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse?.();
            }}
            className="p-1 rounded text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
            title="Expand Inspector"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        </div>
      </aside>
    );
  }

  if (!idea) {
    return (
      <aside className="w-80 border-l border-slate-800 bg-slate-900/90 flex flex-col shrink-0 min-h-0 text-xs">
        <div className="p-3 border-b border-slate-800 flex items-center justify-between">
          <span className="font-semibold text-xs uppercase tracking-wider text-slate-400">
            Inspector
          </span>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 cursor-pointer transition-colors"
              title="Hide / Collapse Inspector"
              aria-label="Hide / Collapse Inspector"
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
                <path d="M7 9l3 3-3 3" />
              </svg>
            </button>
          )}
        </div>
        <div className="p-4 text-slate-400">
          Select or create an Idea to inspect its details.
        </div>
      </aside>
    );
  }

  const selectedNode =
    selection?.type === 'node' ? idea.nodes.find((n) => n.id === selection.id) : null;
  const selectedConnection =
    selection?.type === 'connection'
      ? idea.connections.find((c) => c.id === selection.id)
      : null;
  const selectedPortNode =
    selection?.type === 'port' ? idea.nodes.find((n) => n.id === selection.nodeId) : null;
  const selectedPortType = selection?.type === 'port' ? selection.port : null;

  const badgeText = selectedNode
    ? 'Idea Object'
    : selectedPortNode && selectedPortType
      ? `${selectedPortType === 'input' ? 'INPUT' : 'OUTPUT'} Connector`
      : selectedConnection
        ? 'Directed Connection'
        : 'Idea Summary';

  return (
    <aside className="w-80 border-l border-slate-800 bg-slate-900/90 flex flex-col shrink-0 min-h-0">
      <div className="p-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-xs uppercase tracking-wider text-slate-400">
            Inspector
          </span>
          <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-200">
            {badgeText}
          </span>
        </div>
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 cursor-pointer transition-colors"
            title="Hide / Collapse Inspector"
            aria-label="Hide / Collapse Inspector"
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
              <path d="M7 9l3 3-3 3" />
            </svg>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {!selectedNode && !selectedConnection && !selectedPortNode && (
          <div className="space-y-4">
            <div>
              <label className="block text-slate-400 mb-1">Active Idea Name</label>
              <input
                type="text"
                value={idea.name}
                onChange={(e) => onUpdateIdeaMeta(idea.id, { name: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Idea Description</label>
              <textarea
                rows={4}
                placeholder="Write notes or context for this idea drawing..."
                value={idea.description ?? ''}
                onChange={(e) => onUpdateIdeaMeta(idea.id, { description: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-blue-500 resize-y"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-slate-400">Objects</div>
                <div className="text-base font-semibold text-slate-100 mt-0.5">
                  {idea.nodes.length}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-slate-400">Connections</div>
                <div className="text-base font-semibold text-slate-100 mt-0.5">
                  {idea.connections.length}
                </div>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Complexity</span>
              <span className="font-semibold text-slate-100">{idea.complexity}</span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Last Access</span>
              <span className="text-slate-200">
                {new Date(idea.lastAccess).toLocaleString()}
              </span>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newImageUrl.trim()) return;
                setSummaryUploadError('');
                onAttachImageToIdea(newImageUrl.trim(), newImageLabel.trim() || undefined);
                setNewImageUrl('');
                setNewImageLabel('');
              }}
              className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2"
            >
              <div className="font-semibold text-slate-200">Attach Image (URL or Upload)</div>
              <input
                type="url"
                placeholder="https://example.com/diagram.png"
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-blue-500"
              />
              <input
                type="text"
                placeholder="Caption / label (optional)"
                value={newImageLabel}
                onChange={(e) => setNewImageLabel(e.target.value)}
                className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-blue-500"
              />
              <div className="flex gap-1.5">
                <button
                  type="submit"
                  className="flex-1 py-1.5 rounded bg-blue-600 text-white font-medium hover:bg-blue-500 cursor-pointer"
                >
                  + Add URL Image
                </button>
                <ImageUploadButton
                  label="Upload & Embed"
                  onEncoded={({ dataUrl, defaultLabel }) => {
                    setSummaryUploadError('');
                    onAttachImageToIdea(dataUrl, newImageLabel.trim() || defaultLabel);
                    setNewImageLabel('');
                  }}
                  onError={setSummaryUploadError}
                  className="flex-1 py-1.5 rounded bg-emerald-600 text-white font-medium hover:bg-emerald-500 cursor-pointer"
                />
              </div>
              {summaryUploadError && (
                <div className="text-[11px] text-rose-400">{summaryUploadError}</div>
              )}
            </form>

            <p className="text-slate-400 leading-relaxed pt-1">
              Click any <strong>Idea Box</strong> or <strong>Directed Line</strong> on the canvas
              to edit properties, attach action links, change colors, or delete it.
            </p>
          </div>
        )}

        {selectedNode && selectedNode.isGroup && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300">
                🗂 Group Container
              </span>
              <span className="text-[11px] text-slate-400">
                {getContainedIdeas(selectedNode, idea.nodes).length} idea{getContainedIdeas(selectedNode, idea.nodes).length === 1 ? '' : 's'} inside
              </span>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Group Name</label>
              <input
                type="text"
                value={selectedNode.label}
                onChange={(e) => onUpdateNode(selectedNode.id, { label: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Group Notes / Description</label>
              <textarea
                rows={3}
                placeholder="Free-text notes for this group..."
                value={selectedNode.description ?? ''}
                onChange={(e) => onUpdateNode(selectedNode.id, { description: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-blue-500 resize-y"
              />
            </div>

            <div>
              <span className="block text-slate-400 mb-1.5">Group Theme Color</span>
              <div className="flex items-center gap-2">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onUpdateNode(selectedNode.id, { color: c })}
                    className={`w-6 h-6 rounded-full border-2 cursor-pointer ${
                      selectedNode.color === c ? 'border-white scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Contained Ideas List */}
            <div className="pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-slate-200">
                  Ideas Inside This Group ({getContainedIdeas(selectedNode, idea.nodes).length})
                </span>
              </div>

              {getContainedIdeas(selectedNode, idea.nodes).length === 0 ? (
                <div className="p-3 rounded bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 text-center leading-relaxed">
                  No ideas inside yet. Move idea boxes inside the group boundary on the canvas to group them.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {getContainedIdeas(selectedNode, idea.nodes).map((contained) => (
                    <div
                      key={contained.id}
                      className="p-2 rounded bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-2 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: contained.color }}
                        />
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-200 truncate text-xs">
                            {contained.label}
                          </div>
                          {contained.description && (
                            <div className="text-[10px] text-slate-400 truncate">
                              {contained.description}
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onSelect({ type: 'node', id: contained.id })}
                        className="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white shrink-0 cursor-pointer"
                      >
                        Select
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => onDeleteNode(selectedNode.id)}
                className="w-full py-1.5 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-400 font-medium hover:bg-rose-500/25 cursor-pointer"
              >
                Delete Group Box
              </button>
            </div>
          </div>
        )}

        {selectedNode && !selectedNode.isGroup && (
          <div className="space-y-4">
            <div>
              <label className="block text-slate-400 mb-1">Object Name</label>
              <input
                type="text"
                value={selectedNode.label}
                onChange={(e) => onUpdateNode(selectedNode.id, { label: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Description</label>
              <textarea
                rows={4}
                placeholder="Add free-text notes for this object..."
                value={selectedNode.description ?? ''}
                onChange={(e) => onUpdateNode(selectedNode.id, { description: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-blue-500 resize-y"
              />
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                if (!isInspectorDragOver) setIsInspectorDragOver(true);
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                setIsInspectorDragOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
                setIsInspectorDragOver(false);
              }}
              onDrop={async (e) => {
                e.preventDefault();
                setIsInspectorDragOver(false);
                setNodeUploadError('');
                try {
                  const res = await extractImageFromDataTransfer(e.dataTransfer);
                  if (res) {
                    onUpdateNode(selectedNode.id, { imageUrl: res.dataUrl });
                  }
                } catch (err) {
                  setNodeUploadError(err instanceof Error ? err.message : 'Failed to attach dropped image.');
                }
              }}
              className={`p-2 rounded-lg border transition-all ${
                isInspectorDragOver
                  ? 'border-sky-400 bg-sky-950/40 ring-1 ring-sky-400'
                  : 'border-slate-800/80 bg-slate-950/40'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-400 flex items-center gap-1.5">
                  <span>Attached Image</span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    {isInspectorDragOver ? '• Drop to attach!' : '• Drop image here'}
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <ImageUploadButton
                    label="Upload / Replace"
                    onEncoded={({ dataUrl }) => {
                      setNodeUploadError('');
                      onUpdateNode(selectedNode.id, { imageUrl: dataUrl });
                    }}
                    onError={setNodeUploadError}
                    className="text-emerald-400 hover:underline cursor-pointer"
                  />
                  {selectedNode.imageUrl?.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        setNodeUploadError('');
                        onUpdateNode(selectedNode.id, { imageUrl: '' });
                      }}
                      className="text-rose-400 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              {isEncodedImageDataUrl(selectedNode.imageUrl) ? (
                <div className="w-full px-2.5 py-1.5 rounded-md bg-slate-950 border border-emerald-700/70 text-emerald-300 flex items-center justify-between">
                  <span>
                    Embedded image (Base64 •{' '}
                    {formatEncodedSizeKb(selectedNode.imageUrl ?? '')})
                  </span>
                </div>
              ) : (
                <input
                  type="url"
                  placeholder="https://example.com/image.png"
                  value={selectedNode.imageUrl ?? ''}
                  onChange={(e) => {
                    setNodeUploadError('');
                    onUpdateNode(selectedNode.id, { imageUrl: e.target.value });
                  }}
                  className="w-full px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-blue-500"
                />
              )}
              {nodeUploadError && (
                <div className="mt-1 text-[11px] text-rose-400">{nodeUploadError}</div>
              )}
              {selectedNode.imageUrl?.trim() && (
                <div className="mt-1.5 p-1.5 rounded bg-slate-950 border border-slate-800 flex justify-center">
                  <img
                    src={selectedNode.imageUrl}
                    alt={selectedNode.label}
                    className="max-h-24 object-contain rounded"
                  />
                </div>
              )}
            </div>

            <div>
              <span className="block text-slate-400 mb-1.5">Color</span>
              <div className="flex items-center gap-2">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onUpdateNode(selectedNode.id, { color: c })}
                    className={`w-6 h-6 rounded-full border-2 cursor-pointer ${
                      selectedNode.color === c ? 'border-white scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Cardinality</span>
              <span className="font-semibold text-slate-100">
                {degrees[selectedNode.id]?.total ?? 0} (In: {degrees[selectedNode.id]?.incoming ?? 0},
                Out: {degrees[selectedNode.id]?.outgoing ?? 0})
              </span>
            </div>

            {/* Quick Connector Links & Side Placement */}
            <div>
              <span className="block text-slate-400 mb-1.5">Connectors (Placement & Actions)</span>
              <div className="space-y-2">
                {(['input', 'output'] as const).map((portType) => {
                  const portKey = portType === 'input' ? 'inputPort' : 'outputPort';
                  const existing = selectedNode[portKey];
                  const side: PortSide = existing?.side ?? (portType === 'input' ? 'left' : 'right');
                  const isIn = portType === 'input';
                  return (
                    <div
                      key={portType}
                      className="p-2 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          onSelect({ type: 'port', nodeId: selectedNode.id, port: portType })
                        }
                        className="w-full flex items-center justify-between text-left cursor-pointer hover:opacity-90"
                      >
                        <span className={isIn ? 'text-emerald-400 font-semibold' : 'text-blue-400 font-semibold'}>
                          ● {isIn ? 'INPUT' : 'OUTPUT'}
                        </span>
                        <span className="text-slate-400 truncate max-w-[145px]">
                          {existing?.label?.trim() || 'Click to annotate'}
                        </span>
                      </button>
                      <PortSidePicker
                        value={side}
                        accent={portType}
                        onChange={(nextSide) =>
                          onUpdateNode(selectedNode.id, {
                            [portKey]: {
                              label: existing?.label ?? '',
                              description: existing?.description ?? '',
                              actions: Array.isArray(existing?.actions) ? existing.actions : [],
                              side: nextSide,
                            },
                          })
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <ActionLinksSection
              actions={selectedNode.actions || []}
              onAdd={(action) =>
                onUpdateNode(selectedNode.id, {
                  actions: [...(selectedNode.actions || []), action],
                })
              }
              onRemove={(idx) =>
                onUpdateNode(selectedNode.id, {
                  actions: (selectedNode.actions || []).filter((_, i) => i !== idx),
                })
              }
            />

            <div className="pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => onDeleteNode(selectedNode.id)}
                className="w-full py-2 rounded-md bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 font-medium cursor-pointer"
              >
                Delete Idea Object
              </button>
            </div>
          </div>
        )}

        {selectedPortNode && selectedPortType && (() => {
          const portKey = selectedPortType === 'input' ? 'inputPort' : 'outputPort';
          const currentPort: PortMetadata = {
            label: selectedPortNode[portKey]?.label ?? '',
            description: selectedPortNode[portKey]?.description ?? '',
            actions: Array.isArray(selectedPortNode[portKey]?.actions)
              ? selectedPortNode[portKey]!.actions
              : [],
            side:
              selectedPortNode[portKey]?.side ??
              (selectedPortType === 'input' ? 'left' : 'right'),
          };
          const updatePort = (patch: Partial<PortMetadata>) => {
            onUpdateNode(selectedPortNode.id, {
              [portKey]: { ...currentPort, ...patch },
            });
          };

          return (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onSelect({ type: 'node', id: selectedPortNode.id })}
                  className="text-blue-400 hover:underline cursor-pointer"
                >
                  ← {selectedPortNode.label}
                </button>
                <span
                  className={`px-2 py-0.5 rounded font-semibold ${
                    selectedPortType === 'input'
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-blue-500/15 text-blue-400'
                  }`}
                >
                  {selectedPortType === 'input' ? 'INPUT' : 'OUTPUT'}
                </span>
              </div>

              <div>
                <label className="block text-slate-400 mb-1.5">Connector Side</label>
                <PortSidePicker
                  value={currentPort.side ?? (selectedPortType === 'input' ? 'left' : 'right')}
                  accent={selectedPortType}
                  onChange={(side) => updatePort({ side })}
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Connector Annotation</label>
                <input
                  type="text"
                  placeholder={
                    selectedPortType === 'input'
                      ? 'e.g. JSON Request, Auth Token'
                      : 'e.g. User Record, Event Stream'
                  }
                  value={currentPort.label}
                  onChange={(e) => updatePort({ label: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Connector Description</label>
                <textarea
                  rows={4}
                  placeholder={`Describe what this ${selectedPortType.toUpperCase()} expects or produces...`}
                  value={currentPort.description}
                  onChange={(e) => updatePort({ description: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-blue-500 resize-y"
                />
              </div>

              <ActionLinksSection
                actions={currentPort.actions}
                onAdd={(action) => updatePort({ actions: [...currentPort.actions, action] })}
                onRemove={(idx) =>
                  updatePort({
                    actions: currentPort.actions.filter((_, i) => i !== idx),
                  })
                }
              />
            </div>
          );
        })()}

        {selectedConnection && (() => {
          const fromNode = idea.nodes.find((n) => n.id === selectedConnection.fromNodeId);
          const toNode = idea.nodes.find((n) => n.id === selectedConnection.toNodeId);
          const fromSide: PortSide =
            selectedConnection.fromSide ?? fromNode?.outputPort?.side ?? 'right';
          const toSide: PortSide =
            selectedConnection.toSide ?? toNode?.inputPort?.side ?? 'left';

          return (
          <div className="space-y-4">
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-center font-medium text-slate-200">
              {fromNode?.label || '?'}
              <span className="text-blue-400 mx-2">
                {selectedConnection.bidirectional ? '⇄' : '→'}
              </span>
              {toNode?.label || '?'}
            </div>

            <div>
              <span className="block text-slate-400 mb-1">Connector Direction</span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateConnection(selectedConnection.id, { bidirectional: false })
                  }
                  className={`py-1.5 rounded border text-xs font-medium cursor-pointer transition-colors ${
                    !selectedConnection.bidirectional
                      ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  → One-way
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateConnection(selectedConnection.id, { bidirectional: true })
                  }
                  className={`py-1.5 rounded border text-xs font-medium cursor-pointer transition-colors ${
                    selectedConnection.bidirectional
                      ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ⇄ Bidirectional
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <span className="block text-slate-400 mb-1">
                  Start Anchor ({fromNode?.label || 'From'})
                </span>
                <PortSidePicker
                  value={fromSide}
                  accent="output"
                  onChange={(side) =>
                    onUpdateConnection(selectedConnection.id, { fromSide: side })
                  }
                />
              </div>
              <div>
                <span className="block text-slate-400 mb-1">
                  End Anchor ({toNode?.label || 'To'})
                </span>
                <PortSidePicker
                  value={toSide}
                  accent="input"
                  onChange={(side) =>
                    onUpdateConnection(selectedConnection.id, { toSide: side })
                  }
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Connection Label</label>
              <input
                type="text"
                value={selectedConnection.label}
                onChange={(e) =>
                  onUpdateConnection(selectedConnection.id, { label: e.target.value })
                }
                className="w-full px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <span className="block text-slate-400 mb-1.5">Line Color</span>
              <div className="flex items-center gap-2">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onUpdateConnection(selectedConnection.id, { color: c })}
                    className={`w-6 h-6 rounded-full border-2 cursor-pointer ${
                      selectedConnection.color === c
                        ? 'border-white scale-110'
                        : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Connection Properties */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-slate-200">Connection Properties</span>
                <button
                  type="button"
                  onClick={() => setAddingProp((v) => !v)}
                  className="text-blue-400 hover:underline cursor-pointer"
                >
                  + Add Property
                </button>
              </div>

              {addingProp && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!propKey.trim()) return;
                    onUpdateConnection(selectedConnection.id, {
                      properties: {
                        ...(selectedConnection.properties || {}),
                        [propKey.trim()]: propVal.trim(),
                      },
                    });
                    setPropKey('');
                    setPropVal('');
                    setAddingProp(false);
                  }}
                  className="mb-2 p-2 rounded bg-slate-950 border border-slate-800 space-y-1.5"
                >
                  <input
                    type="text"
                    placeholder="Key (e.g. protocol)"
                    value={propKey}
                    onChange={(e) => setPropKey(e.target.value)}
                    className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="Value (e.g. REST)"
                    value={propVal}
                    onChange={(e) => setPropVal(e.target.value)}
                    className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setAddingProp(false)}
                      className="px-2 py-0.5 text-xs text-slate-400 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-2.5 py-0.5 rounded bg-blue-600 text-white text-xs cursor-pointer"
                    >
                      Save
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-1.5">
                {Object.entries(selectedConnection.properties || {}).length === 0 ? (
                  <div className="text-slate-500 italic">No properties defined.</div>
                ) : (
                  Object.entries(selectedConnection.properties || {}).map(([k, v]) => (
                    <div
                      key={k}
                      className="flex items-center justify-between gap-2 p-2 rounded bg-slate-950 border border-slate-800"
                    >
                      <span className="text-slate-200 truncate">
                        <strong className="text-slate-400">{k}:</strong> {v}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const next = { ...(selectedConnection.properties || {}) };
                          delete next[k];
                          onUpdateConnection(selectedConnection.id, { properties: next });
                        }}
                        className="text-slate-500 hover:text-rose-400 cursor-pointer shrink-0"
                        title="Remove property"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <ActionLinksSection
              actions={selectedConnection.actions || []}
              onAdd={(action) =>
                onUpdateConnection(selectedConnection.id, {
                  actions: [...(selectedConnection.actions || []), action],
                })
              }
              onRemove={(idx) =>
                onUpdateConnection(selectedConnection.id, {
                  actions: (selectedConnection.actions || []).filter((_, i) => i !== idx),
                })
              }
            />

            <div className="pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => onDeleteConnection(selectedConnection.id)}
                className="w-full py-2 rounded-md bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 font-medium cursor-pointer"
              >
                Delete Connection
              </button>
            </div>
          </div>
          );
        })()}
      </div>
    </aside>
  );
}
