// js/modules/class.js
// ============================================================
// 班级管理模块（高级版：Excel导入导出/级联删除/搜索分页/考勤历史）
// ============================================================

var STUDENT_PAGE_SIZE = 20;
var studentPage = 1;       // 学生列表当前页码
var studentSearch = '';    // 学生搜索关键词

function renderClass() {
  return `
    <div class="card">
      <div class="panel-head"><h2 class="panel-title">👥 班级管理</h2></div>
      <div class="class-toolbar">
        <button class="btn" id="addStudentBtn">＋ 添加学生</button>
        <button class="btn" id="addClassBtn">＋ 添加班级</button>
        <button class="btn" id="manageClassBtn">🗂 管理班级</button>
        <button class="btn" id="attendanceBtn">📋 考勤管理</button>
        <button class="btn" id="leaveBtn">📝 请假管理</button>
        <select id="classFilter" class="da-select">
          ${renderClassOptions('')}
        </select>
      </div>
      <div class="data-toolbar">
        <button class="btn btn-success" id="exportExcelBtn">📤 导出Excel</button>
        <button class="btn btn-info" id="downloadTemplateBtn">📥 下载模板</button>
        <label class="btn btn-secondary" style="cursor:pointer;margin:0;">📂 导入恢复<input type="file" id="importFileInput" accept=".xlsx,.xls,.json" style="display:none;" /></label>
      </div>
      <div id="classContent">
        ${renderStudentList()}
      </div>
    </div>
  `;
}

function renderStudentList() {
  var data = loadClassData();
  var filter = document.getElementById('classFilter')?.value || '';
  var students = data.students;

  // 班级筛选
  if (filter) students = students.filter(function(s) { return s.classId === filter; });

  // 搜索过滤
  if (studentSearch) {
    var kw = studentSearch.toLowerCase();
    students = students.filter(function(s) { return s.name.toLowerCase().indexOf(kw) !== -1 || (s.phone || '').indexOf(kw) !== -0; });
  }

  // 分页
  var totalStudents = students.length;
  var totalPages = Math.ceil(totalStudents / STUDENT_PAGE_SIZE);
  if (studentPage > totalPages) studentPage = totalPages || 1;
  if (studentPage < 1) studentPage = 1;
  var paged = students.slice((studentPage - 1) * STUDENT_PAGE_SIZE, studentPage * STUDENT_PAGE_SIZE);

  if (totalStudents === 0) {
    return '<p class="empty">暂无学生，点击「添加学生」录入</p>';
  }

  // 搜索栏
  var html = '<div style="margin-bottom:10px;display:flex;gap:8px;align-items:center;"><input type="text" id="studentSearchInput" placeholder="🔍 搜索姓名/电话..." value="' + htmlEncode(studentSearch) + '" style="flex:1;max-width:300px;padding:6px 12px;border-radius:6px;border:1px solid #ddd;" /><span style="font-size:0.85rem;color:var(--text-light);">共 ' + totalStudents + ' 人</span></div>';

  html += `
    <div style="overflow-x:auto;">
      <table class="ui-table">
        <thead>
          <tr>
            <th>姓名</th>
            <th>班级</th>
            <th>联系电话</th>
            <th>家庭地址</th>
            <th>备注</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
  `;

  paged.forEach(function(s) {
    var className = getClassName(s.classId, data);
    html += `
      <tr>
        <td style="white-space:nowrap;">${htmlEncode(s.name)}</td>
        <td style="white-space:nowrap;">${htmlEncode(className)}</td>
        <td style="white-space:nowrap;">${htmlEncode(s.phone || '-')}</td>
        <td style="">${htmlEncode(s.address || '-')}</td>
        <td style="">${htmlEncode(s.notes || '-')}</td>
        <td style="white-space:nowrap;">
          <button class="da-link edit-student-btn" data-id="${s.id}">✏️</button>
          <button class="da-link-danger del-student-btn" data-id="${s.id}">🗑️</button>
        </td>
      </tr>
    `;
  });

  html += '</tbody></table></div>';

  // 分页器（仅多页时显示）
  if (totalPages > 1) {
    html += '<div style="display:flex;justify-content:center;align-items:center;gap:8px;margin-top:12px;font-size:0.85rem;">';
    html += '<button class="btn" id="prevPageBtn" style="padding:4px 12px;' + (studentPage <= 1 ? 'opacity:0.4;pointer-events:none;' : '') + '">◀ 上一页</button>';
    html += '<span>第 ' + studentPage + ' / ' + totalPages + ' 页</span>';
    html += '<button class="btn" id="nextPageBtn" style="padding:4px 12px;' + (studentPage >= totalPages ? 'opacity:0.4;pointer-events:none;' : '') + '">下一页 ▶</button>';
    html += '</div>';
  }

  return html;
}

