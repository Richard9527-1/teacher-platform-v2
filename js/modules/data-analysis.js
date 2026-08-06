// js/modules/data-analysis.js
// ============================================================
// 数据分析模块（优化版 M1-M3）
// 依赖：class-data.js（数据层）、chart-helper.js（Chart.js 封装）
// ============================================================

function currentFilterValue() {
  var el = document.getElementById('examClassFilter');
  return el ? el.value : '';
}

function filteredStudents(data, filter) {
  if (!filter) return data.students;
  return data.students.filter(function (s) { return s.classId === filter; });
}

// ---------- 统计工具 ----------
function avgField(scores, f) {
  if (!scores.length) return 0;
  return scores.reduce(function (a, b) { return a + (b[f] || 0); }, 0) / scores.length;
}
function classAverage(examData, students) {
  var all = [];
  students.forEach(function (s) {
    examData.scores.filter(function (sc) { return sc.studentId === s.id; })
      .forEach(function (sc) { all.push(sc.chinese || 0); });
  });
  return all.length ? all.reduce(function (a, b) { return a + b; }, 0) / all.length : 0;
}
function classFieldAverage(examData, students, f) {
  var all = [];
  students.forEach(function (s) {
    examData.scores.filter(function (sc) { return sc.studentId === s.id; })
      .forEach(function (sc) { all.push(sc[f] || 0); });
  });
  return all.length ? all.reduce(function (a, b) { return a + b; }, 0) / all.length : 0;
}
function classFieldMax(examData, students, f) {
  var mx = 0;
  students.forEach(function (s) {
    examData.scores.filter(function (sc) { return sc.studentId === s.id; })
      .forEach(function (sc) { mx = Math.max(mx, sc[f] || 0); });
  });
  return mx;
}
function longestConsecutive(dateStrs) {
  if (!dateStrs || !dateStrs.length) return 0;
  var ds = dateStrs.map(function (d) { return new Date(d).getTime(); })
    .filter(function (t) { return !isNaN(t); }).sort(function (a, b) { return a - b; });
  var best = 1, cur = 1;
  for (var i = 1; i < ds.length; i++) {
    if (ds[i] - ds[i - 1] === 86400000) cur++;
    else if (ds[i] !== ds[i - 1]) cur = 1;
    best = Math.max(best, cur);
  }
  return best;
}

// 预警计算（供 KPI 与预警视图共用）
function computeAlerts(students, data, examData, attData, settings) {
  var alerts = [];
  var nameMap = { dictation: '默写', reading: '阅读', writing: '作文' };
  students.forEach(function (s) {
    var scores = examData.scores.filter(function (sc) { return sc.studentId === s.id; });
    var clsStudents = data.students.filter(function (x) { return x.classId === s.classId; });
    var sorted = scores.slice().sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
    // 成绩下滑 / 进步
    if (sorted.length >= 2) {
      var last = sorted[sorted.length - 1], prev = sorted[sorted.length - 2];
      var diff = (last.chinese || 0) - (prev.chinese || 0);
      if (diff <= -settings.scoreDrop) {
        alerts.push({ student: s.name, cls: getClassName(s.classId, data), type: '成绩下滑', detail: '近两次 ' + (prev.chinese || 0) + '→' + (last.chinese || 0) + ' 分', severity: 'warning' });
      } else if (diff >= settings.progress) {
        alerts.push({ student: s.name, cls: getClassName(s.classId, data), type: '进步表扬', detail: '近两次 ' + (prev.chinese || 0) + '→' + (last.chinese || 0) + ' 分', severity: 'success' });
      }
    }
    // 低分预警
    if (scores.length > 0) {
      var avg = avgField(scores, 'chinese');
      var cAvg = classAverage(examData, clsStudents);
      if (cAvg > 0 && (cAvg - avg) >= settings.lowScoreOffset) {
        alerts.push({ student: s.name, cls: getClassName(s.classId, data), type: '低分预警', detail: '均分 ' + avg.toFixed(1) + '，低于班级 ' + cAvg.toFixed(1), severity: 'danger' });
      }
    }
    // 偏科预警
    ['dictation', 'reading', 'writing'].forEach(function (f) {
      var myAvg = avgField(scores, f);
      var clsAvg = classFieldAverage(examData, clsStudents, f);
      if (clsAvg > 0 && (clsAvg - myAvg) >= settings.biasOffset) {
        alerts.push({ student: s.name, cls: getClassName(s.classId, data), type: '偏科预警', detail: nameMap[f] + '低于班级均值 ' + settings.biasOffset + ' 分', severity: 'warning' });
      }
    });
    // 缺课：最长连续 / 累计
    var abs = attData.attendance.filter(function (r) { return r.studentId === s.id && r.type === '缺课'; });
    var consec = longestConsecutive(abs.map(function (r) { return r.date; }));
    if (consec >= settings.absentCount) {
      alerts.push({ student: s.name, cls: getClassName(s.classId, data), type: '连续缺课', detail: '连续缺课 ' + consec + ' 天', severity: 'danger' });
    } else if (abs.length >= settings.absentCount) {
      alerts.push({ student: s.name, cls: getClassName(s.classId, data), type: '累计缺课', detail: '累计缺课 ' + abs.length + ' 次', severity: 'warning' });
    }
    // 长期请假
    var leaveDays = attData.leaves.filter(function (r) { return r.studentId === s.id && (r.status === '已批准' || r.status === '已销假'); }).length;
    if (leaveDays >= settings.leaveDays) {
      alerts.push({ student: s.name, cls: getClassName(s.classId, data), type: '长期请假', detail: '请假 ' + leaveDays + ' 天', severity: 'warning' });
    }
  });
  return alerts;
}

