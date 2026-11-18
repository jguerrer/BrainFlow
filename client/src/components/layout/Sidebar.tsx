import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import type { Project } from '../../types/brainflow';

interface SidebarProps {
  projects: Project[];
  activeProjectId: number | null;
  activeIdeaId: number | null;
  onSelectIdea: (projectId: number, ideaId: number) => void;
  onCreateProject: (name: string) => Promise<void>;
  onDeleteProject: (projectId: number) => Promise<void>;
  onCreateIdea: (projectId: number, name: string) => Promise<void>;
  onRenameIdea: (ideaId: number, name: string) => Promise<void>;
  onToggleStashIdea: (ideaId: number, isStashed: boolean) => Promise<void>;
  onDeleteIdea: (ideaId: number) => Promise<void>;
  onExportProject: (projectId: number) => Promise<void>;
  onExportIdea: (ideaId: number) => Promise<void>;
  onExportIdeaImage: (ideaId: number) => Promise<void>;
  onExportIdeaPdf: (ideaId: number) => Promise<void>;
  onImportJson: (bundle: unknown) => Promise<void>;
  onAddResource: (projectId: number, title: string, url: string) => Promise<void>;
  onDeleteResource: (resourceId: number) => Promise<void>;
}

function complexityBadgeClass(complexity: string) {
  if (complexity === 'High') return 'bg-rose-500/15 text-rose-400';
  if (complexity === 'Medium') return 'bg-amber-500/15 text-amber-400';
  return 'bg-emerald-500/15 text-emerald-400';
}

