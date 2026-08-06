const CLASS_DURATION = 45; // 一节课45分钟

// ============================================================
// 课程表模块 - 支持学科+课文双输入
// ============================================================
const SCHEDULE_KEY = 'scheduleData';
const DEFAULT_PERIODS = ['早自习', '第1节', '第2节', '第3节', '第4节', '第5节', '第6节', '第7节', '晚自习1', '晚自习2'];
const DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

// 学科专属配色（柔和底色 + 同色系深字 + 同色系边框），便于一眼分辨排课
var SUBJECT_COLORS = {
  '语文': { bg:'#e3f2fd', fg:'#0d47a1', bd:'#90caf9' },
  '数学': { bg:'#fce4ec', fg:'#880e4f', bd:'#f48fb1' },
  '英语': { bg:'#e8f5e9', fg:'#1b5e20', bd:'#a5d6a7' },
  '物理': { bg:'#fff3e0', fg:'#e65100', bd:'#ffcc80' },
  '化学': { bg:'#f3e5f5', fg:'#4a148c', bd:'#ce93d8' },
  '生物': { bg:'#e0f7fa', fg:'#006064', bd:'#80deea' },
  '历史': { bg:'#fff8e1', fg:'#ff6f00', bd:'#ffe082' },
  '地理': { bg:'#e8eaf6', fg:'#283593', bd:'#9fa8da' },
  '政治': { bg:'#ffebee', fg:'#b71c1c', bd:'#ef9a9a' }
};
var SUBJECT_EMPTY = { bg:'#f5f6f8', fg:'#666', bd:'#cfd6e0' };

function subjectBgStyle(subject) {
  var c = SUBJECT_COLORS[subject] || SUBJECT_EMPTY;
  return 'background:' + c.bg + ';color:' + c.fg + ';border:1px solid ' + c.bd + ';';
}

function getDefaultSchedule() {
  const schedule = {};
  DAYS.forEach(day => {
    schedule[day] = {};
    DEFAULT_PERIODS.forEach(p => {
      schedule[day][p] = { subject: '', text: '', time: '' };
    });
  });
  return schedule;
}

function loadSchedule() {
  let data = localStorage.getItem(SCHEDULE_KEY);
  if (!data) {
    data = getDefaultSchedule();
    localStorage.setItem(SCHEDULE_KEY, JSON.stringify(data));
  } else {
    data = JSON.parse(data);
    DAYS.forEach(day => {
      if (!data[day]) data[day] = {};
      DEFAULT_PERIODS.forEach(p => {
        if (!(p in data[day])) {
          data[day][p] = { subject: '', text: '', time: '' };
        } else {
          const val = data[day][p];
          if (typeof val === 'string') {
            data[day][p] = { subject: '语文', text: val, time: '' };
          } else if (typeof val === 'object') {
            if (!val.subject) val.subject = '';
            if (!val.text) val.text = '';
            if (!val.time) val.time = '';
          }
        }
      });
    });
  }
  return data;
}

function saveSchedule(data) {
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(data));
  // 通知工作台更新
  window.dispatchEvent(new Event('scheduleUpdated'));
}

function getDayLessons(dayName, data) {
  const dayData = data[dayName] || {};
  const lessons = [];
  Object.keys(dayData).forEach(p => {
    const item = dayData[p];
    if (item && item.text && item.text.trim() !== '' && item.time && item.time.trim() !== '') {
      lessons.push({
        period: p,
        subject: item.subject || '语文',
        text: item.text.trim(),
        time: item.time.trim()
      });
    }
  });
  lessons.sort((a, b) => a.time.localeCompare(b.time));
  return lessons;
}

function getAllPeriods(data) {
  const periodSet = new Set();
  DAYS.forEach(day => {
    if (data[day]) {
      Object.keys(data[day]).forEach(p => periodSet.add(p));
    }
  });
  const sorted = DEFAULT_PERIODS.filter(p => periodSet.has(p));
  const extra = Array.from(periodSet).filter(p => !DEFAULT_PERIODS.includes(p));
  return sorted.concat(extra);
}

