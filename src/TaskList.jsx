import { useState } from "react";
import "./TaskList.css";

const TASK_STATUSES = ["Nepradėta", "Vykdoma", "Atlikta"];

function TaskList({ tasks = [], loading = false, onUpdateTask, onDeleteTask }) {
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editStatus, setEditStatus] = useState(TASK_STATUSES[0]);
  const [editDeadline, setEditDeadline] = useState("");
  const [savingTaskId, setSavingTaskId] = useState(null);
  const [deletingTaskId, setDeletingTaskId] = useState(null);
  const [actionError, setActionError] = useState("");

  function startEditing(task) {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditStatus(task.status);
    setEditDeadline(task.deadline);
    setActionError("");
  }

  async function saveTask(event, taskId) {
    event.preventDefault();
    setSavingTaskId(taskId);
    setActionError("");

    try {
      await onUpdateTask?.(taskId, {
        title: editTitle.trim(),
        status: editStatus,
        deadline: editDeadline,
      });
      setEditingTaskId(null);
    } catch {
      setActionError("Užduoties pakeitimų išsaugoti nepavyko.");
    } finally {
      setSavingTaskId(null);
    }
  }

  async function deleteTask(task) {
    if (!window.confirm(`Ar tikrai norite ištrinti užduotį „${task.title}“?`)) return;

    setDeletingTaskId(task.id);
    setActionError("");
    try {
      await onDeleteTask?.(task.id);
    } catch {
      setActionError("Užduoties ištrinti nepavyko.");
    } finally {
      setDeletingTaskId(null);
    }
  }

  if (loading) {
    return (
      <section className="task-card">
        <p className="task-state">Kraunamos užduotys...</p>
      </section>
    );
  }

  if (tasks.length === 0) {
    return (
      <section className="task-card">
        <p className="task-state">Užduočių kol kas nėra.</p>
      </section>
    );
  }

  return (
    <section className="task-card">
      <header className="task-card__header">
        <h2>Užduotys</h2>
        <p>Artimiausi darbai ir jų būsena</p>
      </header>

      {actionError && <p className="task-action-error" role="alert">{actionError}</p>}

      <div className="task-list">
        {tasks.map((task) => (
          <article className="task-item" key={task.id}>
            {editingTaskId === task.id ? (
              <form className="task-edit-form" onSubmit={(event) => saveTask(event, task.id)}>
                <label className="task-edit-field">
                  <span>Užduoties pavadinimas</span>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(event) => setEditTitle(event.target.value)}
                    maxLength={160}
                    required
                  />
                </label>
                <label className="task-edit-field">
                  <span>Statusas</span>
                  <select value={editStatus} onChange={(event) => setEditStatus(event.target.value)}>
                    {TASK_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </label>
                <label className="task-edit-field">
                  <span>Terminas</span>
                  <input type="date" value={editDeadline} onChange={(event) => setEditDeadline(event.target.value)} required />
                </label>
                <div className="task-actions">
                  <button className="task-action-button task-action-button--primary" type="submit" disabled={savingTaskId === task.id}>
                    {savingTaskId === task.id ? "Saugoma..." : "Išsaugoti"}
                  </button>
                  <button className="task-action-button" type="button" onClick={() => setEditingTaskId(null)} disabled={savingTaskId === task.id}>
                    Atšaukti
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="task-item__top">
                  <h3>{task.title}</h3>
                  <span className={`task-status task-status--${task.status.toLowerCase().replace("ė", "e").replace(" ", "-")}`}>
                    {task.status}
                  </span>
                </div>
                <p className="task-deadline"><span>Terminas:</span> {task.deadline || "Nenurodytas"}</p>
                <div className="task-actions">
                  <button className="task-action-button" type="button" onClick={() => startEditing(task)}>Redaguoti</button>
                  <button className="task-action-button task-action-button--danger" type="button" onClick={() => deleteTask(task)} disabled={deletingTaskId === task.id}>
                    {deletingTaskId === task.id ? "Trinama..." : "Ištrinti"}
                  </button>
                </div>
              </>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

export default TaskList;