// ========== 添加学生弹窗 ==========
function showStudentForm(studentId) {
  var data = loadClassData();

  // 无班级时拦截
  if (data.classes.length === 0 && !studentId) {
    alert('请先添加班级，再录入学生');
    showClassForm(null);
    return;
  }

  var student = studentId ? data.students.find(function(s) { return s.id === studentId; }) : null;
  var isEdit = !!student;

  var formData = {
    name: student?.name || '',
    classId: student?.classId || (data.classes[0]?.id || ''),
    gender: student?.gender || '男',
    phone: student?.phone || '',
    parentPhone: student?.parentPhone || '',
    address: student?.address || '',
    notes: student?.notes || ''
  };

  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <h3>${isEdit ? '编辑学生' : '添加学生'}</h3>
      <div class="form-group">
        <label>姓名 *</label>
        <input type="text" id="formStudentName" value="${htmlEncode(formData.name)}" />
      </div>
      <div class="form-group">
        <label>班级</label>
        <select id="formStudentClass">
          ${data.classes.map(function(c) { return '<option value="' + c.id + '"' + (c.id===formData.classId?' selected':'') + '>' + htmlEncode(c.name) + '</option>'; }).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>性别</label>
          <select id="formStudentGender">
            ${['男','女'].map(function(v) { return '<option' + (v===formData.gender?' selected':'') + '>' + v + '</option>'; }).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>联系电话</label>
          <input type="text" id="formStudentPhone" value="${htmlEncode(formData.phone)}" />
        </div>
      </div>
      <div class="form-group">
        <label>家长电话</label>
        <input type="text" id="formStudentParentPhone" value="${htmlEncode(formData.parentPhone)}" />
      </div>
      <div class="form-group">
        <label>家庭地址</label>
        <input type="text" id="formStudentAddress" value="${htmlEncode(formData.address)}" />
      </div>
      <div class="form-group">
        <label>备注</label>
        <textarea id="formStudentNotes" rows="2">${htmlEncode(formData.notes)}</textarea>
      </div>
      <div class="modal-actions">
        <button class="btn" id="saveStudentBtn">${isEdit ? '更新' : '添加'}</button>
        <button class="btn btn-secondary" id="closeModalBtn">取消</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById('saveStudentBtn').addEventListener('click', function() {
    var name = document.getElementById('formStudentName').value.trim();
    if (!name) { alert('请输入学生姓名'); return; }

    var data = loadClassData();
    var newStudent = {
      id: studentId || generateId(),
      name: name,
      classId: document.getElementById('formStudentClass').value,
      gender: document.getElementById('formStudentGender').value,
      phone: document.getElementById('formStudentPhone').value.trim(),
      parentPhone: document.getElementById('formStudentParentPhone').value.trim(),
      address: document.getElementById('formStudentAddress').value.trim(),
      notes: document.getElementById('formStudentNotes').value.trim()
    };

    if (isEdit) {
      var idx = data.students.findIndex(function(s) { return s.id === studentId; });
      if (idx !== -1) data.students[idx] = newStudent;
    } else {
      data.students.push(newStudent);
    }
    saveClassData(data);
    document.body.removeChild(overlay);
    refreshClassView();
  });

  document.getElementById('closeModalBtn').addEventListener('click', function() {
    document.body.removeChild(overlay);
  });
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) document.body.removeChild(overlay);
  });
}

