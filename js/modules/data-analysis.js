// js/modules/data-analysis.js
// ============================================================
// 数据分析模块
// ============================================================

function renderDataAnalysis() {
  try {
  return `
    <div class="card">
      <h2>📊 数据分析中心</h2>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;">
        <button class="btn" id="addExamBtn">📝 录入成绩</button>
        <button class="btn" id="viewExamBtn">📋 成绩列表</button>
        <button class="btn" id="analysisBtn">📈 学情分析</button>
        <button class="btn" id="trendBtn">📉 趋势图</button>
        <button class="btn" id="reportBtn" style="background:#4a6fa5;">📊 综合报表</button>
        <button class="btn" id="alertBtn">⚠️ 预警管理</button>
        <select id="examClassFilter" style="padding:6px 12px;border-radius:6px;border:1px solid #ddd;">
          ${renderClassOptions('')}
        </select>
      </div>
      <div id="analysisContent">
        ${renderReport()}  <!-- 默认显示综合报表 -->
      </div>
    </div>
  `;
}catch (e) {
    console.error('数据分析渲染错误:', e);
    return `<div class="card"><h2>⚠️ 数据加载失败</h2><p>${e.message}</p><button class="btn" onclick="localStorage.removeItem('examData');localStorage.removeItem('attendanceData');location.reload();">重置数据</button></div>`;}
}

// ========== 录入成绩 ==========
function renderExamEntry() {
  const data = loadClassData();
  const examData = loadExams();

  let html = `
    <div class="card">
      <h3>📝 录入成绩</h3>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
        <div style="flex:1;min-width:150px;">
          <label>考试名称</label>
          <input type="text" id="examName" placeholder="如：第一次月考" style="width:100%;padding:6px 12px;border-radius:6px;border:1px solid #ddd;" />
        </div>
        <div style="flex:1;min-width:120px;">
          <label>考试类型</label>
          <select id="examType" style="width:100%;padding:6px 12px;border-radius:6px;border:1px solid #ddd;">
            <option value="月考">月考</option>
            <option value="期中">期中</option>
            <option value="期末">期末</option>
            <option value="单元测试">单元测试</option>
          </select>
        </div>
        <div style="flex:1;min-width:120px;">
          <label>班级</label>
          <select id="examClass" style="width:100%;padding:6px 12px;border-radius:6px;border:1px solid #ddd;">
            ${renderClassOptions('')}
          </select>
        </div>
        <div style="flex:1;min-width:120px;">
          <label>日期</label>
          <input type="date" id="examDate" value="${new Date().toISOString().slice(0,10)}" style="width:100%;padding:6px 12px;border-radius:6px;border:1px solid #ddd;" />
        </div>
        <div style="display:flex;align-items:flex-end;">
          <button class="btn" id="createExamBtn">创建考试</button>
        </div>
      </div>
      <div id="scoreEntryArea">
        <p style="color:#7f8c8d;">请先创建考试，然后录入学生成绩</p>
      </div>
    </div>
    <button class="btn" id="analysisBackBtn" style="background:#6c757d;margin-top:8px;">返回</button>
  `;
  return html;
}

