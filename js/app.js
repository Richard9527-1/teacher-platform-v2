// ============================================================
// 高中语文智备 - 主应用
// 课程表功能由 schedule.js 提供
// ============================================================

// ========== 全局错误捕获 + 友好提示 ==========
(function setupGlobalErrorHandler() {
  function showToast(msg) {
    try {
      let box = document.getElementById('globalToast');
      if (!box) {
        box = document.createElement('div');
        box.id = 'globalToast';
        box.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:10000;max-width:90%;padding:10px 16px;border-radius:8px;font-size:0.85rem;color:#fff;background:rgba(220,53,69,0.95);box-shadow:0 4px 12px rgba(0,0,0,0.2);transition:opacity .3s;';
        document.body.appendChild(box);
      }
      box.textContent = msg;
      box.style.opacity = '1';
      clearTimeout(box.__t);
      box.__t = setTimeout(function () { box.style.opacity = '0'; }, 4000);
    } catch (e) {}
  }
  window.__showToast = showToast;
  window.addEventListener('error', function (e) {
    console.error('[全局错误]', e.message, e.error);
    showToast('页面发生错误：' + (e.message || '未知错误') + '（详见控制台）');
  });
  window.addEventListener('unhandledrejection', function (e) {
    console.error('[未处理的异步异常]', e.reason);
    var m = e.reason && e.reason.message ? e.reason.message : '异步任务异常';
    showToast('请求或任务异常：' + m + '（详见控制台）');
  });
})();

// ========== file:// 协议降级提示 ==========
(function setupFileProtocolTip() {
  if (location.protocol !== 'file:') return;
  function show() {
    if (document.getElementById('fileProtocolTip')) return;
    var tip = document.createElement('div');
    tip.id = 'fileProtocolTip';
    tip.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#fff7e6;border-top:1px solid #ffd591;color:#ad6800;padding:10px 16px;font-size:0.82rem;line-height:1.6;';
    tip.innerHTML = '⚠️ 当前以 <b>file://</b> 方式打开，教材详情、OCR 等网络请求会被浏览器拦截。请运行 <code>node dev-server.js</code> 后访问 <b>http://localhost:3000</b>。';
    document.body.appendChild(tip);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show);
  else show();
})();

// ========== 常量定义 ==========
const REMINDER_KEY = 'remindedLessons';

// ========== 获取待备课数量（备课中心用） ==========
function getPendingTaskCount() {
  const tasks = JSON.parse(localStorage.getItem('lessonTasks') || '[]');
  return tasks.filter(t => !t.archived && (t.status === '待备课' || t.status === '备课中' || t.status === '逾期')).length;
}

// ========== 提醒功能 ==========
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function sendNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '📚' });
  }
}