// ========== 添加/编辑班级弹窗 ==========
function showClassForm(classId) {
  var data = loadClassData();
  var cls = classId ? data.classes.find(function(c) { return c.id === classId; }) : null;
  var isEdit = !!cls;

  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <h3>${isEdit ? '编辑班级' : '添加班级'}</h3>
      <div class="form-group">
        <label>班级名称 *</label>
        <input type="text" id="formClassName" placeholder="如：高一（2）班" />
      </div>
      <div class="form-group">
        <label>年级</label>
        <input type="text" id="formClassGrade" placeholder="如：高一" />
      </div>
      <div class="modal-actions">
        <button class="btn" id="saveClassBtn">${isEdit ? '更新' : '添加'}</button>
        <button class="btn btn-secondary" id="closeClassModalBtn">取消</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  if (cls) {
    document.getElementById('formClassName').value = cls.name || '';
    document.getElementById('formClassGrade').value = cls.grade || '';
  }

  document.getElementById('saveClassBtn').addEventListener('click', function() {
    var name = document.getElementById('formClassName').value.trim();
    if (!name) { alert('请输入班级名称'); return; }
    var grade = document.getElementById('formClassGrade').value.trim();
    if (isEdit) {
      cls.name = name;
      cls.grade = grade;
    } else {
      data.classes.push({ id: generateId(), name: name, grade: grade || name.substring(0, 2) });
    }
    saveClassData(data);
    document.body.removeChild(overlay);
    refreshClassView();
    syncClassFilter();
  });

  document.getElementById('closeClassModalBtn').addEventListener('click', function() {
    document.body.removeChild(overlay);
  });
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) document.body.removeChild(overlay);
  });
}

// ========== 班级管理（列表 + 编辑/删除） ==========
function showClassManage() {
  var data = loadClassData();
  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  var clsRows = data.classes.map(function(c) {
    var cnt = data.students.filter(function(s) { return s.classId === c.id; }).length;
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;">
        <span>${htmlEncode(c.name)} <span style="color:var(--text-light);font-size:0.8rem;">（${cnt} 人${c.grade ? ' · ' + htmlEncode(c.grade) : ''}）</span></span>
        <span>
          <button class="da-link edit-class-btn" data-id="${c.id}" style="margin-right:8px;">✏️</button>
          <button class="da-link-danger del-class-btn" data-id="${c.id}">🗑️</button>
        </span>
      </div>`;
  }).join('');
  if (!clsRows) clsRows = '<p class="empty">暂无班级，请先添加</p>';
  overlay.innerHTML = `
    <div class="modal-box" style="max-width:440px;">
      <h3>🗂 班级管理</h3>
      <div style="max-height:320px;overflow-y:auto;">${clsRows}</div>
      <div class="modal-actions">
        <button class="btn" id="addClassFromManageBtn">＋ 添加班级</button>
        <button class="btn btn-secondary" id="closeManageBtn">关闭</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelectorAll('.edit-class-btn').forEach(function(b) {
    b.onclick = function() { document.body.removeChild(overlay); showClassForm(this.dataset.id); };
  });
  overlay.querySelectorAll('.del-class-btn').forEach(function(b) {
    b.onclick = function() {
      var id = this.dataset.id;
      var c = data.classes.find(function(x) { return x.id === id; });
      if (!c) return;
      var cnt = data.students.filter(function(s) { return s.classId === id; }).length;
      if (!confirm('确认删除班级「' + c.name + '」？' + (cnt ? '该班级下 ' + cnt + ' 名学生及关联的考勤/成绩记录将一并删除，且不可恢复。' : ''))) return;
      cascadeDeleteClass(id);  // 级联删除
      document.body.removeChild(overlay);
      refreshClassView();
      syncClassFilter();
    };
  });
  document.getElementById('addClassFromManageBtn').onclick = function() {
    document.body.removeChild(overlay); showClassForm(null);
  };
  document.getElementById('closeManageBtn').onclick = function() {
    document.body.removeChild(overlay);
  };
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) document.body.removeChild(overlay);
  });
}

