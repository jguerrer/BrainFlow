import { useEffect, useRef, useState } from 'react';
import type { CardinalityMode, IdeaNode as IdeaNodeType, PortSide } from '../../types/brainflow';
import { getCardinalityVisual, type NodeDegree } from '../../utils/cardinality';
import {
  ALL_PORT_SIDES,
  getEdgeAnchorPoint,
  getInputPortSide,
  getOutputPortSide,
  PORT_RADIUS,
} from '../../utils/geometry';
import {
  encodeImageFile,
  extractImageFromDataTransfer,
  formatEncodedSizeKb,
  isEncodedImageDataUrl,
} from '../../utils/imageEncoding';

interface IdeaNodeProps {
  node: IdeaNodeType;
  degree: NodeDegree;
  cardinalityMode: CardinalityMode;
  selected: boolean;
  selectedPort: 'input' | 'output' | null;
  isDrawingLine: boolean;
  isSnapTarget: boolean;
  snapTargetSide: PortSide | null;
  isDropTarget?: boolean;
  onDropImage?: (nodeId: number, imageUrl: string) => void;
  isEditing: boolean;
  editFocusField: 'label' | 'description';
  draftLabel: string;
  draftDescription: string;
  draftImageUrl: string;
  onMouseDown: (e: React.MouseEvent<SVGGElement>, node: IdeaNodeType) => void;
  onAnchorMouseDown: (
    e: React.MouseEvent<SVGGElement>,
    node: IdeaNodeType,
    side: PortSide
  ) => void;
  onSelectPort: (nodeId: number, port: 'input' | 'output') => void;
  onChangePortSide: (nodeId: number, port: 'input' | 'output', side: PortSide) => void;
  onResizeMouseDown: (e: React.MouseEvent<SVGGElement>, node: IdeaNodeType) => void;
  onStartEdit: (node: IdeaNodeType, focusField: 'label' | 'description') => void;
  onDraftChange: (patch: { label?: string; description?: string; imageUrl?: string }) => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
}