function checkReminders() {
  if (window._notificationsEnabled === false) return;
  try {
    const dayMap = { 0: '周日', 1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五', 6: '周六' };
    const todayName = dayMap[new Date().getDay()];
    const data = loadSchedule();
    const all = getDayLessons(todayName, data);
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const reminded = JSON.parse(localStorage.getItem(REMINDER_KEY) || '{}');
    const todayKey = new Date().toDateString();

    all.forEach(lesson => {
      const [h, m] = lesson.time.split(':').map(Number);
      const lessonMinutes = h * 60 + m;
      const diff = lessonMinutes - nowMinutes;
      if (diff > 0 && diff <= 5) {
        const id = `${todayKey}_${lesson.period}_${lesson.text}`;
        if (!reminded[id]) {
          sendNotification(`⏰ 即将上课`, `${lesson.text} 于 ${lesson.time} 开始`);
          reminded[id] = true;
          localStorage.setItem(REMINDER_KEY, JSON.stringify(reminded));
        }
      }
    });
  } catch(e) {
    // 静默处理
  }
}


// ===== 今日待办统计（复用 todo.js 的分桶模型） =====
function getTodayTaskStats() {
  if (typeof getTodoStats === 'function') return getTodoStats();
  const items = JSON.parse(localStorage.getItem('todoItems') || '[]').map(i => {
    if (i.dueDate === undefined && i.date !== undefined) i.dueDate = i.date;
    return i;
  });
  const today = fmtDate ? fmtDate(new Date()) : new Date().toISOString().slice(0, 10);
  const t = items.filter(i => i.dueDate === today);
  return {
    todayTotal: t.length,
    todayDone: t.filter(i => i.done).length,
    overdue: items.filter(i => !i.done && i.dueDate && i.dueDate < today).length
  };
}


// 日期格式化（YYYY-MM-DD）；原定义随重构丢失，这里补回，供 getDailyRecitation 等使用
function fmtDate(d) {
  d = d || new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

// ===== 今日诵读推荐（按日期固定选一篇） =====
function getDailyRecitation() {
  const texts = window.SAMPLE_TEXTS || {};
  const keys = Object.keys(texts);
  if (!keys.length) return { key: '暂无篇目', author: '敬请期待', excerpt: '' };
  // 优先古诗词/文言文，更契合"诵读"场景
  const poetryKeys = keys.filter(k => {
    const t = texts[k].type;
    return t === '古诗词' || t === '文言文';
  });
  const pool = poetryKeys.length ? poetryKeys : keys;
  const today = fmtDate ? fmtDate(new Date()) : new Date().toISOString().slice(0, 10);
  let h = 0;
  for (let i = 0; i < today.length; i++) h = (h * 31 + today.charCodeAt(i)) >>> 0;
  const pick = pool[h % pool.length];
  const item = texts[pick] || {};
  window.__dailyReciteKey = pick;
  const excerpt = (item.original || '').replace(/\s/g, '').slice(0, 16);
  return {
    key: pick,
    author: item.author || '佚名',
    excerpt: excerpt
  };
}

// ===== 检查是否有即将上课（提前5分钟） =====
function checkClassSoon() {
  try {
    const { next } = getTodayRemaining();
    if (!next) return false;
    const now = new Date();
    const [h, m] = next.time.split(':').map(Number);
    const classTime = new Date();
    classTime.setHours(h, m, 0, 0);
    const diff = (classTime - now) / 1000 / 60;
    return diff > 0 && diff <= 5;
  } catch(e) {
    return false;
  }
}

// ========== 工作台 ==========
function renderDashboard() {
  let todayCount = 0;
  let nextInfo = '加载中...';
  try {
    const { remaining, next } = getTodayRemaining();
    todayCount = remaining.length;
    nextInfo = next ? `下一节：${next.display || next.text} (${next.time})` : '今日课程已结束 🎉';
  } catch(e) {
    // 静默处理
  }
  const pendingCount = getPendingTaskCount();
  const completedCount = getCompletedTaskCount();
  const recite = getDailyRecitation();

  return `
    <div class="card">
      <h2>😊 欢迎使用高中语文智备</h2>
      <p style="color:#7f8c8d;"></p>
      <div class="stat-grid">
        <div class="stat-item" id="todayLessonStat" style="cursor:pointer;">
  <div class="num" id="todayLessonCount">${todayCount}</div>
  <div class="sub-info" id="nextLessonInfo">${nextInfo}</div>
  <div class="label">📚 今日剩余课程</div>
</div>
<div class="stat-item">
  <div class="num">${pendingCount}</div>
  <div style="font-size:0.85rem;color:#7f8c8d;margin-top:2px;">已完成：${completedCount}</div>
  <div class="label">📑 剩余备课</div>
</div>
<div class="stat-item" id="todayTaskStat" style="cursor:pointer;">
  <div class="num" id="todayTaskCount">${getTodayTaskStats().todayTotal}</div>
  <div class="sub-info" style="font-size:0.85rem;color:#7f8c8d;margin-top:2px;">今日 ${getTodayTaskStats().todayDone}/${getTodayTaskStats().todayTotal} · 逾期 ${getTodayTaskStats().overdue}</div>
  <div class="label">⏰ 今日待办</div>
</div>
<div class="stat-item" id="reciteStat" style="cursor:pointer;">
  <div class="num" style="font-size:1.15rem;line-height:1.3;color:#4a6fa5;">${recite.key}</div>
  <div class="sub-info" style="font-size:0.78rem;color:#7f8c8d;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${recite.author} · ${recite.excerpt}</div>
  <div class="label">📖 今日诵读</div>
</div>
      </div>
    </div>

    <div class="card" id="todayScheduleCard">
  <div class="card-header">
    <h2>🕐 今日教学安排</h2>
    <span id="editScheduleBtn" style="background:#4a6fa5;color:white;padding:2px 12px;border-radius:30px;font-size:0.75rem;cursor:pointer;">点击编辑</span>
  </div>
  <div id="todayScheduleContent">
    ${renderTodayScheduleContent()}
  </div>
</div>
    <div class="card">
  <h2>⚡ 课堂快捷工具</h2>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-top:8px;">
    
    <!-- 1. 课堂倒计时 -->
    <div class="quick-item" onclick="openTimer()" style="cursor:pointer;background:var(--bg);border-radius:12px;padding:16px;text-align:center;border-left:4px solid #4a6fa5;">
      <div style="font-size:2rem;">⏱️</div>
      <div style="font-weight:600;font-size:0.9rem;margin-top:4px;">课堂倒计时</div>
      <div style="font-size:0.7rem;color:var(--text-light);">讨论 · 限时答题</div>
    </div>

    <!-- 2. 随机点名器 -->
    <div class="quick-item" onclick="openPicker()" style="cursor:pointer;background:var(--bg);border-radius:12px;padding:16px;text-align:center;border-left:4px solid #ffc107;">
      <div style="font-size:2rem;">🎯</div>
      <div style="font-weight:600;font-size:0.9rem;margin-top:4px;">随机点名器</div>
      <div style="font-size:0.7rem;color:var(--text-light);">公平抽选 · 活跃气氛</div>
    </div>

    <!-- 3. 古诗文诵读 -->
    <div class="quick-item" onclick="openReader()" style="cursor:pointer;background:var(--bg);border-radius:12px;padding:16px;text-align:center;border-left:4px solid #28a745;">
      <div style="font-size:2rem;"> 🔊</div>
      <div style="font-weight:600;font-size:0.9rem;margin-top:4px;">课文范读</div>
      <div style="font-size:0.7rem;color:var(--text-light);">标准诵读 · 跟读练习</div>
    </div>

    <!-- 4. 积分榜 -->
<div class="quick-item" onclick="openScoreboard()" style="cursor:pointer;background:var(--bg);border-radius:12px;padding:16px;text-align:center;border-left:4px solid #9b59b6;">
  <div style="font-size:2rem;">🏆</div>
  <div style="font-weight:600;font-size:0.9rem;margin-top:4px;">积分榜</div>
  <div style="font-size:0.7rem;color:var(--text-light);margin-top:2px;">德智体美劳 · 综合排行</div>
</div>
  `;
}

// ===== 学情速览 =====
function openQuickStats() {
  // 获取数据
  const tasks = JSON.parse(localStorage.getItem('lessonTasks') || '[]');
  const todoItems = JSON.parse(localStorage.getItem('todoItems') || '[]');
  const today = fmtDate ? fmtDate(new Date()) : new Date().toISOString().slice(0, 10);
  
  // 备课统计
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => t.status === '已完成').length;
  const pendingTasks = tasks.filter(t => t.status !== '已完成' && !t.archived).length;
  
  // 今日待办
  const todayTodos = todoItems.filter(item => (item.dueDate || item.date) === today);
  const todoDone = todayTodos.filter(item => item.done).length;
  const todoUndone = todayTodos.length - todoDone;
  
  // 今日课程
  let todayLessons = 0;
  try {
    todayLessons = getTodaySchedule().length;
  } catch(e) {}
  
  const overlay = document.createElement('div');
  overlay.id = 'statsOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;justify-content:center;align-items:center;padding:20px;';
  
  overlay.innerHTML = `
    <div style="max-width:500px;width:100%;background:var(--card-bg);padding:28px;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,0.3);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h2 style="color:var(--text);margin:0;">📊 今日学情速览</h2>
        <button onclick="closeStatsOverlay()" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--text-light);">✕</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div style="background:var(--bg);padding:16px;border-radius:10px;text-align:center;">
          <div style="font-size:2rem;font-weight:700;color:#4a6fa5;">${todayLessons}</div>
          <div style="font-size:0.85rem;color:var(--text-light);">今日课程</div>
        </div>
        <div style="background:var(--bg);padding:16px;border-radius:10px;text-align:center;">
          <div style="font-size:2rem;font-weight:700;color:#28a745;">${todoDone}/${todayTodos.length}</div>
          <div style="font-size:0.85rem;color:var(--text-light);">今日待办完成</div>
        </div>
        <div style="background:var(--bg);padding:16px;border-radius:10px;text-align:center;">
          <div style="font-size:2rem;font-weight:700;color:#ffc107;">${doneTasks}/${totalTasks}</div>
          <div style="font-size:0.85rem;color:var(--text-light);">备课完成</div>
        </div>
      </div>
      <div style="margin-top:16px;padding:12px;background:${pendingTasks > 0 ? '#fff3cd' : '#d4edda'};border-radius:8px;text-align:center;font-size:0.95rem;">
        ${pendingTasks > 0 ? `⏳ 还有 ${pendingTasks} 个备课任务未完成` : '🎉 所有备课任务已完成！'}
      </div>
      <button onclick="closeStatsOverlay()" style="margin-top:16px;width:100%;padding:10px;border-radius:8px;border:none;background:#6c757d;color:#fff;cursor:pointer;">关闭</button>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closeStatsOverlay();
  });
  
  window.closeStatsOverlay = function() {
    const el = document.getElementById('statsOverlay');
    if (el) el.remove();
  };
}

// ===== 课堂工具 =====
function openTimer() {
  const input = prompt('请输入倒计时分钟数（支持小数，如 0.5）：', '3');
  if (input === null) return;
  const minutes = parseFloat(input);
  if (isNaN(minutes) || minutes <= 0) { alert('请输入有效的分钟数'); return; }
  const totalMs = Math.round(minutes * 60 * 1000);
  if (totalMs <= 0) return;

  let endTime = Date.now() + totalMs;   // 基于时间戳，后台标签页不漂移
  let paused = false;
  let remainMsAtPause = 0;
  let tickTimer = null;
  let flashTimer = null;

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;justify-content:center;align-items:center;flex-direction:column;color:#fff;';
  overlay.innerHTML = `
    <div style="font-size:12rem;font-weight:700;font-family:monospace;" id="timerDisplay">${formatTime(Math.round(totalMs / 1000))}</div>
    <div style="margin-top:8px;font-size:1rem;color:#ffd479;min-height:1.4em;" id="timerState"></div>
    <div style="margin-top:20px;display:flex;gap:16px;flex-wrap:wrap;justify-content:center;">
      <button id="timerPauseBtn" style="padding:10px 26px;border-radius:8px;border:none;background:#5a7fb5;color:#fff;cursor:pointer;font-size:1rem;">⏸ 暂停</button>
      <button id="timerResetBtn" style="padding:10px 26px;border-radius:8px;border:none;background:#ffc107;color:#333;cursor:pointer;font-size:1rem;">🔄 重置</button>
      <button id="timerCloseBtn" style="padding:10px 26px;border-radius:8px;border:none;background:#dc3545;color:#fff;cursor:pointer;font-size:1rem;">关闭</button>
    </div>
  `;
  document.body.appendChild(overlay);

  const display = overlay.querySelector('#timerDisplay');
  const stateEl = overlay.querySelector('#timerState');
  const pauseBtn = overlay.querySelector('#timerPauseBtn');

  function render(remainingSec) {
    const r = Math.max(0, remainingSec);
    const m = Math.floor(r / 60);
    const s = r % 60;
    display.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function finish() {
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
    display.textContent = '⏰ 时间到！';
    stateEl.textContent = '';
    pauseBtn.disabled = true;
    beep();
    let on = true;
    flashTimer = setInterval(function () {
      display.style.color = on ? '#ff6b6b' : '#fff';
      on = !on;
    }, 500);
  }

  function tick() {
    const remainingSec = Math.round((endTime - Date.now()) / 1000);
    if (remainingSec <= 0) { render(0); finish(); return; }
    render(remainingSec);
  }

  function startTick() {
    if (tickTimer) clearInterval(tickTimer);
    tick();
    tickTimer = setInterval(tick, 250);
  }

  function cleanup() {
    if (tickTimer) clearInterval(tickTimer);
    if (flashTimer) clearInterval(flashTimer);
    if (overlay._onKey) document.removeEventListener('keydown', overlay._onKey);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }

  pauseBtn.addEventListener('click', function () {
    if (paused) {
      endTime = Date.now() + remainMsAtPause;
      paused = false;
      pauseBtn.textContent = '⏸ 暂停';
      stateEl.textContent = '';
      startTick();
    } else {
      remainMsAtPause = endTime - Date.now();
      paused = true;
      if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
      pauseBtn.textContent = '▶ 继续';
      stateEl.textContent = '已暂停';
    }
  });

  overlay.querySelector('#timerResetBtn').addEventListener('click', function () {
    if (flashTimer) { clearInterval(flashTimer); flashTimer = null; }
    display.style.color = '#fff';
    endTime = Date.now() + totalMs;
    paused = false;
    pauseBtn.disabled = false;
    pauseBtn.textContent = '⏸ 暂停';
    stateEl.textContent = '';
    startTick();
  });

  overlay.querySelector('#timerCloseBtn').addEventListener('click', function () {
    cleanup();
    overlay.remove();
  });

  // 支持 Esc 关闭
  overlay._onKey = function (e) { if (e.key === 'Escape') { cleanup(); overlay.remove(); } };
  document.addEventListener('keydown', overlay._onKey);

  startTick();
}

// 倒计时结束提示音（WebAudio 生成，无需外部音频文件）
function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    o.connect(g); g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.6);
    o.onended = function () { ctx.close(); };
  } catch (e) { /* 部分环境禁用音频，忽略 */ }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

// 把长文本切分，避免 SpeechSynthesisUtterance 超长被浏览器截断
// 先按句末标点/换行切，再对任意仍超过 MAX 字数的片段按逗号/固定长度二次切分
function splitForTTS(text) {
  const MAX = 200;
  const raw = String(text).split(/([。！？；\n])/); // 保留分隔符
  const sentences = [];
  let buf = '';
  for (const seg of raw) {
    buf += seg;
    if (/[。！？；\n]/.test(seg)) {
      const t = buf.trim();
      if (t) sentences.push(t);
      buf = '';
    }
  }
  if (buf.trim()) sentences.push(buf.trim());
  if (!sentences.length) return [String(text)];

  const out = [];
  for (let s of sentences) {
    if (s.length <= MAX) { out.push(s); continue; }
    // 二次切分：优先按逗号/顿号，否则按固定长度
    const segs = s.split(/([，、])/);
    let piece = '';
    for (const seg of segs) {
      if ((piece + seg).length > MAX) {
        if (piece.trim()) out.push(piece.trim());
        piece = seg;
      } else {
        piece += seg;
      }
    }
    if (piece.trim()) out.push(piece.trim());
    // 仍超长（无逗号）则硬切
    for (let k = out.length - 1; k >= 0; k--) {
      if (out[k].length > MAX) {
        const big = out.splice(k, 1)[0];
        for (let p = 0; p < big.length; p += MAX) out.splice(k, 0, big.slice(p, p + MAX));
      }
    }
  }
  return out.length ? out : [String(text)];
}

// 选择中文语音（兼容 lang=zh-CN / cmn / 名称含 Chinese 等情况）
function pickZhVoice() {
  const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
  if (!voices.length) return null;
  return voices.find(v => /zh|cmn/i.test(v.lang) && /CN|CH|TW|HK/i.test(v.lang + v.name))
    || voices.find(v => /zh|cmn/i.test(v.lang))
    || voices.find(v => /chinese/i.test(v.name))
    || null;
}

function openPicker() {
  // 统一走 loadClassData()（含损坏保护），并按班级抽选
  const classData = loadClassData();
  const classes = classData.classes || [];
  const students = classData.students || [];
  if (students.length === 0) {
    alert('请先在「班级管理」中添加学生');
    return;
  }

  const pickedSet = new Set();   // 本轮已抽（防重复模式）
  let spinTimer = null;
  const curClassId = classes.length ? classes[0].id : '';

  function listForClass(classId) {
    return students.filter(s => !classId || s.classId === classId);
  }

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999;display:flex;justify-content:center;align-items:center;flex-direction:column;color:#fff;';
  const classOptions = classes.map(c => `<option value="${c.id}">${htmlEncode(c.name)}</option>`).join('');
  overlay.innerHTML = `
    <div style="display:flex;gap:12px;align-items:center;margin-bottom:18px;flex-wrap:wrap;justify-content:center;">
      ${classes.length ? `<select id="pickerClass" style="padding:8px 12px;border-radius:8px;border:none;font-size:1rem;color:#2c3e50;max-width:220px;">${classOptions}</select>` : ''}
      <label style="font-size:1rem;cursor:pointer;user-select:none;">
        <input type="checkbox" id="pickerNoRepeat" style="transform:scale(1.3);margin-right:6px;vertical-align:middle;" /> 本轮不重复
      </label>
    </div>
    <div style="font-size:5rem;font-weight:700;margin-bottom:20px;">🎯</div>
    <div style="font-size:6rem;font-weight:700;margin-bottom:30px;" id="pickerName">点击抽取</div>
    <div style="display:flex;gap:16px;">
      <button id="pickerDrawBtn" style="padding:12px 40px;border-radius:8px;border:none;background:#4a6fa5;color:#fff;cursor:pointer;font-size:1.2rem;">🎲 抽取</button>
      <button id="pickerCloseBtn" style="padding:12px 30px;border-radius:8px;border:none;background:#6c757d;color:#fff;cursor:pointer;font-size:1.2rem;">关闭</button>
    </div>
  `;
  document.body.appendChild(overlay);

  const display = overlay.querySelector('#pickerName');
  const classSel = overlay.querySelector('#pickerClass');
  const noRepeat = overlay.querySelector('#pickerNoRepeat');

  function cleanup() {
    if (spinTimer) clearInterval(spinTimer);
    if (overlay._onKey) document.removeEventListener('keydown', overlay._onKey);
  }

  function draw() {
    const classId = classSel ? classSel.value : '';
    let pool = listForClass(classId);
    if (noRepeat && noRepeat.checked) {
      const remain = pool.filter(s => !pickedSet.has(s.id));
      if (remain.length === 0) {
        pickedSet.clear();
        alert('本轮已抽完，已重新开始');
      } else {
        pool = remain;
      }
    }
    if (pool.length === 0) { alert('该班级暂无学生'); return; }

    if (spinTimer) clearInterval(spinTimer);
    let count = 0;
    spinTimer = setInterval(function () {
      const idx = Math.floor(Math.random() * pool.length);
      display.textContent = pool[idx].name;
      display.style.color = '#ffc107';
      display.style.fontSize = '6rem';
      count++;
      if (count > 20) {
        clearInterval(spinTimer);
        spinTimer = null;
        const finalIdx = Math.floor(Math.random() * pool.length);
        const picked = pool[finalIdx];
        display.textContent = '🎉 ' + picked.name + ' 🎉';
        display.style.color = '#28a745';
        display.style.fontSize = '8rem';
        if (noRepeat && noRepeat.checked) pickedSet.add(picked.id);
      }
    }, 80);
  }

  overlay.querySelector('#pickerDrawBtn').addEventListener('click', draw);
  overlay.querySelector('#pickerCloseBtn').addEventListener('click', function () { cleanup(); overlay.remove(); });
  if (classSel) classSel.addEventListener('change', function () {
    pickedSet.clear();
    display.textContent = '点击抽取';
    display.style.color = '';
    display.style.fontSize = '6rem';
  });
  if (noRepeat) noRepeat.addEventListener('change', function () { pickedSet.clear(); });

  overlay._onKey = function (e) { if (e.key === 'Escape') { cleanup(); overlay.remove(); } };
  document.addEventListener('keydown', overlay._onKey);
}

// ===== 课文范读（带 TTS 语音朗读） =====
function openReader() {
  const texts = window.SAMPLE_TEXTS || {};
  const allKeys = Object.keys(texts);
  if (allKeys.length === 0) {
    alert('暂无课文数据');
    return;
  }

  const PAGE = 30;
  let searchTerm = '';
  let typeFilter = '';
  let page = 1;

  // 创建选择界面（含搜索 / 类型筛选 / 分页）
  const overlay = document.createElement('div');
  overlay.id = 'readerOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.75);z-index:9999;display:flex;justify-content:center;align-items:center;padding:20px;';

  overlay.innerHTML = `
    <div style="max-width:560px;width:100%;background:var(--card-bg);padding:24px;border-radius:12px;max-height:85vh;display:flex;flex-direction:column;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:8px;">
        <h2 style="color:var(--text);margin:0;">📖 选择课文</h2>
        <button onclick="closeReaderOverlay()" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--text-light);">✕</button>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
        <input id="readerSearch" type="text" placeholder="🔍 搜索篇名…" style="flex:1;min-width:140px;padding:8px 12px;border-radius:8px;border:1px solid #ddd;background:var(--bg);color:var(--text);font-size:0.95rem;" />
        <select id="readerType" style="padding:8px 12px;border-radius:8px;border:1px solid #ddd;background:var(--bg);color:var(--text);font-size:0.95rem;">
          <option value="">全部类型</option>
          <option value="古诗词">古诗词</option>
          <option value="文言文">文言文</option>
          <option value="课文">课文</option>
        </select>
      </div>
      <div id="readerList" style="overflow-y:auto;flex:1;min-height:200px;"></div>
      <div id="readerPager" style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;justify-content:center;align-items:center;"></div>
      <div style="margin-top:10px;font-size:0.8rem;color:var(--text-light);text-align:center;">点击课文查看全文，点「🔊 朗读」可语音播报</div>
    </div>
  `;
  document.body.appendChild(overlay);

  const listEl = overlay.querySelector('#readerList');
  const pagerEl = overlay.querySelector('#readerPager');
  const searchEl = overlay.querySelector('#readerSearch');
  const typeEl = overlay.querySelector('#readerType');

  function filteredKeys() {
    const q = searchTerm.trim().toLowerCase();
    return allKeys.filter(k => {
      const item = texts[k];
      if (typeFilter && (item.type || '课文') !== typeFilter) return false;
      if (q && k.replace(/^\*\s*/, '').toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }

  function renderList() {
    const keys = filteredKeys();
    const total = keys.length;
    const pages = Math.max(1, Math.ceil(total / PAGE));
    if (page > pages) page = pages;
    const start = (page - 1) * PAGE;
    const slice = keys.slice(start, start + PAGE);
    if (slice.length === 0) {
      listEl.innerHTML = '<div style="text-align:center;color:var(--text-light);padding:24px 0;">未找到匹配的课文</div>';
    } else {
      listEl.innerHTML = slice.map(k => {
        const cleanTitle = k.replace(/^\*\s*/, '');
        return `
          <div onclick="selectReader('${k.replace(/'/g, "\\'")}')" style="padding:8px 16px;margin:4px 0;border-radius:6px;background:var(--bg);color:var(--text);cursor:pointer;transition:background 0.2s;display:flex;justify-content:space-between;align-items:center;"
               onmouseenter="this.style.background='#4a6fa5';this.style.color='#fff';"
               onmouseleave="this.style.background='var(--bg)';this.style.color='var(--text)';">
            <span>${htmlEncode(cleanTitle)}</span>
            <span style="font-size:0.8rem;color:var(--text-light);">${htmlEncode(texts[k].type || '课文')}</span>
          </div>`;
      }).join('');
    }
    // 分页器
    if (pages <= 1) { pagerEl.innerHTML = ''; return; }
    let html = `<button data-pg="prev" style="padding:4px 12px;border-radius:6px;border:1px solid #ccc;background:var(--bg);color:var(--text);cursor:pointer;">‹ 上一页</button>`;
    const win = 5;
    let s = Math.max(1, page - 2), e = Math.min(pages, s + win - 1);
    s = Math.max(1, e - win + 1);
    for (let p = s; p <= e; p++) {
      html += `<button data-pg="${p}" style="padding:4px 12px;border-radius:6px;border:1px solid ${p === page ? '#4a6fa5' : '#ccc'};background:${p === page ? '#4a6fa5' : 'var(--bg)'};color:${p === page ? '#fff' : 'var(--text)'};cursor:pointer;">${p}</button>`;
    }
    html += `<button data-pg="next" style="padding:4px 12px;border-radius:6px;border:1px solid #ccc;background:var(--bg);color:var(--text);cursor:pointer;">下一页 ›</button>`;
    html += `<span style="font-size:0.8rem;color:var(--text-light);margin-left:6px;">${total} 篇 · 第 ${page}/${pages} 页</span>`;
    pagerEl.innerHTML = html;
  }

  searchEl.addEventListener('input', function () { searchTerm = this.value; page = 1; renderList(); });
  typeEl.addEventListener('change', function () { typeFilter = this.value; page = 1; renderList(); });
  pagerEl.addEventListener('click', function (e) {
    const btn = e.target.closest('button[data-pg]');
    if (!btn) return;
    const pg = btn.dataset.pg;
    const pages = Math.max(1, Math.ceil(filteredKeys().length / PAGE));
    if (pg === 'prev') page = Math.max(1, page - 1);
    else if (pg === 'next') page = Math.min(pages, page + 1);
    else page = parseInt(pg, 10);
    renderList();
  });

  renderList();

  overlay.addEventListener('click', function (e) { if (e.target === overlay) closeReaderOverlay(); });
  overlay._onKey = function (e) { if (e.key === 'Escape') closeReaderOverlay(); };
  document.addEventListener('keydown', overlay._onKey);

  window.closeReaderOverlay = function () {
    if (overlay._onKey) document.removeEventListener('keydown', overlay._onKey);
    const el = document.getElementById('readerOverlay');
    if (el) el.remove();
  };

  window.selectReader = async function(key) {
    const texts = window.SAMPLE_TEXTS || {};
    let item = texts[key];
    const cleanTitle = key.replace(/^\*\s*/, '');
    if (!item) { alert('课文数据不存在'); return; }
    closeReaderOverlay();

    // 详情为懒加载：若该篇已补齐全文，优先朗读全文而非原文摘要
    if (typeof window.loadTextDetail === 'function' && item.fullText === undefined && item.hasDetail) {
      try {
        const loaded = await window.loadTextDetail(key);
        if (loaded) item = loaded;
      } catch (err) {
        console.warn('[reader] 全文加载失败，回退至原文摘要：', err);
      }
    }
    const readText = item.fullText || item.original || '暂无原文';
    
    const contentOverlay = document.createElement('div');
    contentOverlay.id = 'readerContentOverlay';
    contentOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:9999;display:flex;justify-content:center;align-items:center;padding:20px;';
    contentOverlay.innerHTML = `
      <div style="max-width:700px;width:100%;background:var(--card-bg);padding:30px;border-radius:12px;max-height:80vh;overflow-y:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h2 style="color:var(--text);margin:0;">📖 ${cleanTitle}</h2>
          <button onclick="closeReaderContent()" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--text-light);">✕</button>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
          <button onclick="playAudio()" style="padding:6px 16px;border-radius:6px;border:none;background:#4a6fa5;color:#fff;cursor:pointer;">🔊 朗读</button>
          <button onclick="stopAudio()" style="padding:6px 16px;border-radius:6px;border:none;background:#dc3545;color:#fff;cursor:pointer;">⏹ 停止</button>
        </div>
        <div style="color:var(--text);font-size:1.05rem;line-height:2;margin-top:12px;white-space:pre-wrap;padding:12px;background:var(--bg);border-radius:6px;" id="readerText">${readText}</div>
        ${item.背诵要求 ? `<div style="margin-top:12px;padding:8px 12px;background:#fff3cd;border-radius:6px;color:#856404;font-size:0.9rem;">📌 背诵要求：${item.背诵要求}</div>` : ''}
        <button onclick="closeReaderContent()" style="margin-top:16px;padding:8px 24px;border-radius:6px;border:none;background:#6c757d;color:#fff;cursor:pointer;">关闭</button>
      </div>
    `;
    document.body.appendChild(contentOverlay);
    
    contentOverlay.addEventListener('click', function(e) {
      if (e.target === contentOverlay) closeReaderContent();
    });
    contentOverlay._onKey = function(e) { if (e.key === 'Escape') closeReaderContent(); };
    document.addEventListener('keydown', contentOverlay._onKey);

    // 存储当前课文文本用于朗读
    window._currentReaderText = readText === '暂无原文' ? '' : readText;
    window._currentReaderTitle = cleanTitle;
    
    // 语音合成（按句分片 + 中文嗓延迟加载修复）
    window.playAudio = function() {
      const text = window._currentReaderText;
      if (!text) { alert('没有可朗读的文本'); return; }
      if (!window.speechSynthesis) { alert('您的浏览器不支持语音合成'); return; }

      // 停止之前的语音
      window.speechSynthesis.cancel();

      const chunks = splitForTTS(text);
      let i = 0;
      function next() {
        if (i >= chunks.length) return;
        const u = new SpeechSynthesisUtterance(chunks[i]);
        u.lang = 'zh-CN';
        u.rate = window._readerRate || 0.9;
        u.pitch = 1;
        const zhVoice = pickZhVoice();
        if (zhVoice) u.voice = zhVoice;
        u.onend = function () { i++; next(); };
        u.onerror = function () { i++; next(); }; // 跳过出错片段，继续后续
        window.speechSynthesis.speak(u);
      }

      // 首次调用时语音列表常为空，需等 voiceschanged 后再读，否则会用默认英文嗓
      if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = function () {
          window.speechSynthesis.onvoiceschanged = null;
          next();
        };
      } else {
        next();
      }
    };

    window.stopAudio = function() {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  };
  
  window.closeReaderContent = function() {
    // 停止朗读
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    const el = document.getElementById('readerContentOverlay');
    if (el && el._onKey) document.removeEventListener('keydown', el._onKey);
    if (el) el.remove();
  };
}

function openDictation() {
  const text = prompt('请输入要默写的课文或关键词提示：\n（输入课文名或关键词）');
  if (!text) return;
  
  // 创建遮罩层
  const overlay = document.createElement('div');
  overlay.id = 'dictationOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999;display:flex;justify-content:center;align-items:center;padding:20px;';
  
  overlay.innerHTML = `
    <div style="max-width:600px;width:100%;background:var(--card-bg);padding:30px;border-radius:12px;">
      <h2 style="color:var(--text);">✏️ 课堂默写板</h2>
      <div style="color:var(--text-light);font-size:1.2rem;margin:20px 0;padding:20px;background:var(--bg);border-radius:8px;text-align:center;">
        📌 关键词：<span style="color:var(--text);font-weight:700;font-size:1.4rem;">${text}</span>
      </div>
      <textarea id="dictationInput" rows="6" placeholder="在此默写..." style="width:100%;padding:12px;border-radius:8px;border:1px solid #ddd;background:var(--bg);color:var(--text);font-size:1rem;resize:vertical;"></textarea>
      <div style="display:flex;gap:12px;margin-top:16px;">
        <button id="dictationSubmitBtn" style="flex:1;padding:10px;border-radius:8px;border:none;background:#28a745;color:#fff;cursor:pointer;">📤 提交</button>
        <button id="dictationCloseBtn" style="flex:1;padding:10px;border-radius:8px;border:none;background:#6c757d;color:#fff;cursor:pointer;">关闭</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // 提交按钮
  document.getElementById('dictationSubmitBtn').addEventListener('click', function() {
    const input = document.getElementById('dictationInput');
    const content = input.value.trim();
    if (!content) {
      alert('请先输入默写内容');
      return;
    }
    // 显示提交成功提示，但不关闭弹窗
    const btn = this;
    btn.textContent = '✅ 已提交';
    btn.style.background = '#155724';
    btn.disabled = true;
    // 可以选择让用户继续修改
    setTimeout(function() {
      btn.textContent = '📤 重新提交';
      btn.style.background = '#28a745';
      btn.disabled = false;
    }, 2000);
    // 保存到本地
    const records = JSON.parse(localStorage.getItem('dictationRecords') || '[]');
    records.push({
      keyword: text,
      content: content,
      time: new Date().toISOString()
    });
    localStorage.setItem('dictationRecords', JSON.stringify(records));
    console.log('✅ 默写已保存');
  });
  
  // 关闭按钮 - 直接移除整个遮罩层
  document.getElementById('dictationCloseBtn').addEventListener('click', function() {
    const overlayEl = document.getElementById('dictationOverlay');
    if (overlayEl) overlayEl.remove();
  });
  
  // 点击遮罩层背景也关闭
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) {
      overlay.remove();
    }
  });
}