function computeKpi(filter) {
  var data = loadClassData();
  var examData = loadExams();
  var attData = loadAttendance();
  var settings = loadAlertSettings();
  var students = filteredStudents(data, filter);

  var allScores = [];
  students.forEach(function (s) {
    examData.scores.filter(function (sc) { return sc.studentId === s.id; })
      .forEach(function (sc) { allScores.push(sc.chinese || 0); });
  });
  var maxScore = allScores.length ? Math.max.apply(null, allScores) : 0;
  var avg = allScores.length ? allScores.reduce(function (a, b) { return a + b; }, 0) / allScores.length : 0;
  var passLine = maxScore * 0.6;
  var passCount = allScores.filter(function (v) { return v >= passLine; }).length;
  var passRate = allScores.length ? (passCount / allScores.length) : 0;

  var alerts = computeAlerts(students, data, examData, attData, settings);
  var alertStudents = {};
  alerts.forEach(function (a) { alertStudents[a.student] = true; });

  // 出勤率
  var dates = {};
  attData.attendance.forEach(function (r) { dates[r.date] = true; });
  var distinctDates = Object.keys(dates).length;
  var should = distinctDates * students.length;
  var abnormal = attData.attendance.length;
  var attendanceRate = should ? (should - abnormal) / should : 1;

  return {
    max: maxScore,
    avg: avg,
    passRate: passRate,
    alertCount: Object.keys(alertStudents).length,
    attendanceRate: attendanceRate
  };
}

// ============================================================
// 主渲染
// ============================================================
function renderDataAnalysis() {
  try {
    return `
      <div class="card">
        <div class="panel-head"><h2 class="panel-title">📊 数据分析中心</h2></div>
        <div class="da-toolbar">
          <button class="da-btn" id="addExamBtn">📝 录入成绩</button>
          <button class="da-btn" id="viewExamBtn">📋 成绩列表</button>
          <button class="da-btn" id="analysisBtn">📈 学情分析</button>
          <button class="da-btn" id="trendBtn">📉 趋势图</button>
          <button class="da-btn" id="distBtn">📶 分数段</button>
          <button class="da-btn" id="compareBtn">📊 班级对比</button>
          <button class="da-btn" id="radarBtn">🕸️ 题型雷达</button>
          <button class="da-btn" id="reportBtn">📋 综合报表</button>
          <button class="da-btn" id="alertBtn">⚠️ 预警管理</button>
          <button class="da-btn" id="alertSettingsBtn">⚙️ 预警设置</button>
          <select id="examClassFilter" class="da-select">
            ${renderClassOptions('')}
          </select>
        </div>
        <div id="kpiBar">${renderKpiBar()}</div>
        <div id="analysisContent">
          ${renderReport()}
        </div>
      </div>
    `;
  } catch (e) {
    console.error('数据分析渲染错误:', e);
    return `<div class="card"><div class="panel-head"><h2 class="panel-title">⚠️ 数据加载失败</h2></div><p>${htmlEncode(e.message)}</p><button class="da-btn" onclick="localStorage.removeItem('examData');localStorage.removeItem('attendanceData');location.reload();">重置数据</button></div>`;
  }
}

// ========== KPI 看板 ==========
function renderKpiBar() {
  var kpi = computeKpi(currentFilterValue());
  function card(label, val, color) {
    return `<div class="da-kpi">
      <div class="da-kpi-label">${label}</div>
      <div class="da-kpi-val" style="${color ? 'color:' + color + ';' : ''}">${val}</div>
    </div>`;
  }
  var passColor = kpi.passRate >= 0.8 ? '#3B6D11' : (kpi.passRate >= 0.6 ? '#BA7517' : '#A32D2D');
  var alertColor = kpi.alertCount > 0 ? '#A32D2D' : '#3B6D11';
  var attColor = kpi.attendanceRate >= 0.9 ? '#3B6D11' : '#BA7517';
  return `
    <div class="da-kpi-row">
      ${card('最高分', kpi.max || '—')}
      ${card('班级平均分', kpi.avg ? kpi.avg.toFixed(1) : '—')}
      ${card('及格率', (kpi.passRate * 100).toFixed(0) + '%', passColor)}
      ${card('预警人数', kpi.alertCount, alertColor)}
      ${card('出勤率', (kpi.attendanceRate * 100).toFixed(0) + '%', attColor)}
    </div>`;
}

// ========== 录入成绩 ==========
function renderExamEntry() {
  var data = loadClassData();
  var examData = loadExams();
  var html = `
    <div class="card">
      <h3>📝 录入成绩</h3>
      <div class="da-row">
        <div class="da-field"><label>考试名称</label><input type="text" id="examName" class="da-input" placeholder="如：第一次月考" /></div>
        <div class="da-field"><label>考试类型</label>
          <select id="examType" class="da-input">
            <option value="月考">月考</option><option value="期中">期中</option>
            <option value="期末">期末</option><option value="单元测试">单元测试</option>
          </select>
        </div>
        <div class="da-field"><label>班级</label><select id="examClass" class="da-input">${renderClassOptions('')}</select></div>
        <div class="da-field"><label>日期</label><input type="date" id="examDate" class="da-input" value="${new Date().toISOString().slice(0, 10)}" /></div>
        <div class="da-field da-field-end"><button class="da-btn da-btn-primary" id="createExamBtn">创建考试</button></div>
      </div>
      <div class="da-row" style="margin-top:10px;">
        <button class="da-btn" id="downloadTplBtn">📥 下载模板</button>
        <button class="da-btn" id="importScoresBtn">📤 批量导入成绩</button>
        <input type="file" id="scoreFileInput" accept=".xlsx,.xls" style="display:none;" />
        <span class="da-hint">提示：先下载模板，在「成绩」表中按 考试名称+姓名 填写后导入</span>
      </div>
      <div id="scoreEntryArea" style="margin-top:14px;">
        <p class="da-empty">请先创建考试，然后录入学生成绩</p>
      </div>
    </div>
  `;
  return html;
}

