import { useEffect, useRef } from 'react';
import type { IdeaNode as IdeaNodeType } from '../../types/brainflow';

interface GroupNodeProps {
  group: IdeaNodeType;
  containedIdeas: IdeaNodeType[];
  selected: boolean;
  isEditing: boolean;
  editFocusField?: 'label' | 'description';
  draftLabel: string;
  draftDescription: string;
  onMouseDown: (e: React.MouseEvent<SVGGElement>, node: IdeaNodeType) => void;
  onResizeMouseDown: (e: React.MouseEvent<SVGGElement>, node: IdeaNodeType) => void;
  onStartEdit: (node: IdeaNodeType, focusField: 'label' | 'description') => void;
  onDraftChange: (patch: { label?: string; description?: string }) => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onSelectIdea: (ideaId: number) => void;
}

export function GroupNode({
  group,
  containedIdeas,
  selected,
  isEditing,
  editFocusField,
  draftLabel,
  draftDescription,
  onMouseDown,
  onResizeMouseDown,
  onStartEdit,
  onDraftChange,
  onCommitEdit,
  onCancelEdit,
  onSelectIdea,
}: GroupNodeProps) {
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const descInputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (isEditing) {
      if (editFocusField === 'description') {
        descInputRef.current?.focus();
        descInputRef.current?.select();
      } else {
        titleInputRef.current?.focus();
        titleInputRef.current?.select();
      }
    }
  }, [isEditing, editFocusField]);

  const editorW = Math.max(group.width, 280);
  const editorH = Math.max(group.height, 160);

  if (isEditing) {
    return (
      <g
        onMouseDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <foreignObject x={group.x} y={group.y} width={editorW} height={editorH}>
          <div
            className="w-full h-full rounded-2xl bg-slate-900/95 border-2 flex flex-col shadow-2xl overflow-hidden relative"
            style={{ borderColor: group.color }}
          >
            {/* Top row strictly matching presentation header layout: Icon on left, Title input immediately to the right */}
            <div
              className="flex items-center gap-2 pl-3 pr-3 pt-2 pb-1.5 shrink-0"
              style={{ backgroundColor: `${group.color}15` }}
            >
              {/* Group Icon / Tag */}
              <div
                className="h-[20px] px-2 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold tracking-wider uppercase select-none"
                style={{ backgroundColor: `${group.color}35`, color: group.color }}
              >
                🗂 GROUP
              </div>

              {/* Title input positioned directly to the right after the icon */}
              <input
                ref={titleInputRef}
                type="text"
                value={draftLabel}
                placeholder="Group Title..."
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
                className="flex-1 min-w-0 px-2 py-0.5 rounded bg-slate-950/90 border border-slate-700 text-sm font-bold text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />

              {/* Contained count badge */}
              <div className="shrink-0 px-2 py-0.5 rounded-full bg-slate-950/90 border border-slate-800 text-[10px] font-semibold text-slate-400 select-none">
                {containedIdeas.length} idea{containedIdeas.length === 1 ? '' : 's'}
              </div>
            </div>

            {/* Contents / Description / Notes editing area */}
            <div className="flex-1 flex flex-col min-h-0 px-3 py-2 gap-1">
              <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">
                Group Notes &amp; Description
              </label>
              <textarea
                ref={descInputRef}
                value={draftDescription}
                placeholder="Describe this group of ideas..."
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
                className="flex-1 w-full p-2.5 rounded-lg bg-slate-950/90 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none font-normal"
              />
            </div>

            {/* Compact Footer Bar */}
            <div className="flex items-center justify-between px-3 py-1.5 border-t border-slate-800/80 text-[11px] shrink-0 bg-slate-950/70">
              <span className="text-[10px] text-slate-500">
                Enter to save title • Ctrl+Enter for notes • Esc to cancel
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onCancelEdit}
                  className="px-2.5 py-1 rounded text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onCommitEdit}
                  className="px-3 py-1 rounded bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500 shadow-sm cursor-pointer transition-colors"
                >
                  Save Group
                </button>
              </div>
            </div>
          </div>
        </foreignObject>
      </g>
    );
  }

  const listHeight = Math.min(48, Math.max(30, group.height * 0.18));
  const hasDescription = Boolean(group.description?.trim());

  return (
    <g
      onMouseDown={(e) => onMouseDown(e, group)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onStartEdit(group, 'label');
      }}
      className="group cursor-grab active:cursor-grabbing select-none"
    >
      {/* Selection Halo */}
      {selected && (
        <rect
          x={group.x - 7}
          y={group.y - 7}
          width={group.width + 14}
          height={group.height + 14}
          rx={21}
          fill="none"
          stroke="#60a5fa"
          strokeWidth={2}
        />
      )}

      {/* Main Group Container - Translucent and Placed Behind Other Ideas */}
      <rect
        x={group.x}
        y={group.y}
        width={group.width}
        height={group.height}
        rx={16}
        fill="#090d16"
        fillOpacity={0.82}
        stroke={group.color}
        strokeWidth={2}
        strokeDasharray="6 4"
      />

      {/* Subtle Tint Background */}
      <rect
        x={group.x + 2}
        y={group.y + 2}
        width={group.width - 4}
        height={group.height - 4}
        rx={14}
        fill={group.color}
        fillOpacity={0.06}
        className="pointer-events-none"
      />

      {/* Header Bar Area */}
      <rect
        x={group.x}
        y={group.y}
        width={group.width}
        height={hasDescription ? 54 : 38}
        rx={16}
        fill={group.color}
        fillOpacity={0.14}
        className="pointer-events-none"
      />

      {/* Group Pill Tag */}
      <rect
        x={group.x + 12}
        y={group.y + 10}
        width={64}
        height={18}
        rx={9}
        fill={group.color}
        fillOpacity={0.25}
        className="pointer-events-none"
      />
      <text
        x={group.x + 44}
        y={group.y + 22.5}
        textAnchor="middle"
        fill={group.color}
        fontSize={10}
        fontWeight={700}
        letterSpacing="0.05em"
        className="pointer-events-none"
      >
        🗂 GROUP
      </text>

      {/* Group Title */}
      <text
        x={group.x + 84}
        y={group.y + 23}
        fill="#f8fafc"
        fontSize={14}
        fontWeight={700}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onStartEdit(group, 'label');
        }}
        className="cursor-text"
      >
        {group.label}
      </text>

      {/* Contained Ideas Counter Badge */}
      <g className="pointer-events-none">
        <rect
          x={group.x + group.width - 86}
          y={group.y + 10}
          width={74}
          height={18}
          rx={9}
          fill="#1e293b"
          fillOpacity={0.9}
        />
        <text
          x={group.x + group.width - 49}
          y={group.y + 22}
          textAnchor="middle"
          fill="#94a3b8"
          fontSize={10}
          fontWeight={600}
        >
          {containedIdeas.length} idea{containedIdeas.length === 1 ? '' : 's'}
        </text>
      </g>

      {/* Group Description / Notes */}
      {hasDescription && (
        <text
          x={group.x + 14}
          y={group.y + 44}
          fill="#cbd5e1"
          fontSize={11}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onStartEdit(group, 'description');
          }}
          className="cursor-text"
        >
          {group.description.length > 80
            ? `${group.description.slice(0, 77)}...`
            : group.description}
        </text>
      )}

      {/* Contained Ideas Listing Bar at bottom of group */}
      <foreignObject
        x={group.x + 10}
        y={group.y + group.height - listHeight - 8}
        width={Math.max(60, group.width - 20)}
        height={listHeight}
      >
        <div
          className="w-full h-full rounded-lg bg-slate-950/80 border border-slate-800/80 px-2 py-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar shadow-inner"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <span className="text-[10px] font-semibold text-slate-400 shrink-0 uppercase tracking-wider flex items-center gap-1">
            <span>Inside:</span>
          </span>

          {containedIdeas.length === 0 ? (
            <span className="text-[11px] text-slate-500 italic truncate">
              No ideas inside yet — drag idea boxes into this box to group them
            </span>
          ) : (
            containedIdeas.map((idea) => (
              <button
                key={idea.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectIdea(idea.id);
                }}
                title={`Select idea: ${idea.label}`}
                className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700/80 text-[11px] text-slate-200 hover:border-blue-400 hover:text-white transition-colors cursor-pointer"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: idea.color }}
                />
                <span className="truncate max-w-[110px] font-medium">{idea.label}</span>
              </button>
            ))
          )}
        </div>
      </foreignObject>

      {/* Bottom-Right Resize Handle */}
      <g
        onMouseDown={(e) => {
          e.stopPropagation();
          onResizeMouseDown(e, group);
        }}
        className={`cursor-nwse-resize transition-opacity ${
          selected ? 'opacity-100' : 'opacity-40 group-hover:opacity-100'
        }`}
      >
        <rect
          x={group.x + group.width - 18}
          y={group.y + group.height - 18}
          width={18}
          height={18}
          fill="transparent"
        />
        <line
          x1={group.x + group.width - 12}
          y1={group.y + group.height - 4}
          x2={group.x + group.width - 4}
          y2={group.y + group.height - 12}
          stroke={selected ? '#60a5fa' : group.color}
          strokeWidth={2}
          strokeLinecap="round"
        />
        <line
          x1={group.x + group.width - 7}
          y1={group.y + group.height - 4}
          x2={group.x + group.width - 4}
          y2={group.y + group.height - 7}
          stroke={selected ? '#60a5fa' : group.color}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </g>
    </g>
  );
}