// 同步班级筛选下拉
function syncClassFilter() {
  var filter = document.getElementById('classFilter');
  if (!filter) return;
  filter.innerHTML = renderClassOptions(filter.value);
}

// ========== 新增请假弹窗 ==========
function showLeaveForm() {
  var data = loadClassData();
  if (data.students.length === 0) { alert('请先在「添加学生」中录入学生'); return; }
  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <h3>📝 新增请假</h3>
      <div class="form-group">
        <label>学生 *</label>
        <select id="formLeaveStudent">
          ${data.students.map(function(s) { return '<option value="' + s.id + '">' + htmlEncode(s.name) + '（' + htmlEncode(getClassName(s.classId, data)) + '）</option>'; }).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>请假类型</label>
        <select id="formLeaveType">
          <option>事假</option>
          <option>病假</option>
        </select>
      </div>
      <div class="form-group">
        <label>请假原因</label>
        <textarea id="formLeaveReason" rows="2" placeholder="可选"></textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>日期</label>
          <input type="date" id="formLeaveDate" value="${new Date().toISOString().slice(0, 10)}" />
        </div>
        <div class="form-group">
          <label>时长</label>
          <input type="text" id="formLeaveDuration" placeholder="如：2小时、1天" />
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn" id="saveLeaveBtn">提交</button>
        <button class="btn btn-secondary" id="closeLeaveBtn">取消</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('saveLeaveBtn').addEventListener('click', function() {
    var studentId = document.getElementById('formLeaveStudent').value;
    var type = document.getElementById('formLeaveType').value;
    var reason = document.getElementById('formLeaveReason').value.trim();
    var date = document.getElementById('formLeaveDate').value || new Date().toISOString().slice(0, 10);
    var duration = document.getElementById('formLeaveDuration').value.trim();
    var attData = loadAttendance();
    attData.leaves.push({
      id: generateId(),
      studentId: studentId,
      date: date,
      type: type,
      reason: reason + (duration ? ' (时长: ' + duration + ')' : ''),
      status: '申请中',
      createdAt: Date.now()
    });
    saveAttendance(attData);
    document.body.removeChild(overlay);
    var leaveList = document.getElementById('leaveList');
    if (leaveList) { leaveList.innerHTML = renderLeaveList(); bindLeaveEvents(); }
    alert('✅ 请假申请已提交！');
  });

  document.getElementById('closeLeaveBtn').addEventListener('click', function() {
    document.body.removeChild(overlay);
  });
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) document.body.removeChild(overlay);
  });
}

// ========== 考勤管理 ==========
function renderAttendance() {
  var data = loadClassData();
  var today = new Date().toISOString().slice(0, 10);

  var html = `
    <div class="card">
      <div class="panel-head"><h3 class="panel-title">📋 今日考勤</h3></div>
      <div class="attendance-toolbar">
        <input type="date" id="attDate" value="${today}" class="da-select" />
        <select id="attClassFilter" class="da-select">
          ${renderClassOptions('')}
        </select>
        <button class="btn" id="attSaveBtn">💾 保存考勤</button>
        <button class="btn btn-info" id="attHistoryBtn">📅 考勤历史</button>
        <button class="btn btn-secondary" id="attBackBtn">返回</button>
      </div>
      <div id="attendanceList">
        ${renderAttendanceTable()}
      </div>
    </div>
  `;
  return html;
}