function renderScoreEntry(examId) {
  var data = loadClassData();
  var examData = loadExams();
  var exam = examData.exams.find(function (e) { return e.id === examId; });
  if (!exam) return '<p class="da-empty">考试不存在</p>';
  var students = data.students.filter(function (s) { return s.classId === exam.classId; });
  var scores = examData.scores.filter(function (s) { return s.examId === examId; });

  var rows = students.map(function (s) {
    var score = scores.find(function (sc) { return sc.studentId === s.id; });
    var safe = score ? htmlEncode(score.note || '') : '';
    return `
      <tr>
        <td class="da-td">${htmlEncode(s.name)}</td>
        <td class="da-td"><input type="number" class="da-input score-input" data-student="${s.id}" data-field="chinese" value="${score ? (score.chinese || '') : ''}" style="width:64px;" /></td>
        <td class="da-td"><input type="number" class="da-input score-input" data-student="${s.id}" data-field="dictation" value="${score ? (score.dictation || '') : ''}" style="width:54px;" /></td>
        <td class="da-td"><input type="number" class="da-input score-input" data-student="${s.id}" data-field="reading" value="${score ? (score.reading || '') : ''}" style="width:54px;" /></td>
        <td class="da-td"><input type="number" class="da-input score-input" data-student="${s.id}" data-field="writing" value="${score ? (score.writing || '') : ''}" style="width:54px;" /></td>
        <td class="da-td"><input type="text" class="da-input score-note-input" data-student="${s.id}" value="${safe}" style="width:100%;min-width:90px;" /></td>
      </tr>`;
  }).join('');

  return `
    <h4>📝 ${htmlEncode(exam.name)} - 成绩录入</h4>
    <p class="da-hint">班级：${htmlEncode(getClassName(exam.classId, data))} | 日期：${htmlEncode(exam.date)}。保存时自动校验「总分≈默写+阅读+作文」及分数范围。</p>
    <div style="overflow-x:auto;">
      <table class="da-table" id="scoreEntryTable">
        <thead><tr>
          <th class="da-th">姓名</th><th class="da-th">总分</th><th class="da-th">默写</th>
          <th class="da-th">阅读</th><th class="da-th">作文</th><th class="da-th">备注</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <button class="da-btn da-btn-primary" id="saveScoresBtn" style="margin-top:12px;">💾 保存成绩</button>
  `;
}

// ========== 成绩列表 ==========
function renderExamList() {
  var examData = loadExams();
  var data = loadClassData();
  if (examData.exams.length === 0) {
    return '<p class="da-empty">暂无考试记录，请先录入成绩</p>';
  }
  var rows = examData.exams.map(function (e) {
    var cnt = examData.scores.filter(function (s) { return s.examId === e.id; }).length;
    return `
      <tr>
        <td class="da-td">${htmlEncode(e.name)}</td>
        <td class="da-td">${htmlEncode(e.type)}</td>
        <td class="da-td">${htmlEncode(getClassName(e.classId, data))}</td>
        <td class="da-td">${htmlEncode(e.date)}</td>
        <td class="da-td">
          <button class="da-link view-exam-btn" data-id="${e.id}">📊 查看</button>
          <button class="da-link da-link-danger delete-exam-btn" data-id="${e.id}">🗑️ 删除</button>
        </td>
      </tr>`;
  }).join('');
  return `
    <div style="overflow-x:auto;">
      <table class="da-table">
        <thead><tr><th class="da-th">考试名称</th><th class="da-th">类型</th><th class="da-th">班级</th><th class="da-th">日期</th><th class="da-th">操作</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ========== 学情分析 ==========
function renderAnalysis() {
  var data = loadClassData();
  var examData = loadExams();
  var filter = currentFilterValue();
  var students = filteredStudents(data, filter);
  if (students.length === 0 || examData.exams.length === 0) {
    return '<p class="da-empty">暂无足够数据进行分析</p>';
  }
  // 全班（筛选范围内）平均分，用于差值列
  var classScores = [];
  students.forEach(function (s) {
    examData.scores.filter(function (sc) { return sc.studentId === s.id; })
      .forEach(function (sc) { classScores.push(sc.chinese || 0); });
  });
  var classAvg = classScores.length ? classScores.reduce(function (a, b) { return a + b; }, 0) / classScores.length : 0;

  var rows = students.map(function (s) {
    var scores = examData.scores.filter(function (sc) { return sc.studentId === s.id; });
    if (scores.length === 0) {
      return `<tr><td class="da-td">${htmlEncode(s.name)}</td><td class="da-td">${htmlEncode(getClassName(s.classId, data))}</td><td class="da-td" colspan="5" style="color:var(--text-light);">暂无成绩</td></tr>`;
    }
    var avgC = avgField(scores, 'chinese');
    var avgD = avgField(scores, 'dictation');
    var avgR = avgField(scores, 'reading');
    var avgW = avgField(scores, 'writing');
    var parts = [{ name: '默写', score: avgD }, { name: '阅读', score: avgR }, { name: '作文', score: avgW }];
    parts.sort(function (a, b) { return a.score - b.score; });
    var weakest = parts[0];
    var diff = avgC - classAvg;
    var diffStr = (diff >= 0 ? '+' : '') + diff.toFixed(1);
    var diffColor = diff < 0 ? 'var(--color-text-danger)' : 'var(--color-text-success)';
    return `
      <tr>
        <td class="da-td">${htmlEncode(s.name)}</td>
        <td class="da-td">${htmlEncode(getClassName(s.classId, data))}</td>
        <td class="da-td" style="font-weight:500;">${avgC.toFixed(1)}</td>
        <td class="da-td">${avgD.toFixed(1)}</td>
        <td class="da-td">${avgR.toFixed(1)}</td>
        <td class="da-td">${avgW.toFixed(1)}</td>
        <td class="da-td" style="color:${diffColor};">${diffStr}</td>
        <td class="da-td" style="color:var(--color-text-danger);">${weakest.name} (${weakest.score.toFixed(1)})</td>
      </tr>`;
  }).join('');

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
      <h3 style="margin:0;">📈 学情画像</h3>
      <button class="da-btn" onclick="exportTableToExcel('analysisTable','学情分析_${new Date().toISOString().slice(0,10)}.xlsx')">⬇️ 导出Excel</button>
    </div>
    <p class="da-hint">全班平均分 ${classAvg.toFixed(1)}；「与均值差」列为正表示高于班级水平。</p>
    <div style="overflow-x:auto;">
      <table class="da-table" id="analysisTable">
        <thead><tr>
          <th class="da-th">姓名</th><th class="da-th">班级</th><th class="da-th">平均分</th>
          <th class="da-th">默写均分</th><th class="da-th">阅读均分</th><th class="da-th">作文均分</th>
          <th class="da-th">与均值差</th><th class="da-th">薄弱项</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ========== 趋势图（Chart.js 折线，按真实日期对齐） ==========
function renderTrend() {
  var data = loadClassData();
  var examData = loadExams();
  var filter = currentFilterValue();
  var students = filteredStudents(data, filter);
  if (students.length === 0 || examData.exams.length === 0) {
    return '<p class="da-empty">暂无足够数据生成趋势图</p>';
  }
  var dims = [{ v: 'chinese', t: '总分' }, { v: 'dictation', t: '默写' }, { v: 'reading', t: '阅读' }, { v: 'writing', t: '作文' }];
  var dimOpts = dims.map(function (d) { return `<option value="${d.v}">${d.t}</option>`; }).join('');
  var topOpts = '<option value="10">前 10 名</option><option value="0">全部</option><option value="5">前 5 名</option><option value="20">前 20 名</option>';
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
      <h3 style="margin:0;">📉 成绩趋势图</h3>
      <button class="da-btn" onclick="downloadChartImage('trendChartCanvas','趋势图.png')">⬇️ 下载图片</button>
    </div>
    <div class="da-row" style="margin:10px 0;">
      <div class="da-field"><label>分析维度</label><select id="trendDim" class="da-input">${dimOpts}</select></div>
      <div class="da-field"><label>显示范围</label><select id="trendTopN" class="da-input">${topOpts}</select></div>
    </div>
    <div class="da-chart-box"><canvas id="trendChartCanvas"></canvas></div>
    <p class="da-hint">折线按真实考试日期对齐 X 轴，缺考自动断点；点击图例可隐藏/显示某学生。</p>
  `;
}
function drawTrendChart() {
  var dim = (document.getElementById('trendDim') || {}).value || 'chinese';
  var topN = parseInt((document.getElementById('trendTopN') || {}).value || '10', 10);
  var data = loadClassData(), examData = loadExams();
  var filter = currentFilterValue();
  var students = filteredStudents(data, filter).map(function (s) {
    var sc = examData.scores.filter(function (x) { return x.studentId === s.id; });
    var avg = sc.length ? sc.reduce(function (a, b) { return a + (b[dim] || 0); }, 0) / sc.length : 0;
    return { s: s, avg: avg, sc: sc };
  }).sort(function (a, b) { return b.avg - a.avg; });
  if (topN > 0) students = students.slice(0, topN);

  var exams = examData.exams.slice().sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
  var labels = exams.map(function (e) { return e.name + '\n' + e.date; });
  var maxV = 0;
  var series = students.map(function (o) {
    var byExam = {};
    o.sc.forEach(function (x) {
      var ex = examData.exams.find(function (e) { return e.id === x.examId; });
      if (ex) byExam[ex.id] = x[dim] || 0;
    });
    o.sc.forEach(function (x) { maxV = Math.max(maxV, x[dim] || 0); });
    return { label: o.s.name, data: exams.map(function (e) { return (e.id in byExam) ? byExam[e.id] : null; }) };
  });
  var canvas = document.getElementById('trendChartCanvas');
  if (canvas) daLineChart(canvas, { title: '成绩趋势（缺考断点）', labels: labels, series: series, maxScore: maxV > 0 ? maxV * 1.05 : undefined });
}

