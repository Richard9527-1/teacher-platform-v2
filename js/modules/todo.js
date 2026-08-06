// js/modules/todo.js
// ============================================================
// 待办清单模块（重构版）
// 数据层统一口径：每条待办含 id / dueDate / category / priority / repeat 等字段，
// 全量读写，杜绝"今日子集覆盖写"导致的数据丢失；与首页角标、快速统计、全局搜索打通。
// ============================================================

const TODO_KEY = 'todoItems';
const TODO_CATEGORIES = ['备课', '批改', '行政', '会议', '家校', '其他'];
const TODO_PRIORITIES = {
  high:   { label: '高', color: 'var(--c-danger)' },
  normal: { label: '中', color: 'var(--c-primary)' },
  low:    { label: '低', color: 'var(--c-muted)' }
};
const TODO_REPEATS = [
  { v: 'none',   label: '不重复' },
  { v: 'daily',  label: '每天' },
  { v: 'weekly', label: '每周' },
  { v: 'monthly',label: '每月' }
];

// 模块内筛选/搜索状态
let todoFilter = 'weekly';
let todoSearch = '';
let todoChart = null;

// ===== 小工具 =====
function fmtToday() { return formatDate(new Date()); }
function pad2(n) { return String(n).padStart(2, '0'); }
function formatDateTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
    ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}
