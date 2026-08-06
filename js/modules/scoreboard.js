// js/modules/scoreboard.js
// ============================================================
// 学生积分榜模块
// ============================================================

const SCORE_KEY = 'studentScores';

// ========== 默认数据 ==========
function getDefaultScores() {
  const classData = loadClassData();
  const students = classData.students || [];
  const scores = {};
  students.forEach(s => {
    scores[s.id] = {
      name: s.name,
      classId: s.classId,
      scores: {
        de: 0,   // 德
        zhi: 0,  // 智
        ti: 0,   // 体
        mei: 0,  // 美
        lao: 0   // 劳
      },
      total: 0,
      history: []
    };
  });
  return scores;
}

function loadScores() {
  let data = localStorage.getItem(SCORE_KEY);
  if (!data) {
    data = getDefaultScores();
    localStorage.setItem(SCORE_KEY, JSON.stringify(data));
    return data;
  }
  return JSON.parse(data);
}

function saveScores(data) {
  localStorage.setItem(SCORE_KEY, JSON.stringify(data));
}

// ========== 计算总分 ==========
function calcTotal(scores) {
  return scores.de + scores.zhi + scores.ti + scores.mei + scores.lao;
}

// ========== 渲染积分榜 ==========
function renderScoreboard() {
  const scores = loadScores();
  const classData = loadClassData();
  const students = classData.students || [];
  
  // 更新学生名单（如有新增）
  let needSave = false;
  students.forEach(s => {
    if (!scores[s.id]) {
      scores[s.id] = {
        name: s.name,
        classId: s.classId,
        scores: { de: 0, zhi: 0, ti: 0, mei: 0, lao: 0 },
        total: 0,
        history: []
      };
      needSave = true;
    } else {
      scores[s.id].name = s.name;
      scores[s.id].classId = s.classId;
    }
  });
  if (needSave) saveScores(scores);
  
  // 计算总分并排序
  const sorted = Object.keys(scores)
    .filter(id => students.some(s => s.id === id))
    .map(id => {
      const item = scores[id];
      item.total = calcTotal(item.scores);
      return { id, ...item };
    })
    .sort((a, b) => b.total - a.total);
  
  if (sorted.length === 0) {
    return `
      <div class="card">
        <div class="panel-head"><h2 class="panel-title">🏆 学生积分榜</h2></div>
        <p class="empty">暂无学生数据，请先在「班级管理」中添加学生</p>
      </div>
    `;
  }
  
  let html = `
    <div class="card">
      <div class="panel-head"><h2 class="panel-title">🏆 学生积分榜</h2></div>
      <div class="toolbar">
        <button class="btn btn-success" onclick="addScoreToAll()">＋ 批量加分</button>
        <button class="btn" onclick="exportScoreReport()">📤 导出报表</button>
        <button class="btn btn-danger" onclick="resetAllScores()">🔄 重置</button>
        <span class="toolbar-end" style="font-size:0.85rem;color:var(--text-light);line-height:2.4;">共 ${sorted.length} 名学生</span>
      </div>
      <div style="overflow-x:auto;">
        <table class="ui-table">
          <thead>
            <tr>
              <th style="text-align:center;">🏆 排名</th>
              <th style="text-align:left;">姓名</th>
              <th style="text-align:center;">德</th>
              <th style="text-align:center;">智</th>
              <th style="text-align:center;">体</th>
              <th style="text-align:center;">美</th>
              <th style="text-align:center;">劳</th>
              <th style="text-align:center;font-weight:700;">总分</th>
              <th style="text-align:center;">操作</th>
            </tr>
          </thead>
          <tbody>
  `;
  
  sorted.forEach((item, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1;
    html += `
      <tr style="${index % 2 === 0 ? 'background:var(--bg)' : ''}">
        <td style="padding:6px 10px;text-align:center;font-weight:${index < 3 ? '700' : '400'};font-size:${index < 3 ? '1.1rem' : '0.9rem'};">${medal}</td>
        <td style="padding:6px 10px;text-align:left;font-weight:${index < 3 ? '600' : ''};">
          ${item.name}
          <span style="font-size:0.7rem;color:var(--text-light);margin-left:8px;">${getClassName(item.classId, loadClassData())}</span>
        </td>
        <td style="padding:6px 10px;text-align:center;"><input type="number" value="${item.scores.de}" min="0" max="100" onchange="updateScore('${item.id}','de',this.value)" style="width:40px;padding:2px 4px;border-radius:4px;border:1px solid #ddd;background:var(--bg);color:var(--text);text-align:center;" /></td>
        <td style="padding:6px 10px;text-align:center;"><input type="number" value="${item.scores.zhi}" min="0" max="100" onchange="updateScore('${item.id}','zhi',this.value)" style="width:40px;padding:2px 4px;border-radius:4px;border:1px solid #ddd;background:var(--bg);color:var(--text);text-align:center;" /></td>
        <td style="padding:6px 10px;text-align:center;"><input type="number" value="${item.scores.ti}" min="0" max="100" onchange="updateScore('${item.id}','ti',this.value)" style="width:40px;padding:2px 4px;border-radius:4px;border:1px solid #ddd;background:var(--bg);color:var(--text);text-align:center;" /></td>
        <td style="padding:6px 10px;text-align:center;"><input type="number" value="${item.scores.mei}" min="0" max="100" onchange="updateScore('${item.id}','mei',this.value)" style="width:40px;padding:2px 4px;border-radius:4px;border:1px solid #ddd;background:var(--bg);color:var(--text);text-align:center;" /></td>
        <td style="padding:6px 10px;text-align:center;"><input type="number" value="${item.scores.lao}" min="0" max="100" onchange="updateScore('${item.id}','lao',this.value)" style="width:40px;padding:2px 4px;border-radius:4px;border:1px solid #ddd;background:var(--bg);color:var(--text);text-align:center;" /></td>
        <td style="padding:6px 10px;text-align:center;font-weight:700;color:var(--c-primary);font-size:1.1rem;">${item.total}</td>
        <td style="padding:6px 10px;text-align:center;">
          <button class="da-link" onclick="viewStudentHistory('${item.id}')">📊 趋势</button>
        </td>
      </tr>
    `;
  });
  
  html += `
          </tbody>
        </table>
      </div>
    </div>
  `;
  
  return html;
}

