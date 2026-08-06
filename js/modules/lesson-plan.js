// ============================================================
// 备课中心模块 - 完整任务管理系统
// ============================================================
const STORAGE_KEY = 'lessonTasks';

// 默认示例数据
const DEFAULT_TASKS = [];

// ========== 数据操作 ==========
function loadTasks() {
  let data = localStorage.getItem(STORAGE_KEY);
  if (!data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_TASKS));
    return DEFAULT_TASKS;
  }
  try {
    const tasks = JSON.parse(data);
    // 自动更新逾期状态
    const now = new Date();
    tasks.forEach(t => {
      if (t.deadline && t.status !== '已完成' && t.status !== '逾期') {
        const dueDate = new Date(t.deadline);
        if (dueDate < now) {
          t.status = '逾期';
        }
      }
    });
    return tasks;
  } catch {
    return DEFAULT_TASKS;
  }
}

function saveTasks(tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  window.dispatchEvent(new Event('taskUpdated'));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function isDueSoon(deadline) {
  const now = new Date();
  const due = new Date(deadline);
  const diff = (due - now) / (1000 * 60 * 60 * 24);
  return diff > 0 && diff <= 1;
}

// ========== 筛选逻辑 ==========
function filterTasks(tasks) {
  const grade = document.getElementById('filterGrade')?.value || '';
  const type = document.getElementById('filterType')?.value || '';
  const status = document.getElementById('filterStatus')?.value || '';
  const priority = document.getElementById('filterPriority')?.value || '';
  const keyword = document.getElementById('searchTask')?.value.trim().toLowerCase() || '';

  return tasks.filter(t => {
    if (t.archived) return false;
    if (grade && t.grade !== grade) return false;
    if (type && t.type !== type) return false;
    if (status && t.status !== status) return false;
    if (priority && t.priority !== priority) return false;
    if (keyword && !t.title.toLowerCase().includes(keyword)) return false;
    return true;
  });
}

// ========== 列表视图 ==========
function renderListView(tasks) {
  if (tasks.length === 0) return '<p class="empty">暂无任务，点击「新增备课」添加。</p>';
  let html = '<div class="task-list">';
  tasks.forEach(t => {
    const priorityClass = t.priority === '紧急' ? 'urgent' : (t.priority === '普通' ? 'normal' : 'later');
    const overdue = t.status === '逾期' ? 'overdue' : '';
    const dueSoon = t.deadline && isDueSoon(t.deadline) && t.status !== '逾期' ? 'due-soon' : '';
    const statusMap = { '待备课': 'pending', '备课中': 'doing', '已完成': 'done', '逾期': 'overdue' };
    const statusText = t.status;
    html += `
      <div class="task-card ${priorityClass} ${overdue} ${dueSoon}" data-id="${t.id}">
        <div class="task-info">
          <div class="task-title">${t.title}</div>
          <div class="task-meta">
            <span>📚 ${t.type}</span>
            <span>🏫 ${t.grade} ${t.classes.join('、')}</span>
            <span>📅 截止 ${t.deadline || '未设'}</span>
            <span>⏰ 上课 ${t.classTime || '未设'}</span>
            <span class="task-status status-${statusMap[statusText]}">${statusText}</span>
          </div>
          ${t.materials && t.materials.length ? `<div style="font-size:0.8rem;color:var(--text-light);margin-top:4px;">📎 ${t.materials.join('、')}</div>` : ''}
          ${(t.objectives||t.keyPoints||t.process) ? `<div class="task-outline" style="margin-top:6px;font-size:0.82rem;color:var(--text);line-height:1.5;">
            ${t.objectives ? `<div><b>目标：</b>${htmlEncode(t.objectives)}</div>` : ''}
            ${t.keyPoints ? `<div><b>重难点：</b>${htmlEncode(t.keyPoints)}</div>` : ''}
            ${t.process ? `<div><b>过程：</b>${htmlEncode(t.process)}</div>` : ''}
          </div>` : ''}
        </div>
        <div class="task-actions">
          <button class="edit-btn" data-id="${t.id}">✏️</button>
          ${t.status !== '已完成' ? `<button class="done-btn" data-id="${t.id}">✅</button>` : ''}
          <button class="del-btn" data-id="${t.id}">🗑️</button>
        </div>
      </div>
    `;
  });
  html += '</div>';
  return html;
}

// ========== 看板视图 ==========
function renderKanbanView(tasks) {
  const statuses = ['待备课', '备课中', '已完成', '逾期'];
  let html = '<div class="kanban-board">';
  statuses.forEach(status => {
    const items = tasks.filter(t => t.status === status);
    html += `<div class="kanban-column"><h4>${status} (${items.length})</h4>`;
    items.forEach(t => {
      const priorityColor = t.priority === '紧急' ? 'var(--c-danger)' : (t.priority === '普通' ? 'var(--c-warning)' : 'var(--c-muted)');
      html += `
        <div class="kanban-card" style="border-left-color:${priorityColor};">
          <div class="task-title">${t.title}</div>
          <div class="task-meta">${t.type} · ${t.grade}</div>
          <div class="task-meta">📅 ${t.deadline || '无截止'}</div>
          <div class="task-actions">
            <button class="edit-btn" data-id="${t.id}">✏️</button>
            ${t.status !== '已完成' ? `<button class="done-btn" data-id="${t.id}">✅</button>` : ''}
            <button class="del-btn" data-id="${t.id}">🗑️</button>
          </div>
        </div>
      `;
    });
    html += '</div>';
  });
  html += '</div>';
  return html;
}

// ========== 渲染主界面 ==========
function renderLessonPlan() {
  const tasks = loadTasks();
  const filtered = filterTasks(tasks);
  const viewMode = localStorage.getItem('lessonViewMode') || 'list';

  return `
    <div class="card">
      <div class="panel-head"><h2 class="panel-title">📋 备课任务管理</h2></div>
      <div class="task-toolbar">
        <button class="btn" id="addTaskBtn">＋ 新增备课</button>
        <input type="text" id="searchTask" class="da-input" placeholder="搜索任务标题..." style="width:180px;" />
        <select id="filterGrade" class="da-select">
          <option value="">全部年级</option>
          <option value="高一">高一</option>
          <option value="高二">高二</option>
          <option value="高三">高三</option>
        </select>
        <select id="filterType" class="da-select">
  <option value="">全部类型</option>
  <option value="课文">📖 课文</option>
  <option value="文言文">📜 文言文</option>
  <option value="古诗词">📝 古诗词</option>
</select>
        <select id="filterStatus" class="da-select">
          <option value="">全部状态</option>
          <option value="待备课">待备课</option>
          <option value="备课中">备课中</option>
          <option value="已完成">已完成</option>
          <option value="逾期">逾期</option>
        </select>
        <select id="filterPriority" class="da-select">
          <option value="">全部优先级</option>
          <option value="紧急">紧急</option>
          <option value="普通">普通</option>
          <option value="延后">延后</option>
        </select>
        <button class="btn btn-secondary" id="viewToggle">切换为 ${viewMode === 'list' ? '看板' : '列表'} 视图</button>
        <button class="btn btn-secondary" id="exportTasksBtn">📤 导出文本</button>
        <button class="btn btn-secondary" id="batchDoneBtn">✅ 批量完成</button>
        <button class="btn btn-secondary" id="batchArchiveBtn">📦 批量归档</button>
      </div>
      <div id="taskContainer">
        ${viewMode === 'list' ? renderListView(filtered) : renderKanbanView(filtered)}
      </div>
      <div style="margin-top:12px;color:var(--text-light);font-size:0.9rem;">
        共 ${filtered.length} 条任务（全部 ${tasks.length} 条）
      </div>
    </div>
  `;
}

// ========== 弹出新增/编辑表单 ==========
function showTaskForm(taskId) {
  const tasks = loadTasks();
  const task = taskId ? tasks.find(t => t.id === taskId) : null;
  const isEdit = !!task;

  const tpl = (typeof window.loadSettings === 'function' ? window.loadSettings() : {}).defaultLessonTemplate || { objectives:'', keyPoints:'', process:'' };
  const formData = {
    title: task?.title || '',
    type: task?.type || '新授课',
    grade: task?.grade || '高一',
    classes: task?.classes ? task.classes.join(',') : '',
    deadline: task?.deadline || '',
    classTime: task?.classTime || '',
    priority: task?.priority || '普通',
    status: task?.status || '待备课',
    materials: task?.materials ? task.materials.join('、') : '',
    note: task?.note || '',
    draft: task?.draft || '',
    objectives: task?.objectives || (isEdit ? '' : (tpl.objectives || '')),
    keyPoints: task?.keyPoints || (isEdit ? '' : (tpl.keyPoints || '')),
    process: task?.process || (isEdit ? '' : (tpl.process || ''))
  };

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <h3>${isEdit ? '编辑备课任务' : '新增备课任务'}</h3>
      <div class="form-group">
        <label>任务标题 *</label>
        <input type="text" id="formTitle" value="${formData.title}" placeholder="如《赤壁赋》新授课备课" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>课程类型</label>
          <select id="formType">
            ${['新授课','复习课','讲评课','公开课','试卷讲评','早读默写','作文讲评'].map(v => `<option ${v===formData.type?'selected':''}>${v}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>年级</label>
          <select id="formGrade">
            ${['高一','高二','高三'].map(v => `<option ${v===formData.grade?'selected':''}>${v}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>班级（逗号分隔）</label>
          <input type="text" id="formClasses" value="${formData.classes}" placeholder="1班,3班" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>截止备课日期</label>
          <input type="date" id="formDeadline" value="${formData.deadline}" />
        </div>
        <div class="form-group">
          <label>预计上课时间</label>
          <input type="datetime-local" id="formClassTime" value="${formData.classTime}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>优先级</label>
          <select id="formPriority">
            ${['紧急','普通','延后'].map(v => `<option ${v===formData.priority?'selected':''}>${v}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>状态</label>
          <select id="formStatus">
            ${['待备课','备课中','已完成','逾期'].map(v => `<option ${v===formData.status?'selected':''}>${v}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>关联素材（可用课文名或自定义，逗号分隔）</label>
        <input type="text" id="formMaterials" value="${formData.materials}" placeholder="赤壁赋,劝学" />
      </div>
      <div class="form-group">
        <label>备注</label>
        <textarea id="formNote" rows="2">${formData.note}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>教学目标</label>
          <textarea id="formObjectives" rows="2">${formData.objectives}</textarea>
        </div>
        <div class="form-group">
          <label>教学重难点</label>
          <textarea id="formKeyPoints" rows="2">${formData.keyPoints}</textarea>
        </div>
      </div>
      <div class="form-group">
        <label>教学过程 / 作业</label>
        <textarea id="formProcess" rows="3">${formData.process}</textarea>
      </div>
      <div class="form-group">
        <label>备课草稿（课堂流程、板书等）</label>
        <textarea id="formDraft" rows="4">${formData.draft}</textarea>
      </div>
      <div class="modal-actions">
        <button class="btn" id="saveTaskBtn">${isEdit ? '更新' : '创建'}</button>
        <button class="btn btn-secondary" id="closeModalBtn">取消</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById('saveTaskBtn').addEventListener('click', function() {
    const title = document.getElementById('formTitle').value.trim();
    if (!title) { alert('请输入任务标题'); return; }
    const type = document.getElementById('formType').value;
    const grade = document.getElementById('formGrade').value;
    const classes = document.getElementById('formClasses').value.split(',').map(s => s.trim()).filter(Boolean);
    const deadline = document.getElementById('formDeadline').value;
    const classTime = document.getElementById('formClassTime').value;
    const priority = document.getElementById('formPriority').value;
    const status = document.getElementById('formStatus').value;
    const materials = document.getElementById('formMaterials').value.split(',').map(s => s.trim()).filter(Boolean);
    const note = document.getElementById('formNote').value;
    const draft = document.getElementById('formDraft').value;
    const objectives = document.getElementById('formObjectives').value;
    const keyPoints = document.getElementById('formKeyPoints').value;
    const process = document.getElementById('formProcess').value;

    const tasks = loadTasks();
    if (isEdit) {
      const idx = tasks.findIndex(t => t.id === taskId);
      if (idx !== -1) {
        tasks[idx] = { ...tasks[idx], title, type, grade, classes, deadline, classTime, priority, status, materials, note, draft, objectives, keyPoints, process, updatedAt: Date.now() };
      }
    } else {
      tasks.push({
        id: generateId(),
        title,
        type,
        grade,
        classes,
        deadline,
        classTime,
        priority,
        status,
        materials,
        note,
        draft,
        objectives,
        keyPoints,
        process,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        archived: false
      });
    }
    saveTasks(tasks);
    document.body.removeChild(overlay);
    refreshLessonPlan();
  });

  document.getElementById('closeModalBtn').addEventListener('click', function() {
    document.body.removeChild(overlay);
  });
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) document.body.removeChild(overlay);
  });
}

// ========== 刷新当前视图 ==========
function refreshLessonPlan() {
  const container = document.getElementById('taskContainer');
  if (!container) return;
  const tasks = loadTasks();
  const filtered = filterTasks(tasks);
  const viewMode = localStorage.getItem('lessonViewMode') || 'list';
  container.innerHTML = viewMode === 'list' ? renderListView(filtered) : renderKanbanView(filtered);
  bindTaskEvents();
}

// ========== 绑定任务事件 ==========
function bindTaskEvents() {
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.onclick = function() {
      showTaskForm(this.dataset.id);
    };
  });
  document.querySelectorAll('.done-btn').forEach(btn => {
    btn.onclick = function() {
      const id = this.dataset.id;
      const tasks = loadTasks();
      const task = tasks.find(t => t.id === id);
      if (task) {
        task.status = '已完成';
        task.updatedAt = Date.now();
        saveTasks(tasks);
        refreshLessonPlan();
      }
    };
  });
  document.querySelectorAll('.del-btn').forEach(btn => {
    btn.onclick = function() {
      const id = this.dataset.id;
      if (!confirm('确认删除该任务？')) return;
      let tasks = loadTasks();
      tasks = tasks.filter(t => t.id !== id);
      saveTasks(tasks);
      refreshLessonPlan();
    };
  });
}

