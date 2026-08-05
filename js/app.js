// ============================================================
// 语文智备Pro - 主应用
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


// ========== 搜索功能 ==========
function renderSearchResults(keyword) {
  if (!keyword || keyword.trim() === '') {
    return '<div class="card"><p>请输入关键词搜索。</p></div>';
  }
  const kw = keyword.trim().toLowerCase();
  const results = [];
  if (window.SAMPLE_TEXTS) {
    Object.keys(window.SAMPLE_TEXTS).forEach(name => {
      const item = window.SAMPLE_TEXTS[name];
      // 构建搜索文本：标题 + 作者 + 朝代 + 类型 + 原文 + 注释 + 标签
      const searchText = [
        name,
        item.author || '',
        item.dynasty || '',
        item.type || '',
        item.original || '',
        item.tags ? item.tags.join('') : '',
        // notes 属详情字段（懒加载）；索引中的 nk 保留了注释词条名，保证搜索不降级
        item.notes ? Object.values(item.notes).join('') : '',
        item.nk || ''
      ].join(' ').toLowerCase();
      
      if (searchText.includes(kw)) {
        results.push({ name, ...item });
      }
    });
  }
  if (results.length === 0) {
    return `<div class="card"><p>😅 未找到与“${keyword}”匹配的课文。</p></div>`;
  }
  let html = `<div class="card"><h2>🔍 搜索结果（${results.length} 项）</h2><ul style="list-style:none;padding:0;">`;
  results.forEach(item => {
    // 高亮显示关键词
    let displayName = item.name.replace(/^\*\s*/, '');
    const idx = displayName.toLowerCase().indexOf(kw);
    if (idx !== -1) {
      displayName = displayName.slice(0, idx) + '<mark>' + displayName.slice(idx, idx + kw.length) + '</mark>' + displayName.slice(idx + kw.length);
    }
    html += `<li style="padding:6px 0;border-bottom:1px solid #eee;">
      <strong>${displayName}</strong> — ${item.author || '佚名'}（${item.dynasty || ''}）
      <span style="color:#7f8c8d;margin-left:10px;">${item.type}</span>
    </li>`;
  });
  html += '</ul></div>';
  return html;
}

function doSearch(keyword) {
  document.querySelectorAll('.sidebar li').forEach(el => el.classList.remove('active'));
  const main = document.getElementById('mainContent');
  main.innerHTML = renderSearchResults(keyword);
}

// ===== 今日待办统计 =====
function getTodayTaskStats() {
  const items = JSON.parse(localStorage.getItem('todoItems') || '[]');
  const today = new Date().toISOString().slice(0, 10);
  const todayItems = items.filter(item => item.date === today);
  const done = todayItems.filter(item => item.done).length;
  return { total: todayItems.length, done: done };
}