function renderAttendanceTable() {
  var data = loadClassData();
  var attData = loadAttendance();
  var date = document.getElementById('attDate')?.value || new Date().toISOString().slice(0, 10);
  var filter = document.getElementById('attClassFilter')?.value || '';
  var students = data.students;
  if (filter) students = students.filter(function(s) { return s.classId === filter; });

  // 考勤姓名搜索
  var attSearchEl = document.getElementById('attSearchInput');
  var attSearch = attSearchEl ? attSearchEl.value.trim().toLowerCase() : '';
  if (attSearch) students = students.filter(function(s) { return s.name.toLowerCase().indexOf(attSearch) !== -1; });

  if (students.length === 0) {
    return '<p class="empty">该班级暂无学生</p>';
  }

  // 搜索栏
  var html = '<div style="margin-bottom:8px;"><input type="text" id="attSearchInput" placeholder="🔍 按姓名搜索..." value="' + (attSearchEl ? htmlEncode(attSearchEl.value) : '') + '" style="width:240px;padding:5px 10px;border-radius:4px;border:1px solid #ddd;" /></div>';

  html += `
    <div style="overflow-x:auto;">
      <table class="ui-table">
        <thead>
          <tr>
            <th>姓名</th>
            <th>班级</th>
            <th>状态</th>
            <th>备注</th>
          </tr>
        </thead>
        <tbody>
  `;

  students.forEach(function(s) {
    // 从 attendance 数组查找当天的异常记录（正常=无记录）
    var existing = attData.attendance.find(function(r) { return r.studentId === s.id && r.date === date; });
    var status = existing ? existing.type : '正常';
    var reason = existing ? (existing.reason || '') : '';
    var className = getClassName(s.classId, data);

    html += `
      <tr>
        <td style="">${htmlEncode(s.name)}</td>
        <td style="">${htmlEncode(className)}</td>
        <td style="">
          <select class="att-status-select" data-student="${s.id}" style="padding:4px 8px;border-radius:4px;border:1px solid #ddd;">
            ${['正常','缺课','迟到'].map(function(v) { return '<option' + (v===status?' selected':'') + '>' + v + '</option>'; }).join('')}
          </select>
        </td>
        <td style="">
          <input type="text" class="att-reason-input" data-student="${s.id}" value="${htmlEncode(reason)}" placeholder="原因" style="width:100%;padding:4px 8px;border-radius:4px;border:1px solid #ddd;" />
        </td>
      </tr>
    `;
  });

  html += '</tbody></table></div>';
  return html;
}

// ========== 考勤历史查询 ==========
function renderAttendanceHistory() {
  var data = loadClassData();
  var attData = loadAttendance();
  var today = new Date().toISOString().slice(0, 10);

  var html = `
    <div class="card">
      <div class="panel-head"><h3 class="panel-title">📅 考勤历史</h3></div>
      <div class="attendance-toolbar">
        <div style="display:flex;align-items:center;gap:4px;">
          <label>日期：</label>
          <input type="date" id="histDateFrom" value="${today}" class="da-select" />
          <span>~</span>
          <input type="date" id="histDateTo" value="${today}" class="da-select" />
        </div>
        <select id="histClassFilter" class="da-select">
          ${renderClassOptions('')}
        </select>
        <button class="btn" id="histQueryBtn">🔍 查询</button>
        <button class="btn btn-secondary" id="histBackBtn">← 返回考勤录入</button>
      </div>
      <div id="historyContent">${renderHistoryTable()}</div>
    </div>
  `;
  return html;
}