// ========== 分数段分布（Chart.js 柱状） ==========
function renderDistribution() {
  var examData = loadExams();
  if (examData.exams.length === 0) return '<p class="da-empty">暂无考试，请先录入成绩</p>';
  var opts = examData.exams.map(function (e) { return `<option value="${e.id}">${htmlEncode(e.name)}</option>`; }).join('');
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
      <h3 style="margin:0;">📶 分数段分布</h3>
      <button class="da-btn" onclick="downloadChartImage('distChartCanvas','分数段分布.png')">⬇️ 下载图片</button>
    </div>
    <div class="da-row" style="margin:10px 0;">
      <div class="da-field"><label>选择考试</label><select id="distExam" class="da-input">${opts}</select></div>
    </div>
    <div class="da-chart-box"><canvas id="distChartCanvas"></canvas></div>
    <p class="da-hint">按满分比例自适应分段：不及格(&lt;60%) / 及格 / 中等 / 良好 / 优秀。</p>
  `;
}
function drawDistribution() {
  var examId = (document.getElementById('distExam') || {}).value;
  var examData = loadExams();
  var exam = examData.exams.find(function (e) { return e.id === examId; });
  if (!exam) return;
  var scores = examData.scores.filter(function (s) { return s.examId === examId; });
  var maxV = scores.length ? Math.max.apply(null, scores.map(function (s) { return s.chinese || 0; })) : 100;
  var buckets = [0, 0, 0, 0, 0];
  scores.forEach(function (s) {
    var r = (s.chinese || 0) / (maxV || 1);
    if (r < 0.6) buckets[0]++;
    else if (r < 0.7) buckets[1]++;
    else if (r < 0.8) buckets[2]++;
    else if (r < 0.9) buckets[3]++;
    else buckets[4]++;
  });
  var canvas = document.getElementById('distChartCanvas');
  if (canvas) daBarChart(canvas, {
    title: exam.name + ' 分数段分布（满分 ' + maxV + '）',
    labels: ['不及格(<60%)', '及格(60-69%)', '中等(70-79%)', '良好(80-89%)', '优秀(90-100%)'],
    datasets: [{ label: '人数', data: buckets, color: DA_PALETTE[0] }]
  });
}

// ========== 班级对比（Chart.js 柱状） ==========
function renderCompare() {
  var data = loadClassData();
  if (data.classes.length === 0) return '<p class="da-empty">暂无班级数据</p>';
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
      <h3 style="margin:0;">📊 班级平均分对比</h3>
      <button class="da-btn" onclick="downloadChartImage('compareChartCanvas','班级对比.png')">⬇️ 下载图片</button>
    </div>
    <div class="da-chart-box"><canvas id="compareChartCanvas"></canvas></div>
    <p class="da-hint">蓝色为各班平均分，橙色为年级均值参考线。</p>
  `;
}
function drawCompare() {
  var data = loadClassData(), examData = loadExams();
  var avgs = data.classes.map(function (c) {
    return +classAverage(examData, data.students.filter(function (s) { return s.classId === c.id; })).toFixed(1);
  });
  var overall = avgs.length ? +(avgs.reduce(function (a, b) { return a + b; }, 0) / avgs.length).toFixed(1) : 0;
  var canvas = document.getElementById('compareChartCanvas');
  if (canvas) daBarChart(canvas, {
    title: '各班平均分 vs 年级均值',
    labels: data.classes.map(function (c) { return c.name; }),
    datasets: [
      { label: '班级平均分', data: avgs, color: DA_PALETTE[0] },
      { label: '年级均值', data: data.classes.map(function () { return overall; }), color: DA_PALETTE[1] }
    ]
  });
}

