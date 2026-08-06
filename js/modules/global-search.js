// js/modules/global-search.js
// ============================================================
// 顶部全局搜索：覆盖 教材 / 班级·学生 / 备课 / 待办 四类。
// 实时防抖 200ms、分组下拉、关键词 <mark> 高亮、XSS 转义。
// 点击结果：教材 → openDetail(title)；其余 → showModule(...) 跳转对应模块。
// ============================================================

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

// 在已转义文本中高亮关键词（大小写不敏感，仅高亮首个命中）
function highlight(text, q) {
  const safe = escapeHtml(text);
  if (!q) return safe;
  const lower = safe.toLowerCase();
  const idx = lower.indexOf(q.toLowerCase());
  if (idx < 0) return safe;
  return safe.slice(0, idx) + '<mark>' + safe.slice(idx, idx + q.length) + '</mark>' + safe.slice(idx + q.length);
}

function gsGetLessons() {
  try { return JSON.parse(localStorage.getItem('lessonTasks') || '[]'); } catch (e) { return []; }
}
function gsGetTodos() {
  try { return JSON.parse(localStorage.getItem('todoItems') || '[]'); } catch (e) { return []; }
}

function gsBuildResults(q) {
  const results = { texts: [], classes: [], students: [], lessons: [], todos: [] };

  // 教材（SAMPLE_TEXTS 以标题为键）
  const texts = window.SAMPLE_TEXTS || {};
  for (const title in texts) {
    if (!Object.prototype.hasOwnProperty.call(texts, title)) continue;
    const t = texts[title] || {};
    const hay = [title, t.author, t.type, t.grade, t.dynasty, (t.tags || []).join(' ')].join(' ');
    if (hay.toLowerCase().indexOf(q) >= 0) {
      results.texts.push({ key: title, title: title, sub: [t.grade, t.type, t.author].filter(Boolean).join(' · ') });
    }
  }

  // 班级 / 学生
  try {
    const cd = (typeof loadClassData === 'function') ? loadClassData() : { classes: [], students: [] };
    (cd.classes || []).forEach(c => {
      if ((c.name || '').toLowerCase().indexOf(q) >= 0) {
        results.classes.push({ key: c.id, title: c.name, sub: c.grade || '班级' });
      }
    });
    (cd.students || []).forEach(s => {
      if ((s.name || '').toLowerCase().indexOf(q) >= 0) {
        results.students.push({ key: s.id, title: s.name, sub: (typeof getClassName === 'function' ? getClassName(s.classId, cd) : '学生') });
      }
    });
  } catch (e) {}

  // 备课
  gsGetLessons().forEach((t, i) => {
    const name = t.title || t.name || t.subject || '';
    if (name.toLowerCase().indexOf(q) >= 0) {
      results.lessons.push({ key: i, title: name, sub: '备课任务' });
    }
  });

  // 待办
  gsGetTodos().forEach((t, i) => {
    const name = t.text || t.title || t.name || '';
    if (name.toLowerCase().indexOf(q) >= 0) {
      results.todos.push({ key: i, title: name, sub: '待办事项' });
    }
  });

  return results;
}

function gsRenderDropdown(q, box, dropdown) {
  const r = gsBuildResults(q);
  const groups = [
    { key: 'texts', label: '📚 教材', items: r.texts, type: 'text' },
    { key: 'classes', label: '👥 班级', items: r.classes, type: 'class' },
    { key: 'students', label: '🧑 学生', items: r.students, type: 'student' },
    { key: 'lessons', label: '📑 备课', items: r.lessons, type: 'lesson' },
    { key: 'todos', label: '⏰ 待办', items: r.todos, type: 'todo' }
  ];
  const total = groups.reduce((s, g) => s + g.items.length, 0);
  if (total === 0) {
    dropdown.innerHTML = '<div class="search-empty" style="padding:14px;color:#7f8c8d;">未找到相关结果</div>';
    dropdown.style.display = 'block';
    return;
  }
  let html = '';
  groups.forEach(g => {
    if (!g.items.length) return;
    html += '<div class="search-group"><div class="search-group-title">' + escapeHtml(g.label) + '（' + g.items.length + '）</div>';
    g.items.slice(0, 8).forEach(it => {
      html += '<div class="search-item" data-type="' + g.type + '" data-key="' + escapeAttr(it.key) + '">' +
        '<div class="search-item-title">' + highlight(it.title, q) + '</div>' +
        (it.sub ? '<div class="search-item-sub">' + escapeHtml(it.sub) + '</div>' : '') +
        '</div>';
    });
    html += '</div>';
  });
  dropdown.innerHTML = html;
  dropdown.style.display = 'block';
}

function initGlobalSearch() {
  const box = document.getElementById('globalSearchBox');
  const input = document.getElementById('globalSearchInput');
  const btn = document.getElementById('globalSearchBtn');
  const dropdown = document.getElementById('searchDropdown');
  if (!box || !input || !dropdown) return;

  let timer = null;
  const doSearch = () => {
    const q = input.value.trim();
    if (!q) { dropdown.style.display = 'none'; dropdown.innerHTML = ''; return; }
    gsRenderDropdown(q.toLowerCase(), box, dropdown);
  };

  input.addEventListener('input', function () {
    if (timer) clearTimeout(timer);
    timer = setTimeout(doSearch, 200);
  });
  if (btn) btn.addEventListener('click', doSearch);
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter') doSearch(); });

  // 点击结果：路由跳转
  dropdown.addEventListener('click', function (e) {
    const item = e.target.closest('.search-item');
    if (!item) return;
    const type = item.getAttribute('data-type');
    const key = item.getAttribute('data-key');
    dropdown.style.display = 'none';
    dropdown.innerHTML = '';
    input.value = '';
    try {
      if (type === 'text') {
        if (typeof openDetail === 'function') openDetail(key);
      } else if (type === 'class' || type === 'student') {
        if (typeof showModule === 'function') showModule('class');
      } else if (type === 'lesson') {
        if (typeof showModule === 'function') showModule('lesson');
      } else if (type === 'todo') {
        if (typeof showModule === 'function') showModule('todo');
      }
    } catch (err) { console.warn('搜索跳转失败:', err); }
  });

  // 点击页面其它区域关闭下拉
  document.addEventListener('click', function (e) {
    if (box.contains(e.target)) return;
    dropdown.style.display = 'none';
  });
}