function parseDateTime(s) {
  if (!s) return Date.now();
  const t = Date.parse(String(s).replace(/-/g, '/'));
  return isNaN(t) ? Date.now() : t;
}
function normalizeDate(s) {
  s = String(s || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const n = Number(s);
  if (!isNaN(n) && n > 20000 && n < 80000) { // Excel 日期序列号
    return formatDate(new Date((n - 25569) * 86400000));
  }
  return fmtToday();
}
function advDate(dateStr, rep) {
  const d = new Date(dateStr);
  if (rep === 'daily') d.setDate(d.getDate() + 1);
  else if (rep === 'weekly') d.setDate(d.getDate() + 7);
  else if (rep === 'monthly') d.setMonth(d.getMonth() + 1);
  return formatDate(d);
}

// ===== 数据规范化（兼容旧数据）=====
function normalizeTodo(it) {
  it = it || {};
  if (!it.id) it.id = genId();
  if (it.dueDate === undefined) it.dueDate = it.date || fmtToday();
  if (it.category === undefined || !TODO_CATEGORIES.includes(it.category)) it.category = '其他';
  if (it.priority === undefined || !TODO_PRIORITIES[it.priority]) it.priority = 'normal';
  if (it.done === undefined) it.done = false;
  if (it.pinned === undefined) it.pinned = false;
  if (it.repeat === undefined) it.repeat = 'none';
  if (it.note === undefined) it.note = '';
  if (it.source === undefined || it.source === '') it.source = '手动添加';
  if (it.time === undefined) it.time = '';
  if (it.linkedType === undefined) it.linkedType = '';
  if (it.linkedId === undefined) it.linkedId = '';
  if (it.repeatGroup === undefined) it.repeatGroup = (it.repeat && it.repeat !== 'none') ? it.id : '';
  if (it.doneAt === undefined) it.doneAt = it.done ? (it.createdAt || Date.now()) : null;
  if (it.createdAt === undefined) it.createdAt = Date.now();
  return it;
}

// ===== 全量读写（修复覆盖写 Bug 的核心）=====
function getTodoAll() {
  let arr = [];
  try { arr = JSON.parse(localStorage.getItem(TODO_KEY) || '[]'); } catch (e) { arr = []; }
  return arr.map(normalizeTodo);
}
function saveTodoAll(arr) {
  localStorage.setItem(TODO_KEY, JSON.stringify(arr.map(normalizeTodo)));
}
function upsertTodo(item) {
  const all = getTodoAll();
  const idx = all.findIndex(i => i.id === item.id);
  if (idx >= 0) all[idx] = item; else all.push(item);
  saveTodoAll(all);
}
function removeTodo(id) {
  saveTodoAll(getTodoAll().filter(i => i.id !== id));
}

// 供首页角标 / 快速统计共用的统一统计口径
function getTodoStats() {
  const all = getTodoAll();
  const today = fmtToday();
  const todayItems = all.filter(i => i.dueDate === today);
  return {
    todayTotal: todayItems.length,
    todayDone: todayItems.filter(i => i.done).length,
    overdue: all.filter(i => !i.done && i.dueDate < today).length,
    allOpen: all.filter(i => !i.done).length
  };
}

// 兼容旧调用：返回今日待办（仅读取，不再参与写回）
function loadTodoItems() { return getTodoAll().filter(i => i.dueDate === fmtToday()); }
function saveTodoItems(items) { saveTodoAll(items); }

// ===== 时间范围判断（本周/本月/本年）=====
function ymdKey(dateStr) { return Number(dateStr.replace(/-/g, '')); }
function isThisWeek(dateStr) {
  const today = new Date();
  const day = today.getDay(); // 0=周日
  const monday = new Date(today); monday.setDate(today.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  const k = ymdKey(dateStr), lo = ymdKey(formatDate(monday)), hi = ymdKey(formatDate(sunday));
  return k >= lo && k <= hi;
}
function isThisMonth(dateStr) {
  const [y, m] = dateStr.split('-').map(Number);
  const t = new Date();
  return y === t.getFullYear() && m === t.getMonth() + 1;
}
function isThisYear(dateStr) { return Number(dateStr.slice(0, 4)) === new Date().getFullYear(); }

// ===== 重复任务滚动生成 =====
function rollRepeat() {
  const all = getTodoAll();
  const today = fmtToday();
  let changed = false;
  const groups = {};
  all.forEach(it => {
    if (it.repeat && it.repeat !== 'none') {
      const g = it.repeatGroup || it.id;
      (groups[g] = groups[g] || []).push(it);
    }
  });
  Object.keys(groups).forEach(g => {
    const items = groups[g].slice().sort((a, b) => a.dueDate < b.dueDate ? -1 : 1);
    const rep = items[items.length - 1].repeat;
    let last = items[items.length - 1].dueDate;
    let guard = 0;
    while (last < today && guard < 400) {
      const next = advDate(last, rep);
      if (!all.some(i => i.repeatGroup === g && i.dueDate === next)) {
        const seed = items[items.length - 1];
        const ni = normalizeTodo({
          id: genId(), text: seed.text, note: seed.note, source: seed.source,
          category: seed.category, priority: seed.priority, dueDate: next,
          time: seed.time, repeat: rep, repeatGroup: g,
          linkedType: '', linkedId: '', done: false, createdAt: Date.now()
        });
        all.push(ni); changed = true;
      }
      last = next;
      guard++;
    }
  });
  if (changed) saveTodoAll(all);
}

// ===== 可见列表（筛选 + 搜索 + 排序）=====
function getVisibleTodos() {
  const all = getTodoAll();
  const today = fmtToday();
  let list = all;
  if (todoFilter === 'open') list = list.filter(i => !i.done);
  else if (todoFilter === 'done') list = list.filter(i => i.done);
  else if (todoFilter === 'overdue') list = list.filter(i => !i.done && i.dueDate < today);
  else if (todoFilter === 'weekly') list = list.filter(i => isThisWeek(i.dueDate));
  else if (todoFilter === 'monthly') list = list.filter(i => isThisMonth(i.dueDate));
  else if (todoFilter === 'yearly') list = list.filter(i => isThisYear(i.dueDate));
  if (todoSearch) {
    const q = todoSearch.toLowerCase();
    list = list.filter(i => (i.text + ' ' + i.note + ' ' + i.source).toLowerCase().includes(q));
  }
  const prio = { high: 0, normal: 1, low: 2 };
  list.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (prio[a.priority] !== prio[b.priority]) return prio[a.priority] - prio[b.priority];
    if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
    return (a.createdAt || 0) - (b.createdAt || 0);
  });
  return list;
}

