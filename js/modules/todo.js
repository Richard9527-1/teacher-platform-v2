// js/modules/todo.js
// ============================================================
// 今日待办模块
// ============================================================

const TODO_KEY = 'todoItems';

// ===== 加载今日待办 =====
function loadTodoItems() {
  const items = JSON.parse(localStorage.getItem('todoItems') || '[]');
  const today = new Date().toISOString().slice(0, 10);
  return items.filter(item => item.date === today);
}

function saveTodoItems(items) {
  localStorage.setItem(TODO_KEY, JSON.stringify(items));
}

// ===== 渲染主界面 =====
function renderTodo() {
  const items = loadTodoItems();
  const total = items.length;
  const done = items.filter(item => item.done).length;
  const undone = total - done;
  
  return `
    <div class="card">
      <h2>📋 今日待办</h2>
      <div style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap;">
        <div style="background:var(--bg);padding:12px 20px;border-radius:8px;">
          <span style="font-size:1.2rem;font-weight:700;color:#4a6fa5;">${total}</span>
          <span style="color:var(--text-light);"> 总任务</span>
        </div>
        <div style="background:#d4edda;padding:12px 20px;border-radius:8px;">
          <span style="font-size:1.2rem;font-weight:700;color:#155724;">${done}</span>
          <span style="color:#155724;"> 已完成</span>
        </div>
        <div style="background:#f8d7da;padding:12px 20px;border-radius:8px;">
          <span style="font-size:1.2rem;font-weight:700;color:#721c24;">${undone}</span>
          <span style="color:#721c24;"> 未完成</span>
        </div>
        <button class="btn" id="addTodoBtn" style="background:#28a745;margin-left:auto;">＋ 添加待办</button>
      </div>
      <div id="todoList">
        ${renderTodoList(items)}
      </div>
    </div>
  `;
}

// ===== 渲染待办列表 =====
function renderTodoList(items) {
  if (items.length === 0) {
    return '<p style="color:#7f8c8d;text-align:center;padding:30px;">今日暂无待办事项 🎉</p>';
  }
  
  let html = '<div style="display:flex;flex-direction:column;gap:8px;">';
  items.forEach((item, index) => {
    const checked = item.done ? 'checked' : '';
    html += `
      <div style="display:flex;align-items:center;gap:12px;background:var(--card-bg);padding:10px 16px;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,0.06);${item.done ? 'opacity:0.6;' : ''}">
        <input type="checkbox" ${checked} onchange="toggleTodo(${index})" style="width:18px;height:18px;cursor:pointer;" />
        <div style="flex:1;">
          <div style="${item.done ? 'text-decoration:line-through;color:var(--text-light);' : 'font-weight:500;'}">${item.text}</div>
          <div style="font-size:0.8rem;color:var(--text-light);">
            ${item.source || '手动添加'} · ${item.time || ''}
          </div>
        </div>
        <button onclick="deleteTodo(${index})" style="background:none;border:none;color:#dc3545;cursor:pointer;font-size:1rem;">🗑️</button>
      </div>
    `;
  });
  html += '</div>';
  return html;
}

// ===== 添加待办 =====
function showAddTodoForm() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box" style="max-width:500px;">
      <h3>✏️ 添加待办事项</h3>
      <div class="form-group">
        <label>事项内容</label>
        <input type="text" id="todoText" placeholder="如：批改作文、备课《赤壁赋》" style="width:100%;padding:8px 12px;border-radius:6px;border:1px solid #ddd;background:var(--bg);color:var(--text);" />
      </div>
      <div class="form-group">
        <label>来源/关联</label>
        <input type="text" id="todoSource" placeholder="如：备课中心、作文批改" style="width:100%;padding:8px 12px;border-radius:6px;border:1px solid #ddd;background:var(--bg);color:var(--text);" />
      </div>
      <div class="form-group">
        <label>时间（可选）</label>
        <input type="time" id="todoTime" style="width:100%;padding:8px 12px;border-radius:6px;border:1px solid #ddd;background:var(--bg);color:var(--text);" />
      </div>
      <div class="modal-actions">
        <button class="btn" id="saveTodoBtn" style="background:#28a745;">添加</button>
        <button class="btn" id="closeModalBtn" style="background:#6c757d;">取消</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  
  document.getElementById('saveTodoBtn').addEventListener('click', function() {
    const text = document.getElementById('todoText').value.trim();
    if (!text) { alert('请输入事项内容'); return; }
    const items = loadTodoItems();
    items.push({
      text: text,
      source: document.getElementById('todoSource').value.trim() || '手动添加',
      time: document.getElementById('todoTime').value || '',
      done: false,
      date: new Date().toISOString().slice(0, 10),
      createdAt: Date.now()
    });
    saveTodoItems(items);
    document.body.removeChild(overlay);
    refreshTodoView();
  });
  
  document.getElementById('closeModalBtn').addEventListener('click', function() {
    document.body.removeChild(overlay);
  });
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) document.body.removeChild(overlay);
  });
}

// ===== 切换完成状态 =====
function toggleTodo(index) {
  const items = loadTodoItems();
  if (items[index]) {
    items[index].done = !items[index].done;
    saveTodoItems(items);
    refreshTodoView();
    // 更新工作台统计
    updateDashboardStats();
  }
}

// ===== 删除待办 =====
function deleteTodo(index) {
  if (!confirm('确认删除该待办事项？')) return;
  const items = loadTodoItems();
  items.splice(index, 1);
  saveTodoItems(items);
  refreshTodoView();
  updateDashboardStats();
}

// ===== 刷新视图 =====
function refreshTodoView() {
  const container = document.getElementById('todoList');
  if (container) {
    const items = loadTodoItems();
    container.innerHTML = renderTodoList(items);
  }
}

// ===== 更新工作台统计 =====
function updateDashboardStats() {
  const items = loadTodoItems();
  const total = items.length;
  const done = items.filter(item => item.done).length;
  
  const countEl = document.getElementById('todayTaskCount');
  if (countEl) countEl.textContent = total;
  
  const doneEl = document.querySelector('#todayTaskStat .sub-info');
  if (doneEl) doneEl.textContent = `✅ 已完成 ${done} / ${total}`;
}

// ===== 初始化 =====
function initTodo() {
  document.getElementById('addTodoBtn').addEventListener('click', showAddTodoForm);
}

// ===== 暴露到全局 =====
window.renderTodo = renderTodo;
window.initTodo = initTodo;
window.toggleTodo = toggleTodo;
window.deleteTodo = deleteTodo;
window.showAddTodoForm = showAddTodoForm;
window.refreshTodoView = refreshTodoView;
window.updateDashboardStats = updateDashboardStats;
window.loadTodoItems = loadTodoItems;
window.saveTodoItems = saveTodoItems;