import type {
  ActionLink,
  IdeaConnection,
  IdeaDetail,
  IdeaNode,
  IdeaSummary,
  Project,
  ProjectResource,
  WorkspaceState,
} from '../types/brainflow';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return res.json();
}

export const api = {
  // Workspace Session State
  getWorkspace: () => request<WorkspaceState>('/api/workspace'),

  updateWorkspace: (
    data: Partial<Pick<WorkspaceState, 'lastProjectId' | 'lastIdeaId' | 'cardinalityMode'>>
  ) =>
    request<WorkspaceState>('/api/workspace', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Projects & Resources
  listProjects: () => request<Project[]>('/api/projects'),

  createProject: (name: string) =>
    request<Project>('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  renameProject: (id: number, name: string) =>
    request<Project>(`/api/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),

  deleteProject: (id: number) =>
    request<void>(`/api/projects/${id}`, { method: 'DELETE' }),

  addResource: (projectId: number, title: string, url: string) =>
    request<ProjectResource>(`/api/projects/${projectId}/resources`, {
      method: 'POST',
      body: JSON.stringify({ title, url }),
    }),

  deleteResource: (resourceId: number) =>
    request<void>(`/api/resources/${resourceId}`, { method: 'DELETE' }),

  // Ideas (Drawings)
  getIdea: (ideaId: number) => request<IdeaDetail>(`/api/ideas/${ideaId}`),

  createIdea: (projectId: number, name: string) =>
    request<IdeaDetail>(`/api/projects/${projectId}/ideas`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  updateIdea: (
    ideaId: number,
    data: {
      name?: string;
      description?: string;
      complexity?: string;
      isStashed?: boolean;
      zoom?: number;
      panX?: number;
      panY?: number;
    }
  ) =>
    request<IdeaSummary>(`/api/ideas/${ideaId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteIdea: (ideaId: number) =>
    request<void>(`/api/ideas/${ideaId}`, { method: 'DELETE' }),

  // Canvas Nodes
  createNode: (
    ideaId: number,
    payload: {
      label: string;
      description?: string;
      imageUrl?: string;
      x: number;
      y: number;
      color: string;
      width?: number;
      height?: number;
      isGroup?: boolean;
      groupNodeIds?: number[];
    }
  ) =>
    request<{ node: IdeaNode; idea: IdeaSummary }>(`/api/ideas/${ideaId}/nodes`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateNode: (
    nodeId: number,
    payload: Partial<
      Pick<
        IdeaNode,
        | 'label'
        | 'description'
        | 'imageUrl'
        | 'x'
        | 'y'
        | 'width'
        | 'height'
        | 'color'
        | 'actions'
        | 'inputPort'
        | 'outputPort'
        | 'isGroup'
        | 'groupNodeIds'
      >
    >
  ) =>
    request<{ node: IdeaNode; idea: IdeaSummary }>(`/api/nodes/${nodeId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteNode: (nodeId: number) =>
    request<{ deletedNodeId: number; idea: IdeaSummary }>(`/api/nodes/${nodeId}`, {
      method: 'DELETE',
    }),

  // Canvas Directed Connections
  createConnection: (
    ideaId: number,
    payload: {
      fromNodeId: number;
      toNodeId: number;
      fromSide?: string;
      toSide?: string;
      bidirectional?: boolean;
      label?: string;
      color?: string;
      properties?: Record<string, string>;
      actions?: ActionLink[];
      labelOffsetX?: number;
      labelOffsetY?: number;
      labelWidth?: number;
      labelHeight?: number;
    }
  ) =>
    request<{ connection: IdeaConnection; idea: IdeaSummary }>(`/api/ideas/${ideaId}/connections`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateConnection: (
    connectionId: number,
    payload: Partial<
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
  ) =>
    request<{ connection: IdeaConnection; idea: IdeaSummary }>(`/api/connections/${connectionId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteConnection: (connectionId: number) =>
    request<{ deletedConnectionId: number; idea: IdeaSummary }>(`/api/connections/${connectionId}`, {
      method: 'DELETE',
    }),

  // Export & Import JSON Bundles
  exportProject: (projectId: number) =>
    request<import('../types/brainflow').BrainFlowProjectExport>(
      `/api/projects/${projectId}/export`
    ),

  exportIdea: (ideaId: number) =>
    request<import('../types/brainflow').BrainFlowIdeaExport>(`/api/ideas/${ideaId}/export`),

  importBundle: (bundle: unknown, targetProjectId?: number | null) =>
    request<
      | { kind: 'project'; project: Project; activeIdeaId: number | null }
      | { kind: 'idea'; projectId: number; idea: IdeaDetail }
    >('/api/import', {
      method: 'POST',
      body: JSON.stringify({ bundle, targetProjectId }),
    }),
};