function renderScoreEntry(examId) {
  const data = loadClassData();
  const examData = loadExams();
  const exam = examData.exams.find(e => e.id === examId);
  if (!exam) return '<p>考试不存在</p>';

  const students = data.students.filter(s => s.classId === exam.classId);
  const scores = examData.scores.filter(s => s.examId === examId);

  let html = `
    <h4>📝 ${exam.name} - 成绩录入</h4>
    <p style="color:#7f8c8d;margin-bottom:12px;">班级：${getClassName(exam.classId, data)} | 日期：${exam.date}</p>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
        <thead>
          <tr style="background:#f0f4f8;">
            <th style="padding:8px;border-bottom:2px solid #ddd;">姓名</th>
            <th style="padding:8px;border-bottom:2px solid #ddd;">总分</th>
            <th style="padding:8px;border-bottom:2px solid #ddd;">默写</th>
            <th style="padding:8px;border-bottom:2px solid #ddd;">阅读</th>
            <th style="padding:8px;border-bottom:2px solid #ddd;">作文</th>
            <th style="padding:8px;border-bottom:2px solid #ddd;">备注</th>
          </tr>
        </thead>
        <tbody>
  `;

  students.forEach(s => {
    const score = scores.find(sc => sc.studentId === s.id);
    html += `
      <tr>
        <td style="padding:6px;border-bottom:1px solid #eee;">${s.name}</td>
        <td style="padding:6px;border-bottom:1px solid #eee;">
          <input type="number" class="score-input" data-student="${s.id}" data-field="chinese" value="${score?.chinese || ''}" style="width:60px;padding:4px;border-radius:4px;border:1px solid #ddd;" />
        </td>
        <td style="padding:6px;border-bottom:1px solid #eee;">
          <input type="number" class="score-input" data-student="${s.id}" data-field="dictation" value="${score?.dictation || ''}" style="width:50px;padding:4px;border-radius:4px;border:1px solid #ddd;" />
        </td>
        <td style="padding:6px;border-bottom:1px solid #eee;">
          <input type="number" class="score-input" data-student="${s.id}" data-field="reading" value="${score?.reading || ''}" style="width:50px;padding:4px;border-radius:4px;border:1px solid #ddd;" />
        </td>
        <td style="padding:6px;border-bottom:1px solid #eee;">
          <input type="number" class="score-input" data-student="${s.id}" data-field="writing" value="${score?.writing || ''}" style="width:50px;padding:4px;border-radius:4px;border:1px solid #ddd;" />
        </td>
        <td style="padding:6px;border-bottom:1px solid #eee;">
          <input type="text" class="score-note-input" data-student="${s.id}" value="${score?.note || ''}" style="width:100%;padding:4px;border-radius:4px;border:1px solid #ddd;" />
        </td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </div>
    <button class="btn" id="saveScoresBtn" style="margin-top:12px;">💾 保存成绩</button>
  `;
  return html;
}

// ========== 成绩列表 ==========
function renderExamList() {
  const examData = loadExams();
  const data = loadClassData();

  if (examData.exams.length === 0) {
    return '<p style="color:#7f8c8d;text-align:center;padding:20px;">暂无考试记录，请先录入成绩</p>';
  }

  let html = `
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
        <thead>
          <tr style="background:#f0f4f8;">
            <th style="padding:8px;border-bottom:2px solid #ddd;">考试名称</th>
            <th style="padding:8px;border-bottom:2px solid #ddd;">类型</th>
            <th style="padding:8px;border-bottom:2px solid #ddd;">班级</th>
            <th style="padding:8px;border-bottom:2px solid #ddd;">日期</th>
            <th style="padding:8px;border-bottom:2px solid #ddd;">操作</th>
          </tr>
        </thead>
        <tbody>
  `;

  examData.exams.forEach(e => {
    const className = getClassName(e.classId, data);
    const scoreCount = examData.scores.filter(s => s.examId === e.id).length;
    html += `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">${e.name}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${e.type}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${className}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${e.date}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">
          <button class="view-exam-btn" data-id="${e.id}" style="background:none;border:none;color:#4a6fa5;cursor:pointer;">📊 查看</button>
          <button class="delete-exam-btn" data-id="${e.id}" style="background:none;border:none;color:#dc3545;cursor:pointer;">🗑️ 删除</button>
        </td>
      </tr>
    `;
  });

  html += '</tbody></table></div>';
  return html;
}

// ========== 学情分析 ==========
function renderAnalysis() {
  const data = loadClassData();
  const examData = loadExams();
  const filter = document.getElementById('examClassFilter')?.value || '';

  let students = data.students;
  if (filter) students = students.filter(s => s.classId === filter);

  if (students.length === 0 || examData.exams.length === 0) {
    return '<p style="color:#7f8c8d;text-align:center;padding:20px;">暂无足够数据进行分析</p>';
  }

  // 计算每个学生的平均分
  let html = `
    <h3>📈 学情画像</h3>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
        <thead>
          <tr style="background:#f0f4f8;">
            <th style="padding:8px;border-bottom:2px solid #ddd;">姓名</th>
            <th style="padding:8px;border-bottom:2px solid #ddd;">班级</th>
            <th style="padding:8px;border-bottom:2px solid #ddd;">平均分</th>
            <th style="padding:8px;border-bottom:2px solid #ddd;">默写均分</th>
            <th style="padding:8px;border-bottom:2px solid #ddd;">阅读均分</th>
            <th style="padding:8px;border-bottom:2px solid #ddd;">作文均分</th>
            <th style="padding:8px;border-bottom:2px solid #ddd;">薄弱项</th>
          </tr>
        </thead>
        <tbody>
  `;

  students.forEach(s => {
    const scores = examData.scores.filter(sc => sc.studentId === s.id);
    if (scores.length === 0) {
      html += `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee;">${s.name}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;">${getClassName(s.classId, data)}</td>
          <td colspan="5" style="padding:8px;border-bottom:1px solid #eee;color:#7f8c8d;">暂无成绩</td>
        </tr>
      `;
      return;
    }

    const avgChinese = scores.reduce((sum, sc) => sum + (sc.chinese || 0), 0) / scores.length;
    const avgDictation = scores.reduce((sum, sc) => sum + (sc.dictation || 0), 0) / scores.length;
    const avgReading = scores.reduce((sum, sc) => sum + (sc.reading || 0), 0) / scores.length;
    const avgWriting = scores.reduce((sum, sc) => sum + (sc.writing || 0), 0) / scores.length;

    // 找薄弱项
    const parts = [
      { name: '默写', score: avgDictation },
      { name: '阅读', score: avgReading },
      { name: '作文', score: avgWriting }
    ];
    parts.sort((a, b) => a.score - b.score);
    const weakest = parts[0];

    html += `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">${s.name}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${getClassName(s.classId, data)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">${avgChinese.toFixed(1)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${avgDictation.toFixed(1)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${avgReading.toFixed(1)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${avgWriting.toFixed(1)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;color:#dc3545;">${weakest.name} (${weakest.score.toFixed(1)})</td>
      </tr>
    `;
  });

  html += '</tbody></table></div>';
  return html;
}

// ========== 趋势图 ==========
function renderTrend() {
  const data = loadClassData();
  const examData = loadExams();
  const filter = document.getElementById('examClassFilter')?.value || '';

  let students = data.students;
  if (filter) students = students.filter(s => s.classId === filter);

  if (students.length === 0 || examData.exams.length === 0) {
    return '<p style="color:#7f8c8d;text-align:center;padding:20px;">暂无足够数据生成趋势图</p>';
  }

  // 取前10名学生的趋势
  const topStudents = students.slice(0, 10);
  const examNames = examData.exams.map(e => e.name);

  let html = `
    <h3>📉 成绩趋势图</h3>
    <canvas id="trendChartCanvas" width="600" height="300" style="max-width:100%;margin-top:12px;"></canvas>
    <div style="margin-top:12px;font-size:0.85rem;color:#7f8c8d;">
      显示前10名学生的历次考试总分变化
    </div>
  `;

  // 延迟执行绘图
  setTimeout(() => {
    drawTrendChart(topStudents, examData, examNames);
  }, 100);

  return html;
}

function drawTrendChart(students, examData, examNames) {
  const canvas = document.getElementById('trendChartCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const pad = 50;

  ctx.clearRect(0, 0, w, h);

  // 背景
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(0, 0, w, h);

  // 标题
  ctx.fillStyle = '#333';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('成绩变化趋势', w/2, 25);

  // X轴
  ctx.beginPath();
  ctx.moveTo(pad, h - pad);
  ctx.lineTo(w - pad, h - pad);
  ctx.strokeStyle = '#666';
  ctx.stroke();

  // X轴标签
  ctx.fillStyle = '#666';
  ctx.font = '10px sans-serif';
  examNames.forEach((name, i) => {
    const x = pad + (i / (examNames.length - 1 || 1)) * (w - 2*pad);
    ctx.textAlign = 'center';
    ctx.fillText(name, x, h - pad + 18);
  });

  // 绘制每个学生的趋势线（用不同颜色）
  const colors = ['#4a6fa5', '#ffb74d', '#66bb6a', '#ef5350', '#ab47bc', '#26c6da', '#ff7043', '#42a5f5', '#8d6e63', '#78909c'];

  students.forEach((student, idx) => {
    const scores = examData.scores.filter(s => s.studentId === student.id);
    if (scores.length < 2) return;

    const color = colors[idx % colors.length];

    ctx.beginPath();
    scores.forEach((sc, i) => {
      const x = pad + (i / (scores.length - 1 || 1)) * (w - 2*pad);
      const y = pad + (1 - (sc.chinese || 0) / 150) * (h - 2*pad);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 起点和终点标记
    if (scores.length > 0) {
      const first = scores[0];
      const last = scores[scores.length - 1];
      // 起点
      ctx.beginPath();
      const x1 = pad;
      const y1 = pad + (1 - (first.chinese || 0) / 150) * (h - 2*pad);
      ctx.arc(x1, y1, 3, 0, 2*Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      // 终点
      ctx.beginPath();
      const x2 = w - pad;
      const y2 = pad + (1 - (last.chinese || 0) / 150) * (h - 2*pad);
      ctx.arc(x2, y2, 3, 0, 2*Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    }
  });

  // 图例
  ctx.fillStyle = '#333';
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'left';
  students.slice(0, 10).forEach((student, idx) => {
    const color = colors[idx % colors.length];
    const x = 10;
    const y = 40 + idx * 14;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 12, 8);
    ctx.fillStyle = '#333';
    ctx.fillText(student.name, x + 16, y + 8);
  });
}

// ========== 综合报表 ==========
function renderReport() {
  const data = loadClassData();
  const examData = loadExams();
  const attData = loadAttendance();
  const filter = document.getElementById('examClassFilter')?.value || '';

  let students = data.students;
  if (filter) students = students.filter(s => s.classId === filter);

  if (students.length === 0) {
    return '<p style="color:#7f8c8d;text-align:center;padding:20px;">📭 暂无学生数据，请先添加学生</p>';
  }

  if (examData.exams.length === 0) {
    return `
      <p style="color:#7f8c8d;text-align:center;padding:20px;">📭 暂无考试成绩，请先<a href="#" onclick="document.getElementById('addExamBtn').click(); return false;" style="color:#4a6fa5;">录入成绩</a></p>
    `;
  }
  let html = `
    <h3>📊 综合报表</h3>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
        <thead>
          <tr style="background:#f0f4f8;">
            <th style="padding:8px;border-bottom:2px solid #ddd;">姓名</th>
            <th style="padding:8px;border-bottom:2px solid #ddd;">班级</th>
            <th style="padding:8px;border-bottom:2px solid #ddd;">考试次数</th>
            <th style="padding:8px;border-bottom:2px solid #ddd;">平均分</th>
            <th style="padding:8px;border-bottom:2px solid #ddd;">缺课次数</th>
            <th style="padding:8px;border-bottom:2px solid #ddd;">迟到次数</th>
            <th style="padding:8px;border-bottom:2px solid #ddd;">请假次数</th>
          </tr>
        </thead>
        <tbody>
  `;

  students.forEach(s => {
    const scores = examData.scores.filter(sc => sc.studentId === s.id);
    const avg = scores.length > 0 ? scores.reduce((sum, sc) => sum + (sc.chinese || 0), 0) / scores.length : 0;
    // 新考勤数据结构：attendance 数组存异常（缺课/迟到），leaves 数组存请假
    const absent = attData.attendance.filter(r => r.studentId === s.id && r.type === '缺课').length;
    const late = attData.attendance.filter(r => r.studentId === s.id && r.type === '迟到').length;
    const leave = attData.leaves.filter(r => r.studentId === s.id && (r.status === '已批准' || r.status === '已销假')).length;

    html += `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">${s.name}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${getClassName(s.classId, data)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${scores.length}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">${avg.toFixed(1)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;${absent>3?'color:#dc3545':''}">${absent}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${late}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${leave}</td>
      </tr>
    `;
  });

  html += '</tbody></table></div>';
  return html;
}

// ========== 预警管理 ==========
function renderAlert() {
  const data = loadClassData();
  const examData = loadExams();
  const attData = loadAttendance();

  let alerts = [];

  data.students.forEach(s => {
    // 成绩下滑预警（最近两次考试对比）
    const scores = examData.scores.filter(sc => sc.studentId === s.id).sort((a,b) => a.createdAt - b.createdAt);
    if (scores.length >= 2) {
      const last = scores[scores.length - 1];
      const prev = scores[scores.length - 2];
      if (last.chinese && prev.chinese && (last.chinese - prev.chinese) < -10) {
        alerts.push({
          student: s.name,
          class: getClassName(s.classId, data),
          type: '成绩下滑',
          detail: `从 ${prev.chinese} 分降至 ${last.chinese} 分`,
          severity: 'warning'
        });
      }
    }
    // 连续缺课预警（新数据结构：从 attendance 数组统计）
    const attAbsent = attData.attendance.filter(r => r.studentId === s.id && r.type === '缺课');
    if (attAbsent.length >= 3) {
      alerts.push({
        student: s.name,
        class: getClassName(s.classId, data),
        type: '连续缺课',
        detail: `连续缺课 ${attAbsent.length} 次`,
        severity: 'danger'
      });
    }
  });

  if (alerts.length === 0) {
    return '<p style="color:#7f8c8d;text-align:center;padding:20px;">🎉 暂无异常预警</p>';
  }

  let html = `
    <h3>⚠️ 异常预警</h3>
    <div style="display:flex;flex-direction:column;gap:8px;">
  `;

  alerts.forEach(a => {
    const bg = a.severity === 'danger' ? '#f8d7da' : '#fff3cd';
    const border = a.severity === 'danger' ? '#dc3545' : '#ffc107';
    html += `
      <div style="background:${bg};border-left:4px solid ${border};padding:12px 16px;border-radius:8px;">
        <div style="font-weight:bold;">${a.student} (${a.class})</div>
        <div>${a.type}: ${a.detail}</div>
      </div>
    `;
  });

  html += '</div>';
  return html;
}

// ========== 初始化 ==========
function initDataAnalysis() {
  // 录入成绩
  document.getElementById('addExamBtn').addEventListener('click', function() {
    document.getElementById('analysisContent').innerHTML = renderExamEntry();
    bindExamEntryEvents();
  });

  // 当前子视图（班级筛选时按此刷新，而非强制跳回综合报表）
  let currentAnalysisView = 'report';

  // 统一渲染子视图并绑定「返回」按钮
  function showView(html, view, withBack) {
    currentAnalysisView = view;
    const content = document.getElementById('analysisContent');
    if (!content) return;
    content.innerHTML = html + (withBack ? '<button class="btn" id="analysisBackBtn" style="background:#6c757d;margin-top:8px;">返回</button>' : '');
    const back = document.getElementById('analysisBackBtn');
    if (back) back.addEventListener('click', function () {
      currentAnalysisView = 'report';
      content.innerHTML = renderReport();
    });
  }

  // 成绩列表
  document.getElementById('viewExamBtn').addEventListener('click', function() {
    showView(renderExamList(), 'exam', true);
    bindExamListEvents();
  });

  // 学情分析
  document.getElementById('analysisBtn').addEventListener('click', function() {
    showView(renderAnalysis(), 'analysis', true);
  });

  // 趋势图
  document.getElementById('trendBtn').addEventListener('click', function() {
    showView(renderTrend(), 'trend', true);
  });

  // 综合报表（点击按钮时刷新）
  document.getElementById('reportBtn').addEventListener('click', function() {
    showView(renderReport(), 'report', false);
  });

  // 预警管理
  document.getElementById('alertBtn').addEventListener('click', function() {
    showView(renderAlert(), 'alert', true);
  });

  // 班级筛选：按当前子视图刷新，而非强制跳回综合报表
  document.getElementById('examClassFilter').addEventListener('change', function() {
    const map = {
      report: function () { return renderReport(); },
      analysis: function () { return renderAnalysis(); },
      trend: function () { return renderTrend(); },
      alert: function () { return renderAlert(); },
      exam: function () { return renderExamList(); }
    };
    const fn = map[currentAnalysisView] || map.report;
    const withBack = currentAnalysisView !== 'report';
    showView(fn(), currentAnalysisView, withBack);
    if (currentAnalysisView === 'exam') bindExamListEvents();
  });

  // 默认加载综合报表
  showView(renderReport(), 'report', false);
}

function bindExamEntryEvents() {
  document.getElementById('analysisBackBtn').addEventListener('click', function() {
    document.getElementById('analysisContent').innerHTML = '<p style="color:#7f8c8d;text-align:center;padding:20px;">请选择上方功能按钮查看数据</p>';
  });

  document.getElementById('createExamBtn').addEventListener('click', function() {
    const name = document.getElementById('examName').value.trim();
    if (!name) { alert('请输入考试名称'); return; }
    const type = document.getElementById('examType').value;
    const classId = document.getElementById('examClass').value;
    const date = document.getElementById('examDate').value;

    const examData = loadExams();
    const newExam = {
      id: generateId(),
      name,
      type,
      classId,
      date,
      createdAt: Date.now()
    };
    examData.exams.push(newExam);
    saveExams(examData);

    document.getElementById('scoreEntryArea').innerHTML = renderScoreEntry(newExam.id);
    bindScoreEntryEvents(newExam.id);
    alert('✅ 考试已创建，请录入成绩');
  });
}

function bindScoreEntryEvents(examId) {
  document.getElementById('saveScoresBtn').addEventListener('click', function() {
    const examData = loadExams();
    document.querySelectorAll('.score-input').forEach(input => {
      const studentId = input.dataset.student;
      const field = input.dataset.field;
      const value = parseFloat(input.value);
      const noteInput = document.querySelector(`.score-note-input[data-student="${studentId}"]`);
      const note = noteInput ? noteInput.value : '';

      let score = examData.scores.find(s => s.examId === examId && s.studentId === studentId);
      if (score) {
        score[field] = value;
        score.note = note;
        score.updatedAt = Date.now();
      } else if (value) {
        const newScore = {
          id: generateId(),
          examId,
          studentId,
          chinese: field === 'chinese' ? value : 0,
          dictation: field === 'dictation' ? value : 0,
          reading: field === 'reading' ? value : 0,
          writing: field === 'writing' ? value : 0,
          note,
          createdAt: Date.now()
        };
        examData.scores.push(newScore);
      }
    });
    saveExams(examData);
    alert('✅ 成绩已保存！');
  });
}

function bindExamListEvents() {
  document.getElementById('analysisBackBtn').addEventListener('click', function() {
    document.getElementById('analysisContent').innerHTML = '<p style="color:#7f8c8d;text-align:center;padding:20px;">请选择上方功能按钮查看数据</p>';
  });

  document.querySelectorAll('.view-exam-btn').forEach(btn => {
    btn.onclick = function() {
      const examId = this.dataset.id;
      document.getElementById('analysisContent').innerHTML = `
        ${renderScoreEntry(examId)}
        <button class="btn" id="examBackBtn" style="background:#6c757d;margin-top:8px;">返回</button>
      `;
      bindScoreEntryEvents(examId);
      document.getElementById('examBackBtn').addEventListener('click', function() {
        document.getElementById('analysisContent').innerHTML = renderExamList();
        bindExamListEvents();
      });
    };
  });

  document.querySelectorAll('.delete-exam-btn').forEach(btn => {
    btn.onclick = function() {
      if (!confirm('确认删除该考试及相关成绩？')) return;
      const examId = this.dataset.id;
      const examData = loadExams();
      examData.exams = examData.exams.filter(e => e.id !== examId);
      examData.scores = examData.scores.filter(s => s.examId !== examId);
      saveExams(examData);
      document.getElementById('analysisContent').innerHTML = renderExamList();
      bindExamListEvents();
    };
  });
}

// ========== 暴露到全局 ==========
window.renderDataAnalysis = renderDataAnalysis;
window.initDataAnalysis = initDataAnalysis;