// 暴露到全局
window.openTimer = openTimer;
window.openPicker = openPicker;
window.openReader = openReader;
window.openDictation = openDictation;
window.formatTime = formatTime;

function getCompletedTaskCount() {
  const tasks = JSON.parse(localStorage.getItem('lessonTasks') || '[]');
  return tasks.filter(t => !t.archived && t.status === '已完成').length;
}

function renderTodayScheduleContent() {
  try {
    const lessons = getTodaySchedule();
    return renderTodaySchedule(lessons);
  } catch(e) {
    return '<p style="color:#7f8c8d;text-align:center;padding:12px;">今日暂无课程安排 📭</p>';
  }
}

function initDashboard() {

// ---- 点击“今日待办” ----
document.getElementById('todayTaskStat')?.addEventListener('click', function() {
  showModule('todo');
});

// ---- 点击“今日诵读” → 打开教材资源详情 ----
document.getElementById('reciteStat')?.addEventListener('click', function() {
  showModule('resource');
  const key = window.__dailyReciteKey;
  if (key && typeof openDetail === 'function') {
    setTimeout(function() { openDetail(key); }, 60);
  }
});

  // 点击“今日剩余课程” → 跳转课程表
  const statEl = document.getElementById('todayLessonStat');
  if (statEl) {
    statEl.addEventListener('click', function() {
      showModule('schedule');
    });
  }

  // 点击“今日教学安排”卡片 → 跳转课程表
  const editBtn = document.getElementById('editScheduleBtn');
if (editBtn) {
  editBtn.addEventListener('click', function(e) {
    e.stopPropagation();  // 防止冒泡
    showModule('schedule');
  });
}

  // ===== 新增：点击“未完成备课” → 跳转备课中心 =====
  const pendingStat = document.getElementById('pendingTaskStat');
if (pendingStat) {
  pendingStat.addEventListener('click', function() {
    showModule('lesson');
  });
}

  // 监听课程表更新事件
  window.addEventListener('scheduleUpdated', function() {
    try {
      const contentEl = document.getElementById('todayScheduleContent');
      if (contentEl) {
        contentEl.innerHTML = renderTodayScheduleContent();
      }
      const countEl = document.getElementById('todayLessonCount');
      if (countEl) {
        const { remaining, next } = getTodayRemaining();
        countEl.textContent = remaining.length;
        const nextEl = document.getElementById('nextLessonInfo');
        if (nextEl) {
          nextEl.textContent = next ? `下一节：${next.display || next.text}` : '今日课程已结束 🎉';
        }
      }
    } catch(e) {}
  });
}