// ===== 渲染：统计块 =====
function renderStatsInner() {
  const s = getTodoStats();
  return `
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
      <div style="background:var(--bg);padding:10px 16px;border-radius:var(--radius-md);"><span style="font-weight:700;color:var(--c-primary);">${s.allOpen}</span> <span style="color:var(--text-light);">待完成</span></div>
      <div style="background:var(--c-success-bg);padding:10px 16px;border-radius:var(--radius-md);"><span style="font-weight:700;color:var(--c-success-text);">${s.todayDone}/${s.todayTotal}</span> <span style="color:var(--c-success-text);">今日完成</span></div>
      <div style="background:var(--c-danger-bg);padding:10px 16px;border-radius:var(--radius-md);"><span style="font-weight:700;color:var(--c-danger-text);">${s.overdue}</span> <span style="color:var(--c-danger-text);">逾期</span></div>
    </div>`;
}

// ===== 渲染：筛选 Tab =====
function renderTabsInner() {
  const all = getTodoAll();
  const weeklyCount = all.filter(i => isThisWeek(i.dueDate)).length;
  const monthlyCount = all.filter(i => isThisMonth(i.dueDate)).length;
  const yearlyCount = all.filter(i => isThisYear(i.dueDate)).length;
  const tabs = [
    { f: 'weekly', label: '本周', n: weeklyCount },
    { f: 'monthly', label: '本月', n: monthlyCount },
    { f: 'yearly', label: '本年', n: yearlyCount }
  ];
  return tabs.map(t =>
    `<div class="todo-tab ${todoFilter === t.f ? 'active' : ''}" data-filter="${t.f}">${t.label}<span class="todo-tab-badge">${t.n}</span></div>`
  ).join('');
}

// ===== 渲染：到期角标 =====
function dueBadge(it, today) {
  if (it.done) return '<span style="color:var(--text-light);">已完成</span>';
  if (it.dueDate < today) return '<span style="color:var(--c-danger);font-weight:600;">⚠ 逾期</span>';
  if (it.dueDate === today) return '<span style="color:var(--c-primary);font-weight:600;">今日</span>';
  const diff = Math.round((new Date(it.dueDate).getTime() - new Date(today).getTime()) / 86400000);
  if (diff <= 2) return '<span style="color:var(--c-warning);font-weight:600;">临近</span>';
  return `<span>📅 ${htmlEncode(it.dueDate)}</span>`;
}

// ===== 渲染：主界面 =====
function renderTodo() {
  return `<div class="card">
    <div class="panel-head"><h2 class="panel-title">⏰ 待办清单</h2></div>
    <div id="todoStats">${renderStatsInner()}</div>
    <div class="todo-tabs" id="todoTabs">${renderTabsInner()}</div>
    <div class="todo-toolbar">
      <input type="text" id="todoSearch" class="da-input" placeholder="🔍 搜索内容 / 备注 / 来源" value="${htmlEncode(todoSearch)}" />
      <div class="todo-actions">
        <button class="btn btn-success" id="addTodoBtn">＋ 添加待办</button>
        <button class="btn btn-secondary" id="supplementTodoBtn">🔄 补充</button>
        <button class="btn btn-secondary" id="exportJsonBtn">📤 JSON</button>
        <button class="btn btn-secondary" id="exportExcelBtn">📊 Excel</button>
        <button class="btn btn-secondary" id="importTodoBtn">📥 导入</button>
        <input type="file" id="importTodoFile" accept=".json,.xlsx,.xls" style="display:none;" />
      </div>
    </div>
    <div id="todoOverdueBanner"></div>
    <div id="todoList" class="todo-items"></div>
    <div class="todo-stats-foot">
      <div style="font-size:0.85rem;color:var(--text-light);margin-bottom:6px;">📈 近 7 日完成趋势</div>
      <canvas id="todoTrend" height="80" style="width:100%;"></canvas>
    </div>
  </div>`;
}

