import { useState, useEffect } from 'react';
import {
  getProject, getTasksForProject, insertProjectTask,
  updateProjectTask, deleteProjectTask, insertPointLog,
} from '../utils/storage';
import { todayString } from '../utils/dateHelpers';

function TaskRow({ task, onToggle, onDelete }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <button
        onClick={() => onToggle(task)}
        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
          task.completed ? 'bg-success border-success' : 'border-border'
        }`}
      >
        {task.completed ? <span className="text-white text-xs font-bold">✓</span> : null}
      </button>
      <span className={`flex-1 text-[15px] leading-snug ${task.completed ? 'line-through text-textMuted' : 'text-textPrimary'}`}>
        {task.name}
      </span>
      {task.completed ? (
        <span className="text-[12px] font-bold text-success flex-shrink-0">+15</span>
      ) : null}
      <button
        onClick={() => onDelete(task.id)}
        className="text-textMuted text-base w-7 flex-shrink-0 flex items-center justify-center"
      >✕</button>
    </div>
  );
}

export default function ProjectDetailScreen({ projectId, onBack }) {
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [newTaskName, setNewTaskName] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [projectId]);

  async function loadData() {
    setLoading(true);
    try {
      const [proj, taskList] = await Promise.all([
        getProject(projectId),
        getTasksForProject(projectId),
      ]);
      setProject(proj);
      setTasks(taskList);
    } catch (_) {}
    setLoading(false);
  }

  async function handleToggleTask(task) {
    try {
      if (task.completed) {
        await updateProjectTask(task.id, { completed: 0 });
      } else {
        await updateProjectTask(task.id, { completed: 1 });
        await insertPointLog({
          sourceType: 'project_task',
          sourceId: task.id,
          points: 15,
          logDate: todayString(),
        });
      }
      await loadData();
    } catch (_) {}
  }

  async function handleAddTask() {
    const name = newTaskName.trim();
    if (!name) return;
    try {
      await insertProjectTask({ projectId, name, orderIndex: tasks.length });
      setNewTaskName('');
      setShowAdd(false);
      await loadData();
    } catch (_) {}
  }

  async function handleDeleteTask(id) {
    try {
      await deleteProjectTask(id);
      await loadData();
    } catch (_) {}
  }

  if (loading) return <div className="flex-1 flex items-center justify-center"><div className="spinner" /></div>;
  if (!project) return null;

  const doneCount = tasks.filter(t => t.completed).length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card flex-shrink-0">
        <button onClick={onBack} className="text-primary font-semibold text-[15px] w-16">‹ Back</button>
        <span className="flex-1 text-textPrimary font-bold text-center text-[16px] truncate">{project.name}</span>
        <span className="w-16" />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 pt-4 pb-6">
          {project.description ? (
            <p className="text-textSecondary text-[14px] mb-4 leading-relaxed">{project.description}</p>
          ) : null}

          <div className="flex items-center justify-between mb-2">
            <div className="section-title">Tasks</div>
            {tasks.length > 0 && (
              <span className="text-[12px] text-textMuted">{doneCount}/{tasks.length} done · +15 pts each</span>
            )}
          </div>

          {tasks.length > 0 && (
            <div className="card mb-3">
              {tasks.map((task, i) => (
                <div key={task.id}>
                  {i > 0 && <div className="h-px bg-border" />}
                  <TaskRow task={task} onToggle={handleToggleTask} onDelete={handleDeleteTask} />
                </div>
              ))}
            </div>
          )}

          {tasks.length === 0 && (
            <div className="text-center py-8">
              <div className="text-3xl mb-2">📝</div>
              <div className="text-textMuted text-[14px]">No tasks yet. Add one to get started.</div>
            </div>
          )}

          {showAdd ? (
            <div className="card mb-3">
              <input
                type="text"
                placeholder="Task name"
                value={newTaskName}
                onChange={e => setNewTaskName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddTask()}
                autoFocus
                className="mb-3"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowAdd(false); setNewTaskName(''); }}
                  className="flex-1 border border-border rounded-xl py-2.5 text-textSecondary font-semibold text-[14px]"
                >Cancel</button>
                <button
                  onClick={handleAddTask}
                  className="flex-1 bg-primary rounded-xl py-2.5 text-white font-bold text-[14px]"
                >Add</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAdd(true)} className="dashed-btn w-full">+ Add Task</button>
          )}
        </div>
      </div>
    </div>
  );
}