function formatLastAccess(isoDate: string) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function Sidebar({
  projects,
  activeProjectId,
  activeIdeaId,
  onSelectIdea,
  onCreateProject,
  onDeleteProject,
  onCreateIdea,
  onRenameIdea,
  onToggleStashIdea,
  onDeleteIdea,
  onExportProject,
  onExportIdea,
  onExportIdeaImage,
  onExportIdeaPdf,
  onImportJson,
  onAddResource,
  onDeleteResource,
}: SidebarProps) {
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [creatingProject, setCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const [creatingIdeaForProject, setCreatingIdeaForProject] = useState<number | null>(null);
  const [newIdeaName, setNewIdeaName] = useState('');

  const [menuIdeaId, setMenuIdeaId] = useState<number | null>(null);
  const [renamingIdeaId, setRenamingIdeaId] = useState<number | null>(null);
  const [renameText, setRenameText] = useState('');
  const [stashOpen, setStashOpen] = useState(false);

  const [addingResource, setAddingResource] = useState(false);
  const [resTitle, setResTitle] = useState('');
  const [resUrl, setResUrl] = useState('https://');

  useEffect(() => {
    if (menuIdeaId === null) return;
    function closeMenu() {
      setMenuIdeaId(null);
    }
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, [menuIdeaId]);

  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0] || null;
  const stashedItems = projects.flatMap((project) =>
    project.ideas
      .filter((idea) => idea.isStashed)
      .map((idea) => ({ idea, projectName: project.name, projectId: project.id }))
  );

  async function handleCreateProject(e: FormEvent) {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    await onCreateProject(newProjectName.trim());
    setNewProjectName('');
    setCreatingProject(false);
  }

  async function handleCreateIdea(e: FormEvent, projectId: number) {
    e.preventDefault();
    if (!newIdeaName.trim()) return;
    await onCreateIdea(projectId, newIdeaName.trim());
    setNewIdeaName('');
    setCreatingIdeaForProject(null);
  }

  async function handleAddResource(e: FormEvent) {
    e.preventDefault();
    if (!activeProject || !resTitle.trim() || !resUrl.trim()) return;
    await onAddResource(activeProject.id, resTitle.trim(), resUrl.trim());
    setResTitle('');
    setResUrl('https://');
    setAddingResource(false);
  }

  async function handleImportFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      await onImportJson(parsed);
    } catch {
      await onImportJson(null);
    }
  }

  return (
    <aside className="w-76 border-r border-slate-800 bg-slate-900/90 flex flex-col shrink-0 min-h-0">
      <input
        ref={importInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleImportFileChange}
        className="hidden"
      />
      {/* Projects Header */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between gap-2">
        <span className="font-semibold text-xs uppercase tracking-wider text-slate-400">
          Projects
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="text-xs px-2 py-1 rounded border border-slate-700 bg-slate-950 text-slate-300 hover:text-white hover:border-slate-500 cursor-pointer"
            title="Import a Project or Idea JSON file"
          >
            ↑ Import
          </button>
          <button
            type="button"
            onClick={() => setCreatingProject((v) => !v)}
            className="text-xs px-2.5 py-1 rounded bg-blue-600 text-white hover:bg-blue-500 cursor-pointer"
          >
            + Project
          </button>
        </div>
      </div>

      {creatingProject && (
        <form onSubmit={handleCreateProject} className="p-2.5 border-b border-slate-800 bg-slate-950 space-y-2">
          <input
            type="text"
            placeholder="Project name..."
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            autoFocus
            className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setCreatingProject(false)}
              className="px-2 py-1 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-2.5 py-1 rounded bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 cursor-pointer"
            >
              Create
            </button>
          </div>
        </form>
      )}

      {/* Projects & Ideas List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-3">
        {projects.length === 0 && (
          <div className="text-xs text-slate-400 p-3 text-center">
            No projects yet. Click "+ Project" to start.
          </div>
        )}

        {projects.map((project) => {
          const visibleIdeas = project.ideas.filter((idea) => !idea.isStashed);
          return (
            <div
              key={project.id}
              className="rounded-lg border border-slate-800 bg-slate-950/70"
            >
              <div className="px-3 py-2 flex items-center justify-between gap-2 bg-slate-900 border-b border-slate-800 rounded-t-lg">
                <span className="font-semibold text-xs text-slate-100 truncate" title={project.name}>
                  {project.name}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setCreatingIdeaForProject(
                        creatingIdeaForProject === project.id ? null : project.id
                      );
                      setNewIdeaName('');
                    }}
                    className="text-xs text-blue-400 hover:underline cursor-pointer"
                  >
                    + Idea
                  </button>
                  <button
                    type="button"
                    onClick={() => void onExportProject(project.id)}
                    className="text-xs text-slate-400 hover:text-emerald-400 cursor-pointer"
                    title="Export project JSON"
                  >
                    ↓
                  </button>
                  {projects.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onDeleteProject(project.id)}
                      className="text-xs text-slate-500 hover:text-rose-400 cursor-pointer"
                      title="Delete project"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {creatingIdeaForProject === project.id && (
                <form
                  onSubmit={(e) => handleCreateIdea(e, project.id)}
                  className="p-2 border-b border-slate-800 bg-slate-900/60 space-y-1.5"
                >
                  <input
                    type="text"
                    placeholder="Idea drawing name..."
                    value={newIdeaName}
                    onChange={(e) => setNewIdeaName(e.target.value)}
                    autoFocus
                    className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCreatingIdeaForProject(null)}
                      className="px-2 py-0.5 text-xs text-slate-400 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-2 py-0.5 rounded bg-blue-600 text-white text-xs cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                </form>
              )}

              <div className="p-1.5 space-y-1">
                {visibleIdeas.length === 0 ? (
                  <div className="px-2 py-2 text-xs text-slate-500 italic">
                    All ideas hidden in Stash.
                  </div>
                ) : (
                  visibleIdeas.map((idea) => {
                    const isActive = idea.id === activeIdeaId && project.id === activeProjectId;
                    const isMenuOpen = menuIdeaId === idea.id;
                    const isRenaming = renamingIdeaId === idea.id;

                    return (
                      <div
                        key={idea.id}
                        className={`relative group rounded-md border transition ${
                          isActive
                            ? 'bg-blue-600/15 border-blue-500/60'
                            : 'border-transparent hover:bg-slate-900'
                        }`}
                      >
                        {isRenaming ? (
                          <form
                            onSubmit={async (e) => {
                              e.preventDefault();
                              if (renameText.trim()) {
                                await onRenameIdea(idea.id, renameText.trim());
                              }
                              setRenamingIdeaId(null);
                            }}
                            className="p-2 space-y-1.5"
                          >
                            <input
                              type="text"
                              value={renameText}
                              onChange={(e) => setRenameText(e.target.value)}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') setRenamingIdeaId(null);
                              }}
                              className="w-full px-2 py-1 rounded bg-slate-950 border border-blue-500 text-xs text-slate-100 focus:outline-none"
                            />
                            <div className="flex justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setRenamingIdeaId(null)}
                                className="px-2 py-0.5 text-xs text-slate-400 cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                className="px-2 py-0.5 rounded bg-blue-600 text-white text-xs cursor-pointer"
                              >
                                Save
                              </button>
                            </div>
                          </form>
                        ) : (
                          <div className="flex items-start justify-between gap-1 p-2">
                            <button
                              type="button"
                              onClick={() => onSelectIdea(project.id, idea.id)}
                              className="flex-1 text-left min-w-0 cursor-pointer"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium text-xs text-slate-100 truncate">
                                  {idea.name}
                                </span>
                                <span
                                  className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${complexityBadgeClass(
                                    idea.complexity
                                  )}`}
                                >
                                  {idea.complexity}
                                </span>
                              </div>
                              <div className="flex items-center justify-between mt-1 text-xs text-slate-400">
                                <span>{idea.itemCount} items</span>
                                <span>{formatLastAccess(idea.lastAccess)}</span>
                              </div>
                            </button>

                            {/* Per-Idea Actions (...) Button */}
                            <button
                              type="button"
                              aria-label="Idea actions"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuIdeaId(isMenuOpen ? null : idea.id);
                              }}
                              className={`px-1.5 py-0.5 rounded text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition ${
                                isMenuOpen ? 'opacity-100 bg-slate-800 text-white' : 'opacity-70 group-hover:opacity-100'
                              }`}
                              title="More actions"
                            >
                              ⋯
                            </button>
                          </div>
                        )}

                        {/* Dropdown Menu */}
                        {isMenuOpen && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-2 top-8 z-30 w-44 rounded-lg border border-slate-700 bg-slate-900 shadow-xl py-1 text-xs"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setMenuIdeaId(null);
                                setRenamingIdeaId(idea.id);
                                setRenameText(idea.name);
                              }}
                              className="w-full text-left px-3 py-1.5 text-slate-200 hover:bg-slate-800 cursor-pointer"
                            >
                              ✎ Rename
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setMenuIdeaId(null);
                                setStashOpen(true);
                                void onToggleStashIdea(idea.id, true);
                              }}
                              className="w-full text-left px-3 py-1.5 text-amber-300 hover:bg-slate-800 cursor-pointer"
                            >
                              📦 Hide / Move to Stash
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setMenuIdeaId(null);
                                void onExportIdea(idea.id);
                              }}
                              className="w-full text-left px-3 py-1.5 text-emerald-300 hover:bg-slate-800 cursor-pointer"
                            >
                              ⬇ Export Idea JSON
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setMenuIdeaId(null);
                                void onExportIdeaImage(idea.id);
                              }}
                              className="w-full text-left px-3 py-1.5 text-teal-300 hover:bg-slate-800 cursor-pointer"
                            >
                              🖼 Export PNG Image
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setMenuIdeaId(null);
                                void onExportIdeaPdf(idea.id);
                              }}
                              className="w-full text-left px-3 py-1.5 text-sky-300 hover:bg-slate-800 cursor-pointer"
                            >
                              📄 Export PDF
                            </button>
                            <div className="my-1 border-t border-slate-800" />
                            <button
                              type="button"
                              onClick={() => {
                                setMenuIdeaId(null);
                                void onDeleteIdea(idea.id);
                              }}
                              className="w-full text-left px-3 py-1.5 text-rose-400 hover:bg-slate-800 cursor-pointer"
                            >
                              🗑 Delete Idea
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Collapsible Stash Drawer */}
      <div className="border-t border-slate-800 bg-slate-950/60">
        <button
          type="button"
          onClick={() => setStashOpen((v) => !v)}
          className="w-full px-3 py-2 flex items-center justify-between text-xs hover:bg-slate-900 cursor-pointer"
        >
          <span className="font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <span>📦 Stash</span>
            <span className="px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-200 text-xs">
              {stashedItems.length}
            </span>
          </span>
          <span className="text-slate-400">{stashOpen ? '▾' : '▸'}</span>
        </button>

        {stashOpen && (
          <div className="px-2.5 pb-2.5 max-h-44 overflow-y-auto space-y-1.5">
            {stashedItems.length === 0 ? (
              <div className="text-xs text-slate-500 italic px-1 py-1">
                No hidden ideas in stash. Use ⋯ on any idea to stash it.
              </div>
            ) : (
              stashedItems.map(({ idea, projectName }) => (
                <div
                  key={idea.id}
                  className="p-2 rounded-md bg-slate-900 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-slate-200 truncate">{idea.name}</div>
                    <div className="text-slate-400 truncate">
                      {projectName} • {idea.itemCount} items
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => void onToggleStashIdea(idea.id, false)}
                      className="px-2 py-1 rounded bg-blue-600/20 text-blue-300 hover:bg-blue-600/35 cursor-pointer"
                      title="Restore back to project"
                    >
                      Retrieve
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDeleteIdea(idea.id)}
                      className="px-1.5 py-1 text-slate-500 hover:text-rose-400 cursor-pointer"
                      title="Delete permanently"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Per-Project Resources / Links Panel */}
      <div className="border-t border-slate-800 p-3 bg-slate-900 max-h-60 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-xs uppercase tracking-wider text-slate-400 truncate">
            {activeProject ? `${activeProject.name} Links` : 'Project Resources'}
          </span>
          {activeProject && (
            <button
              type="button"
              onClick={() => setAddingResource((v) => !v)}
              className="text-xs text-blue-400 hover:underline shrink-0 cursor-pointer"
            >
              + Add Link
            </button>
          )}
        </div>

        {addingResource && (
          <form onSubmit={handleAddResource} className="mb-2 p-2 rounded bg-slate-950 border border-slate-800 space-y-1.5">
            <input
              type="text"
              placeholder="Title (e.g. API Spec)"
              value={resTitle}
              onChange={(e) => setResTitle(e.target.value)}
              className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            />
            <input
              type="url"
              placeholder="https://..."
              value={resUrl}
              onChange={(e) => setResUrl(e.target.value)}
              className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            />
            <div className="flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setAddingResource(false)}
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

        <div className="space-y-1.5 overflow-y-auto text-xs">
          {!activeProject || activeProject.resources.length === 0 ? (
            <div className="text-slate-500 italic">No resources linked to this project.</div>
          ) : (
            activeProject.resources.map((res) => (
              <div
                key={res.id}
                className="flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-slate-950 border border-slate-800"
              >
                <a
                  href={res.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline truncate"
                  title={res.url}
                >
                  {res.title} ↗
                </a>
                <button
                  type="button"
                  onClick={() => onDeleteResource(res.id)}
                  className="text-slate-500 hover:text-rose-400 cursor-pointer shrink-0"
                  title="Remove link"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}