function renderHistoryTable() {
  var data = loadClassData();
  var attData = loadAttendance();
  var dateFrom = document.getElementById('histDateFrom')?.value || '';
  var dateTo = document.getElementById('histDateTo')?.value || '';
  var classFilter = document.getElementById('histClassFilter')?.value || '';

  // 筛选考勤异常记录
  var records = attData.attendance.filter(function(r) {
    if (dateFrom && r.date < dateFrom) return false;
    if (dateTo && r.date > dateTo) return false;
    if (classFilter) {
      var s = data.students.find(function(st) { return st.id === r.studentId; });
      if (!s || s.classId !== classFilter) return false;
    }
    return true;
  });

  // 统计汇总
  var absentCount = records.filter(function(r) { return r.type === '缺课'; }).length;
  var lateCount = records.filter(function(r) { return r.type === '迟到'; }).length;

  var html = '<div style="display:flex;gap:16px;margin-bottom:12px;font-size:0.9rem;flex-wrap:wrap;">';
  html += '<span class="tag tag-danger">缺课：<strong>' + absentCount + '</strong> 次</span>';
  html += '<span class="tag tag-warning">迟到：<strong>' + lateCount + '</strong> 次</span>';
  html += '<span style="color:var(--text-light);">共 ' + records.length + ' 条异常记录</span>';
  html += '</div>';

  if (records.length === 0) {
    html += '<p class="empty">所选时间段无异常考勤记录</p>';
    return html;
  }

  html += `
    <div style="overflow-x:auto;">
      <table class="ui-table">
        <thead>
          <tr>
            <th>学生</th>
            <th>班级</th>
            <th>日期</th>
            <th>类别</th>
            <th>原因</th>
          </tr>
        </thead>
        <tbody>
  `;

  records.forEach(function(r) {
    var s = data.students.find(function(st) { return st.id === r.studentId; });
    html += `
      <tr>
        <td style="">${s ? htmlEncode(s.name) : '未知'}</td>
        <td style="">${s ? htmlEncode(getClassName(s.classId, data)) : '-'}</td>
        <td style="">${r.date}</td>
        <td><span class="tag ${r.type==='缺课'?'tag-danger':'tag-warning'}">${r.type}</span></td>
        <td style="">${htmlEncode(r.reason || '-')}</td>
      </tr>
    `;
  });

  html += '</tbody></table></div>';
  return html;
}

function bindAttendanceHistoryEvents() {
  document.getElementById('histBackBtn').addEventListener('click', function() {
    document.getElementById('classContent').innerHTML = renderAttendance();
    bindAttendanceEvents();
  });

  document.getElementById('histQueryBtn').addEventListener('click', function() {
    document.getElementById('historyContent').innerHTML = renderHistoryTable();
  });

  // 日期/班级变化自动刷新
  ['histDateFrom','histDateTo','histClassFilter'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('change', function() { document.getElementById('historyContent').innerHTML = renderHistoryTable(); });
  });
}

// ========== 请假管理 ==========
function renderLeave() {
  var data = loadClassData();

  var html = `
    <div class="card">
      <div class="panel-head"><h3 class="panel-title">📝 请假管理</h3></div>
      <div class="toolbar">
        <button class="btn" id="addLeaveBtn">＋ 新增请假</button>
        <select id="leaveStatusFilter" class="da-select">
          <option value="">全部状态</option>
          <option value="申请中">申请中</option>
          <option value="已批准">已批准</option>
          <option value="已销假">已销假</option>
          <option value="已拒绝">已拒绝</option>
        </select>
        <button class="btn btn-secondary" id="leaveBackBtn">返回</button>
      </div>
      <div id="leaveList">
        ${renderLeaveList()}
      </div>
    </div>
  `;
  return html;
}

function renderLeaveList() {
  var data = loadClassData();
  var attData = loadAttendance();
  var filter = document.getElementById('leaveStatusFilter')?.value || '';

  var leaves = attData.leaves;
  var filtered = leaves;
  if (filter) filtered = leaves.filter(function(r) { return (r.status || '已批准') === filter; });

  if (filtered.length === 0) {
    return '<p class="empty">暂无请假记录</p>';
  }

  var html = `
    <div style="overflow-x:auto;">
      <table class="ui-table">
        <thead>
          <tr>
            <th>学生</th>
            <th>日期</th>
            <th>类型</th>
            <th>原因</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
  `;

  filtered.forEach(function(r) {
    var studentName = getStudentName(r.studentId, data);
    var status = r.status || '已批准';
    html += `
      <tr>
        <td style="">${htmlEncode(studentName)}</td>
        <td style="">${r.date}</td>
        <td style="">${r.type}</td>
        <td style="">${htmlEncode(r.reason || '-')}</td>
        <td>
          <span class="tag ${status==='已批准'?'tag-success':status==='申请中'?'tag-warning':'tag-danger'}">${status}</span>
        </td>
        <td>
          ${status === '申请中' ? '<button class="da-link-success approve-leave-btn" data-id="' + r.id + '">✅ 批准</button>' : ''}
          ${status === '已批准' ? '<button class="da-link finish-leave-btn" data-id="' + r.id + '">📌 销假</button>' : ''}
        </td>
      </tr>
    `;
  });

  html += '</tbody></table></div>';
  return html;
}