// ========== 题型雷达（Chart.js 雷达） ==========
function renderRadar() {
  var data = loadClassData();
  var examData = loadExams();
  if (data.students.length === 0) return '<p class="da-empty">暂无学生数据</p>';
  if (examData.scores.length === 0) return '<p class="da-empty">暂无成绩数据</p>';
  var opts = data.students.map(function (s) { return `<option value="${s.id}">${htmlEncode(s.name)}（${htmlEncode(getClassName(s.classId, data))}）</option>`; }).join('');
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
      <h3 style="margin:0;">🕸️ 题型得分率雷达</h3>
      <button class="da-btn" onclick="downloadChartImage('radarChartCanvas','题型雷达.png')">⬇️ 下载图片</button>
    </div>
    <div class="da-row" style="margin:10px 0;">
      <div class="da-field"><label>选择学生</label><select id="radarStudent" class="da-input">${opts}</select></div>
    </div>
    <div class="da-chart-box"><canvas id="radarChartCanvas"></canvas></div>
    <p class="da-hint">得分为各题型「实际均值 / 该题型满分」的百分比，对比班级均值。</p>
  `;
}
function drawRadar() {
  var studentId = (document.getElementById('radarStudent') || {}).value;
  var data = loadClassData(), examData = loadExams();
  var s = data.students.find(function (x) { return x.id === studentId; });
  if (!s) return;
  var clsStudents = data.students.filter(function (x) { return x.classId === s.classId; });
  var dims = [['dictation', '默写'], ['reading', '阅读'], ['writing', '作文'], ['chinese', '总分']];
  var myData = dims.map(function (d) {
    var sc = examData.scores.filter(function (x) { return x.studentId === s.id; });
    var mx = sc.length ? Math.max.apply(null, sc.map(function (x) { return x[d[0]] || 0; })) : 1;
    var avg = avgField(sc, d[0]);
    return mx > 0 ? +(avg / mx * 100).toFixed(0) : 0;
  });
  var clsData = dims.map(function (d) {
    var mx = classFieldMax(examData, clsStudents, d[0]);
    var avg = classFieldAverage(examData, clsStudents, d[0]);
    return mx > 0 ? +(avg / mx * 100).toFixed(0) : 0;
  });
  var canvas = document.getElementById('radarChartCanvas');
  if (canvas) daRadarChart(canvas, {
    title: s.name + ' 题型得分率 vs 班级',
    labels: dims.map(function (d) { return d[1]; }),
    datasets: [
      { label: s.name, data: myData, color: DA_PALETTE[0] },
      { label: '班级均值', data: clsData, color: DA_PALETTE[1] }
    ]
  });
}

// ========== 综合报表（汇总 + 排序） ==========
var reportSort = { key: null, dir: 1 };
function renderReport() {
  var data = loadClassData();
  var examData = loadExams();
  var attData = loadAttendance();
  var filter = currentFilterValue();
  var students = filteredStudents(data, filter);
  if (students.length === 0) return '<p class="da-empty">📭 暂无学生数据，请先添加学生</p>';
  if (examData.exams.length === 0) {
    return '<p class="da-empty">📭 暂无考试成绩，请先<a href="#" class="da-link" onclick="document.getElementById(\'addExamBtn\').click();return false;">录入成绩</a></p>';
  }

  var rows = students.map(function (s) {
    var scores = examData.scores.filter(function (sc) { return sc.studentId === s.id; });
    var avg = scores.length ? scores.reduce(function (sum, sc) { return sum + (sc.chinese || 0); }, 0) / scores.length : 0;
    var absent = attData.attendance.filter(function (r) { return r.studentId === s.id && r.type === '缺课'; }).length;
    var late = attData.attendance.filter(function (r) { return r.studentId === s.id && r.type === '迟到'; }).length;
    var leave = attData.leaves.filter(function (r) { return r.studentId === s.id && (r.status === '已批准' || r.status === '已销假'); }).length;
    return { name: s.name, cls: getClassName(s.classId, data), count: scores.length, avg: avg, absent: absent, late: late, leave: leave };
  });

  if (reportSort.key) {
    rows.sort(function (a, b) {
      var va = a[reportSort.key], vb = b[reportSort.key];
      if (typeof va === 'string') return va.localeCompare(vb, 'zh') * reportSort.dir;
      return (va - vb) * reportSort.dir;
    });
  }

  function th(key, label) {
    var arrow = reportSort.key === key ? (reportSort.dir > 0 ? ' ▲' : ' ▼') : '';
    return `<th class="da-th da-sortable" data-sort="${key}">${label}${arrow}</th>`;
  }

  var body = rows.map(function (r) {
    return `<tr>
      <td class="da-td">${htmlEncode(r.name)}</td>
      <td class="da-td">${htmlEncode(r.cls)}</td>
      <td class="da-td">${r.count}</td>
      <td class="da-td" style="font-weight:500;">${r.avg.toFixed(1)}</td>
      <td class="da-td" style="${r.absent > 3 ? 'color:var(--color-text-danger);' : ''}">${r.absent}</td>
      <td class="da-td">${r.late}</td>
      <td class="da-td">${r.leave}</td>
    </tr>`;
  }).join('');

  // 汇总行
  var totalCount = rows.reduce(function (a, r) { return a + r.count; }, 0);
  var avgOfAvg = rows.length ? rows.reduce(function (a, r) { return a + r.avg; }, 0) / rows.length : 0;
  var maxScore = Math.max.apply(null, rows.map(function (r) { return r.avg; }).concat([0]));
  var passLine = maxScore * 0.6;
  var passN = rows.filter(function (r) { return r.avg >= passLine; }).length;
  var sumAbsent = rows.reduce(function (a, r) { return a + r.absent; }, 0);
  var sumLate = rows.reduce(function (a, r) { return a + r.late; }, 0);
  var sumLeave = rows.reduce(function (a, r) { return a + r.leave; }, 0);
  var passRate = rows.length ? (passN / rows.length) : 0;

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
      <h3 style="margin:0;">📋 综合报表</h3>
      <button class="da-btn" onclick="exportTableToExcel('reportTable','综合报表_${new Date().toISOString().slice(0,10)}.xlsx')">⬇️ 导出Excel</button>
    </div>
    <p class="da-hint">点击表头可排序。及格率口径：平均分 ≥ 班级最高均分×60%。</p>
    <div style="overflow-x:auto;">
      <table class="da-table" id="reportTable">
        <thead><tr>
          ${th('name', '姓名')}${th('cls', '班级')}${th('count', '考试次数')}
          ${th('avg', '平均分')}${th('absent', '缺课')}${th('late', '迟到')}${th('leave', '请假')}
        </tr></thead>
        <tbody>${body}</tbody>
        <tfoot><tr style="font-weight:500;background:var(--color-background-secondary);">
          <td class="da-td">汇总</td><td class="da-td">${rows.length} 人</td><td class="da-td">${totalCount}</td>
          <td class="da-td">${avgOfAvg.toFixed(1)}</td><td class="da-td">${sumAbsent}</td><td class="da-td">${sumLate}</td><td class="da-td">${sumLeave}</td>
        </tr></tfoot>
      </table>
    </div>
    <p class="da-hint">班级及格率（按均分）：<b>${(passRate * 100).toFixed(0)}%</b></p>`;
}