// ========== 今日课程（工作台用） ==========
function getTodaySchedule() {
  const dayMap = { 0: '周日', 1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五', 6: '周六' };
  const todayName = dayMap[new Date().getDay()];
  const data = loadSchedule();
  const dayData = data[todayName] || {};
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const lessons = [];
  Object.keys(dayData).forEach(period => {
    const item = dayData[period];
    if (item && item.text && item.text.trim() !== '' && item.time) {
      const [h, m] = item.time.split(':').map(Number);
      const lessonMinutes = h * 60 + m;
      const lessonEndMinutes = lessonMinutes + CLASS_DURATION; // 下课时间
      
      let status = '未开始';
      if (nowMinutes > lessonEndMinutes) {
        status = '已完成';           // 当前时间 > 下课时间 → 已完成
      } else if (nowMinutes >= lessonMinutes) {
        status = '进行中';           // 上课时间 ≤ 当前时间 ≤ 下课时间 → 进行中
      } else {
        status = '未开始';           // 当前时间 < 上课时间 → 未开始
      }
      
      lessons.push({
        period,
        subject: item.subject || '语文',
        text: item.text.trim(),
        time: item.time,
        status,
        minutes: lessonMinutes,
        display: `${item.subject || '语文'} · ${item.text.trim()}`
      });
    }
  });
  lessons.sort((a, b) => a.minutes - b.minutes);
  return lessons;
}

function getTodayRemaining() {
  const all = getTodaySchedule();
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const remaining = [];
  let next = null;
  all.forEach(lesson => {
    if (lesson.minutes > nowMinutes) {
      remaining.push(lesson);
      if (!next) next = lesson;
    }
  });
  return { remaining, next };
}

function renderTodaySchedule(lessons) {
  if (!lessons || lessons.length === 0) {
    return '<p style="color:#7f8c8d;text-align:center;padding:12px;">今日暂无课程安排 📭</p>';
  }
  let html = `<table>
    <tr><th>时间</th><th>学科</th><th>课文</th><th>状态</th></tr>`;
  lessons.forEach(lesson => {
    const statusMap = {
      '已完成': '<span class="status done">已完成</span>',
      '进行中': '<span class="status ongoing">进行中</span>',
      '未开始': '<span class="status pending">未开始</span>'
    };
    html += `<tr>
      <td>${lesson.time}</td>
      <td>${lesson.subject || '语文'}</td>
      <td>${lesson.text}</td>
      <td>${statusMap[lesson.status] || lesson.status}</td>
    </tr>`;
  });
  html += '</table>';
  return html;
}

function updateTotalsAndDashboard(data) {
  DAYS.forEach(day => {
    const lessons = getDayLessons(day, data);
    const cell = document.getElementById(`total-${day}`);
    if (cell) cell.textContent = lessons.length;
  });
  // 更新工作台
  const countEl = document.getElementById('todayLessonCount');
  const nextEl = document.getElementById('nextLessonInfo');
  if (countEl) {
    const { remaining, next } = getTodayRemaining();
    countEl.textContent = remaining.length;
    if (nextEl) nextEl.textContent = next ? `下一节：${next.display}` : '今日课程已结束 🎉';
  }
  // 更新今日教学安排内容
  const contentEl = document.getElementById('todayScheduleContent');
  if (contentEl) {
    const lessons = getTodaySchedule();
    contentEl.innerHTML = renderTodaySchedule(lessons);
  }
}

// ========== 渲染课程表 ==========
function renderSchedule() {
  const data = loadSchedule();
  const periods = getAllPeriods(data);

  let html = `<div class="card">
    <h2>📅 周课程表 <span style="font-size:0.8rem;color:#7f8c8d;">（点击单元格修改，自动保存）</span></h2>
    <div style="margin-bottom:12px;color:#4a6fa5;font-size:0.9rem;background:#e8f0fe;padding:8px 14px;border-radius:8px;">
      💡 选择<b>学科</b>，输入<b>课文名称</b>，设置上课时间
    </div>
    <div style="overflow-x:auto;">
      <table class="schedule-table" id="scheduleTable">
        <thead><tr><th style="min-width:60px;">节次</th><th style="min-width:80px;">时间</th>`;
  DAYS.forEach(d => html += `<th style="min-width:160px;">${d}</th>`);
  html += `<th style="min-width:50px;">操作</th></tr></thead><tbody>`;

  periods.forEach(period => {
    const defaultTime = data[DAYS[0]] && data[DAYS[0]][period] ? data[DAYS[0]][period].time : '';
    html += `<tr>`;
    html += `<td><span class="period-label">${period}</span></td>`;
    html += `<td><input type="time" class="time-input" data-period="${period}" value="${defaultTime}" step="60" style="width:80px;padding:4px;border-radius:4px;border:1px solid #ddd;background:var(--bg);color:var(--text);" /></td>`;
    DAYS.forEach(day => {
      if (!data[day]) data[day] = {};
      if (!data[day][period]) {
        data[day][period] = { subject: '', text: '', time: '' };
      }
      const item = data[day][period];
      const subject = item.subject || '';
      const text = item.text || '';
      
      html += `<td style="padding:4px;min-width:160px;">
        <div style="display:flex;gap:4px;align-items:center;flex-wrap:nowrap;">
          <select class="subject-select" data-day="${day}" data-period="${period}" style="width:55px;padding:4px;border-radius:4px;${subjectBgStyle(subject)}font-size:0.8rem;flex-shrink:0;">
            <option value="">学科</option>
            <option value="语文" ${subject === '语文' ? 'selected' : ''}>语文</option>
            <option value="数学" ${subject === '数学' ? 'selected' : ''}>数学</option>
            <option value="英语" ${subject === '英语' ? 'selected' : ''}>英语</option>
            <option value="物理" ${subject === '物理' ? 'selected' : ''}>物理</option>
            <option value="化学" ${subject === '化学' ? 'selected' : ''}>化学</option>
            <option value="生物" ${subject === '生物' ? 'selected' : ''}>生物</option>
            <option value="历史" ${subject === '历史' ? 'selected' : ''}>历史</option>
            <option value="地理" ${subject === '地理' ? 'selected' : ''}>地理</option>
            <option value="政治" ${subject === '政治' ? 'selected' : ''}>政治</option>
          </select>
          <input type="text" class="course-input" data-day="${day}" data-period="${period}" value="${text}" placeholder="课文名" style="width:85px;padding:4px;border-radius:4px;border:1px solid #ddd;background:var(--bg);color:var(--text);font-size:0.8rem;flex-shrink:0;" />
        </div>
      </td>`;
    });
    html += `<td><button class="del-row-btn" data-period="${period}" style="background:#dc3545;color:#fff;border:none;border-radius:4px;cursor:pointer;padding:2px 8px;">✕</button></td>`;
    html += `</tr>`;
  });

  // 汇总行
  html += `<tr style="background:#f0f4f8;font-weight:bold;">`;
  html += `<td>📊 合计</td><td></td>`;
  DAYS.forEach(day => {
    const lessons = getDayLessons(day, data);
    html += `<td class="total-cell" id="total-${day}">${lessons.length}</td>`;
  });
  html += `<td></td></tr>`;
  html += `</tbody></table>
    </div>
    <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
      <button class="btn" id="addPeriodBtn">＋ 添加节次</button>
      <button class="btn" id="resetScheduleBtn" style="background:#dc3545;">重置所有课程</button>
    </div>
  </div>`;
  return html;
}

// ========== 初始化 ==========
function initSchedule() {
  const data = loadSchedule();

  // 课文输入
  document.querySelectorAll('.course-input').forEach(input => {
    input.addEventListener('change', function() {
      const day = this.dataset.day;
      const period = this.dataset.period;
      const val = this.value.trim();
      if (!data[day]) data[day] = {};
      if (!data[day][period]) data[day][period] = { subject: '', text: '', time: '' };
      data[day][period].text = val;
      saveSchedule(data);
      updateTotalsAndDashboard(data);
    });
  });

  // 学科选择
  document.querySelectorAll('.subject-select').forEach(select => {
    select.addEventListener('change', function() {
      const day = this.dataset.day;
      const period = this.dataset.period;
      const val = this.value;
      if (!data[day]) data[day] = {};
      if (!data[day][period]) data[day][period] = { subject: '', text: '', time: '' };
      data[day][period].subject = val;
      const sc = SUBJECT_COLORS[val] || SUBJECT_EMPTY;
      this.style.background = sc.bg;
      this.style.color = sc.fg;
      this.style.borderColor = sc.bd;
      saveSchedule(data);
      updateTotalsAndDashboard(data);
    });
  });

  // 时间输入
  document.querySelectorAll('.time-input').forEach(input => {
    input.addEventListener('change', function() {
      const period = this.dataset.period;
      const val = this.value;
      DAYS.forEach(day => {
        if (!data[day]) data[day] = {};
        if (!data[day][period]) data[day][period] = { subject: '', text: '', time: '' };
        data[day][period].time = val;
      });
      saveSchedule(data);
      updateTotalsAndDashboard(data);
    });
  });

  // 删除节次
  document.querySelectorAll('.del-row-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const period = this.dataset.period;
      if (!confirm(`确定删除节次“${period}”吗？`)) return;
      DAYS.forEach(day => {
        if (data[day]) delete data[day][period];
      });
      saveSchedule(data);
      document.getElementById('mainContent').innerHTML = renderSchedule();
      initSchedule();
    });
  });

  // 添加节次
  document.getElementById('addPeriodBtn').addEventListener('click', function() {
    const newPeriod = prompt('请输入新节次名称：');
    if (!newPeriod || newPeriod.trim() === '') return;
    const p = newPeriod.trim();
    const periods = getAllPeriods(data);
    if (periods.includes(p)) {
      alert('该节次已存在，请勿重复添加。');
      return;
    }
    DAYS.forEach(day => {
      if (!data[day]) data[day] = {};
      data[day][p] = { subject: '', text: '', time: '' };
    });
    saveSchedule(data);
    document.getElementById('mainContent').innerHTML = renderSchedule();
    initSchedule();
  });

  // 重置所有课程
  document.getElementById('resetScheduleBtn').addEventListener('click', function() {
    if (!confirm('清空所有课程内容？（节次和时间保留）')) return;
    DAYS.forEach(day => {
      if (data[day]) {
        Object.keys(data[day]).forEach(p => {
          data[day][p].text = '';
          data[day][p].subject = '';
        });
      }
    });
    saveSchedule(data);
    document.getElementById('mainContent').innerHTML = renderSchedule();
    initSchedule();
  });

  updateTotalsAndDashboard(data);
}

// ========== 暴露到全局 ==========
// ========== 暴露到全局（供 app.js 调用） ==========
window.renderSchedule = renderSchedule;
window.initSchedule = initSchedule;
window.loadSchedule = loadSchedule;
window.saveSchedule = saveSchedule;
window.getTodaySchedule = getTodaySchedule;
window.getTodayRemaining = getTodayRemaining;
window.getDayLessons = getDayLessons;
window.renderTodaySchedule = renderTodaySchedule;
window.updateTotalsAndDashboard = updateTotalsAndDashboard;