// ===== 渲染：列表 =====
function renderTodoListContainer() {
  const listEl = document.getElementById('todoList');
  if (!listEl) return;
  const items = getVisibleTodos();
  if (items.length === 0) {
    listEl.innerHTML = '<p class="empty">暂无待办事项 🎉</p>';
    return;
  }
  const today = fmtToday();
  listEl.innerHTML = items.map(it => {
    const p = TODO_PRIORITIES[it.priority] || TODO_PRIORITIES.normal;
    const note = it.note ? `<div class="todo-item-meta" style="margin-top:4px;">📝 ${htmlEncode(it.note)}</div>` : '';
    return `<div class="todo-item ${it.done ? 'done' : ''}" data-id="${it.id}">
      <input type="checkbox" ${it.done ? 'checked' : ''} onchange="toggleTodo('${it.id}')" style="width:18px;height:18px;cursor:pointer;" />
      <div class="todo-priority-bar" style="background:${p.color};"></div>
      <div class="todo-item-body">
        <div class="todo-item-text" onclick="editTodo('${it.id}')">${htmlEncode(it.text)}</div>
        <div class="todo-item-meta">
          <span class="tag tag-muted">${htmlEncode(it.category)}</span>
          ${dueBadge(it, today)}
          ${it.time ? `<span>🕒 ${htmlEncode(it.time)}</span>` : ''}
          ${it.source && it.source !== '手动添加' ? `<span>🔗 ${htmlEncode(it.source)}</span>` : ''}
        </div>
        ${note}
      </div>
      <button class="btn-mini" onclick="pinTodo('${it.id}')" title="置顶">${it.pinned ? '📍' : '📌'}</button>
      <button class="da-link-danger" onclick="deleteTodo('${it.id}')" title="删除">🗑️</button>
    </div>`;
  }).join('');
}

// ===== 渲染：逾期横幅 =====
function renderOverdueBanner() {
  const el = document.getElementById('todoOverdueBanner');
  if (!el) return;
  const n = getTodoStats().overdue;
  el.innerHTML = n > 0 ? `<div class="todo-overdue-banner">⚠ 你有 ${n} 项待办已逾期，请尽快处理或顺延。</div>` : '';
}

// ===== 渲染：趋势图 =====
function renderTrend() {
  const cv = document.getElementById('todoTrend');
  if (!cv || typeof Chart === 'undefined') return;
  if (todoChart) { todoChart.destroy(); todoChart = null; }
  const all = getTodoAll();
  const labels = [], data = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = formatDate(d);
    labels.push((d.getMonth() + 1) + '/' + d.getDate());
    data.push(all.filter(it => it.done && it.doneAt && formatDate(new Date(it.doneAt)) === key).length);
  }
  todoChart = new Chart(cv.getContext('2d'), {
    type: 'line',
    data: { labels, datasets: [{ label: '完成数', data, borderColor: 'var(--c-primary)', backgroundColor: 'rgba(74,111,165,0.15)', fill: true, tension: 0.3, pointRadius: 3 }] },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
  });
}

// ===== 刷新视图（不重建整卡，保留事件绑定）=====
function refreshTodoView() {
  const s = document.getElementById('todoStats'); if (s) s.innerHTML = renderStatsInner();
  const t = document.getElementById('todoTabs'); if (t) t.innerHTML = renderTabsInner();
  renderTodoListContainer();
  renderOverdueBanner();
  renderTrend();
}