// ========== 刷新视图 ==========
function refreshClassView() {
  var container = document.getElementById('classContent');
  if (container) {
    container.innerHTML = renderStudentList();
    bindClassEvents();
  }
}

// ========== 绑定事件 ==========
function bindClassEvents() {
  // 编辑学生
  document.querySelectorAll('.edit-student-btn').forEach(function(btn) {
    btn.onclick = function() { showStudentForm(this.dataset.id); };
  });

  // 删除学生（使用级联删除）
  document.querySelectorAll('.del-student-btn').forEach(function(btn) {
    btn.onclick = function() {
      if (!confirm('确认删除该学生？关联的考勤和成绩记录将一并删除。')) return;
      cascadeDeleteStudent(this.dataset.id);
      var data = loadClassData();
      data.students = data.students.filter(function(s) { return s.id !== this.dataset.id; }.bind(this));
      saveClassData(data);
      refreshClassView();
    }.bind(btn);
  });

  // 搜索
  var searchInput = document.getElementById('studentSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      studentSearch = this.value;
      studentPage = 1;
      refreshClassView();
    });
  }

  // 分页
  var prevBtn = document.getElementById('prevPageBtn');
  var nextBtn = document.getElementById('nextPageBtn');
  if (prevBtn) prevBtn.addEventListener('click', function() { studentPage--; refreshClassView(); });
  if (nextBtn) nextBtn.addEventListener('click', function() { studentPage++; refreshClassView(); });
}

// ========== 初始化 ==========
function initClass() {
  // 添加学生
  document.getElementById('addStudentBtn').addEventListener('click', function() {
    showStudentForm(null);
  });

  // 添加班级
  document.getElementById('addClassBtn').addEventListener('click', function() {
    showClassForm(null);
  });

  // 管理班级
  document.getElementById('manageClassBtn').addEventListener('click', function() {
    showClassManage();
  });

  // 班级筛选
  document.getElementById('classFilter').addEventListener('change', function() {
    studentPage = 1;
    refreshClassView();
  });

  // 考勤管理
  document.getElementById('attendanceBtn').addEventListener('click', function() {
    document.getElementById('classContent').innerHTML = renderAttendance();
    bindAttendanceEvents();
  });

  // 请假管理
  document.getElementById('leaveBtn').addEventListener('click', function() {
    document.getElementById('classContent').innerHTML = renderLeave();
    bindLeaveEvents();
  });

  // Excel 导出
  document.getElementById('exportExcelBtn').addEventListener('click', function() {
    exportClassExcel(true);
  });

  // 下载模板
  document.getElementById('downloadTemplateBtn').addEventListener('click', function() {
    exportClassExcel(false);
  });

  // 导入恢复（单次绑定，干净闭包）
  document.getElementById('importFileInput').addEventListener('change', function(e) {
    var f = e.target.files[0];
    if (!f) return;
    var ext = f.name.split('.').pop().toLowerCase();
    var rdr = new FileReader();
    rdr.onload = function(evt) {
      try {
        if (ext === 'json') {
          if (!confirm('⚠️ 即将覆盖当前所有班级数据，确定？')) return;
          if (parseClassJson(JSON.parse(evt.target.result))) { alert('✅ 导入成功！刷新...'); location.reload(); }
        } else if (ext === 'xlsx' || ext === 'xls') {
          if (!confirm('⚠️ 即将覆盖当前所有班级数据，确定？')) return;
          if (parseClassWorkbook(XLSX.read(evt.target.result, { type: 'binary' }))) { alert('✅ 导入成功！刷新...'); location.reload(); }
        } else {
          alert('❌ 不支持的文件格式，请上传 .xlsx 或 .json 文件');
        }
      } catch(err) { alert('❌ 解析失败：' + err.message); }
      e.target.value = '';
    };
    if (ext === 'json') rdr.readAsText(f); else rdr.readAsBinaryString(f);
  });

  bindClassEvents();
}