export function IdeaNode({
  node,
  degree,
  cardinalityMode,
  selected,
  selectedPort,
  isDrawingLine,
  isSnapTarget,
  snapTargetSide,
  isDropTarget = false,
  onDropImage,
  isEditing,
  editFocusField,
  draftLabel,
  draftDescription,
  draftImageUrl,
  onMouseDown,
  onAnchorMouseDown,
  onSelectPort,
  onChangePortSide,
  onResizeMouseDown,
  onStartEdit,
  onDraftChange,
  onCommitEdit,
  onCancelEdit,
}: IdeaNodeProps) {
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const descInputRef = useRef<HTMLTextAreaElement | null>(null);
  const inlineFileInputRef = useRef<HTMLInputElement | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [inlineUploadError, setInlineUploadError] = useState('');
  const [isLocalDragOver, setIsLocalDragOver] = useState(false);
  const [isNodeDragOver, setIsNodeDragOver] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [node.imageUrl]);

  useEffect(() => {
    if (!isEditing) {
      setInlineUploadError('');
      return;
    }
    if (editFocusField === 'description') {
      descInputRef.current?.focus();
    } else {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditing, editFocusField]);

  async function handleInlineFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setInlineUploadError('');
      const { dataUrl } = await encodeImageFile(file);
      onDraftChange({ imageUrl: dataUrl });
    } catch (err) {
      setInlineUploadError(err instanceof Error ? err.message : 'Failed to encode image.');
    }
  }

  const card = getCardinalityVisual(degree, cardinalityMode);
  const actionsCount = Array.isArray(node.actions) ? node.actions.length : 0;
  const displayLabel = node.label;
  const hasImage = Boolean(node.imageUrl?.trim());
  const showDescriptionPreview = Boolean(node.description?.trim());

  if (isEditing) {
    const editorW = Math.max(node.width, 232);
    const editorH = Math.max(node.height, 176);
    return (
      <g
        onMouseDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <foreignObject x={node.x} y={node.y} width={editorW} height={editorH}>
          <div
            className={`w-full h-full rounded-lg bg-slate-900 border-2 p-1.5 flex flex-col gap-1 shadow-2xl relative transition-all ${
              isLocalDragOver ? 'border-sky-400 ring-2 ring-sky-400/50 bg-slate-900/95' : ''
            }`}
            style={{ borderColor: isLocalDragOver ? '#38bdf8' : node.color }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = 'copy';
              if (!isLocalDragOver) setIsLocalDragOver(true);
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsLocalDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
              setIsLocalDragOver(false);
            }}
            onDrop={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsLocalDragOver(false);
              setInlineUploadError('');
              try {
                const res = await extractImageFromDataTransfer(e.dataTransfer);
                if (res) {
                  onDraftChange({ imageUrl: res.dataUrl });
                }
              } catch (err) {
                setInlineUploadError(err instanceof Error ? err.message : 'Failed to embed image.');
              }
            }}
          >
            {isLocalDragOver && (
              <div className="absolute inset-0 rounded-lg bg-sky-950/85 backdrop-blur-[1px] flex flex-col items-center justify-center gap-1 z-20 pointer-events-none border-2 border-dashed border-sky-400">
                <span className="text-xl">📥</span>
                <span className="text-xs font-semibold text-sky-200">Drop image to embed</span>
              </div>
            )}
            <input
              ref={titleInputRef}
              type="text"
              value={draftLabel}
              placeholder="Box title..."
              onChange={(e) => onDraftChange({ label: e.target.value })}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onCommitEdit();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  onCancelEdit();
                }
              }}
              className="w-full px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-xs font-semibold text-slate-100 focus:outline-none focus:border-blue-500"
            />
            <textarea
              ref={descInputRef}
              value={draftDescription}
              placeholder="Box content / notes..."
              onChange={(e) => onDraftChange({ description: e.target.value })}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  onCommitEdit();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  onCancelEdit();
                }
              }}
              className="flex-1 w-full px-1.5 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-blue-500 resize-none"
            />
            <input
              ref={inlineFileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => void handleInlineFileChange(e)}
              className="hidden"
            />
            <div className="flex items-center gap-1">
              {isEncodedImageDataUrl(draftImageUrl) ? (
                <div className="flex-1 min-w-0 flex items-center justify-between gap-1 px-1.5 py-0.5 rounded bg-slate-950 border border-emerald-700/70 text-[11px] text-emerald-300">
                  <span className="truncate">
                    Embedded ({formatEncodedSizeKb(draftImageUrl)})
                  </span>
                  <button
                    type="button"
                    onClick={() => onDraftChange({ imageUrl: '' })}
                    className="text-rose-400 hover:underline shrink-0 cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <input
                  type="url"
                  value={draftImageUrl}
                  placeholder="Image URL (https://...)"
                  onChange={(e) => onDraftChange({ imageUrl: e.target.value })}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      onCommitEdit();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      onCancelEdit();
                    }
                  }}
                  className="flex-1 min-w-0 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                />
              )}
              <button
                type="button"
                onClick={() => inlineFileInputRef.current?.click()}
                title="Upload and embed an image file"
                className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[11px] text-slate-200 hover:bg-slate-700 shrink-0 cursor-pointer"
              >
                Upload
              </button>
            </div>
            {inlineUploadError && (
              <div className="text-[11px] text-rose-400 leading-tight">{inlineUploadError}</div>
            )}
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs text-slate-500">Enter / Ctrl+Enter</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={onCancelEdit}
                  className="px-1.5 py-0.5 rounded text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onCommitEdit}
                  className="px-2 py-0.5 rounded bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 cursor-pointer"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </foreignObject>
      </g>
    );
  }

  return (
    <g
      onMouseDown={(e) => onMouseDown(e, node)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        const svg = e.currentTarget.ownerSVGElement;
        const rect = svg?.getBoundingClientRect();
        // If user double-clicked below the title row on a taller box, focus content; otherwise focus title
        const clickRelY = rect ? e.clientY - rect.top : 0;
        const boxTopScreen = e.currentTarget.getBoundingClientRect().top - (rect?.top ?? 0);
        const focusField =
          node.height >= 64 && clickRelY - boxTopScreen > 26 ? 'description' : 'label';
        onStartEdit(node, focusField);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        if (!isNodeDragOver) setIsNodeDragOver(true);
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        setIsNodeDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setIsNodeDragOver(false);
      }}
      onDrop={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsNodeDragOver(false);
        try {
          const res = await extractImageFromDataTransfer(e.dataTransfer);
          if (res && onDropImage) {
            onDropImage(node.id, res.dataUrl);
          }
        } catch {
          // ignore
        }
      }}
      className="group cursor-grab active:cursor-grabbing"
      style={{ opacity: card.dimmed ? 0.38 : 1 }}
    >
      {/* Drag & Drop Target Ring & Overlay */}
      {(isDropTarget || isNodeDragOver) && (
        <>
          <rect
            x={node.x - 6}
            y={node.y - 6}
            width={node.width + 12}
            height={node.height + 12}
            rx={14}
            fill="rgba(56, 189, 248, 0.16)"
            stroke="#38bdf8"
            strokeWidth={2.5}
            strokeDasharray="6 4"
            className="animate-pulse pointer-events-none"
          />
          <g className="pointer-events-none">
            <rect
              x={node.x + Math.max(6, (node.width - 150) / 2)}
              y={node.y + Math.max(4, (node.height - 24) / 2)}
              width={Math.min(node.width - 12, 150)}
              height={24}
              rx={12}
              fill="#0284c7"
              fillOpacity={0.92}
            />
            <text
              x={node.x + node.width / 2}
              y={node.y + Math.max(4, (node.height - 24) / 2) + 16}
              textAnchor="middle"
              fill="#ffffff"
              fontSize={11}
              fontWeight={600}
            >
              📥 Drop image here
            </text>
          </g>
        </>
      )}

      {/* Cardinality Halo */}
      {card.ringColor && (
        <rect
          x={node.x - 5}
          y={node.y - 5}
          width={node.width + 10}
          height={node.height + 10}
          rx={13}
          fill="none"
          stroke={card.ringColor}
          strokeWidth={card.ringWidth}
          strokeDasharray={card.dashed ? '5 3' : undefined}
        />
      )}

      {/* Selection Ring */}
      {selected && (
        <rect
          x={node.x - 7}
          y={node.y - 7}
          width={node.width + 14}
          height={node.height + 14}
          rx={15}
          fill="none"
          stroke="#60a5fa"
          strokeWidth={2}
        />
      )}

      {/* Snap-to-object Target Pulse */}
      {isSnapTarget && (
        <rect
          x={node.x - 6}
          y={node.y - 6}
          width={node.width + 12}
          height={node.height + 12}
          rx={14}
          fill="none"
          stroke="#38bdf8"
          className="snap-pulse"
        />
      )}

      {/* Main Card Box */}
      <rect
        x={node.x}
        y={node.y}
        width={node.width}
        height={node.height}
        rx={10}
        fill="#0f172a"
        stroke={node.color}
        strokeWidth={2}
      />

      {/* Left Accent Strip */}
      <rect x={node.x} y={node.y} width={5} height={node.height} rx={3} fill={node.color} />

      {/* Node Title */}
      <text
        x={node.x + 10}
        y={node.y + 18}
        fill="#f1f5f9"
        fontSize={13}
        fontWeight={600}
      >
        {displayLabel}
      </text>

      {/* Attached Image & Description Content */}
      {(hasImage || showDescriptionPreview) && (
        <foreignObject
          x={node.x + 8}
          y={node.y + 23}
          width={Math.max(40, node.width - 14)}
          height={Math.max(20, node.height - 43)}
          style={{ overflow: hasImage ? 'hidden' : 'visible' }}
          className="pointer-events-none"
        >
          <div className="w-full h-full flex flex-col gap-1">
            {hasImage && (
              <div className="flex-1 min-h-0 w-full flex items-center justify-center rounded bg-slate-950/60 overflow-hidden">
                {imageFailed ? (
                  <span className="text-[11px] text-rose-400 px-1 text-center break-all">
                    ⚠ Image unavailable
                  </span>
                ) : (
                  <img
                    src={node.imageUrl}
                    alt={node.label}
                    onError={() => setImageFailed(true)}
                    className="w-full h-full object-contain"
                  />
                )}
              </div>
            )}
            {showDescriptionPreview && (
              <div className="w-full text-xs text-slate-300/90 leading-snug break-words whitespace-pre-wrap shrink-0">
                {node.description}
              </div>
            )}
          </div>
        </foreignObject>
      )}

      {/* Degree Subtitle */}
      <text x={node.x + 10} y={node.y + node.height - 7} fill="#94a3b8" fontSize={12}>
        In: {degree.incoming} • Out: {degree.outgoing}
        {node.description?.trim() ? ' • 📝' : ''}
        {hasImage ? ' • 🖼' : ''}
      </text>

      {/* Action Link Indicator */}
      {actionsCount > 0 && (
        <g>
          <circle
            cx={node.x + node.width - 12}
            cy={node.y + 12}
            r={7.5}
            fill={node.color}
            fillOpacity={0.22}
          />
          <text
            x={node.x + node.width - 12}
            y={node.y + 16}
            textAnchor="middle"
            fill={node.color}
            fontSize={11}
            fontWeight={700}
          >
            ⚡
          </text>
        </g>
      )}

      {/* Bottom-Right Resize Handle */}
      <g
        onMouseDown={(e) => {
          e.stopPropagation();
          onResizeMouseDown(e, node);
        }}
        className={`cursor-nwse-resize transition-opacity ${
          selected ? 'opacity-100' : 'opacity-30 group-hover:opacity-100'
        }`}
      >
        <rect
          x={node.x + node.width - 16}
          y={node.y + node.height - 16}
          width={16}
          height={16}
          fill="transparent"
        />
        <line
          x1={node.x + node.width - 11}
          y1={node.y + node.height - 4}
          x2={node.x + node.width - 4}
          y2={node.y + node.height - 11}
          stroke={selected ? '#60a5fa' : '#94a3b8'}
          strokeWidth={1.75}
          strokeLinecap="round"
        />
        <line
          x1={node.x + node.width - 7}
          y1={node.y + node.height - 4}
          x2={node.x + node.width - 4}
          y2={node.y + node.height - 7}
          stroke={selected ? '#60a5fa' : '#94a3b8'}
          strokeWidth={1.75}
          strokeLinecap="round"
        />
      </g>

      {/* Ghost Edge Targets to relocate the selected INPUT/OUTPUT annotation badge directly on canvas */}
      {selectedPort &&
        ALL_PORT_SIDES
          .filter(
            (side) =>
              side !== (selectedPort === 'input' ? getInputPortSide(node) : getOutputPortSide(node))
          )
          .map((side) => {
            const targetPt = getEdgeAnchorPoint(node, side);
            const stroke = selectedPort === 'input' ? '#10b981' : '#38bdf8';
            return (
              <g
                key={`move-${selectedPort}-${side}`}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onChangePortSide(node.id, selectedPort, side);
                }}
                className="cursor-pointer opacity-80 hover:opacity-100"
              >
                <title>{`Move ${selectedPort.toUpperCase()} port badge to ${side}`}</title>
                <circle cx={targetPt.x} cy={targetPt.y} r={11} fill="transparent" />
                <circle
                  cx={targetPt.x}
                  cy={targetPt.y}
                  r={PORT_RADIUS + 2}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={1.75}
                  strokeDasharray="2.5 2"
                />
              </g>
            );
          })}

      {/* All 4 Edge Connection Anchors (Left, Top, Right, Bottom — any can send or receive) */}
      {ALL_PORT_SIDES.map((side) => {
        const pt = getEdgeAnchorPoint(node, side);
        const inSide = getInputPortSide(node);
        const outSide = getOutputPortSide(node);
        const isInSide = side === inSide;
        const isOutSide = side === outSide;
        const isSnapAnchor = snapTargetSide === side;
        const isSelectedAnchor =
          (selectedPort === 'input' && isInSide) || (selectedPort === 'output' && isOutSide);
        const isHighlighted = isSnapAnchor || isSelectedAnchor;

        const inMeta = node.inputPort;
        const outMeta = node.outputPort;
        const showInBadge =
          isInSide &&
          (Boolean(inMeta?.label?.trim()) ||
            Boolean(inMeta?.description?.trim()) ||
            (inMeta?.actions?.length ?? 0) > 0);
        const showOutBadge =
          isOutSide &&
          (Boolean(outMeta?.label?.trim()) ||
            Boolean(outMeta?.description?.trim()) ||
            (outMeta?.actions?.length ?? 0) > 0);

        const formatBadge = (meta: typeof inMeta) =>
          [meta?.label?.trim() || '', meta?.actions?.length ? '⚡' : ''].filter(Boolean).join(' ') ||
          '📝';

        const badgePos =
          side === 'left'
            ? { x: pt.x - 10, y: pt.y - 9, anchor: 'end' as const }
            : side === 'right'
              ? { x: pt.x + 10, y: pt.y - 9, anchor: 'start' as const }
              : side === 'top'
                ? { x: pt.x, y: pt.y - 11, anchor: 'middle' as const }
                : { x: pt.x, y: pt.y + 19, anchor: 'middle' as const };

        const ringStroke = isSnapAnchor
          ? '#38bdf8'
          : isInSide
            ? '#10b981'
            : isOutSide
              ? '#e2e8f0'
              : '#64748b';
        const dotFill = isOutSide ? node.color : '#0f172a';
        const visibilityClass =
          isHighlighted || isInSide || isOutSide || isDrawingLine || selected
            ? 'opacity-100'
            : 'opacity-65 group-hover:opacity-100';

        return (
          <g
            key={side}
            onMouseDown={(e) => {
              e.stopPropagation();
              onAnchorMouseDown(e, node, side);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (isInSide) onSelectPort(node.id, 'input');
              else if (isOutSide) onSelectPort(node.id, 'output');
            }}
            className={`cursor-crosshair transition-opacity ${visibilityClass}`}
          >
            <title>
              {`Connection point (${side})${isInSide && inMeta?.label ? ` • IN: ${inMeta.label}` : ''}${isOutSide && outMeta?.label ? ` • OUT: ${outMeta.label}` : ''} — drag to connect any box & side`}
            </title>
            <circle cx={pt.x} cy={pt.y} r={12} fill="transparent" />
            {isHighlighted && (
              <circle
                cx={pt.x}
                cy={pt.y}
                r={PORT_RADIUS + 4}
                fill="none"
                stroke={isSnapAnchor ? '#38bdf8' : isInSide ? '#10b981' : '#38bdf8'}
                strokeWidth={2.5}
              />
            )}
            <circle
              cx={pt.x}
              cy={pt.y}
              r={isInSide || isOutSide || isSnapAnchor ? PORT_RADIUS : 5}
              fill={dotFill}
              stroke={ringStroke}
              strokeWidth={isInSide || isOutSide ? 2 : 1.5}
            />
            {isInSide && <circle cx={pt.x} cy={pt.y} r={2} fill="#10b981" />}
            {showInBadge && (
              <text
                x={badgePos.x}
                y={badgePos.y}
                textAnchor={badgePos.anchor}
                fill="#6ee7b7"
                fontSize={12}
                fontWeight={500}
              >
                {formatBadge(inMeta)}
              </text>
            )}
            {showOutBadge && (
              <text
                x={badgePos.x}
                y={showInBadge ? badgePos.y + 14 : badgePos.y}
                textAnchor={badgePos.anchor}
                fill="#93c5fd"
                fontSize={12}
                fontWeight={500}
              >
                {formatBadge(outMeta)}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}
