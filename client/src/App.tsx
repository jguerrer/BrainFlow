import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api/client';
import { DrawingCanvas } from './components/canvas/DrawingCanvas';
import { Inspector } from './components/layout/Inspector';
import { Sidebar } from './components/layout/Sidebar';
import { COLOR_PALETTE, Toolbar } from './components/layout/Toolbar';
import type {
  CardinalityMode,
  DrawingTool,
  IdeaConnection,
  IdeaDetail,
  IdeaNode,
  IdeaSummary,
  PortSide,
  Project,
  Selection,
} from './types/brainflow';
import { computeNodeDegrees } from './utils/cardinality';
import {
  exportIdeaAsImage,
  exportIdeaAsPdf,
  toSafeFilenameSlug,
  triggerBlobDownload,
} from './utils/canvasExport';
import type { Point } from './utils/geometry';

function triggerJsonDownload(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  triggerBlobDownload(filename, blob);
}

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
  const [activeIdea, setActiveIdea] = useState<IdeaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tool, setTool] = useState<DrawingTool>('select');
  const [activeColor, setActiveColor] = useState<string>(COLOR_PALETTE[0]);
  const [cardinalityMode, setCardinalityMode] = useState<CardinalityMode>('degree');
  const [selection, setSelection] = useState<Selection>(null);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(() => {
    try {
      return localStorage.getItem('brainflow_inspector_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleInspector = useCallback(() => {
    setInspectorCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('brainflow_inspector_collapsed', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const [viewport, setViewport] = useState<{ zoom: number; pan: Point }>({
    zoom: 1,
    pan: { x: 0, y: 0 },
  });

  const debounceRef = useRef<number | null>(null);
  const viewportDebounceRef = useRef<number | null>(null);
  const skipNextViewportSaveRef = useRef(false);

  const syncIdeaSummaryInProjects = useCallback((summary: IdeaSummary) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === summary.projectId
          ? { ...p, ideas: p.ideas.map((i) => (i.id === summary.id ? summary : i)) }
          : p
      )
    );
  }, []);

  const loadIdea = useCallback(
    async (projectId: number, ideaId: number) => {
      try {
        setActiveProjectId(projectId);
        setSelection(null);
        const detail = await api.getIdea(ideaId);
        skipNextViewportSaveRef.current = true;
        setViewport({
          zoom: detail.zoom ?? 1,
          pan: { x: detail.panX ?? 0, y: detail.panY ?? 0 },
        });
        setActiveIdea(detail);
        syncIdeaSummaryInProjects({
          id: detail.id,
          projectId: detail.projectId,
          name: detail.name,
          description: detail.description,
          lastAccess: detail.lastAccess,
          itemCount: detail.itemCount,
          complexity: detail.complexity,
          isStashed: detail.isStashed ?? false,
          zoom: detail.zoom ?? 1,
          panX: detail.panX ?? 0,
          panY: detail.panY ?? 0,
          createdAt: detail.createdAt,
          updatedAt: detail.updatedAt,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load idea');
      }
    },
    [syncIdeaSummaryInProjects]
  );

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const [list, workspace] = await Promise.all([api.listProjects(), api.getWorkspace()]);
        if (cancelled) return;
        setProjects(list);
        if (
          workspace.cardinalityMode === 'off' ||
          workspace.cardinalityMode === 'degree' ||
          workspace.cardinalityMode === 'hubs' ||
          workspace.cardinalityMode === 'isolated'
        ) {
          setCardinalityMode(workspace.cardinalityMode);
        }

        const savedProject = list.find((p) => p.id === workspace.lastProjectId);
        const savedIdea = savedProject?.ideas.find(
          (i) => i.id === workspace.lastIdeaId && !i.isStashed
        );
        const firstActiveProject = list.find((p) => p.ideas.some((i) => !i.isStashed)) || list[0];
        const targetProject = savedIdea ? savedProject! : firstActiveProject;
        const targetIdea =
          savedIdea || targetProject?.ideas.find((i) => !i.isStashed);

        if (targetProject && targetIdea) {
          await loadIdea(targetProject.id, targetIdea.id);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to connect to server');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [loadIdea]);

  // Persist screen viewport (zoom & pan) for the active idea after panning/zooming
  useEffect(() => {
    if (!activeIdea) return;
    if (skipNextViewportSaveRef.current) {
      skipNextViewportSaveRef.current = false;
      return;
    }

    const ideaId = activeIdea.id;
    if (viewportDebounceRef.current) window.clearTimeout(viewportDebounceRef.current);
    viewportDebounceRef.current = window.setTimeout(() => {
      void api.updateIdea(ideaId, {
        zoom: viewport.zoom,
        panX: viewport.pan.x,
        panY: viewport.pan.y,
      });
    }, 300);

    return () => {
      if (viewportDebounceRef.current) window.clearTimeout(viewportDebounceRef.current);
    };
  }, [viewport, activeIdea?.id]);

  // Keyboard Delete shortcut for selected item
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selection) {
        if (selection.type === 'node') {
          e.preventDefault();
          void handleDeleteNode(selection.id);
        } else if (selection.type === 'connection') {
          e.preventDefault();
          void handleDeleteConnection(selection.id);
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const degrees = useMemo(() => {
    if (!activeIdea) return {};
    return computeNodeDegrees(activeIdea.nodes, activeIdea.connections);
  }, [activeIdea]);

  // --- Project & Idea Sidebar Handlers ---
  async function handleCreateProject(name: string) {
    setSaving(true);
    try {
      const created = await api.createProject(name);
      setProjects((prev) => [...prev, created]);
      if (created.ideas[0]) {
        await loadIdea(created.id, created.ideas[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create project');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProject(projectId: number) {
    setSaving(true);
    try {
      await api.deleteProject(projectId);
      const nextProjects = projects.filter((p) => p.id !== projectId);
      setProjects(nextProjects);
      if (activeProjectId === projectId) {
        const nextProj = nextProjects[0];
        const nextIdea = nextProj?.ideas[0];
        if (nextProj && nextIdea) {
          await loadIdea(nextProj.id, nextIdea.id);
        } else {
          setActiveProjectId(null);
          setActiveIdea(null);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete project');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateIdea(projectId: number, name: string) {
    setSaving(true);
    try {
      const created = await api.createIdea(projectId, name);
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, ideas: [...p.ideas, created] } : p))
      );
      setActiveProjectId(projectId);
      skipNextViewportSaveRef.current = true;
      setViewport({ zoom: 1, pan: { x: 0, y: 0 } });
      setActiveIdea(created);
      setSelection(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create idea');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteIdea(ideaId: number) {
    setSaving(true);
    try {
      await api.deleteIdea(ideaId);
      const nextProjects = projects.map((p) => ({
        ...p,
        ideas: p.ideas.filter((i) => i.id !== ideaId),
      }));
      setProjects(nextProjects);
      if (activeIdea?.id === ideaId) {
        const currentProj = nextProjects.find((p) => p.id === activeProjectId) || nextProjects[0];
        const nextIdea =
          currentProj?.ideas.find((i) => !i.isStashed) ||
          nextProjects.flatMap((p) => p.ideas).find((i) => !i.isStashed);
        if (nextIdea) {
          await loadIdea(nextIdea.projectId, nextIdea.id);
        } else {
          setActiveIdea(null);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete idea');
    } finally {
      setSaving(false);
    }
  }

  async function handleRenameIdeaFromSidebar(ideaId: number, name: string) {
    setSaving(true);
    try {
      const updated = await api.updateIdea(ideaId, { name });
      syncIdeaSummaryInProjects(updated);
      if (activeIdea?.id === ideaId) {
        setActiveIdea({ ...activeIdea, name: updated.name });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not rename idea');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStashIdea(ideaId: number, isStashed: boolean) {
    setSaving(true);
    try {
      const updated = await api.updateIdea(ideaId, { isStashed });
      const nextProjects = projects.map((p) =>
        p.id === updated.projectId
          ? { ...p, ideas: p.ideas.map((i) => (i.id === updated.id ? updated : i)) }
          : p
      );
      setProjects(nextProjects);

      if (isStashed && activeIdea?.id === ideaId) {
        const currentProj = nextProjects.find((p) => p.id === activeProjectId);
        const nextIdea =
          currentProj?.ideas.find((i) => !i.isStashed) ||
          nextProjects.flatMap((p) => p.ideas).find((i) => !i.isStashed);
        if (nextIdea) {
          await loadIdea(nextIdea.projectId, nextIdea.id);
        } else {
          setActiveIdea(null);
          setSelection(null);
        }
      } else if (!isStashed) {
        await loadIdea(updated.projectId, updated.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update stash status');
    } finally {
      setSaving(false);
    }
  }

  async function handleExportProject(projectId: number) {
    try {
      const bundle = await api.exportProject(projectId);
      const slug = toSafeFilenameSlug(bundle.project.name, `project-${projectId}`);
      triggerJsonDownload(`${slug}.project.brainflow.json`, bundle);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not export project JSON');
    }
  }

  async function handleExportIdea(ideaId: number) {
    try {
      const bundle = await api.exportIdea(ideaId);
      const slug = toSafeFilenameSlug(bundle.idea.name, `idea-${ideaId}`);
      triggerJsonDownload(`${slug}.idea.brainflow.json`, bundle);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not export idea JSON');
    }
  }

  async function handleExportIdeaVisual(format: 'png' | 'pdf', ideaId?: number) {
    const targetId = ideaId ?? activeIdea?.id;
    if (!targetId) return;

    setExporting(true);
    try {
      const detail =
        activeIdea && activeIdea.id === targetId ? activeIdea : await api.getIdea(targetId);
      const owningProject = projects.find((p) => p.id === detail.projectId);
      const projectTitle = owningProject?.name ?? '';

      if (format === 'png') {
        await exportIdeaAsImage(detail, projectTitle, cardinalityMode);
      } else {
        await exportIdeaAsPdf(detail, projectTitle, cardinalityMode);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Could not export idea as ${format.toUpperCase()}`
      );
    } finally {
      setExporting(false);
    }
  }

  async function handleImportJson(bundle: unknown) {
    setSaving(true);
    try {
      const result = await api.importBundle(bundle, activeProjectId);
      const freshList = await api.listProjects();
      setProjects(freshList);

      if (result.kind === 'project') {
        setActiveProjectId(result.project.id);
        if (result.activeIdeaId) {
          await loadIdea(result.project.id, result.activeIdeaId);
        } else {
          setActiveIdea(null);
          setSelection(null);
        }
      } else {
        await loadIdea(result.projectId, result.idea.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import JSON file');
    } finally {
      setSaving(false);
    }
  }

  function handleUpdateIdeaMeta(
    ideaId: number,
    patch: { name?: string; description?: string }
  ) {
    if (!activeIdea || activeIdea.id !== ideaId) return;
    setActiveIdea({ ...activeIdea, ...patch });
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      const payload: { name?: string; description?: string } = {};
      if (typeof patch.name === 'string') {
        if (!patch.name.trim()) return;
        payload.name = patch.name.trim();
      }
      if (typeof patch.description === 'string') {
        payload.description = patch.description;
      }
      if (Object.keys(payload).length === 0) return;

      setSaving(true);
      try {
        const updated = await api.updateIdea(ideaId, payload);
        syncIdeaSummaryInProjects(updated);
      } finally {
        setSaving(false);
      }
    }, 350);
  }

  async function handleAddResource(projectId: number, title: string, url: string) {
    setSaving(true);
    try {
      const res = await api.addResource(projectId, title, url);
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, resources: [...p.resources, res] } : p))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add resource');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteResource(resourceId: number) {
    setSaving(true);
    try {
      await api.deleteResource(resourceId);
      setProjects((prev) =>
        prev.map((p) => ({
          ...p,
          resources: p.resources.filter((r) => r.id !== resourceId),
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete resource');
    } finally {
      setSaving(false);
    }
  }

  // --- Canvas Node & Connection Handlers ---
  async function handleCreateNode(
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
  ) {
    if (!activeIdea) return;
    setSaving(true);
    try {
      const defaultLabel = options?.isGroup
        ? `Group ${activeIdea.nodes.filter((n) => n.isGroup).length + 1}`
        : `Idea ${activeIdea.nodes.filter((n) => !n.isGroup).length + 1}`;
      const label = options?.label?.trim() || defaultLabel;
      const { node, idea } = await api.createNode(activeIdea.id, {
        label,
        imageUrl: options?.imageUrl,
        x,
        y,
        width: options?.width,
        height: options?.height,
        color: options?.color || (options?.isGroup ? '#8b5cf6' : activeColor),
        isGroup: options?.isGroup,
        groupNodeIds: options?.groupNodeIds,
      });
      setActiveIdea((prev) =>
        prev
          ? { ...prev, ...idea, nodes: [...prev.nodes, node] }
          : prev
      );
      syncIdeaSummaryInProjects(idea);
      setSelection({ type: 'node', id: node.id });
      setTool('select');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create object');
    } finally {
      setSaving(false);
    }
  }

  async function handleAttachImageToIdea(imageUrl: string, label?: string) {
    const cleanUrl = imageUrl.trim();
    if (!cleanUrl) return;
    const canvasEl = document.querySelector('[data-brainflow-canvas="true"]');
    const viewW = canvasEl?.clientWidth ?? 800;
    const viewH = canvasEl?.clientHeight ?? 520;
    const width = 240;
    const height = 180;
    const x = Math.round((viewW / 2 - viewport.pan.x) / viewport.zoom - width / 2);
    const y = Math.round((viewH / 2 - viewport.pan.y) / viewport.zoom - height / 2);
    await handleCreateNode(x, y, {
      label: label?.trim() || 'Image',
      imageUrl: cleanUrl,
      width,
      height,
    });
  }

  function handleMoveNodeLocal(nodeId: number, x: number, y: number) {
    setActiveIdea((prev) =>
      prev
        ? {
            ...prev,
            nodes: prev.nodes.map((n) => (n.id === nodeId ? { ...n, x, y } : n)),
          }
        : prev
    );
  }

  async function handleCommitNodePosition(nodeId: number, x: number, y: number) {
    setSaving(true);
    try {
      const { idea } = await api.updateNode(nodeId, { x, y });
      syncIdeaSummaryInProjects(idea);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save position');
    } finally {
      setSaving(false);
    }
  }

  function handleResizeNodeLocal(nodeId: number, width: number, height: number) {
    setActiveIdea((prev) =>
      prev
        ? {
            ...prev,
            nodes: prev.nodes.map((n) => (n.id === nodeId ? { ...n, width, height } : n)),
          }
        : prev
    );
  }

  async function handleCommitNodeSize(nodeId: number, width: number, height: number) {
    setSaving(true);
    try {
      const { idea } = await api.updateNode(nodeId, { width, height });
      syncIdeaSummaryInProjects(idea);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save size');
    } finally {
      setSaving(false);
    }
  }

  function handleUpdateNode(
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
  ) {
    const existing = activeIdea?.nodes.find((n) => n.id === nodeId);
    const nextPatch = { ...patch };
    if (
      existing &&
      !existing.imageUrl?.trim() &&
      typeof nextPatch.imageUrl === 'string' &&
      /^(https?:\/\/|data:image\/)/i.test(nextPatch.imageUrl.trim())
    ) {
      if (existing.width < 220) nextPatch.width = 220;
      if (existing.height < 160) nextPatch.height = 160;
    }

    setActiveIdea((prev) =>
      prev
        ? {
            ...prev,
            nodes: prev.nodes.map((n) => (n.id === nodeId ? { ...n, ...nextPatch } : n)),
          }
        : prev
    );

    const isTextEdit =
      Object.keys(nextPatch).length === 1 &&
      (typeof nextPatch.label === 'string' ||
        typeof nextPatch.description === 'string' ||
        typeof nextPatch.imageUrl === 'string' ||
        nextPatch.inputPort !== undefined ||
        nextPatch.outputPort !== undefined);
    const persist = async () => {
      setSaving(true);
      try {
        const { idea } = await api.updateNode(nodeId, nextPatch);
        syncIdeaSummaryInProjects(idea);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not update object');
      } finally {
        setSaving(false);
      }
    };

    if (isTextEdit) {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => void persist(), 300);
    } else {
      void persist();
    }
  }

  function handleChangePortSide(nodeId: number, port: 'input' | 'output', side: PortSide) {
    const node = activeIdea?.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const key = port === 'input' ? 'inputPort' : 'outputPort';
    const existing = node[key];
    handleUpdateNode(nodeId, {
      [key]: {
        label: existing?.label ?? '',
        description: existing?.description ?? '',
        actions: Array.isArray(existing?.actions) ? existing.actions : [],
        side,
      },
    });
  }

  async function handleDeleteNode(nodeId: number) {
    setSaving(true);
    try {
      const { idea } = await api.deleteNode(nodeId);
      setActiveIdea((prev) =>
        prev
          ? {
              ...prev,
              ...idea,
              nodes: prev.nodes.filter((n) => n.id !== nodeId),
              connections: prev.connections.filter(
                (c) => c.fromNodeId !== nodeId && c.toNodeId !== nodeId
              ),
            }
          : prev
      );
      syncIdeaSummaryInProjects(idea);
      if (selection?.type === 'node' && selection.id === nodeId) {
        setSelection(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete object');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateConnection(
    fromNodeId: number,
    toNodeId: number,
    fromSide: PortSide = 'right',
    toSide: PortSide = 'left',
    bidirectional = false
  ) {
    if (!activeIdea) return;
    setSaving(true);
    try {
      const { connection, idea } = await api.createConnection(activeIdea.id, {
        fromNodeId,
        toNodeId,
        fromSide,
        toSide,
        bidirectional,
        label: 'connects',
        color: activeColor,
      });
      setActiveIdea((prev) =>
        prev
          ? { ...prev, ...idea, connections: [...prev.connections, connection] }
          : prev
      );
      syncIdeaSummaryInProjects(idea);
      setSelection({ type: 'connection', id: connection.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create connection');
    } finally {
      setSaving(false);
    }
  }

  function handleMoveEdgeEndpointLocal(
    connectionId: number,
    end: 'from' | 'to',
    side: PortSide
  ) {
    const field = end === 'from' ? 'fromSide' : 'toSide';
    setActiveIdea((prev) =>
      prev
        ? {
            ...prev,
            connections: prev.connections.map((c) =>
              c.id === connectionId ? { ...c, [field]: side } : c
            ),
          }
        : prev
    );
  }

  async function handleCommitEdgeEndpoint(
    connectionId: number,
    end: 'from' | 'to',
    side: PortSide
  ) {
    const patch = end === 'from' ? { fromSide: side } : { toSide: side };
    await handleCommitEdgeLabelLayout(connectionId, patch);
  }

  function handleMoveEdgeLabelLocal(connectionId: number, labelOffsetX: number, labelOffsetY: number) {
    setActiveIdea((prev) =>
      prev
        ? {
            ...prev,
            connections: prev.connections.map((c) =>
              c.id === connectionId ? { ...c, labelOffsetX, labelOffsetY } : c
            ),
          }
        : prev
    );
  }

  function handleResizeEdgeLabelLocal(connectionId: number, labelWidth: number, labelHeight: number) {
    setActiveIdea((prev) =>
      prev
        ? {
            ...prev,
            connections: prev.connections.map((c) =>
              c.id === connectionId ? { ...c, labelWidth, labelHeight } : c
            ),
          }
        : prev
    );
  }

  async function handleCommitEdgeLabelLayout(
    connectionId: number,
    patch: Partial<
      Pick<
        IdeaConnection,
        'fromSide' | 'toSide' | 'labelOffsetX' | 'labelOffsetY' | 'labelWidth' | 'labelHeight'
      >
    >
  ) {
    setSaving(true);
    try {
      const { idea } = await api.updateConnection(connectionId, patch);
      syncIdeaSummaryInProjects(idea);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save connection layout');
    } finally {
      setSaving(false);
    }
  }

  function handleUpdateConnection(
    connectionId: number,
    patch: Partial<
      Pick<
        IdeaConnection,
        | 'fromSide'
        | 'toSide'
        | 'bidirectional'
        | 'label'
        | 'color'
        | 'properties'
        | 'actions'
        | 'labelOffsetX'
        | 'labelOffsetY'
        | 'labelWidth'
        | 'labelHeight'
      >
    >
  ) {
    setActiveIdea((prev) =>
      prev
        ? {
            ...prev,
            connections: prev.connections.map((c) =>
              c.id === connectionId ? { ...c, ...patch } : c
            ),
          }
        : prev
    );

    const isTextEdit = typeof patch.label === 'string' && Object.keys(patch).length === 1;
    const persist = async () => {
      setSaving(true);
      try {
        const { idea } = await api.updateConnection(connectionId, patch);
        syncIdeaSummaryInProjects(idea);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not update connection');
      } finally {
        setSaving(false);
      }
    };

    if (isTextEdit) {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => void persist(), 300);
    } else {
      void persist();
    }
  }

  async function handleDeleteConnection(connectionId: number) {
    setSaving(true);
    try {
      const { idea } = await api.deleteConnection(connectionId);
      setActiveIdea((prev) =>
        prev
          ? {
              ...prev,
              ...idea,
              connections: prev.connections.filter((c) => c.id !== connectionId),
            }
          : prev
      );
      syncIdeaSummaryInProjects(idea);
      if (selection?.type === 'connection' && selection.id === connectionId) {
        setSelection(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete connection');
    } finally {
      setSaving(false);
    }
  }

  // --- Toolbar Color & Zoom ---
  function handleSelectColor(color: string) {
    setActiveColor(color);
    if (selection?.type === 'node') {
      handleUpdateNode(selection.id, { color });
    } else if (selection?.type === 'connection') {
      handleUpdateConnection(selection.id, { color });
    }
  }

  const handleZoomChange = useCallback((delta: number, anchor?: Point) => {
    let resolvedAnchor = anchor;
    if (!resolvedAnchor) {
      const rect = document
        .querySelector('[data-brainflow-canvas="true"]')
        ?.getBoundingClientRect();
      if (rect) {
        resolvedAnchor = { x: rect.width / 2, y: rect.height / 2 };
      }
    }

    setViewport((prev) => {
      const nextZoom = Math.min(3.0, Math.max(0.25, +(prev.zoom + delta).toFixed(2)));
      if (nextZoom === prev.zoom) return prev;
      if (!resolvedAnchor) {
        return { ...prev, zoom: nextZoom };
      }
      const scale = nextZoom / prev.zoom;
      return {
        zoom: nextZoom,
        pan: {
          x: resolvedAnchor.x - (resolvedAnchor.x - prev.pan.x) * scale,
          y: resolvedAnchor.y - (resolvedAnchor.y - prev.pan.y) * scale,
        },
      };
    });
  }, []);

  const handlePanChange = useCallback((pan: Point) => {
    setViewport((prev) => ({ ...prev, pan }));
  }, []);

  const activeProject = projects.find((p) => p.id === activeProjectId) || null;

  if (loading) {
    return (
      <div className="h-screen bg-slate-950 text-slate-300 flex items-center justify-center text-sm">
        Loading BrainFlow workspace...
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      <Toolbar
        projectName={activeProject?.name ?? ''}
        ideaName={activeIdea?.name ?? ''}
        hasActiveIdea={Boolean(activeIdea)}
        tool={tool}
        activeColor={activeColor}
        cardinalityMode={cardinalityMode}
        zoom={viewport.zoom}
        saving={saving}
        exporting={exporting}
        inspectorCollapsed={inspectorCollapsed}
        onToggleInspector={handleToggleInspector}
        onSelectTool={setTool}
        onSelectColor={handleSelectColor}
        onSelectCardinality={(mode) => {
          setCardinalityMode(mode);
          void api.updateWorkspace({ cardinalityMode: mode });
        }}
        onZoomChange={(delta) => handleZoomChange(delta)}
        onResetView={() => setViewport({ zoom: 1, pan: { x: 0, y: 0 } })}
        onExportImage={() => void handleExportIdeaVisual('png')}
        onExportPdf={() => void handleExportIdeaVisual('pdf')}
      />

      {error && (
        <div className="bg-rose-500/15 border-b border-rose-500/40 px-4 py-2 text-xs text-rose-300 flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        <Sidebar
          projects={projects}
          activeProjectId={activeProjectId}
          activeIdeaId={activeIdea?.id ?? null}
          onSelectIdea={(pId, iId) => void loadIdea(pId, iId)}
          onCreateProject={handleCreateProject}
          onDeleteProject={handleDeleteProject}
          onCreateIdea={handleCreateIdea}
          onRenameIdea={handleRenameIdeaFromSidebar}
          onToggleStashIdea={handleToggleStashIdea}
          onDeleteIdea={handleDeleteIdea}
          onExportProject={handleExportProject}
          onExportIdea={handleExportIdea}
          onExportIdeaImage={(ideaId) => handleExportIdeaVisual('png', ideaId)}
          onExportIdeaPdf={(ideaId) => handleExportIdeaVisual('pdf', ideaId)}
          onImportJson={handleImportJson}
          onAddResource={handleAddResource}
          onDeleteResource={handleDeleteResource}
        />

        <DrawingCanvas
          idea={activeIdea}
          tool={tool}
          activeColor={activeColor}
          cardinalityMode={cardinalityMode}
          degrees={degrees}
          selection={selection}
          zoom={viewport.zoom}
          pan={viewport.pan}
          onPanChange={handlePanChange}
          onWheelZoom={handleZoomChange}
          onSelect={setSelection}
          onCreateNode={(x, y, opts) => void handleCreateNode(x, y, opts)}
          onMoveNodeLocal={handleMoveNodeLocal}
          onCommitNodePosition={(id, x, y) => void handleCommitNodePosition(id, x, y)}
          onResizeNodeLocal={handleResizeNodeLocal}
          onCommitNodeSize={(id, w, h) => void handleCommitNodeSize(id, w, h)}
          onUpdateNodeInline={(id, patch) => handleUpdateNode(id, patch)}
          onChangePortSide={handleChangePortSide}
          onMoveEdgeLabelLocal={handleMoveEdgeLabelLocal}
          onResizeEdgeLabelLocal={handleResizeEdgeLabelLocal}
          onCommitEdgeLabelLayout={(id, patch) => void handleCommitEdgeLabelLayout(id, patch)}
          onUpdateConnectionInline={(id, patch) => handleUpdateConnection(id, patch)}
          onMoveEdgeEndpointLocal={handleMoveEdgeEndpointLocal}
          onCommitEdgeEndpoint={(id, end, side) => void handleCommitEdgeEndpoint(id, end, side)}
          onDeleteConnection={(id) => void handleDeleteConnection(id)}
          onCreateConnection={(from, to, fromSide, toSide, bidirectional) =>
            void handleCreateConnection(from, to, fromSide, toSide, bidirectional)
          }
        />

        <Inspector
          idea={activeIdea}
          selection={selection}
          degrees={degrees}
          isCollapsed={inspectorCollapsed}
          onToggleCollapse={handleToggleInspector}
          onSelect={setSelection}
          onUpdateIdeaMeta={handleUpdateIdeaMeta}
          onAttachImageToIdea={(url, label) => void handleAttachImageToIdea(url, label)}
          onUpdateNode={handleUpdateNode}
          onDeleteNode={(id) => void handleDeleteNode(id)}
          onUpdateConnection={handleUpdateConnection}
          onDeleteConnection={(id) => void handleDeleteConnection(id)}
        />
      </div>
    </div>
  );
}