// ========== 更新积分 ==========
function updateScore(studentId, field, value) {
  const scores = loadScores();
  if (scores[studentId]) {
    const num = parseInt(value) || 0;
    scores[studentId].scores[field] = Math.max(0, Math.min(100, num));
    scores[studentId].total = calcTotal(scores[studentId].scores);
    // 记录历史
    if (!scores[studentId].history) scores[studentId].history = [];
    scores[studentId].history.push({
      date: new Date().toISOString().slice(0, 10),
      scores: { ...scores[studentId].scores },
      total: scores[studentId].total
    });
    saveScores(scores);
    refreshScoreboard();
  }
}

// ========== 查看单学生积分趋势 ==========
function viewStudentHistory(studentId) {
  const scores = loadScores();
  const student = scores[studentId];
  if (!student) { alert('学生不存在'); return; }
  
  const history = student.history || [];
  if (history.length === 0) {
    alert(`${student.name} 暂无积分变化记录`);
    return;
  }
  
  // 取最近10条
  const recent = history.slice(-10);
  const labels = recent.map(h => h.date.slice(5));
  const data = recent.map(h => h.total);
  
  const overlay = document.createElement('div');
  overlay.id = 'historyOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.75);z-index:9999;display:flex;justify-content:center;align-items:center;padding:20px;';
  
  overlay.innerHTML = `
    <div style="max-width:600px;width:100%;background:var(--card-bg);padding:24px;border-radius:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h2 style="color:var(--text);margin:0;">📊 ${student.name} 积分趋势</h2>
        <button onclick="closeOverlay('historyOverlay')" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--text-light);">✕</button>
      </div>
      <canvas id="trendChart" width="500" height="250" style="max-width:100%;"></canvas>
      <div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:0.85rem;">
        <div style="background:var(--bg);padding:8px;border-radius:6px;text-align:center;">
          <span style="color:var(--text-light);">当前总分</span>
          <div style="font-weight:700;font-size:1.2rem;color:var(--c-primary);">${student.total}</div>
        </div>
        <div style="background:var(--bg);padding:8px;border-radius:6px;text-align:center;">
          <span style="color:var(--text-light);">最高分</span>
          <div style="font-weight:700;font-size:1.2rem;color:var(--c-success);">${Math.max(...data)}</div>
        </div>
        <div style="background:var(--bg);padding:8px;border-radius:6px;text-align:center;">
          <span style="color:var(--text-light);">变化趋势</span>
          <div style="font-weight:700;font-size:1.2rem;color:${data[data.length-1] > data[0] ? 'var(--c-success)' : 'var(--c-danger)'};">${data[data.length-1] > data[0] ? '📈 上升' : '📉 下降'}</div>
        </div>
      </div>
      <button class="btn btn-secondary btn-block" onclick="closeOverlay('historyOverlay')">关闭</button>
    </div>
  `;
  document.body.appendChild(overlay);
  
  // 绘制趋势图
  setTimeout(() => {
    const canvas = document.getElementById('trendChart');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const w = canvas.width, h = canvas.height;
      const pad = 40;
      const max = Math.max(...data, 10);
      const min = Math.min(...data, 0);
      const range = max - min || 1;
      
      // 网格线
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 0.5;
      for (let i = 0; i < 5; i++) {
        const y = pad + (i / 4) * (h - 2 * pad);
        ctx.beginPath();
        ctx.moveTo(pad, y);
        ctx.lineTo(w - pad, y);
        ctx.stroke();
        ctx.fillStyle = '#999';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(Math.round(max - (i / 4) * range), pad - 5, y + 4);
      }
      
      // 绘制趋势线
      ctx.beginPath();
      data.forEach((val, i) => {
        const x = pad + (i / (data.length - 1 || 1)) * (w - 2 * pad);
        const y = pad + (1 - (val - min) / range) * (h - 2 * pad);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#4a6fa5';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      
      // 数据点
      data.forEach((val, i) => {
        const x = pad + (i / (data.length - 1 || 1)) * (w - 2 * pad);
        const y = pad + (1 - (val - min) / range) * (h - 2 * pad);
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#4a6fa5';
        ctx.fill();
        ctx.fillStyle = '#333';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(val, x, y - 8);
      });
      
      // X轴标签
      ctx.fillStyle = '#999';
      ctx.font = '10px sans-serif';
      labels.forEach((label, i) => {
        const x = pad + (i / (labels.length - 1 || 1)) * (w - 2 * pad);
        ctx.textAlign = 'center';
        ctx.fillText(label, x, h - pad + 16);
      });
    }
  }, 100);
}

// ========== 批量加分 ==========
function addScoreToAll() {
  const field = prompt('请选择加分维度：\n1. 德\n2. 智\n3. 体\n4. 美\n5. 劳\n输入编号(1-5)或名称：');
  if (!field) return;
  const map = { '1': 'de', '2': 'zhi', '3': 'ti', '4': 'mei', '5': 'lao', '德': 'de', '智': 'zhi', '体': 'ti', '美': 'mei', '劳': 'lao' };
  const key = map[field];
  if (!key) { alert('无效选择'); return; }
  const amount = parseInt(prompt(`请输入给所有人加 ${key} 的分数：`));
  if (isNaN(amount) || amount <= 0) return;
  
  const scores = loadScores();
  let count = 0;
  Object.keys(scores).forEach(id => {
    scores[id].scores[key] = Math.min(100, (scores[id].scores[key] || 0) + amount);
    scores[id].total = calcTotal(scores[id].scores);
    if (!scores[id].history) scores[id].history = [];
    scores[id].history.push({
      date: new Date().toISOString().slice(0, 10),
      scores: { ...scores[id].scores },
      total: scores[id].total
    });
    count++;
  });
  saveScores(scores);
  alert(`✅ 已为 ${count} 名学生加 ${key} ${amount} 分`);
  refreshScoreboard();
}

// ========== 导出报表 ==========
function exportScoreReport() {
  const scores = loadScores();
  const classData = loadClassData();
  let text = '学生积分报表\n' + '='.repeat(40) + '\n';
  text += `导出时间: ${new Date().toLocaleString()}\n\n`;
  
  Object.keys(scores).forEach(id => {
    const s = scores[id];
    const className = getClassName(s.classId, classData);
    text += `${s.name} (${className})\n`;
    text += `  德: ${s.scores.de}  智: ${s.scores.zhi}  体: ${s.scores.ti}  美: ${s.scores.mei}  劳: ${s.scores.lao}\n`;
    text += `  总分: ${s.total}\n\n`;
  });
  
  const blob = new Blob([text], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `积分报表_${new Date().toISOString().slice(0,10)}.txt`;
  a.click();
}

// ========== 重置积分 ==========
function resetAllScores() {
  if (!confirm('确认重置所有学生积分为0？此操作不可恢复！')) return;
  const scores = loadScores();
  Object.keys(scores).forEach(id => {
    scores[id].scores = { de: 0, zhi: 0, ti: 0, mei: 0, lao: 0 };
    scores[id].total = 0;
    scores[id].history = [];
  });
  saveScores(scores);
  alert('✅ 所有积分已重置');
  refreshScoreboard();
}

// ========== 刷新 ==========
function refreshScoreboard() {
  const container = document.getElementById('scoreboardContent');
  if (container) {
    container.innerHTML = renderScoreboard();
  }
}

// ========== 关闭弹窗 ==========
function closeOverlay(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

// ========== 获取班级名称（使用 class-data.js 全局版本，不再重复定义）==========

// ========== 快捷入口函数 ==========
function openScoreboard() {
  // 在页面中显示积分榜
  const main = document.getElementById('mainContent');
  main.innerHTML = `
    <div id="scoreboardContent">
      ${renderScoreboard()}
    </div>
  `;
  // 高亮侧边栏（但不改变选中状态，因为是快捷入口）
}

// ========== 暴露到全局 ==========
window.renderScoreboard = renderScoreboard;
window.openScoreboard = openScoreboard;
window.updateScore = updateScore;
window.viewStudentHistory = viewStudentHistory;
window.addScoreToAll = addScoreToAll;
window.exportScoreReport = exportScoreReport;
window.resetAllScores = resetAllScores;
window.refreshScoreboard = refreshScoreboard;
window.closeOverlay = closeOverlay;
// getClassName 已由 class-data.js 暴露到全局，此处不再重复覆盖