export interface ActionLink {
  label: string;
  url: string;
}

export type PortSide = 'left' | 'right' | 'top' | 'bottom';

export interface PortMetadata {
  label: string;
  description: string;
  actions: ActionLink[];
  side?: PortSide;
}

export interface ProjectResource {
  id: number;
  projectId: number;
  title: string;
  url: string;
  createdAt: string;
}

export interface IdeaNode {
  id: number;
  ideaId: number;
  label: string;
  description: string;
  imageUrl?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  actions: ActionLink[];
  inputPort?: PortMetadata | null;
  outputPort?: PortMetadata | null;
  isGroup?: boolean;
  groupNodeIds?: number[];
}

export interface IdeaConnection {
  id: number;
  ideaId: number;
  fromNodeId: number;
  toNodeId: number;
  fromSide?: PortSide;
  toSide?: PortSide;
  bidirectional?: boolean;
  label: string;
  color: string;
  properties: Record<string, string>;
  actions: ActionLink[];
  labelOffsetX?: number;
  labelOffsetY?: number;
  labelWidth?: number;
  labelHeight?: number;
}

export interface IdeaSummary {
  id: number;
  projectId: number;
  name: string;
  description: string;
  lastAccess: string;
  itemCount: number;
  complexity: string;
  isStashed: boolean;
  zoom: number;
  panX: number;
  panY: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceState {
  id: number;
  lastProjectId: number | null;
  lastIdeaId: number | null;
  cardinalityMode: CardinalityMode;
}

export interface IdeaDetail extends IdeaSummary {
  nodes: IdeaNode[];
  connections: IdeaConnection[];
}

export interface Project {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  resources: ProjectResource[];
  ideas: IdeaSummary[];
}

export type DrawingTool = 'select' | 'box' | 'group' | 'line' | 'bidirectional';
export type CardinalityMode = 'off' | 'degree' | 'hubs' | 'isolated';

export interface ExportedNode {
  refId: string;
  label: string;
  description: string;
  imageUrl?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  actions: ActionLink[];
  inputPort?: PortMetadata | null;
  outputPort?: PortMetadata | null;
  isGroup?: boolean;
  groupNodeIds?: number[];
}

export interface ExportedConnection {
  fromRefId: string;
  toRefId: string;
  fromSide: PortSide | string;
  toSide: PortSide | string;
  bidirectional: boolean;
  label: string;
  labelOffsetX: number;
  labelOffsetY: number;
  labelWidth: number;
  labelHeight: number;
  color: string;
  properties: Record<string, string>;
  actions: ActionLink[];
}

export interface ExportedIdea {
  name: string;
  description: string;
  complexity: string;
  isStashed: boolean;
  zoom: number;
  panX: number;
  panY: number;
  nodes: ExportedNode[];
  connections: ExportedConnection[];
}

export interface BrainFlowProjectExport {
  format: 'brainflow-export';
  version: 1;
  kind: 'project';
  exportedAt: string;
  project: {
    name: string;
    resources: Array<{ title: string; url: string }>;
    ideas: ExportedIdea[];
  };
}

export interface BrainFlowIdeaExport {
  format: 'brainflow-export';
  version: 1;
  kind: 'idea';
  exportedAt: string;
  idea: ExportedIdea;
}

export type BrainFlowExportBundle = BrainFlowProjectExport | BrainFlowIdeaExport;

export type Selection =
  | { type: 'node'; id: number }
  | { type: 'connection'; id: number }
  | { type: 'port'; nodeId: number; port: 'input' | 'output' }
  | null;