// ===== 系统通知统计 =====
function getNotificationCount() {
  // 1. 即将上课提醒（提前5分钟）
  // 2. 逾期任务
  // 3. 今日截止任务
  const tasks = JSON.parse(localStorage.getItem('lessonTasks') || '[]');
  const today = new Date().toISOString().slice(0, 10);
  const overdue = tasks.filter(t => 
    !t.archived && 
    t.status !== '已完成' && 
    t.deadline && 
    t.deadline < today
  );
  const dueToday = tasks.filter(t => 
    !t.archived && 
    t.status !== '已完成' && 
    t.deadline === today
  );
  // 检查是否有即将上课的提醒
  const hasClassSoon = checkClassSoon();
  let count = overdue.length + dueToday.length;
  if (hasClassSoon) count += 1;
  return count;
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

  return `
    <div class="card">
      <h2>😊 欢迎使用语文智备Pro</h2>
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
  <div class="num" id="todayTaskCount">${getTodayTaskStats().total}</div>
  <div style="font-size:0.85rem;color:#7f8c8d;margin-top:2px;">已完成 ${getTodayTaskStats().done} / ${getTodayTaskStats().total}</div>
  <div class="label">⏰ 今日待办</div>
</div>
<div class="stat-item" id="notificationStat" style="cursor:pointer;">
  <div class="num" id="notificationCount" style="color:${getNotificationCount() > 0 ? '#dc3545' : '#4a6fa5'};">${getNotificationCount()}</div>
  <div style="font-size:0.85rem;color:#7f8c8d;margin-top:2px;">${getNotificationCount() > 0 ? '🔴 有未读通知' : '暂无通知'}</div>
  <div class="label">🔔 系统通知</div>
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
  const today = new Date().toISOString().slice(0, 10);
  
  // 备课统计
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => t.status === '已完成').length;
  const pendingTasks = tasks.filter(t => t.status !== '已完成' && !t.archived).length;
  
  // 今日待办
  const todayTodos = todoItems.filter(item => item.date === today);
  const todoDone = todayTodos.filter(item => item.done).length;
  const todoUndone = todayTodos.length - todoDone;
  
  // 今日课程
  let todayLessons = 0;
  try {
    todayLessons = getTodaySchedule().length;
  } catch(e) {}
  
  // 通知数
  let notifCount = 0;
  try {
    notifCount = getNotificationCount();
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
        <div style="background:var(--bg);padding:16px;border-radius:10px;text-align:center;">
          <div style="font-size:2rem;font-weight:700;color:${notifCount > 0 ? '#dc3545' : '#6c757d'};">${notifCount}</div>
          <div style="font-size:0.85rem;color:var(--text-light);">系统通知</div>
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
  const minutes = prompt('请输入倒计时分钟数：', '3');
  if (!minutes) return;
  const seconds = parseInt(minutes) * 60;
  let remaining = seconds;
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;justify-content:center;align-items:center;flex-direction:column;color:#fff;';
  overlay.innerHTML = `
    <div style="font-size:6rem;font-weight:700;font-family:monospace;" id="timerDisplay">${formatTime(remaining)}</div>
    <div style="margin-top:20px;display:flex;gap:16px;">
      <button onclick="this.parentElement.parentElement.remove()" style="padding:10px 30px;border-radius:8px;border:none;background:#dc3545;color:#fff;cursor:pointer;font-size:1rem;">关闭</button>
      <button onclick="this.parentElement.parentElement.querySelector('#timerDisplay').textContent='00:00'" style="padding:10px 30px;border-radius:8px;border:none;background:#ffc107;color:#333;cursor:pointer;font-size:1rem;">重置</button>
    </div>
  `;
  document.body.appendChild(overlay);
  
  const timer = setInterval(function() {
    remaining--;
    const display = document.getElementById('timerDisplay');
    if (display) display.textContent = formatTime(remaining);
    if (remaining <= 0) {
      clearInterval(timer);
      document.getElementById('timerDisplay').textContent = '⏰ 时间到！';
      // 闪烁效果
      let flash = true;
      setInterval(function() {
        const d = document.getElementById('timerDisplay');
        if (d) d.style.color = flash ? '#ff6b6b' : '#fff';
        flash = !flash;
      }, 500);
    }
  }, 1000);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function openPicker() {
  // 从班级管理获取学生列表
  const classData = JSON.parse(localStorage.getItem('classData') || '{}');
  let students = classData.students || [];
  if (students.length === 0) {
    alert('请先在「班级管理」中添加学生');
    return;
  }
  const names = students.map(s => s.name);
  // 滚动抽选
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999;display:flex;justify-content:center;align-items:center;flex-direction:column;color:#fff;';
  overlay.innerHTML = `
    <div style="font-size:5rem;font-weight:700;margin-bottom:20px;" id="pickerDisplay">🎯</div>
    <div style="font-size:3rem;font-weight:700;margin-bottom:30px;" id="pickerName">点击抽取</div>
    <div style="display:flex;gap:16px;">
      <button onclick="pickStudent()" style="padding:12px 40px;border-radius:8px;border:none;background:#4a6fa5;color:#fff;cursor:pointer;font-size:1.2rem;">🎲 抽取</button>
      <button onclick="this.parentElement.parentElement.remove()" style="padding:12px 30px;border-radius:8px;border:none;background:#6c757d;color:#fff;cursor:pointer;font-size:1.2rem;">关闭</button>
    </div>
  `;
  document.body.appendChild(overlay);
  
  const namesList = names;
  window.pickStudent = function() {
    const display = document.getElementById('pickerName');
    const namesList2 = namesList;
    // 快速轮播效果
    let count = 0;
    const interval = setInterval(function() {
      const idx = Math.floor(Math.random() * namesList2.length);
      display.textContent = namesList2[idx];
      display.style.color = '#ffc107';
      count++;
      if (count > 20) {
        clearInterval(interval);
        const finalIdx = Math.floor(Math.random() * namesList2.length);
        display.textContent = '🎉 ' + namesList2[finalIdx] + ' 🎉';
        display.style.color = '#28a745';
        display.style.fontSize = '4rem';
      }
    }, 80);
  };
}

// ===== 课文范读（带 TTS 语音朗读） =====
function openReader() {
  const texts = window.SAMPLE_TEXTS || {};
  const keys = Object.keys(texts);
  if (keys.length === 0) {
    alert('暂无课文数据');
    return;
  }
  
  // 创建选择界面
  const overlay = document.createElement('div');
  overlay.id = 'readerOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.75);z-index:9999;display:flex;justify-content:center;align-items:center;padding:20px;';
  
  let listHtml = '';
  keys.forEach((k, i) => {
    const cleanTitle = k.replace(/^\*\s*/, '');
    listHtml += `
      <div onclick="selectReader('${k}')" style="padding:8px 16px;margin:4px 0;border-radius:6px;background:var(--bg);color:var(--text);cursor:pointer;transition:background 0.2s;display:flex;justify-content:space-between;align-items:center;"
           onmouseenter="this.style.background='#4a6fa5';this.style.color='#fff';"
           onmouseleave="this.style.background='var(--bg)';this.style.color='var(--text)';">
        <span>${i+1}. ${cleanTitle}</span>
        <span style="font-size:0.8rem;color:var(--text-light);">${texts[k].type || '课文'}</span>
      </div>
    `;
  });
  
  overlay.innerHTML = `
    <div style="max-width:500px;width:100%;background:var(--card-bg);padding:24px;border-radius:12px;max-height:80vh;display:flex;flex-direction:column;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h2 style="color:var(--text);margin:0;">📖 选择课文</h2>
        <button onclick="closeReaderOverlay()" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--text-light);">✕</button>
      </div>
      <div style="overflow-y:auto;flex:1;">
        ${listHtml}
      </div>
      <div style="margin-top:12px;font-size:0.8rem;color:var(--text-light);text-align:center;">点击课文名称查看全文，点击「🔊 朗读」可语音播报</div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closeReaderOverlay();
  });
  
  window.closeReaderOverlay = function() {
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
    
    // 存储当前课文文本用于朗读
    window._currentReaderText = readText === '暂无原文' ? '' : readText;
    window._currentReaderTitle = cleanTitle;
    
    // 语音合成
    window.playAudio = function() {
      const text = window._currentReaderText;
      if (!text) { alert('没有可朗读的文本'); return; }
      if (!window.speechSynthesis) { alert('您的浏览器不支持语音合成'); return; }
      
      // 停止之前的语音
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = 0.9;
      utterance.pitch = 1;
      // 选择中文语音
      const voices = window.speechSynthesis.getVoices();
      const zhVoice = voices.find(v => v.lang.startsWith('zh'));
      if (zhVoice) utterance.voice = zhVoice;
      
      window.speechSynthesis.speak(utterance);
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

// ---- 点击“系统通知” ----
document.getElementById('notificationStat')?.addEventListener('click', function() {
  showModule('notification');
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
    case 'notification':
      main.innerHTML = renderNotification();
      initNotification();
      break;

    default:
      main.innerHTML = '<p style="padding:40px;text-align:center;color:#7f8c8d;">功能未找到</p>';
  }
}

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', function() {
  
  // 定时刷新（每30秒）
setInterval(function() {
  // ... 其他刷新逻辑 ...
  
  // 检查通知
  try {
    if (typeof autoCheckNotifications === 'function') {
      autoCheckNotifications();
    }
  } catch(e) {}
}, 30000);
  
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

// ---- 退出功能 ----
document.getElementById('logoutBtn')?.addEventListener('click', function() {
  if (confirm('确认退出登录？')) {
    localStorage.removeItem('auth_session');
    location.reload();
  }
});

// ===== 将原有初始化代码移到这个函数中 =====
function initAppAfterLogin() {
  // ---- 添加退出按钮 ----
  const userInfo = document.querySelector('.user-info');
  if (userInfo && !document.getElementById('logoutBtn')) {
    const logoutBtn = document.createElement('span');
    logoutBtn.id = 'logoutBtn';
    logoutBtn.textContent = '🚪 退出';
    logoutBtn.style.cssText = 'cursor:pointer;margin-left:14px;font-size:0.8rem;color:rgba(255,255,255,0.8);padding:4px 12px;border-radius:12px;border:1px solid rgba(255,255,255,0.2);';
    logoutBtn.onmouseenter = function() { this.style.background = 'rgba(255,255,255,0.15)'; };
    logoutBtn.onmouseleave = function() { this.style.background = 'transparent'; };
    logoutBtn.onclick = function() {
      if (confirm('确认退出登录？')) {
        authLogout();
        location.reload();
      }
    };
    userInfo.appendChild(logoutBtn);
  }

  // ---- 主题切换 ----
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
      document.body.classList.add('dark');
      themeToggle.textContent = '☀️';
    } else {
      document.body.classList.remove('dark');
      themeToggle.textContent = '🌙';
    }
    themeToggle.addEventListener('click', function() {
      const isDark = document.body.classList.toggle('dark');
      this.textContent = isDark ? '☀️' : '🌙';
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });
  }

  // ---- 侧边栏菜单 ----
  document.querySelectorAll('.sidebar li').forEach(li => {
    li.addEventListener('click', function() {
      const module = this.dataset.module;
      if (module && typeof showModule === 'function') {
        showModule(module);
      }
    });
  });

  // ---- 搜索 ----
  const searchInput = document.getElementById('globalSearch');
  const searchBtn = document.getElementById('searchBtn');
  if (searchInput && searchBtn) {
    function handleSearch() {
      const keyword = searchInput.value.trim();
      if (keyword && typeof doSearch === 'function') {
        doSearch(keyword);
      } else if (typeof showModule === 'function') {
        showModule('dashboard');
      }
    }
    searchBtn.addEventListener('click', handleSearch);
    searchInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSearch();
      }
    });
  }

  // ---- 通知权限 ----
  if (typeof requestNotificationPermission === 'function') {
    requestNotificationPermission();
  }

  // ---- 定时刷新 ----
  if (typeof setInterval === 'function') {
  // 更新通知数量
const notifCountEl = document.getElementById('notificationCount');
if (notifCountEl) {
  const count = getNotificationCount();
  notifCountEl.textContent = count;
  notifCountEl.style.color = count > 0 ? '#dc3545' : '#4a6fa5';
  const notifLabel = document.querySelector('#notificationStat .sub-info');
  if (notifLabel) notifLabel.textContent = count > 0 ? '🔴 有未读通知' : '✅ 暂无通知';
}

    setInterval(function() {
      // 每30秒检查一次通知
      try {
        if (typeof autoCheckNotifications === 'function') {
           autoCheckNotifications();
           }
          } catch(e) {}
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
    }, 30000);
  }

  // ---- 默认加载工作台 ----
  if (typeof showModule === 'function') {
    showModule('dashboard');
  }
}