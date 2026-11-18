import { useEffect, useRef, useState } from 'react';
import type {
  CardinalityMode,
  DrawingTool,
  IdeaConnection,
  IdeaDetail,
  IdeaNode as IdeaNodeType,
  PortSide,
  Selection,
} from '../../types/brainflow';
import type { NodeDegree } from '../../utils/cardinality';
import {
  buildConnectionCurve,
  buildParallelConnectionCurves,
  clientToCanvas,
  findNodeAtPoint,
  findPortSnapTarget,
  getContainedIdeas,
  getEdgeAnchorPoint,
  getInputPortSide,
  getNearestSideOnNode,
  getOutputPortSide,
  getPortRimPoint,
  isNodeInsideGroup,
  type Point,
} from '../../utils/geometry';
import { COLOR_PALETTE } from '../layout/Toolbar';
import { encodeImageFile, extractImageFromDataTransfer } from '../../utils/imageEncoding';
import { DirectedEdge } from './DirectedEdge';
import { GroupNode } from './GroupNode';
import { IdeaNode } from './IdeaNode';

interface DrawingCanvasProps {
  idea: IdeaDetail | null;
  tool: DrawingTool;
  activeColor: string;
  cardinalityMode: CardinalityMode;
  degrees: Record<number, NodeDegree>;
  selection: Selection;
  zoom: number;
  pan: Point;
  onPanChange: (pan: Point) => void;
  onWheelZoom: (delta: number, center: Point) => void;
  onSelect: (selection: Selection) => void;
  onCreateNode: (
    x: number,
    y: number,
    options?: {
      label?: string;
      imageUrl?: string;
      width?: number;
      height?: number;
      isGroup?: boolean;
      color?: string;
      groupNodeIds?: number[];
    }
  ) => void;
  onMoveNodeLocal: (nodeId: number, x: number, y: number) => void;
  onCommitNodePosition: (nodeId: number, x: number, y: number) => void;
  onResizeNodeLocal: (nodeId: number, width: number, height: number) => void;
  onCommitNodeSize: (nodeId: number, width: number, height: number) => void;
  onUpdateNodeInline: (
    nodeId: number,
    patch: Partial<IdeaNodeType>
  ) => void;
  onChangePortSide: (nodeId: number, port: 'input' | 'output', side: PortSide) => void;
  onMoveEdgeLabelLocal: (connectionId: number, labelOffsetX: number, labelOffsetY: number) => void;
  onResizeEdgeLabelLocal: (connectionId: number, labelWidth: number, labelHeight: number) => void;
  onCommitEdgeLabelLayout: (
    connectionId: number,
    patch: { labelOffsetX?: number; labelOffsetY?: number; labelWidth?: number; labelHeight?: number }
  ) => void;
  onUpdateConnectionInline: (
    connectionId: number,
    patch: { label: string; color: string; bidirectional: boolean }
  ) => void;
  onMoveEdgeEndpointLocal: (connectionId: number, end: 'from' | 'to', side: PortSide) => void;
  onCommitEdgeEndpoint: (connectionId: number, end: 'from' | 'to', side: PortSide) => void;
  onDeleteConnection: (connectionId: number) => void;
  onCreateConnection: (
    fromNodeId: number,
    toNodeId: number,
    fromSide: PortSide,
    toSide: PortSide,
    bidirectional: boolean
  ) => void;
}

const MIN_NODE_WIDTH = 120;
const MIN_NODE_HEIGHT = 56;
const MIN_LABEL_WIDTH = 60;
const MIN_LABEL_HEIGHT = 22;

type DragState =
  | { mode: 'move-node'; nodeId: number; offsetX: number; offsetY: number; lastX: number; lastY: number }
  | {
      mode: 'move-group';
      nodeId: number;
      offsetX: number;
      offsetY: number;
      lastX: number;
      lastY: number;
      contained: { id: number; offsetX: number; offsetY: number }[];
    }
  | {
      mode: 'resize-node';
      nodeId: number;
      startMouseX: number;
      startMouseY: number;
      startW: number;
      startH: number;
      lastW: number;
      lastH: number;
    }
  | {
      mode: 'move-edge-label';
      connectionId: number;
      startMouseX: number;
      startMouseY: number;
      startOffsetX: number;
      startOffsetY: number;
      lastOffsetX: number;
      lastOffsetY: number;
    }
  | {
      mode: 'resize-edge-label';
      connectionId: number;
      startMouseX: number;
      startMouseY: number;
      startW: number;
      startH: number;
      lastW: number;
      lastH: number;
    }
  | { mode: 'pan'; startX: number; startY: number }
  | {
      mode: 'draw-line';
      fromNode: IdeaNodeType;
      startSide: PortSide;
      autoStartSide: boolean;
      startPt: Point;
      hasDragged: boolean;
      currentPt: Point;
      snapTarget: { node: IdeaNodeType; side: PortSide } | null;
    }
  | {
      mode: 'reconnect-edge';
      connectionId: number;
      end: 'from' | 'to';
      anchorNode: IdeaNodeType;
      startSide: PortSide;
      lastSide: PortSide;
    }
  | null;