// ========== 考勤事件绑定 ==========
function bindAttendanceEvents() {
  document.getElementById('attBackBtn').addEventListener('click', function() {
    document.getElementById('classContent').innerHTML = renderStudentList();
    bindClassEvents();
  });

  // 考勤历史
  document.getElementById('attHistoryBtn').addEventListener('click', function() {
    document.getElementById('classContent').innerHTML = renderAttendanceHistory();
    bindAttendanceHistoryEvents();
  });

  document.getElementById('attSaveBtn').addEventListener('click', function() {
    var date = document.getElementById('attDate').value;
    var attData = loadAttendance();
    document.querySelectorAll('.att-status-select').forEach(function(sel) {
      var studentId = sel.dataset.student;
      var status = sel.value;
      var reasonInput = document.querySelector('.att-reason-input[data-student="' + studentId + '"]');
      var reason = reasonInput ? reasonInput.value : '';

      if (status === '正常') {
        // 正常 = 删除该生当日异常记录（不存）
        attData.attendance = attData.attendance.filter(function(r) { return !(r.studentId === studentId && r.date === date); });
      } else {
        // 异常 = 更新或新增
        var existingIdx = attData.attendance.findIndex(function(r) { return r.studentId === studentId && r.date === date; });
        var record = {
          id: generateId(),
          studentId: studentId,
          date: date,
          type: status,
          reason: reason,
          createdAt: Date.now()
        };
        if (existingIdx !== -1) {
          record.id = attData.attendance[existingIdx].id;
          record.createdAt = attData.attendance[existingIdx].createdAt;
          attData.attendance[existingIdx] = record;
        } else {
          attData.attendance.push(record);
        }
      }
    });
    saveAttendance(attData);
    alert('✅ 考勤已保存！（仅保存异常记录，正常=无记录）');
  });

  document.getElementById('attDate').addEventListener('change', function() {
    document.getElementById('attendanceList').innerHTML = renderAttendanceTable();
  });

  document.getElementById('attClassFilter').addEventListener('change', function() {
    document.getElementById('attendanceList').innerHTML = renderAttendanceTable();
  });

  // 考勤搜索（事件委托）
  document.getElementById('attendanceList').addEventListener('input', function(e) {
    if (e.target.id === 'attSearchInput') {
      document.getElementById('attendanceList').innerHTML = renderAttendanceTable();
    }
  });
}

// ========== 请假事件绑定 ==========
function bindLeaveEvents() {
  document.getElementById('leaveBackBtn').addEventListener('click', function() {
    document.getElementById('classContent').innerHTML = renderStudentList();
    bindClassEvents();
  });

  document.getElementById('addLeaveBtn').addEventListener('click', function() {
    showLeaveForm();
  });

  document.getElementById('leaveStatusFilter').addEventListener('change', function() {
    document.getElementById('leaveList').innerHTML = renderLeaveList();
    bindLeaveEvents();
  });

  // 批准请假
  document.querySelectorAll('.approve-leave-btn').forEach(function(btn) {
    btn.onclick = function() {
      var attData = loadAttendance();
      var record = attData.leaves.find(function(r) { return r.id === this.dataset.id; }.bind(this));
      if (record) {
        record.status = '已批准';
        record.approvedAt = Date.now();
        saveAttendance(attData);
        document.getElementById('leaveList').innerHTML = renderLeaveList();
        bindLeaveEvents();
        alert('✅ 请假已批准！');
      }
    }.bind(btn);
  });

  // 销假
  document.querySelectorAll('.finish-leave-btn').forEach(function(btn) {
    btn.onclick = function() {
      var attData = loadAttendance();
      var record = attData.leaves.find(function(r) { return r.id === this.dataset.id; }.bind(this));
      if (record) {
        record.status = '已销假';
        record.finishedAt = Date.now();
        saveAttendance(attData);
        document.getElementById('leaveList').innerHTML = renderLeaveList();
        bindLeaveEvents();
        alert('✅ 已销假！');
      }
    }.bind(btn);
  });
}

// ========== 暴露到全局 ==========
window.renderClass = renderClass;
window.initClass = initClass;