// ===== 添加 / 编辑表单 =====
function showAddTodoForm(editId) {
  const editing = editId ? getTodoAll().find(i => i.id === editId) : null;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const prioOpts = Object.entries(TODO_PRIORITIES).map(([v, p]) =>
    `<option value="${v}" ${editing && editing.priority === v ? 'selected' : ''}>${p.label}</option>`).join('');
  const catOpts = TODO_CATEGORIES.map(c =>
    `<option value="${c}" ${editing && editing.category === c ? 'selected' : ''}>${c}</option>`).join('');
  const repOpts = TODO_REPEATS.map(r =>
    `<option value="${r.v}" ${editing && editing.repeat === r.v ? 'selected' : ''}>${r.label}</option>`).join('');
  overlay.innerHTML = `<div class="modal-box" style="max-width:520px;">
    <h3>${editing ? '✏️ 编辑待办' : '✏️ 添加待办事项'}</h3>
    <div class="form-group"><label>事项内容 *</label><input type="text" id="todoText" value="${editing ? htmlEncode(editing.text) : ''}" placeholder="如：批改作文、备课《赤壁赋》" /></div>
    <div class="form-row">
      <div class="form-group"><label>分类</label><select id="todoCategory">${catOpts}</select></div>
      <div class="form-group"><label>优先级</label><select id="todoPriority">${prioOpts}</select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>到期日</label><input type="date" id="todoDue" value="${editing ? editing.dueDate : fmtToday()}" /></div>
      <div class="form-group"><label>时间（可选）</label><input type="time" id="todoTime" value="${editing ? editing.time : ''}" /></div>
    </div>
    <div class="form-group"><label>重复</label><select id="todoRepeat">${repOpts}</select></div>
    <div class="form-group"><label>来源/关联</label><input type="text" id="todoSource" value="${editing ? htmlEncode(editing.source || '') : ''}" placeholder="如：备课中心、作文批改" /></div>
    <div class="form-group"><label>备注（可选）</label><textarea id="todoNote" rows="2" placeholder="补充说明">${editing ? htmlEncode(editing.note || '') : ''}</textarea></div>
    <div class="modal-actions">
      <button class="btn" id="saveTodoBtn">${editing ? '保存' : '添加'}</button>
      <button class="btn btn-cancel" id="closeModalBtn">取消</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);

  document.getElementById('saveTodoBtn').addEventListener('click', function () {
    const text = document.getElementById('todoText').value.trim();
    if (!text) { alert('请输入事项内容'); return; }
    const item = normalizeTodo({
      id: editing ? editing.id : genId(),
      text,
      note: document.getElementById('todoNote').value.trim(),
      source: document.getElementById('todoSource').value.trim() || '手动添加',
      category: document.getElementById('todoCategory').value,
      priority: document.getElementById('todoPriority').value,
      dueDate: document.getElementById('todoDue').value || fmtToday(),
      time: document.getElementById('todoTime').value || '',
      repeat: document.getElementById('todoRepeat').value,
      done: editing ? editing.done : false,
      doneAt: editing ? editing.doneAt : null,
      pinned: editing ? editing.pinned : false,
      linkedType: editing ? editing.linkedType : '',
      linkedId: editing ? editing.linkedId : '',
      repeatGroup: editing ? editing.repeatGroup : '',
      createdAt: editing ? editing.createdAt : Date.now()
    });
    upsertTodo(item);
    document.body.removeChild(overlay);
    refreshTodoView();
    updateDashboardStats();
  });
  document.getElementById('closeModalBtn').addEventListener('click', function () {
    document.body.removeChild(overlay);
  });
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) document.body.removeChild(overlay);
  });
}

// ===== 操作：切换 / 删除 / 置顶 / 编辑 =====
function toggleTodo(id) {
  const all = getTodoAll();
  const it = all.find(i => i.id === id);
  if (it) { it.done = !it.done; it.doneAt = it.done ? Date.now() : null; saveTodoAll(all); }
  rollRepeat();
  refreshTodoView();
  updateDashboardStats();
}
function deleteTodo(id) {
  if (!confirm('确认删除该待办事项？')) return;
  removeTodo(id);
  refreshTodoView();
  updateDashboardStats();
}
function pinTodo(id) {
  const all = getTodoAll();
  const it = all.find(i => i.id === id);
  if (it) { it.pinned = !it.pinned; saveTodoAll(all); refreshTodoView(); }
}
function editTodo(id) { showAddTodoForm(id); }

// ===== 联动补充：从备课逾期 + 今日课表派生 =====
function supplementFromLessonsAndSchedule() {
  const all = getTodoAll();
  const today = fmtToday();
  let added = 0;
  // 备课逾期
  let lessons = [];
  try { lessons = JSON.parse(localStorage.getItem('lessonTasks') || '[]'); } catch (e) {}
  lessons.forEach(t => {
    if (t.status === '已完成' || t.archived) return;
    const dl = t.deadline ? (t.deadline.length >= 10 ? t.deadline.slice(0, 10) : t.deadline) : '';
    if (!dl || dl >= today) return;
    if (!all.some(i => i.linkedType === 'lesson' && i.linkedId === String(t.id))) {
      all.push(normalizeTodo({
        id: genId(), text: '备课：' + (t.title || '未命名'), category: '备课',
        dueDate: dl, source: '备课中心(逾期)', linkedType: 'lesson', linkedId: String(t.id),
        priority: 'high'
      }));
      added++;
    }
  });
  // 今日课表
  let todayLessons = [];
  try { if (typeof getTodaySchedule === 'function') todayLessons = getTodaySchedule(); } catch (e) {}
  todayLessons.forEach(l => {
    const lid = 'schedule:' + l.period + ':' + l.time;
    if (all.some(i => i.linkedType === 'schedule' && i.linkedId === lid)) return;
    all.push(normalizeTodo({
      id: genId(), text: '上课：' + (l.subject || '语文') + ' ' + l.text, category: '其他',
      dueDate: today, time: l.time || '', source: '课程表', linkedType: 'schedule', linkedId: lid,
      priority: 'normal'
    }));
    added++;
  });
  saveTodoAll(all);
  alert(added > 0 ? ('已从备课/课表补充 ' + added + ' 项待办') : '没有可补充的新待办');
  refreshTodoView();
  updateDashboardStats();
}

// ===== 导入 / 导出 =====
function exportTodoJson() {
  const data = getTodoAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '待办备份_' + fmtToday() + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
}
function importTodoJson(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const arr = JSON.parse(e.target.result);
      if (!Array.isArray(arr)) throw new Error('文件格式错误');
      const all = getTodoAll();
      let added = 0, updated = 0;
      arr.forEach(it => {
        it = normalizeTodo(it);
        const ex = all.find(x => x.id === it.id);
        if (ex) { Object.assign(ex, it); updated++; } else { all.push(it); added++; }
      });
      saveTodoAll(all);
      alert('导入完成：新增 ' + added + ' 项，更新 ' + updated + ' 项');
      refreshTodoView(); updateDashboardStats();
    } catch (err) { alert('导入失败：' + err.message); }
  };
  reader.readAsText(file);
}
function exportTodoExcel() {
  if (typeof XLSX === 'undefined') { alert('Excel 组件未加载，已改用 JSON 导出'); exportTodoJson(); return; }
  const all = getTodoAll();
  const rows = all.map(it => ({
    '内容': it.text, '备注': it.note, '来源': it.source, '分类': it.category,
    '优先级': (TODO_PRIORITIES[it.priority] || TODO_PRIORITIES.normal).label,
    '到期日': it.dueDate, '时间': it.time,
    '完成': it.done ? '是' : '否', '置顶': it.pinned ? '是' : '否',
    '重复': (TODO_REPEATS.find(r => r.v === it.repeat) || TODO_REPEATS[0]).label,
    '关联类型': it.linkedType, '关联ID': it.linkedId, '创建时间': formatDateTime(it.createdAt)
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '待办');
  XLSX.writeFile(wb, '待办备份_' + fmtToday() + '.xlsx');
}
function importTodoExcel(file) {
  if (typeof XLSX === 'undefined') { alert('Excel 组件未加载'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array', raw: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { raw: true });
      const all = getTodoAll();
      let added = 0, updated = 0;
      rows.forEach(r => {
        const text = String(r['内容'] || '').trim();
        if (!text) return;
        const item = normalizeTodo({
          id: genId(), text,
          note: String(r['备注'] || ''),
          source: String(r['来源'] || '导入'),
          category: TODO_CATEGORIES.includes(r['分类']) ? r['分类'] : '其他',
          priority: ({ '高': 'high', '中': 'normal', '低': 'low' })[String(r['优先级'] || '')] || 'normal',
          dueDate: normalizeDate(r['到期日']),
          time: String(r['时间'] || ''),
          done: /是/.test(String(r['完成'] || '')),
          pinned: /是/.test(String(r['置顶'] || '')),
          repeat: ({ '每天': 'daily', '每周': 'weekly', '每月': 'monthly', '不重复': 'none' })[String(r['重复'] || '')] || 'none',
          linkedType: String(r['关联类型'] || ''),
          linkedId: String(r['关联ID'] || ''),
          createdAt: parseDateTime(String(r['创建时间'] || ''))
        });
        const ex = all.find(x => x.text === item.text && x.dueDate === item.dueDate);
        if (ex) { Object.assign(ex, item); updated++; } else { all.push(item); added++; }
      });
      saveTodoAll(all);
      alert('导入完成：新增 ' + added + ' 项，更新 ' + updated + ' 项');
      refreshTodoView(); updateDashboardStats();
    } catch (err) { alert('导入失败：' + err.message); }
  };
  reader.readAsArrayBuffer(file);
}

// ===== 更新工作台统计 =====
function updateDashboardStats() {
  const s = getTodoStats();
  const countEl = document.getElementById('todayTaskCount');
  if (countEl) countEl.textContent = s.todayTotal;
  const doneEl = document.querySelector('#todayTaskStat .sub-info');
  if (doneEl) doneEl.textContent = `✅ 已完成 ${s.todayDone} / ${s.todayTotal} · 逾期 ${s.overdue}`;
}

// ===== 初始化 =====
function initTodo() {
  rollRepeat();
  const addBtn = document.getElementById('addTodoBtn');
  if (addBtn) addBtn.addEventListener('click', () => showAddTodoForm());
  const tabs = document.getElementById('todoTabs');
  if (tabs) tabs.addEventListener('click', e => {
    const tab = e.target.closest('.todo-tab');
    if (!tab) return;
    todoFilter = tab.getAttribute('data-filter');
    refreshTodoView();
  });
  const search = document.getElementById('todoSearch');
  if (search) search.addEventListener('input', e => {
    todoSearch = e.target.value.trim();
    renderTodoListContainer();
    renderOverdueBanner();
  });
  const supp = document.getElementById('supplementTodoBtn');
  if (supp) supp.addEventListener('click', supplementFromLessonsAndSchedule);
  const ej = document.getElementById('exportJsonBtn');
  if (ej) ej.addEventListener('click', exportTodoJson);
  const ee = document.getElementById('exportExcelBtn');
  if (ee) ee.addEventListener('click', exportTodoExcel);
  const imp = document.getElementById('importTodoBtn');
  const file = document.getElementById('importTodoFile');
  if (imp && file) imp.addEventListener('click', () => file.click());
  if (file) file.addEventListener('change', function () {
    const f = this.files[0];
    if (!f) return;
    if (/\.xlsx?$/i.test(f.name)) importTodoExcel(f); else importTodoJson(f);
    this.value = '';
  });
  renderTodoListContainer();
  renderOverdueBanner();
  renderTrend();
}

// ===== 暴露到全局 =====
window.renderTodo = renderTodo;
window.initTodo = initTodo;
window.toggleTodo = toggleTodo;
window.deleteTodo = deleteTodo;
window.pinTodo = pinTodo;
window.editTodo = editTodo;
window.showAddTodoForm = showAddTodoForm;
window.refreshTodoView = refreshTodoView;
window.updateDashboardStats = updateDashboardStats;
window.getTodoStats = getTodoStats;
window.getTodoAll = getTodoAll;
window.saveTodoAll = saveTodoAll;
window.loadTodoItems = loadTodoItems;
window.saveTodoItems = saveTodoItems;