export function DrawingCanvas({
  idea,
  tool,
  activeColor,
  cardinalityMode,
  degrees,
  selection,
  zoom,
  pan,
  onPanChange,
  onWheelZoom,
  onSelect,
  onCreateNode,
  onMoveNodeLocal,
  onCommitNodePosition,
  onResizeNodeLocal,
  onCommitNodeSize,
  onUpdateNodeInline,
  onChangePortSide,
  onMoveEdgeLabelLocal,
  onResizeEdgeLabelLocal,
  onCommitEdgeLabelLayout,
  onUpdateConnectionInline,
  onMoveEdgeEndpointLocal,
  onCommitEdgeEndpoint,
  onDeleteConnection,
  onCreateConnection,
}: DrawingCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragState, setDragState] = useState<DragState>(null);
  const [editingDraft, setEditingDraft] = useState<{
    nodeId: number;
    label: string;
    description: string;
    imageUrl: string;
    focusField: 'label' | 'description';
  } | null>(null);
  const [editingEdgeDraft, setEditingEdgeDraft] = useState<{
    connectionId: number;
    label: string;
    color: string;
    bidirectional: boolean;
  } | null>(null);
  const [dropTargetNodeId, setDropTargetNodeId] = useState<number | null>(null);

  function handleDropImageOnNode(nodeId: number, imageUrl: string) {
    if (editingDraft && editingDraft.nodeId === nodeId) {
      setEditingDraft((prev) => (prev ? { ...prev, imageUrl } : null));
    } else {
      const target = idea?.nodes.find((n) => n.id === nodeId);
      const newWidth = target ? Math.max(target.width, 220) : 220;
      const newHeight = target ? Math.max(target.height, 160) : 160;
      onUpdateNodeInline(nodeId, {
        imageUrl,
        width: newWidth,
        height: newHeight,
      });
    }
    onSelect({ type: 'node', id: nodeId });
  }

  useEffect(() => {
    setEditingDraft(null);
    setEditingEdgeDraft(null);
  }, [idea?.id]);

  function syncGroupContainment() {
    if (!idea) return;
    const groups = idea.nodes.filter((n) => n.isGroup);
    if (groups.length === 0) return;
    for (const group of groups) {
      const currentContainedIds = idea.nodes
        .filter((n) => !n.isGroup && isNodeInsideGroup(n, group))
        .map((n) => n.id)
        .sort((a, b) => a - b);
      const existingIds = (group.groupNodeIds ?? []).slice().sort((a, b) => a - b);
      const isDifferent =
        currentContainedIds.length !== existingIds.length ||
        currentContainedIds.some((id, idx) => id !== existingIds[idx]);
      if (isDifferent) {
        onUpdateNodeInline(group.id, { groupNodeIds: currentContainedIds });
      }
    }
  }

  function commitInlineEdit() {
    if (!editingDraft) return;
    const trimmedLabel = editingDraft.label.trim();
    onUpdateNodeInline(editingDraft.nodeId, {
      label: trimmedLabel || 'Untitled',
      description: editingDraft.description,
      imageUrl: editingDraft.imageUrl.trim(),
    });
    setEditingDraft(null);
  }

  function commitEdgeInlineEdit() {
    if (!editingEdgeDraft) return;
    onUpdateConnectionInline(editingEdgeDraft.connectionId, {
      label: editingEdgeDraft.label.trim() || 'connects',
      color: editingEdgeDraft.color,
      bidirectional: editingEdgeDraft.bidirectional,
    });
    setEditingEdgeDraft(null);
  }

  // Use a non-passive native wheel listener so zoom anchors cleanly at the mouse cursor
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    function onNativeWheel(e: WheelEvent) {
      e.preventDefault();
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const delta = e.deltaY < 0 ? 0.12 : -0.12;
      onWheelZoom(delta, {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }

    svg.addEventListener('wheel', onNativeWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onNativeWheel);
  }, [idea?.id, onWheelZoom]);

  if (!idea) {
    return (
      <main className="flex-1 canvas-grid flex items-center justify-center text-sm text-slate-400">
        Select or create a Project & Idea from the left sidebar to begin drawing.
      </main>
    );
  }

  function handleCanvasMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current || !idea) return;
    if (editingDraft) {
      commitInlineEdit();
    }
    if (editingEdgeDraft) {
      commitEdgeInlineEdit();
    }
    const pt = clientToCanvas(svgRef.current, e.clientX, e.clientY, pan, zoom);

    if (tool === 'box') {
      onCreateNode(Math.round(pt.x - 78), Math.round(pt.y - 34));
      return;
    }

    if (tool === 'group') {
      const groupX = Math.round(pt.x - 180);
      const groupY = Math.round(pt.y - 120);
      const groupW = 360;
      const groupH = 240;
      const containedIds = idea.nodes
        .filter(
          (n) =>
            !n.isGroup &&
            n.x + n.width / 2 >= groupX &&
            n.x + n.width / 2 <= groupX + groupW &&
            n.y + n.height / 2 >= groupY &&
            n.y + n.height / 2 <= groupY + groupH
        )
        .map((n) => n.id);

      onCreateNode(groupX, groupY, {
        isGroup: true,
        label: `Group ${idea.nodes.filter((n) => n.isGroup).length + 1}`,
        width: groupW,
        height: groupH,
        color: activeColor || '#8b5cf6',
        groupNodeIds: containedIds,
      });
      return;
    }

    if (tool === 'line' || tool === 'bidirectional') {
      const startNode = findNodeAtPoint(idea.nodes, pt.x, pt.y, 12);
      if (startNode) {
        setDragState({
          mode: 'draw-line',
          fromNode: startNode,
          startSide: getNearestSideOnNode(startNode, pt.x, pt.y),
          autoStartSide: true,
          startPt: pt,
          hasDragged: true,
          currentPt: pt,
          snapTarget: null,
        });
        return;
      }
    }

    onSelect(null);
    setDragState({
      mode: 'pan',
      startX: e.clientX - pan.x,
      startY: e.clientY - pan.y,
    });
  }

  function handleNodeMouseDown(e: React.MouseEvent<SVGGElement>, node: IdeaNodeType) {
    e.stopPropagation();
    if (!svgRef.current || !idea) return;
    if (editingDraft && editingDraft.nodeId !== node.id) {
      commitInlineEdit();
    }
    if (editingEdgeDraft) {
      commitEdgeInlineEdit();
    }
    const pt = clientToCanvas(svgRef.current, e.clientX, e.clientY, pan, zoom);

    if (tool === 'line' || tool === 'bidirectional') {
      setDragState({
        mode: 'draw-line',
        fromNode: node,
        startSide: 'right',
        autoStartSide: true,
        startPt: pt,
        hasDragged: true,
        currentPt: pt,
        snapTarget: null,
      });
      return;
    }

    onSelect({ type: 'node', id: node.id });

    if (node.isGroup) {
      const contained = idea.nodes.filter((n) => !n.isGroup && isNodeInsideGroup(n, node));
      const containedOffsets = contained.map((c) => ({
        id: c.id,
        offsetX: c.x - node.x,
        offsetY: c.y - node.y,
      }));
      setDragState({
        mode: 'move-group',
        nodeId: node.id,
        offsetX: pt.x - node.x,
        offsetY: pt.y - node.y,
        lastX: node.x,
        lastY: node.y,
        contained: containedOffsets,
      });
      return;
    }

    setDragState({
      mode: 'move-node',
      nodeId: node.id,
      offsetX: pt.x - node.x,
      offsetY: pt.y - node.y,
      lastX: node.x,
      lastY: node.y,
    });
  }

  function handleAnchorMouseDown(
    e: React.MouseEvent<SVGGElement>,
    node: IdeaNodeType,
    side: PortSide
  ) {
    e.stopPropagation();
    if (!svgRef.current) return;
    if (editingDraft) {
      commitInlineEdit();
    }
    if (editingEdgeDraft) {
      commitEdgeInlineEdit();
    }
    const pt = clientToCanvas(svgRef.current, e.clientX, e.clientY, pan, zoom);
    setDragState({
      mode: 'draw-line',
      fromNode: node,
      startSide: side,
      autoStartSide: false,
      startPt: pt,
      hasDragged: false,
      currentPt: pt,
      snapTarget: null,
    });
  }

  function handleEdgeEndpointMouseDown(
    e: React.MouseEvent<SVGGElement>,
    conn: IdeaConnection,
    end: 'from' | 'to'
  ) {
    e.stopPropagation();
    if (!idea) return;
    const anchorNodeId = end === 'from' ? conn.fromNodeId : conn.toNodeId;
    const anchorNode = idea.nodes.find((n) => n.id === anchorNodeId);
    if (!anchorNode) return;
    const startSide =
      end === 'from'
        ? (conn.fromSide ?? getOutputPortSide(anchorNode))
        : (conn.toSide ?? getInputPortSide(anchorNode));
    onSelect({ type: 'connection', id: conn.id });
    setDragState({
      mode: 'reconnect-edge',
      connectionId: conn.id,
      end,
      anchorNode,
      startSide,
      lastSide: startSide,
    });
  }

  function handleNodeResizeMouseDown(e: React.MouseEvent<SVGGElement>, node: IdeaNodeType) {
    e.stopPropagation();
    if (!svgRef.current) return;
    const pt = clientToCanvas(svgRef.current, e.clientX, e.clientY, pan, zoom);
    onSelect({ type: 'node', id: node.id });
    setDragState({
      mode: 'resize-node',
      nodeId: node.id,
      startMouseX: pt.x,
      startMouseY: pt.y,
      startW: node.width,
      startH: node.height,
      lastW: node.width,
      lastH: node.height,
    });
  }

  function handleEdgeLabelMouseDown(e: React.MouseEvent<SVGGElement>, conn: IdeaConnection) {
    e.stopPropagation();
    if (!svgRef.current) return;
    if (editingDraft) commitInlineEdit();
    if (editingEdgeDraft && editingEdgeDraft.connectionId !== conn.id) {
      commitEdgeInlineEdit();
    }
    const pt = clientToCanvas(svgRef.current, e.clientX, e.clientY, pan, zoom);
    const startOffsetX = conn.labelOffsetX ?? 0;
    const startOffsetY = conn.labelOffsetY ?? 0;
    onSelect({ type: 'connection', id: conn.id });
    setDragState({
      mode: 'move-edge-label',
      connectionId: conn.id,
      startMouseX: pt.x,
      startMouseY: pt.y,
      startOffsetX,
      startOffsetY,
      lastOffsetX: startOffsetX,
      lastOffsetY: startOffsetY,
    });
  }

  function handleEdgeLabelResizeMouseDown(
    e: React.MouseEvent<SVGGElement>,
    conn: IdeaConnection
  ) {
    e.stopPropagation();
    if (!svgRef.current) return;
    if (editingDraft) commitInlineEdit();
    if (editingEdgeDraft && editingEdgeDraft.connectionId !== conn.id) {
      commitEdgeInlineEdit();
    }
    const pt = clientToCanvas(svgRef.current, e.clientX, e.clientY, pan, zoom);
    const startW = Math.max(40, conn.labelWidth ?? 96);
    const startH = Math.max(20, conn.labelHeight ?? 24);
    onSelect({ type: 'connection', id: conn.id });
    setDragState({
      mode: 'resize-edge-label',
      connectionId: conn.id,
      startMouseX: pt.x,
      startMouseY: pt.y,
      startW,
      startH,
      lastW: startW,
      lastH: startH,
    });
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!dragState || !svgRef.current || !idea) return;

    if (dragState.mode === 'move-node') {
      const pt = clientToCanvas(svgRef.current, e.clientX, e.clientY, pan, zoom);
      const nextX = Math.round(pt.x - dragState.offsetX);
      const nextY = Math.round(pt.y - dragState.offsetY);
      setDragState({ ...dragState, lastX: nextX, lastY: nextY });
      onMoveNodeLocal(dragState.nodeId, nextX, nextY);
      return;
    }

    if (dragState.mode === 'move-group') {
      const pt = clientToCanvas(svgRef.current, e.clientX, e.clientY, pan, zoom);
      const nextX = Math.round(pt.x - dragState.offsetX);
      const nextY = Math.round(pt.y - dragState.offsetY);
      setDragState({ ...dragState, lastX: nextX, lastY: nextY });
      onMoveNodeLocal(dragState.nodeId, nextX, nextY);
      for (const c of dragState.contained) {
        onMoveNodeLocal(c.id, nextX + c.offsetX, nextY + c.offsetY);
      }
      return;
    }

    if (dragState.mode === 'resize-node') {
      const pt = clientToCanvas(svgRef.current, e.clientX, e.clientY, pan, zoom);
      const nextW = Math.max(MIN_NODE_WIDTH, Math.round(dragState.startW + (pt.x - dragState.startMouseX)));
      const nextH = Math.max(MIN_NODE_HEIGHT, Math.round(dragState.startH + (pt.y - dragState.startMouseY)));
      setDragState({ ...dragState, lastW: nextW, lastH: nextH });
      onResizeNodeLocal(dragState.nodeId, nextW, nextH);
      return;
    }

    if (dragState.mode === 'move-edge-label') {
      const pt = clientToCanvas(svgRef.current, e.clientX, e.clientY, pan, zoom);
      const nextOffsetX = Math.round(dragState.startOffsetX + (pt.x - dragState.startMouseX));
      const nextOffsetY = Math.round(dragState.startOffsetY + (pt.y - dragState.startMouseY));
      setDragState({ ...dragState, lastOffsetX: nextOffsetX, lastOffsetY: nextOffsetY });
      onMoveEdgeLabelLocal(dragState.connectionId, nextOffsetX, nextOffsetY);
      return;
    }

    if (dragState.mode === 'resize-edge-label') {
      const pt = clientToCanvas(svgRef.current, e.clientX, e.clientY, pan, zoom);
      const nextW = Math.max(
        MIN_LABEL_WIDTH,
        Math.round(dragState.startW + (pt.x - dragState.startMouseX) * 2)
      );
      const nextH = Math.max(
        MIN_LABEL_HEIGHT,
        Math.round(dragState.startH + (pt.y - dragState.startMouseY) * 2)
      );
      setDragState({ ...dragState, lastW: nextW, lastH: nextH });
      onResizeEdgeLabelLocal(dragState.connectionId, nextW, nextH);
      return;
    }

    if (dragState.mode === 'pan') {
      onPanChange({
        x: e.clientX - dragState.startX,
        y: e.clientY - dragState.startY,
      });
      return;
    }

    if (dragState.mode === 'reconnect-edge') {
      const pt = clientToCanvas(svgRef.current, e.clientX, e.clientY, pan, zoom);
      const nextSide = getNearestSideOnNode(dragState.anchorNode, pt.x, pt.y);
      if (nextSide !== dragState.lastSide) {
        setDragState({ ...dragState, lastSide: nextSide });
        onMoveEdgeEndpointLocal(dragState.connectionId, dragState.end, nextSide);
      }
      return;
    }

    if (dragState.mode === 'draw-line') {
      const pt = clientToCanvas(svgRef.current, e.clientX, e.clientY, pan, zoom);
      const distSq =
        (pt.x - dragState.startPt.x) ** 2 + (pt.y - dragState.startPt.y) ** 2;
      const hasDragged = dragState.hasDragged || distSq >= 25;
      const snapTarget = hasDragged
        ? findPortSnapTarget(idea.nodes, pt.x, pt.y, dragState.fromNode.id)
        : null;
      const targetPt = snapTarget ? getEdgeAnchorPoint(snapTarget.node, snapTarget.side) : pt;
      const startSide =
        dragState.autoStartSide && hasDragged
          ? getNearestSideOnNode(dragState.fromNode, targetPt.x, targetPt.y)
          : dragState.startSide;
      setDragState({ ...dragState, hasDragged, startSide, currentPt: pt, snapTarget });
    }
  }

  function handleMouseUp() {
    if (!dragState) return;

    if (dragState.mode === 'move-node') {
      onCommitNodePosition(dragState.nodeId, dragState.lastX, dragState.lastY);
      syncGroupContainment();
    } else if (dragState.mode === 'move-group') {
      onCommitNodePosition(dragState.nodeId, dragState.lastX, dragState.lastY);
      for (const c of dragState.contained) {
        onCommitNodePosition(c.id, dragState.lastX + c.offsetX, dragState.lastY + c.offsetY);
      }
      syncGroupContainment();
    } else if (dragState.mode === 'resize-node') {
      onCommitNodeSize(dragState.nodeId, dragState.lastW, dragState.lastH);
      syncGroupContainment();
    } else if (dragState.mode === 'move-edge-label') {
      if (
        dragState.lastOffsetX !== dragState.startOffsetX ||
        dragState.lastOffsetY !== dragState.startOffsetY
      ) {
        onCommitEdgeLabelLayout(dragState.connectionId, {
          labelOffsetX: dragState.lastOffsetX,
          labelOffsetY: dragState.lastOffsetY,
        });
      }
    } else if (dragState.mode === 'resize-edge-label') {
      if (dragState.lastW !== dragState.startW || dragState.lastH !== dragState.startH) {
        onCommitEdgeLabelLayout(dragState.connectionId, {
          labelWidth: dragState.lastW,
          labelHeight: dragState.lastH,
        });
      }
    } else if (dragState.mode === 'reconnect-edge') {
      if (dragState.lastSide !== dragState.startSide) {
        onCommitEdgeEndpoint(dragState.connectionId, dragState.end, dragState.lastSide);
      }
    } else if (dragState.mode === 'draw-line') {
      if (!dragState.hasDragged) {
        const inSide = getInputPortSide(dragState.fromNode);
        const outSide = getOutputPortSide(dragState.fromNode);
        if (dragState.startSide === inSide) {
          onSelect({ type: 'port', nodeId: dragState.fromNode.id, port: 'input' });
        } else if (dragState.startSide === outSide) {
          onSelect({ type: 'port', nodeId: dragState.fromNode.id, port: 'output' });
        } else {
          onSelect({ type: 'node', id: dragState.fromNode.id });
        }
      } else if (dragState.snapTarget) {
        onCreateConnection(
          dragState.fromNode.id,
          dragState.snapTarget.node.id,
          dragState.startSide,
          dragState.snapTarget.side,
          tool === 'bidirectional'
        );
      }
    }

    setDragState(null);
  }

  function handleSvgDragOver(e: React.DragEvent<SVGSVGElement>) {
    e.preventDefault();
    if (!svgRef.current || !idea) return;

    if (e.dataTransfer.types.includes('text/plain') && !e.dataTransfer.types.includes('Files')) {
      const plain = e.dataTransfer.getData('text/plain');
      if (plain === 'brainflow-new-box' || plain === 'brainflow-new-group') {
        if (dropTargetNodeId !== null) setDropTargetNodeId(null);
        e.dataTransfer.dropEffect = 'copy';
        return;
      }
    }

    const pt = clientToCanvas(svgRef.current, e.clientX, e.clientY, pan, zoom);
    const hoveredNode = findNodeAtPoint(idea.nodes, pt.x, pt.y, 4);

    if (hoveredNode) {
      e.dataTransfer.dropEffect = 'copy';
      if (dropTargetNodeId !== hoveredNode.id) {
        setDropTargetNodeId(hoveredNode.id);
      }
    } else {
      e.dataTransfer.dropEffect = 'copy';
      if (dropTargetNodeId !== null) {
        setDropTargetNodeId(null);
      }
    }
  }

  function handleSvgDragLeave(e: React.DragEvent<SVGSVGElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setDropTargetNodeId(null);
    }
  }

  async function handleDrop(e: React.DragEvent<SVGSVGElement>) {
    e.preventDefault();
    setDropTargetNodeId(null);
    if (!svgRef.current || !idea) return;
    const pt = clientToCanvas(svgRef.current, e.clientX, e.clientY, pan, zoom);

    // 1. Try extracting an image (file, HTML img, or image URL)
    try {
      const droppedImage = await extractImageFromDataTransfer(e.dataTransfer);
      if (droppedImage) {
        const targetNode = findNodeAtPoint(idea.nodes, pt.x, pt.y, 8);
        if (targetNode) {
          handleDropImageOnNode(targetNode.id, droppedImage.dataUrl);
          return;
        }

        onCreateNode(Math.round(pt.x - 120), Math.round(pt.y - 90), {
          label: droppedImage.defaultLabel,
          imageUrl: droppedImage.dataUrl,
          width: 240,
          height: 180,
        });
        return;
      }
    } catch {
      // Ignore oversized or invalid dropped files silently on canvas drop
    }

    if (e.dataTransfer.getData('text/plain') === 'brainflow-new-box') {
      onCreateNode(Math.round(pt.x - 78), Math.round(pt.y - 34));
      return;
    }

    if (e.dataTransfer.getData('text/plain') === 'brainflow-new-group') {
      const groupX = Math.round(pt.x - 180);
      const groupY = Math.round(pt.y - 120);
      const groupW = 360;
      const groupH = 240;
      const containedIds = idea.nodes
        .filter(
          (n) =>
            !n.isGroup &&
            n.x + n.width / 2 >= groupX &&
            n.x + n.width / 2 <= groupX + groupW &&
            n.y + n.height / 2 >= groupY &&
            n.y + n.height / 2 <= groupY + groupH
        )
        .map((n) => n.id);

      onCreateNode(groupX, groupY, {
        isGroup: true,
        label: `Group ${idea.nodes.filter((n) => n.isGroup).length + 1}`,
        width: groupW,
        height: groupH,
        color: activeColor || '#8b5cf6',
        groupNodeIds: containedIds,
      });
      return;
    }
  }

  const nodeMap = new Map(idea.nodes.map((n) => [n.id, n]));

  let tempPreview:
    | { bidirectional: false; d: string }
    | { bidirectional: true; dForward: string; dBackward: string }
    | null = null;
  if (dragState?.mode === 'draw-line' && dragState.hasDragged) {
    const startAnchor = getEdgeAnchorPoint(dragState.fromNode, dragState.startSide);
    const startPt = getPortRimPoint(startAnchor, dragState.startSide);

    const endSide: PortSide = dragState.snapTarget
      ? dragState.snapTarget.side
      : getNearestSideOnNode(
          { ...dragState.fromNode, x: dragState.currentPt.x, y: dragState.currentPt.y, width: 0, height: 0 },
          startAnchor.x,
          startAnchor.y
        );

    const endPt = dragState.snapTarget
      ? getPortRimPoint(
          getEdgeAnchorPoint(dragState.snapTarget.node, dragState.snapTarget.side),
          dragState.snapTarget.side
        )
      : dragState.currentPt;

    if (tool === 'bidirectional') {
      const { dForward, dBackward } = buildParallelConnectionCurves(
        startPt,
        endPt,
        dragState.startSide,
        endSide,
        3.5
      );
      tempPreview = { bidirectional: true, dForward, dBackward };
    } else {
      tempPreview = {
        bidirectional: false,
        d: buildConnectionCurve(startPt, endPt, dragState.startSide, endSide).d,
      };
    }
  }

  const hintText =
    tool === 'select'
      ? 'Drag from any edge dot to connect • Double-click to edit • Drag a group to move its contents'
      : tool === 'box'
        ? 'Add Idea Box: Click anywhere on the canvas to place a new Idea Box'
        : tool === 'group'
          ? 'Add Group Box: Click anywhere on the canvas to place a container that groups other ideas'
          : tool === 'bidirectional'
            ? 'Bidirectional Connector: Drag between boxes for double parallel dashed arrows'
            : 'Directed Line: Drag from any box toward any edge point (Left / Top / Right / Bottom)';

  return (
    <main
      data-brainflow-canvas="true"
      className="flex-1 relative overflow-hidden canvas-grid"
      style={{
        backgroundPosition: `${pan.x}px ${pan.y}px`,
        backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
      }}
    >
      {/* Mode Hint Pill */}
      <div className="absolute top-3 left-3 z-10 px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-xs text-slate-300 shadow pointer-events-none">
        {hintText}
      </div>

      {/* Draggable Palette Chips */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        <div
          draggable
          onDragStart={(e) => e.dataTransfer.setData('text/plain', 'brainflow-new-box')}
          className="px-3 py-1.5 rounded-lg bg-slate-900/95 border border-dashed border-blue-500 text-xs font-medium text-slate-100 cursor-grab shadow hover:bg-slate-800"
        >
          ⠿ Drag Idea Box
        </div>
        <div
          draggable
          onDragStart={(e) => e.dataTransfer.setData('text/plain', 'brainflow-new-group')}
          className="px-3 py-1.5 rounded-lg bg-slate-900/95 border border-dashed border-violet-500 text-xs font-medium text-slate-100 cursor-grab shadow hover:bg-slate-800"
        >
          🗂 Drag Group Box
        </div>
      </div>

      {/* Cardinality Legend */}
      <div className="absolute bottom-3 left-3 z-10 px-3 py-2 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-slate-300 flex items-center gap-3 shadow">
        <span className="font-medium text-slate-400">Connectivity:</span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" />0 (Isolated)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />1–2 (Linked)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />3+ (Hub)
        </span>
      </div>

      <svg
        ref={svgRef}
        className="w-full h-full select-none block"
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDragOver={handleSvgDragOver}
        onDragLeave={handleSvgDragLeave}
        onDrop={handleDrop}
      >
        <defs>
          {COLOR_PALETTE.map((color) => (
            <marker
              key={color}
              id={`arrow-${color.replace('#', '')}`}
              viewBox="0 0 10 10"
              refX={9}
              refY={5}
              markerWidth={7}
              markerHeight={7}
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill={color} />
            </marker>
          ))}
        </defs>

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Groups Layer - strictly placed behind other ideas and connections */}
          {idea.nodes
            .filter((n) => n.isGroup)
            .map((group) => {
              const isEditing = editingDraft?.nodeId === group.id;
              const contained = getContainedIdeas(group, idea.nodes);
              return (
                <GroupNode
                  key={group.id}
                  group={group}
                  containedIdeas={contained}
                  selected={selection?.type === 'node' && selection.id === group.id}
                  isEditing={isEditing}
                  editFocusField={isEditing ? editingDraft?.focusField : undefined}
                  draftLabel={isEditing ? editingDraft.label : group.label}
                  draftDescription={isEditing ? editingDraft.description : group.description ?? ''}
                  onMouseDown={handleNodeMouseDown}
                  onResizeMouseDown={handleNodeResizeMouseDown}
                  onStartEdit={(targetNode, focusField) => {
                    onSelect({ type: 'node', id: targetNode.id });
                    setEditingDraft({
                      nodeId: targetNode.id,
                      label: targetNode.label,
                      description: targetNode.description ?? '',
                      imageUrl: targetNode.imageUrl ?? '',
                      focusField,
                    });
                  }}
                  onDraftChange={(patch) =>
                    setEditingDraft((prev) => (prev ? { ...prev, ...patch } : prev))
                  }
                  onCommitEdit={commitInlineEdit}
                  onCancelEdit={() => setEditingDraft(null)}
                  onSelectIdea={(ideaId) => onSelect({ type: 'node', id: ideaId })}
                />
              );
            })}

          {/* Directed Connections Layer */}
          {idea.connections.map((conn) => {
            const fromNode = nodeMap.get(conn.fromNodeId);
            const toNode = nodeMap.get(conn.toNodeId);
            if (!fromNode || !toNode) return null;

            return (
              <DirectedEdge
                key={conn.id}
                connection={conn}
                fromNode={fromNode}
                toNode={toNode}
                selected={selection?.type === 'connection' && selection.id === conn.id}
                onSelect={(_e, id) => {
                  if (editingDraft) commitInlineEdit();
                  if (editingEdgeDraft && editingEdgeDraft.connectionId !== id) {
                    commitEdgeInlineEdit();
                  }
                  onSelect({ type: 'connection', id });
                }}
                onStartEdit={(targetConn) => {
                  if (editingDraft) commitInlineEdit();
                  onSelect({ type: 'connection', id: targetConn.id });
                  setEditingEdgeDraft({
                    connectionId: targetConn.id,
                    label: targetConn.label,
                    color: targetConn.color,
                    bidirectional: Boolean(targetConn.bidirectional),
                  });
                }}
                onLabelMouseDown={handleEdgeLabelMouseDown}
                onLabelResizeMouseDown={handleEdgeLabelResizeMouseDown}
                onEndpointMouseDown={handleEdgeEndpointMouseDown}
              />
            );
          })}

          {/* Temporary Snap-Preview Curve */}
          {tempPreview &&
            (tempPreview.bidirectional ? (
              <>
                <path
                  d={tempPreview.dForward}
                  fill="none"
                  stroke={activeColor}
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  markerEnd={`url(#arrow-${activeColor.replace('#', '')})`}
                />
                <path
                  d={tempPreview.dBackward}
                  fill="none"
                  stroke={activeColor}
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  markerStart={`url(#arrow-${activeColor.replace('#', '')})`}
                />
              </>
            ) : (
              <path
                d={tempPreview.d}
                fill="none"
                stroke={activeColor}
                strokeWidth={2.5}
                strokeDasharray="5 4"
                markerEnd={`url(#arrow-${activeColor.replace('#', '')})`}
              />
            ))}

          {/* Idea Nodes Layer (render editing node last so its inline editor stays on top) */}
          {[...idea.nodes.filter((n) => !n.isGroup)]
            .sort((a, b) => {
              if (editingDraft?.nodeId === a.id) return 1;
              if (editingDraft?.nodeId === b.id) return -1;
              return 0;
            })
            .map((node) => {
              const isEditing = editingDraft?.nodeId === node.id;
              const isDrawingLine = dragState?.mode === 'draw-line' && dragState.hasDragged;
              const isSnap =
                dragState?.mode === 'draw-line' && dragState.snapTarget?.node.id === node.id;
              const snapTargetSide = isSnap ? dragState.snapTarget!.side : null;
              return (
                <IdeaNode
                  key={node.id}
                  node={node}
                  degree={degrees[node.id] ?? { incoming: 0, outgoing: 0, total: 0 }}
                  cardinalityMode={cardinalityMode}
                  selected={selection?.type === 'node' && selection.id === node.id}
                  selectedPort={
                    selection?.type === 'port' && selection.nodeId === node.id
                      ? selection.port
                      : null
                  }
                  isDrawingLine={Boolean(isDrawingLine)}
                  isSnapTarget={isSnap}
                  snapTargetSide={snapTargetSide}
                  isDropTarget={dropTargetNodeId === node.id}
                  onDropImage={handleDropImageOnNode}
                  isEditing={isEditing}
                  editFocusField={isEditing ? editingDraft.focusField : 'label'}
                  draftLabel={isEditing ? editingDraft.label : node.label}
                  draftDescription={isEditing ? editingDraft.description : node.description ?? ''}
                  draftImageUrl={isEditing ? editingDraft.imageUrl : node.imageUrl ?? ''}
                  onMouseDown={handleNodeMouseDown}
                  onAnchorMouseDown={handleAnchorMouseDown}
                  onSelectPort={(nodeId, port) => onSelect({ type: 'port', nodeId, port })}
                  onChangePortSide={onChangePortSide}
                  onResizeMouseDown={handleNodeResizeMouseDown}
                  onStartEdit={(targetNode, focusField) => {
                    onSelect({ type: 'node', id: targetNode.id });
                    setEditingDraft({
                      nodeId: targetNode.id,
                      label: targetNode.label,
                      description: targetNode.description ?? '',
                      imageUrl: targetNode.imageUrl ?? '',
                      focusField,
                    });
                  }}
                  onDraftChange={(patch) =>
                    setEditingDraft((prev) => (prev ? { ...prev, ...patch } : prev))
                  }
                  onCommitEdit={commitInlineEdit}
                  onCancelEdit={() => setEditingDraft(null)}
                />
              );
            })}

          {/* In-Place Connection Editor Overlay */}
          {editingEdgeDraft &&
            (() => {
              const conn = idea.connections.find((c) => c.id === editingEdgeDraft.connectionId);
              const fromNode = conn ? nodeMap.get(conn.fromNodeId) : undefined;
              const toNode = conn ? nodeMap.get(conn.toNodeId) : undefined;
              if (!conn || !fromNode || !toNode) return null;

              const fromSide = conn.fromSide ?? getOutputPortSide(fromNode);
              const toSide = conn.toSide ?? getInputPortSide(toNode);
              const outPort = getEdgeAnchorPoint(fromNode, fromSide);
              const inPort = getEdgeAnchorPoint(toNode, toSide);
              const { midX, midY } = buildConnectionCurve(
                getPortRimPoint(outPort, fromSide),
                getPortRimPoint(inPort, toSide),
                fromSide,
                toSide
              );
              const w = 236;
              const h = 132;
              const cx = midX + (conn.labelOffsetX ?? 0);
              const cy = midY + (conn.labelOffsetY ?? 0);

              return (
                <g
                  onMouseDown={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => e.stopPropagation()}
                >
                  <foreignObject x={cx - w / 2} y={cy - h / 2} width={w} height={h}>
                    <div
                      className="w-full h-full rounded-lg bg-slate-900 border-2 p-1.5 flex flex-col gap-1.5 shadow-2xl"
                      style={{ borderColor: editingEdgeDraft.color }}
                    >
                      <input
                        type="text"
                        autoFocus
                        value={editingEdgeDraft.label}
                        placeholder="Connection label..."
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) =>
                          setEditingEdgeDraft((prev) =>
                            prev ? { ...prev, label: e.target.value } : prev
                          )
                        }
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            commitEdgeInlineEdit();
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            setEditingEdgeDraft(null);
                          }
                        }}
                        className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs font-medium text-slate-100 focus:outline-none focus:border-blue-500"
                      />

                      <div className="grid grid-cols-2 gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setEditingEdgeDraft((prev) =>
                              prev ? { ...prev, bidirectional: false } : prev
                            )
                          }
                          className={`py-0.5 rounded border text-[11px] font-medium cursor-pointer ${
                            !editingEdgeDraft.bidirectional
                              ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          → One-way
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setEditingEdgeDraft((prev) =>
                              prev ? { ...prev, bidirectional: true } : prev
                            )
                          }
                          className={`py-0.5 rounded border text-[11px] font-medium cursor-pointer ${
                            editingEdgeDraft.bidirectional
                              ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          ⇄ Bidirectional
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1">
                          {COLOR_PALETTE.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() =>
                                setEditingEdgeDraft((prev) => (prev ? { ...prev, color: c } : prev))
                              }
                              className={`w-4 h-4 rounded-full border cursor-pointer ${
                                editingEdgeDraft.color === c
                                  ? 'border-white scale-110'
                                  : 'border-transparent opacity-80'
                              }`}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const id = editingEdgeDraft.connectionId;
                            setEditingEdgeDraft(null);
                            onDeleteConnection(id);
                          }}
                          className="px-1.5 py-0.5 rounded text-xs text-rose-400 hover:bg-rose-500/15 cursor-pointer"
                          title="Delete connection"
                        >
                          🗑
                        </button>
                      </div>

                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingEdgeDraft(null)}
                          className="px-2 py-0.5 rounded text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={commitEdgeInlineEdit}
                          className="px-2.5 py-0.5 rounded bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 cursor-pointer"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </foreignObject>
                </g>
              );
            })()}
        </g>
      </svg>
    </main>
  );
}