// ========== 模块切换 ==========
function showModule(name) {
  document.querySelectorAll('.sidebar li').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.sidebar li').forEach(el => {
    if (el.dataset.module === name) el.classList.add('active');
  });
  const main = document.getElementById('mainContent');

  switch (name) {
    case 'dashboard':
      main.innerHTML = renderDashboard();
      initDashboard();
      break;
    case 'lesson':
      main.innerHTML = renderLessonPlan();
      initLessonPlan();
      break;
    case 'essay':
      main.innerHTML = renderEssay();
      initEssay();
      break;
    case 'resource':
      main.innerHTML = renderResource();
      initResource();
      break;
    case 'exam':
      main.innerHTML = renderExam();
      initExam();
      break;
    case 'ocr':
      // 手写识别已并入「作文批改」，旧入口重定向过去并直接打开手写录入 Tab
      window.__essayInitialTab = 'ocr';
      document.querySelectorAll('.sidebar li').forEach(el => {
        if (el.dataset.module === 'essay') el.classList.add('active');
      });
      main.innerHTML = renderEssay();
      initEssay();
      break;
    case 'class':
      main.innerHTML = renderClass();
      initClass();
      break;
    case 'data-analysis':
  try {
    console.log('🔄 加载数据分析...');
    const html = renderDataAnalysis();
    main.innerHTML = html;
    if (typeof initDataAnalysis === 'function') {
      initDataAnalysis();
    }
  } catch (e) {
    console.error('❌ 数据分析加载失败:', e);
    main.innerHTML = `<div class="card"><h2>⚠️ 加载失败</h2><p>${e.message}</p><button class="btn" onclick="localStorage.removeItem('examData');localStorage.removeItem('attendanceData');location.reload();">重置数据</button></div>`;
  }
  break;
    case 'settings':
      main.innerHTML = renderSettings();
      initSettings();
      break;
    case 'schedule':
      main.innerHTML = renderSchedule();
      initSchedule();
      break;
    case 'todo':
      main.innerHTML = renderTodo();
      initTodo();
      break;

    default:
      main.innerHTML = '<p style="padding:40px;text-align:center;color:#7f8c8d;">功能未找到</p>';
  }
}

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', function() {
  
  // ===== 认证检查 =====
  const loginContainer = document.getElementById('loginContainer');
  const mainApp = document.querySelector('.app-header');
  const appLayout = document.querySelector('.app-layout');
  
  // 检查登录状态
  let authStatus = { valid: false };
  try {
    authStatus = checkAuthStatus();
  } catch(e) {
    console.warn('认证模块未加载，跳过登录检查');
    // 如果 auth 模块未加载，直接显示应用（调试模式）
    if (loginContainer) loginContainer.style.display = 'none';
    if (mainApp) mainApp.style.display = 'flex';
    if (appLayout) appLayout.style.display = 'flex';
    // 继续执行后续初始化
    initAppAfterLogin();
    return;
  }
  
    // 公开分发版：打开即用，不做登录拦截（数据存各自浏览器 localStorage）
  
  // ===== 已登录：隐藏登录界面，显示应用 =====
  if (loginContainer) loginContainer.style.display = 'none';
  if (mainApp) mainApp.style.display = 'flex';
  if (appLayout) appLayout.style.display = 'flex';
  
  // 执行后续初始化
  initAppAfterLogin();
});