// ========== 初始化模块 ==========
function initLessonPlan() {
  // 新增任务
  document.getElementById('addTaskBtn').addEventListener('click', function() {
    showTaskForm(null);
  });

  // 搜索与筛选
  ['searchTask', 'filterGrade', 'filterType', 'filterStatus', 'filterPriority'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', refreshLessonPlan);
      el.addEventListener('change', refreshLessonPlan);
    }
  });

  // 视图切换
  document.getElementById('viewToggle').addEventListener('click', function() {
    const current = localStorage.getItem('lessonViewMode') || 'list';
    const next = current === 'list' ? 'kanban' : 'list';
    localStorage.setItem('lessonViewMode', next);
    this.textContent = `切换为 ${next === 'list' ? '看板' : '列表'} 视图`;
    refreshLessonPlan();
  });

  // 导出
  document.getElementById('exportTasksBtn').addEventListener('click', function() {
    const tasks = loadTasks();
    const filtered = filterTasks(tasks);
    let text = '备课任务列表\n' + '='.repeat(40) + '\n';
    filtered.forEach(t => {
      text += `标题：${t.title}\n类型：${t.type}\n年级：${t.grade} ${t.classes.join('、')}\n截止：${t.deadline}\n上课：${t.classTime}\n优先级：${t.priority}\n状态：${t.status}\n素材：${t.materials.join('、')}\n备注：${t.note}\n草稿：${t.draft}\n${'-'.repeat(20)}\n`;
    });
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `备课任务_${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
  });

  // 批量完成
  document.getElementById('batchDoneBtn').addEventListener('click', function() {
    const tasks = loadTasks();
    const filtered = filterTasks(tasks);
    if (filtered.length === 0) { alert('当前无任务可批量完成'); return; }
    if (!confirm(`将 ${filtered.length} 条任务标记为已完成？`)) return;
    filtered.forEach(t => { t.status = '已完成'; t.updatedAt = Date.now(); });
    saveTasks(tasks);
    refreshLessonPlan();
  });

  // 批量归档
  document.getElementById('batchArchiveBtn').addEventListener('click', function() {
    const tasks = loadTasks();
    const filtered = filterTasks(tasks);
    if (filtered.length === 0) { alert('当前无任务可归档'); return; }
    if (!confirm(`将 ${filtered.length} 条任务归档（不再显示）？`)) return;
    filtered.forEach(t => { t.archived = true; });
    saveTasks(tasks);
    refreshLessonPlan();
  });

  bindTaskEvents();

  window.addEventListener('taskUpdated', function() {
    // 由定时器处理
  });
}

// ========== 暴露到全局 ==========
window.renderLessonPlan = renderLessonPlan;
window.initLessonPlan = initLessonPlan;