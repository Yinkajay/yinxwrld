"use client";

import { useState, type FormEvent } from "react";
import { useWorkspace } from "@/app/hooks/use-workspace";
import { useCategoryFilter } from "@/app/hooks/use-category-filter";
import StorageNotice from "@/app/components/storage-notice";
import { CategoryBadge, CategoryFilter, CategoryInput } from "@/app/components/category-controls";
import {
  createId,
  filterByCategory,
  type CreativeIdea,
  type CreativeProject,
  type ProjectStatus,
} from "@/app/lib/workspace";
import { assignWorkspaceCategory, getWorkspaceCategories } from "@/app/lib/workspace-settings";

const projectStatuses: { value: ProjectStatus; label: string }[] = [
  { value: "planned", label: "Planned" },
  { value: "active", label: "In progress" },
  { value: "paused", label: "On hold" },
  { value: "complete", label: "Complete" },
];

function ProjectCard({
  project,
  categories,
  onUpdate,
  onDelete,
}: {
  project: CreativeProject;
  categories: string[];
  onUpdate: (projectId: string, change: Partial<Pick<CreativeProject, "title" | "notes" | "status" | "category">>) => void;
  onDelete: (projectId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [title, setTitle] = useState(project.title);
  const [notes, setNotes] = useState(project.notes);
  const [category, setCategory] = useState(project.category ?? "");

  function saveProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    onUpdate(project.id, { title: title.trim(), notes: notes.trim(), category: category.trim() || undefined });
    setEditing(false);
  }

  return (
    <article className={`project-card status-${project.status}`}>
      <div className="project-card-topline">
        <span className="project-mark" aria-hidden="true">✳</span>
        <label className="sr-only" htmlFor={`project-status-${project.id}`}>Status for {project.title}</label>
        <select
          id={`project-status-${project.id}`}
          className="project-status-select"
          value={project.status}
          onChange={(event) => onUpdate(project.id, { status: event.target.value as ProjectStatus })}
        >
          {projectStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
        </select>
      </div>

      {editing ? (
        <form className="project-edit-form" onSubmit={saveProject}>
          <label>
            <span>Project name</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required />
          </label>
          <label>
            <span>Notes</span>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} maxLength={1000} />
          </label>
          <CategoryInput id={`project-${project.id}-category`} value={category} categories={categories} onChange={setCategory} />
          <div className="card-action-row">
            <button className="button button-primary button-small" type="submit" disabled={!title.trim()}>Save project</button>
            <button className="button button-quiet button-small" type="button" onClick={() => { setTitle(project.title); setNotes(project.notes); setCategory(project.category ?? ""); setEditing(false); }}>Cancel</button>
          </div>
        </form>
      ) : (
        <>
          <h3>{project.title}</h3>
          <CategoryBadge category={project.category} />
          <p className={`project-notes${project.notes ? "" : " is-empty"}`}>
            {project.notes || "Add a note about what you are making."}
          </p>
          <div className="card-action-row">
            <button className="text-button" type="button" onClick={() => { setTitle(project.title); setNotes(project.notes); setCategory(project.category ?? ""); setEditing(true); }}>Edit details</button>
            {confirmingDelete ? (
              <span className="inline-confirm">
                <span>Delete?</span>
                <button className="text-button danger-text" type="button" onClick={() => onDelete(project.id)}>Confirm</button>
                <button className="text-button muted-button" type="button" onClick={() => setConfirmingDelete(false)}>Cancel</button>
              </span>
            ) : (
              <button className="text-button muted-button" type="button" onClick={() => setConfirmingDelete(true)}>Delete</button>
            )}
          </div>
        </>
      )}
    </article>
  );
}

function IdeaCard({
  idea,
  onUpdate,
  onPromote,
  onDelete,
}: {
  idea: CreativeIdea;
  onUpdate: (ideaId: string, change: Partial<Pick<CreativeIdea, "title" | "notes">>) => void;
  onPromote: (idea: CreativeIdea) => void;
  onDelete: (ideaId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [title, setTitle] = useState(idea.title);
  const [notes, setNotes] = useState(idea.notes);

  function saveIdea(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    onUpdate(idea.id, { title: title.trim(), notes: notes.trim() });
    setEditing(false);
  }

  return (
    <article className="idea-card">
      {editing ? (
        <form className="idea-edit-form" onSubmit={saveIdea}>
          <label>
            <span>Idea</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required />
          </label>
          <label>
            <span>Extra context</span>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} maxLength={1000} />
          </label>
          <div className="card-action-row">
            <button className="button button-primary button-small" type="submit" disabled={!title.trim()}>Save idea</button>
            <button className="button button-quiet button-small" type="button" onClick={() => { setTitle(idea.title); setNotes(idea.notes); setEditing(false); }}>Cancel</button>
          </div>
        </form>
      ) : (
        <>
          <div className="idea-pin" aria-hidden="true">✧</div>
          <h3>{idea.title}</h3>
          {idea.notes && <p>{idea.notes}</p>}
          <div className="idea-card-footer">
            <button className="button button-soft button-small" type="button" onClick={() => onPromote(idea)}>Make a project <span aria-hidden="true">↗</span></button>
            <div className="idea-secondary-actions">
              <button className="text-button" type="button" onClick={() => { setTitle(idea.title); setNotes(idea.notes); setEditing(true); }}>Edit</button>
              {confirmingDelete ? (
                <span className="inline-confirm">
                  <button className="text-button danger-text" type="button" onClick={() => onDelete(idea.id)}>Confirm</button>
                  <button className="text-button muted-button" type="button" onClick={() => setConfirmingDelete(false)}>Cancel</button>
                </span>
              ) : (
                <button className="text-button muted-button" type="button" onClick={() => setConfirmingDelete(true)}>Delete</button>
              )}
            </div>
          </div>
        </>
      )}
    </article>
  );
}

export default function CreativeWorkspace() {
  const { data, isLoaded, isConnected, storageMessage, retryConnection, updateWorkspace } = useWorkspace();
  const [ideaTitle, setIdeaTitle] = useState("");
  const [ideaNotes, setIdeaNotes] = useState("");
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [projectTitle, setProjectTitle] = useState("");
  const [projectNotes, setProjectNotes] = useState("");
  const [projectCategory, setProjectCategory] = useState("");
  const categories = getWorkspaceCategories(data);
  const [selectedProjectCategory, setSelectedProjectCategory] = useCategoryFilter(categories);
  const visibleProjects = filterByCategory(data.projects, selectedProjectCategory);

  function addIdea(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isLoaded) return;
    const title = ideaTitle.trim();
    if (!title) return;
    const now = new Date().toISOString();
    const idea: CreativeIdea = {
      id: createId(),
      title,
      notes: ideaNotes.trim(),
      createdAt: now,
      updatedAt: now,
    };
    updateWorkspace((current) => ({ ...current, ideas: [idea, ...current.ideas] }));
    setIdeaTitle("");
    setIdeaNotes("");
  }

  function addProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isLoaded) return;
    const title = projectTitle.trim();
    if (!title) return;
    const now = new Date().toISOString();
    const project: CreativeProject = {
      id: createId(),
      title,
      notes: projectNotes.trim(),
      status: "planned",
      createdAt: now,
      updatedAt: now,
    };
    updateWorkspace((current) => {
      const { data: categorized, category } = assignWorkspaceCategory(current, projectCategory);
      return {
        ...categorized,
        projects: [category ? { ...project, category } : project, ...current.projects],
      };
    });
    setProjectTitle("");
    setProjectNotes("");
    setProjectCategory("");
    setShowProjectForm(false);
  }

  function updateProject(projectId: string, change: Partial<Pick<CreativeProject, "title" | "notes" | "status" | "category">>) {
    const now = new Date().toISOString();
    updateWorkspace((current) => {
      const hasCategory = Object.prototype.hasOwnProperty.call(change, "category");
      const { data: categorized, category } = hasCategory ? assignWorkspaceCategory(current, change.category ?? "") : { data: current, category: undefined };
      return {
        ...categorized,
        projects: current.projects.map((project) => project.id === projectId
          ? { ...project, ...change, ...(hasCategory ? { category } : {}), updatedAt: now }
          : project),
      };
    });
  }

  function updateIdea(ideaId: string, change: Partial<Pick<CreativeIdea, "title" | "notes">>) {
    updateWorkspace((current) => ({
      ...current,
      ideas: current.ideas.map((idea) => idea.id === ideaId
        ? { ...idea, ...change, updatedAt: new Date().toISOString() }
        : idea),
    }));
  }

  function promoteIdea(idea: CreativeIdea) {
    const now = new Date().toISOString();
    const project: CreativeProject = {
      id: createId(),
      title: idea.title,
      notes: idea.notes,
      status: "planned",
      createdAt: now,
      updatedAt: now,
    };
    updateWorkspace((current) => ({
      ...current,
      projects: [project, ...current.projects],
      ideas: current.ideas.filter((item) => item.id !== idea.id),
    }));
  }

  return (
    <div className="page-content creative-page">
      <header className="page-heading creative-heading">
        <div className="heading-copy">
          <p className="eyebrow">FOR THE FUN STUFF</p>
          <h1>Things I want to make.</h1>
          <p className="page-subtitle">Projects, early ideas, and things to come back to.</p>
        </div>
        <div className="creative-stats" aria-label="Creative workspace totals">
          <div><strong>{data.projects.length}</strong><span>projects</span></div>
          <div><strong>{data.ideas.length}</strong><span>ideas</span></div>
        </div>
      </header>

      {storageMessage && <StorageNotice message={storageMessage} onRetry={isConnected ? undefined : retryConnection} />}

      {!isLoaded ? (
        <div className="creative-loading"><div className="skeleton skeleton-line" /><div className="skeleton skeleton-line short" /></div>
      ) : !isConnected ? (
        <div className="creative-empty empty-state mongo-unavailable">
          <span className="empty-mark" aria-hidden="true">!</span>
          <p>Reconnect to MongoDB to open your creative workspace.</p>
          <span>Your projects and ideas are not stored on this device.</span>
        </div>
      ) : <div className="creative-grid">
        <section className="creative-section projects-section" aria-labelledby="projects-heading">
          <header className="section-heading creative-section-heading">
            <div>
              <p className="panel-kicker">THINGS IN MOTION</p>
              <h2 id="projects-heading">Projects</h2>
            </div>
            <div className="project-heading-tools">
              <CategoryFilter id="project-category-filter" value={selectedProjectCategory} categories={categories} onChange={setSelectedProjectCategory} />
              <span className="task-total-pill">{visibleProjects.length} {visibleProjects.length === 1 ? "project" : "projects"}</span>
              <button className="button button-primary" type="button" disabled={!isLoaded} onClick={() => setShowProjectForm((current) => !current)}>
                <span aria-hidden="true">+</span> New project
              </button>
            </div>
          </header>

          {showProjectForm && (
            <form className="entry-form project-create-form" onSubmit={addProject}>
              <div className="form-title-row"><h3>Start a project</h3><button className="icon-action" type="button" aria-label="Close project form" onClick={() => setShowProjectForm(false)}>×</button></div>
              <label><span>Project name</span><input autoFocus value={projectTitle} onChange={(event) => setProjectTitle(event.target.value)} maxLength={120} placeholder="What are you making?" required /></label>
              <label><span>A note to yourself</span><textarea value={projectNotes} onChange={(event) => setProjectNotes(event.target.value)} rows={3} maxLength={1000} placeholder="A little context or a first step" /></label>
              <CategoryInput id="new-project-category" value={projectCategory} categories={categories} onChange={setProjectCategory} />
              <button className="button button-primary" type="submit" disabled={!isLoaded || !projectTitle.trim()}>Create project</button>
            </form>
          )}

          {!isLoaded ? (
            <div className="creative-loading"><div className="skeleton skeleton-line" /><div className="skeleton skeleton-line short" /></div>
          ) : visibleProjects.length ? (
            <div className="project-grid">
              {visibleProjects.map((project) => (
                <ProjectCard key={project.id} project={project} categories={categories} onUpdate={updateProject} onDelete={(projectId) => updateWorkspace((current) => ({ ...current, projects: current.projects.filter((item) => item.id !== projectId) }))} />
              ))}
            </div>
          ) : data.projects.length ? (
            <div className="creative-empty empty-state filtered-empty-state">
              <span className="empty-mark" aria-hidden="true">⌕</span>
              <p>No projects in {selectedProjectCategory}.</p>
              <button className="text-button" type="button" onClick={() => setSelectedProjectCategory("")}>Show all categories</button>
            </div>
          ) : (
            <div className="creative-empty empty-state">
              <span className="empty-mark" aria-hidden="true">✳</span>
              <p>Your next project can start small.</p>
              <span>Give an idea a name and a place to grow.</span>
            </div>
          )}
        </section>

        <section className="creative-section ideas-section" aria-labelledby="ideas-heading">
          <header className="section-heading creative-section-heading">
            <div>
              <p className="panel-kicker">A PLACE TO BEGIN</p>
              <h2 id="ideas-heading">Idea shelf</h2>
            </div>
            <span className="task-total-pill">{data.ideas.length} saved</span>
          </header>

          <form className="entry-form idea-create-form" onSubmit={addIdea}>
            <label><span>Catch an idea</span><input value={ideaTitle} onChange={(event) => setIdeaTitle(event.target.value)} maxLength={120} placeholder="A thought, a question, a maybe…" required /></label>
            <label><span>A few more details <span className="optional-label">optional</span></span><textarea value={ideaNotes} onChange={(event) => setIdeaNotes(event.target.value)} rows={3} maxLength={1000} placeholder="Keep the spark alive with a little context" /></label>
            <button className="button button-soft" type="submit" disabled={!isLoaded || !ideaTitle.trim()}>Save idea <span aria-hidden="true">↗</span></button>
          </form>

          {!isLoaded ? null : data.ideas.length ? (
            <div className="idea-list">
              {data.ideas.map((idea) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  onUpdate={updateIdea}
                  onPromote={promoteIdea}
                  onDelete={(ideaId) => updateWorkspace((current) => ({ ...current, ideas: current.ideas.filter((item) => item.id !== ideaId) }))}
                />
              ))}
            </div>
          ) : (
            <div className="idea-empty empty-state">
              <span className="empty-mark" aria-hidden="true">✧</span>
              <p>Keep the first thought that catches you.</p>
              <span>It does not need to be figured out yet.</span>
            </div>
          )}
        </section>
      </div>}
    </div>
  );
}