// ===== 将原有初始化代码移到这个函数中 =====
function initAppAfterLogin() {
  // ---- 主题切换（与设置中心的 appSettings.theme 共用同一数据源，避免两套键互相覆盖）----
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    const getSavedTheme = () => {
      try {
        const s = JSON.parse(localStorage.getItem('appSettings') || '{}');
        return s.theme === 'dark' ? 'dark' : 'light';
      } catch { return 'light'; }
    };
    const applyTheme = () => {
      const isDark = getSavedTheme() === 'dark';
      document.body.classList.toggle('dark', isDark);
      themeToggle.textContent = isDark ? '☀️' : '🌙';
    };
    applyTheme();
    themeToggle.addEventListener('click', function() {
      const newTheme = getSavedTheme() === 'dark' ? 'light' : 'dark';
      let settings;
      try { settings = JSON.parse(localStorage.getItem('appSettings') || '{}'); } catch { settings = {}; }
      settings.theme = newTheme;
      localStorage.setItem('appSettings', JSON.stringify(settings));
      applyTheme();
    });
  }

  // ---- 侧边栏菜单 ----
  document.querySelectorAll('.sidebar li').forEach(li => {
    li.addEventListener('click', function() {
      const module = this.dataset.module;
      document.body.classList.remove('nav-open'); // 移动端：点菜单项后收起抽屉
      if (module && typeof showModule === 'function') {
        showModule(module);
      }
    });
  });

  // ---- 移动端：抽屉式侧边栏开关 ----
  const menuToggle = document.getElementById('menuToggle');
  if (menuToggle) {
    menuToggle.addEventListener('click', function(e) {
      e.stopPropagation();
      document.body.classList.toggle('nav-open');
    });
  }
  const navBackdrop = document.getElementById('navBackdrop');
  if (navBackdrop) {
    navBackdrop.addEventListener('click', function() {
      document.body.classList.remove('nav-open');
    });
  }

  // ---- 顶部全局搜索 ----
  if (typeof initGlobalSearch === 'function') {
    initGlobalSearch();
  }

  // ---- 通知权限 ----
  if (typeof requestNotificationPermission === 'function') {
    requestNotificationPermission();
  }

  // ---- 定时刷新 ----
  if (typeof setInterval === 'function') {
    setInterval(function() {
      const activeMenu = document.querySelector('.sidebar li.active');
      if (activeMenu && activeMenu.dataset.module === 'dashboard') {
        try {
          if (typeof getTodayRemaining === 'function') {
            const { remaining, next } = getTodayRemaining();
            const countEl = document.getElementById('todayLessonCount');
            if (countEl) countEl.textContent = remaining.length;
            const nextEl = document.getElementById('nextLessonInfo');
            if (nextEl) {
              nextEl.textContent = next ? `下一节：${next.display || next.text} (${next.time})` : '今日课程已结束 🎉';
            }
            const contentEl = document.getElementById('todayScheduleContent');
            if (contentEl && typeof renderTodayScheduleContent === 'function') {
              contentEl.innerHTML = renderTodayScheduleContent();
            }
          }
        } catch(e) {}
      }
      if (typeof checkReminders === 'function') {
        try { checkReminders(); } catch(e) {}
      }
      if (typeof checkTodoReminders === 'function') {
        try { checkTodoReminders(); } catch(e) {}
      }
    }, 30000);
  }

  // ---- 默认加载工作台 ----
  if (typeof showModule === 'function') {
    showModule('dashboard');
  }
}

// ========== PWA：仅在安全上下文（https / localhost）注册 Service Worker ==========
// file:// 或非安全上下文不注册，避免报错；GitHub Pages（https）等环境可正常启用离线缓存。
(function setupPWA() {
  if (!('serviceWorker' in navigator)) return;
  if (!window.isSecureContext) return;
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('sw.js').catch(function(err) {
      console.warn('[PWA] Service Worker 注册失败：', err);
    });
  });
})();