// ========== 预警管理 ==========
function renderAlert() {
  var data = loadClassData();
  var examData = loadExams();
  var attData = loadAttendance();
  var settings = loadAlertSettings();
  var filter = currentFilterValue();
  var students = filteredStudents(data, filter);
  var alerts = computeAlerts(students, data, examData, attData, settings);

  if (alerts.length === 0) {
    return '<p class="da-empty">🎉 暂无异常预警</p>';
  }
  var colorMap = { danger: ['#f8d7da', '#A32D2D'], warning: ['#fff3cd', '#BA7517'], success: ['#d4edda', '#3B6D11'] };
  var html = '<h3>⚠️ 异常预警（阈值可于「预警设置」调整）</h3><div class="da-alert-list">';
  alerts.forEach(function (a) {
    var c = colorMap[a.severity] || colorMap.warning;
    html += `<div class="da-alert" style="background:${c[0]};border-left:4px solid ${c[1]};">
      <div style="font-weight:500;">${htmlEncode(a.student)}（${htmlEncode(a.cls)}）</div>
      <div>${htmlEncode(a.type)}：${htmlEncode(a.detail)}</div>
    </div>`;
  });
  html += '</div>';
  return html;
}

// ========== 预警设置 ==========
function renderAlertSettings() {
  var s = loadAlertSettings();
  function field(key, label, val) {
    return `<div class="da-field"><label>${label}</label><input type="number" class="da-input" id="as_${key}" value="${val}" style="width:90px;" /></div>`;
  }
  return `
    <h3>⚙️ 预警阈值设置</h3>
    <p class="da-hint">数值越小越灵敏。保存后即时生效于预警管理与 KPI 看板。</p>
    <div class="da-row">
      ${field('scoreDrop', '成绩下滑阈值(分)', s.scoreDrop)}
      ${field('progress', '进步表扬阈值(分)', s.progress)}
      ${field('lowScoreOffset', '低分低于班级(分)', s.lowScoreOffset)}
      ${field('biasOffset', '偏科低于班级(分)', s.biasOffset)}
      ${field('absentCount', '缺课预警(天/次)', s.absentCount)}
      ${field('leaveDays', '长期请假(天)', s.leaveDays)}
    </div>
    <button class="da-btn da-btn-primary" id="saveAlertSettingsBtn" style="margin-top:12px;">💾 保存设置</button>
    <button class="da-btn" id="resetAlertSettingsBtn" style="margin-top:12px;">恢复默认</button>
  `;
}

// ========== 导出工具 ==========
function exportTableToExcel(tableId, filename) {
  if (typeof XLSX === 'undefined') { alert('⚠️ Excel 库未加载，请刷新页面重试'); return; }
  var table = document.getElementById(tableId);
  if (!table) return;
  var rows = [];
  table.querySelectorAll('tr').forEach(function (tr) {
    var row = [];
    tr.querySelectorAll('th,td').forEach(function (cell) { row.push(cell.innerText); });
    rows.push(row);
  });
  var ws = XLSX.utils.aoa_to_sheet(rows);
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '报表');
  XLSX.writeFile(wb, filename || ('报表_' + new Date().toISOString().slice(0, 10) + '.xlsx'));
}
function downloadChartImage(canvasId, filename) {
  var chart = daGetChart(canvasId);
  if (!chart) { alert('⚠️ 图表未生成'); return; }
  var url = chart.toBase64Image();
  var a = document.createElement('a');
  a.href = url;
  a.download = filename || 'chart.png';
  a.click();
}
function importScoresFile(file) {
  if (typeof XLSX === 'undefined') { alert('⚠️ Excel 库未加载'); return; }
  var reader = new FileReader();
  reader.onload = function (e) {
    try {
      var wb = XLSX.read(e.target.result, { type: 'array' });
      var ws = wb.Sheets['成绩'];
      if (!ws) { alert('❌ 未找到「成绩」工作表，请使用模板'); return; }
      var rows = XLSX.utils.sheet_to_json(ws, { raw: true });
      var data = loadClassData(), examData = loadExams();
      var added = 0, updated = 0;
      rows.forEach(function (r) {
        var examName = String(r['考试名称'] || '').trim();
        var stuName = String(r['姓名'] || '').trim();
        if (!examName || !stuName) return;
        var exam = examData.exams.find(function (x) { return x.name === examName; });
        var stu = data.students.find(function (x) { return x.name === stuName; });
        if (!exam || !stu) return;
        var score = examData.scores.find(function (sc) { return sc.examId === exam.id && sc.studentId === stu.id; });
        if (score) {
          score.chinese = parseFloat(r['总分']) || score.chinese;
          score.dictation = parseFloat(r['默写']) || score.dictation;
          score.reading = parseFloat(r['阅读']) || score.reading;
          score.writing = parseFloat(r['作文']) || score.writing;
          score.note = String(r['备注'] || score.note || '');
          score.updatedAt = Date.now();
          updated++;
        } else {
          examData.scores.push({
            id: generateId(), examId: exam.id, studentId: stu.id,
            chinese: parseFloat(r['总分']) || 0, dictation: parseFloat(r['默写']) || 0,
            reading: parseFloat(r['阅读']) || 0, writing: parseFloat(r['作文']) || 0,
            note: String(r['备注'] || ''), createdAt: Date.now()
          });
          added++;
        }
      });
      saveExams(examData);
      alert('✅ 成绩导入完成：新增 ' + added + ' 条，更新 ' + updated + ' 条');
      var content = document.getElementById('analysisContent');
      if (content) { content.innerHTML = renderExamEntry(); bindExamEntryEvents(); }
    } catch (err) { alert('❌ 导入失败：' + err.message); }
  };
  reader.readAsArrayBuffer(file);
}

// ============================================================
// 初始化
// ============================================================
function initDataAnalysis() {
  var content = document.getElementById('analysisContent');

  function refreshKpi() {
    var kpi = document.getElementById('kpiBar');
    if (kpi) kpi.innerHTML = renderKpiBar();
  }

  function showView(html, view, withBack) {
    currentAnalysisView = view;
    if (!content) return;
    content.innerHTML = html + (withBack ? '<button class="da-btn da-btn-secondary" id="analysisBackBtn" style="margin-top:10px;">返回</button>' : '');
    var back = document.getElementById('analysisBackBtn');
    if (back) back.addEventListener('click', function () {
      showView(renderReport(), 'report', false);
      refreshKpi();
    });
  }

  // 录入成绩
  document.getElementById('addExamBtn').addEventListener('click', function () {
    showView(renderExamEntry(), 'entry', true);
    bindExamEntryEvents();
  });
  document.getElementById('viewExamBtn').addEventListener('click', function () {
    showView(renderExamList(), 'exam', true);
    bindExamListEvents();
  });
  document.getElementById('analysisBtn').addEventListener('click', function () {
    showView(renderAnalysis(), 'analysis', true);
  });
  document.getElementById('trendBtn').addEventListener('click', function () {
    showView(renderTrend(), 'trend', true);
    setTimeout(function () {
      drawTrendChart();
      var dim = document.getElementById('trendDim'), top = document.getElementById('trendTopN');
      if (dim) dim.addEventListener('change', drawTrendChart);
      if (top) top.addEventListener('change', drawTrendChart);
    }, 60);
  });
  document.getElementById('distBtn').addEventListener('click', function () {
    showView(renderDistribution(), 'distribution', true);
    setTimeout(function () {
      drawDistribution();
      var sel = document.getElementById('distExam');
      if (sel) sel.addEventListener('change', drawDistribution);
    }, 60);
  });
  document.getElementById('compareBtn').addEventListener('click', function () {
    showView(renderCompare(), 'compare', true);
    setTimeout(function () { drawCompare(); }, 60);
  });
  document.getElementById('radarBtn').addEventListener('click', function () {
    showView(renderRadar(), 'radar', true);
    setTimeout(function () {
      drawRadar();
      var sel = document.getElementById('radarStudent');
      if (sel) sel.addEventListener('change', drawRadar);
    }, 60);
  });
  document.getElementById('reportBtn').addEventListener('click', function () {
    showView(renderReport(), 'report', false);
  });
  document.getElementById('alertBtn').addEventListener('click', function () {
    showView(renderAlert(), 'alert', true);
  });
  document.getElementById('alertSettingsBtn').addEventListener('click', function () {
    showView(renderAlertSettings(), 'alertSettings', true);
    bindAlertSettingsEvents();
  });

  // 报表表头排序（事件委托，绑定在稳定的父容器上）
  content.addEventListener('click', function (e) {
    var th = e.target.closest && e.target.closest('th[data-sort]');
    if (!th) return;
    var key = th.getAttribute('data-sort');
    if (reportSort.key === key) reportSort.dir *= -1;
    else { reportSort.key = key; reportSort.dir = 1; }
    showView(renderReport(), 'report', false);
  });

  // 班级筛选：按当前视图刷新 + 刷新 KPI
  document.getElementById('examClassFilter').addEventListener('change', function () {
    var map = {
      report: renderReport, analysis: renderAnalysis, trend: renderTrend,
      distribution: renderDistribution, compare: renderCompare, radar: renderRadar,
      alert: renderAlert, exam: renderExamList, entry: renderExamEntry
    };
    var fn = map[currentAnalysisView] || map.report;
    var withBack = currentAnalysisView !== 'report';
    showView(fn(), currentAnalysisView, withBack);
    refreshKpi();
    if (currentAnalysisView === 'exam') bindExamListEvents();
    if (currentAnalysisView === 'entry') bindExamEntryEvents();
    if (currentAnalysisView === 'trend') setTimeout(function () {
      drawTrendChart();
      var dim = document.getElementById('trendDim'), top = document.getElementById('trendTopN');
      if (dim) dim.addEventListener('change', drawTrendChart);
      if (top) top.addEventListener('change', drawTrendChart);
    }, 60);
    if (currentAnalysisView === 'distribution') setTimeout(function () {
      drawDistribution();
      var sel = document.getElementById('distExam');
      if (sel) sel.addEventListener('change', drawDistribution);
    }, 60);
    if (currentAnalysisView === 'radar') setTimeout(function () {
      drawRadar();
      var sel = document.getElementById('radarStudent');
      if (sel) sel.addEventListener('change', drawRadar);
    }, 60);
  });

  // 默认加载综合报表
  showView(renderReport(), 'report', false);
}

var currentAnalysisView = 'report';

// ========== 事件绑定 ==========
function bindExamEntryEvents() {
  var back = document.getElementById('analysisBackBtn');
  if (back) back.addEventListener('click', function () {
    showView(renderReport(), 'report', false);
  });

  var createBtn = document.getElementById('createExamBtn');
  if (createBtn) createBtn.addEventListener('click', function () {
    var name = document.getElementById('examName').value.trim();
    if (!name) { alert('请输入考试名称'); return; }
    var type = document.getElementById('examType').value;
    var classId = document.getElementById('examClass').value;
    var date = document.getElementById('examDate').value;
    var examData = loadExams();
    var newExam = { id: generateId(), name: name, type: type, classId: classId, date: date, createdAt: Date.now() };
    examData.exams.push(newExam);
    saveExams(examData);
    document.getElementById('scoreEntryArea').innerHTML = renderScoreEntry(newExam.id);
    bindScoreEntryEvents(newExam.id);
    alert('✅ 考试已创建，请录入成绩');
  });

  var dlBtn = document.getElementById('downloadTplBtn');
  if (dlBtn) dlBtn.addEventListener('click', function () { exportClassExcel(false); });
  var impBtn = document.getElementById('importScoresBtn');
  if (impBtn) impBtn.addEventListener('click', function () {
    var inp = document.getElementById('scoreFileInput');
    if (inp) inp.click();
  });
  var fileInp = document.getElementById('scoreFileInput');
  if (fileInp) fileInp.addEventListener('change', function () {
    if (this.files && this.files[0]) importScoresFile(this.files[0]);
    this.value = '';
  });
}

function bindScoreEntryEvents(examId) {
  var saveBtn = document.getElementById('saveScoresBtn');
  if (!saveBtn) return;
  saveBtn.addEventListener('click', function () {
    var examData = loadExams();
    var warnings = [];
    document.querySelectorAll('.score-input').forEach(function (input) {
      var studentId = input.dataset.student;
      var field = input.dataset.field;
      var value = parseFloat(input.value);
      var noteInput = document.querySelector('.score-note-input[data-student="' + studentId + '"]');
      var note = noteInput ? noteInput.value : '';
      var stuName = (function () { var d = loadClassData(); var st = d.students.find(function (x) { return x.id === studentId; }); return st ? st.name : studentId; })();
      var score = examData.scores.find(function (s) { return s.examId === examId && s.studentId === studentId; });
      if (score) {
        score[field] = value;
        score.note = note;
        score.updatedAt = Date.now();
      } else if (!isNaN(value)) {
        examData.scores.push({
          id: generateId(), examId: examId, studentId: studentId,
          chinese: field === 'chinese' ? value : 0,
          dictation: field === 'dictation' ? value : 0,
          reading: field === 'reading' ? value : 0,
          writing: field === 'writing' ? value : 0,
          note: note, createdAt: Date.now()
        });
      }
      // 校验
      if (field === 'chinese' && !isNaN(value)) {
        if (value < 0 || value > 200) warnings.push(stuName + ' 总分超出合理范围(0-200)');
      }
    });
    // 总分与子项一致性（按学生聚合）
    var byStudent = {};
    document.querySelectorAll('.score-input').forEach(function (input) {
      var sid = input.dataset.student, f = input.dataset.field, v = parseFloat(input.value);
      if (isNaN(v)) return;
      if (!byStudent[sid]) byStudent[sid] = { chinese: NaN, sum: 0 };
      if (f === 'chinese') byStudent[sid].chinese = v;
      else byStudent[sid].sum += v;
    });
    Object.keys(byStudent).forEach(function (sid) {
      var b = byStudent[sid];
      if (!isNaN(b.chinese) && Math.abs(b.chinese - b.sum) > 2) {
        var d = loadClassData(); var st = d.students.find(function (x) { return x.id === sid; });
        warnings.push((st ? st.name : sid) + ' 总分(' + b.chinese + ')与子项之和(' + b.sum + ')不一致');
      }
    });
    if (warnings.length) {
      if (!confirm('发现 ' + warnings.length + ' 处录入提示：\n' + warnings.join('\n') + '\n\n仍要保存？')) return;
    }
    saveExams(examData);
    alert('✅ 成绩已保存！');
  });
}

function bindExamListEvents() {
  var back = document.getElementById('analysisBackBtn');
  if (back) back.addEventListener('click', function () {
    showView(renderReport(), 'report', false);
  });
  document.querySelectorAll('.view-exam-btn').forEach(function (btn) {
    btn.onclick = function () {
      var examId = this.dataset.id;
      content.innerHTML = renderScoreEntry(examId) + '<button class="da-btn da-btn-secondary" id="examBackBtn" style="margin-top:10px;">返回</button>';
      bindScoreEntryEvents(examId);
      document.getElementById('examBackBtn').addEventListener('click', function () {
        content.innerHTML = renderExamList();
        bindExamListEvents();
      });
    };
  });
  document.querySelectorAll('.delete-exam-btn').forEach(function (btn) {
    btn.onclick = function () {
      if (!confirm('确认删除该考试及相关成绩？')) return;
      var examId = this.dataset.id;
      var examData = loadExams();
      examData.exams = examData.exams.filter(function (e) { return e.id !== examId; });
      examData.scores = examData.scores.filter(function (s) { return s.examId !== examId; });
      saveExams(examData);
      content.innerHTML = renderExamList();
      bindExamListEvents();
    };
  });
}

function bindAlertSettingsEvents() {
  var save = document.getElementById('saveAlertSettingsBtn');
  if (save) save.addEventListener('click', function () {
    var keys = ['scoreDrop', 'progress', 'lowScoreOffset', 'biasOffset', 'absentCount', 'leaveDays'];
    var obj = {};
    keys.forEach(function (k) {
      var v = parseFloat(document.getElementById('as_' + k).value);
      obj[k] = isNaN(v) ? 0 : v;
    });
    saveAlertSettings(obj);
    alert('✅ 预警设置已保存');
    refreshKpi();
  });
  var reset = document.getElementById('resetAlertSettingsBtn');
  if (reset) reset.addEventListener('click', function () {
    saveAlertSettings(getDefaultAlertSettings());
    content.innerHTML = renderAlertSettings();
    bindAlertSettingsEvents();
    refreshKpi();
  });
}

// ========== 暴露到全局 ==========
window.renderDataAnalysis = renderDataAnalysis;
window.initDataAnalysis = initDataAnalysis;
