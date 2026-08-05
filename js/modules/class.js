// js/modules/class.js
// ============================================================
// 班级管理模块
// ============================================================

function renderClass() {
  return `
    <div class="card">
      <h2>👥 班级管理</h2>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;">
        <button class="btn" id="addStudentBtn">＋ 添加学生</button>
        <button class="btn" id="addClassBtn">＋ 添加班级</button>
        <button class="btn" id="manageClassBtn">🗂 管理班级</button>
        <button class="btn" id="attendanceBtn">📋 考勤管理</button>
        <button class="btn" id="leaveBtn">📝 请假管理</button>
        <button class="btn" id="exportClassBtn">📤 导出数据</button>
        <select id="classFilter" style="padding:6px 12px;border-radius:6px;border:1px solid #ddd;">
          <option value="">全部班级</option>
          ${loadClassData().classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
        </select>
      </div>
      <div id="classContent">
        ${renderStudentList()}
      </div>
    </div>
  `;
}

function renderStudentList() {
  const data = loadClassData();
  const filter = document.getElementById('classFilter')?.value || '';
  let students = data.students;
  if (filter) {
    students = students.filter(s => s.classId === filter);
  }

  if (students.length === 0) {
    return '<p style="color:#7f8c8d;text-align:center;padding:20px;">暂无学生，点击「添加学生」录入</p>';
  }

  let html = `
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
        <thead>
          <tr style="background:#f0f4f8;">
            <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #ddd;white-space:nowrap;">姓名</th>
            <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #ddd;white-space:nowrap;">班级</th>
            <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #ddd;white-space:nowrap;">联系电话</th>
            <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #ddd;white-space:nowrap;">家庭地址</th>
            <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #ddd;white-space:nowrap;">备注</th>
            <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #ddd;white-space:nowrap;">操作</th>
          </tr>
        </thead>
        <tbody>
  `;

  students.forEach(s => {
    const className = getClassName(s.classId, data);
    html += `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;white-space:nowrap;">${s.name}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;white-space:nowrap;">${className}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;white-space:nowrap;">${s.phone || '-'}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;">${s.address || '-'}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;">${s.notes || '-'}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;white-space:nowrap;">
          <button class="edit-student-btn" data-id="${s.id}" style="background:none;border:none;color:#4a6fa5;cursor:pointer;font-size:0.9rem;">✏️</button>
          <button class="del-student-btn" data-id="${s.id}" style="background:none;border:none;color:#dc3545;cursor:pointer;font-size:0.9rem;">🗑️</button>
        </td>
      </tr>
    `;
  });

  html += '</tbody></table></div>';
  return html;
}

// ========== 添加学生弹窗 ==========
function showStudentForm(studentId) {
  const data = loadClassData();
  const student = studentId ? data.students.find(s => s.id === studentId) : null;
  const isEdit = !!student;

  const formData = {
    name: student?.name || '',
    classId: student?.classId || (data.classes[0]?.id || ''),
    gender: student?.gender || '男',
    phone: student?.phone || '',
    parentPhone: student?.parentPhone || '',
    address: student?.address || '',
    notes: student?.notes || ''
  };

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <h3>${isEdit ? '编辑学生' : '添加学生'}</h3>
      <div class="form-group">
        <label>姓名 *</label>
        <input type="text" id="formStudentName" value="${formData.name}" />
      </div>
      <div class="form-group">
        <label>班级</label>
        <select id="formStudentClass">
          ${data.classes.map(c => `<option value="${c.id}" ${c.id===formData.classId?'selected':''}>${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>性别</label>
          <select id="formStudentGender">
            ${['男','女'].map(v => `<option ${v===formData.gender?'selected':''}>${v}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>联系电话</label>
          <input type="text" id="formStudentPhone" value="${formData.phone}" />
        </div>
      </div>
      <div class="form-group">
        <label>家长电话</label>
        <input type="text" id="formStudentParentPhone" value="${formData.parentPhone}" />
      </div>
      <div class="form-group">
        <label>家庭地址</label>
        <input type="text" id="formStudentAddress" value="${formData.address}" />
      </div>
      <div class="form-group">
        <label>备注</label>
        <textarea id="formStudentNotes" rows="2">${formData.notes}</textarea>
      </div>
      <div class="modal-actions">
        <button class="btn" id="saveStudentBtn">${isEdit ? '更新' : '添加'}</button>
        <button class="btn" id="closeModalBtn" style="background:#6c757d;">取消</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById('saveStudentBtn').addEventListener('click', function() {
    const name = document.getElementById('formStudentName').value.trim();
    if (!name) { alert('请输入学生姓名'); return; }

    const data = loadClassData();
    const newStudent = {
      id: studentId || generateId(),
      name,
      classId: document.getElementById('formStudentClass').value,
      gender: document.getElementById('formStudentGender').value,
      phone: document.getElementById('formStudentPhone').value.trim(),
      parentPhone: document.getElementById('formStudentParentPhone').value.trim(),
      address: document.getElementById('formStudentAddress').value.trim(),
      notes: document.getElementById('formStudentNotes').value.trim()
    };

    if (isEdit) {
      const idx = data.students.findIndex(s => s.id === studentId);
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
  const data = loadClassData();
  const cls = classId ? data.classes.find(c => c.id === classId) : null;
  const isEdit = !!cls;

  const overlay = document.createElement('div');
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
        <button class="btn" id="closeClassModalBtn" style="background:#6c757d;">取消</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // 编辑态回填（避免属性转义问题，采用赋值方式）
  if (cls) {
    document.getElementById('formClassName').value = cls.name || '';
    document.getElementById('formClassGrade').value = cls.grade || '';
  }

  document.getElementById('saveClassBtn').addEventListener('click', function() {
    const name = document.getElementById('formClassName').value.trim();
    if (!name) { alert('请输入班级名称'); return; }
    const grade = document.getElementById('formClassGrade').value.trim();
    if (isEdit) {
      cls.name = name;
      cls.grade = grade;
    } else {
      data.classes.push({ id: generateId(), name: name, grade: grade || name.substring(0, 2), studentCount: 0 });
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
  const data = loadClassData();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  let clsRows = data.classes.map(c => {
    const cnt = data.students.filter(s => s.classId === c.id).length;
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;">
        <span>${htmlEncode(c.name)} <span style="color:var(--text-light);font-size:0.8rem;">（${cnt} 人${c.grade ? ' · ' + htmlEncode(c.grade) : ''}）</span></span>
        <span>
          <button class="edit-class-btn" data-id="${c.id}" style="background:none;border:none;color:#4a6fa5;cursor:pointer;font-size:0.95rem;margin-right:8px;">✏️</button>
          <button class="del-class-btn" data-id="${c.id}" style="background:none;border:none;color:#dc3545;cursor:pointer;font-size:0.95rem;">🗑️</button>
        </span>
      </div>`;
  }).join('');
  if (!clsRows) clsRows = '<p style="color:#7f8c8d;text-align:center;padding:12px;">暂无班级，请先添加</p>';
  overlay.innerHTML = `
    <div class="modal-box" style="max-width:440px;">
      <h3>🗂 班级管理</h3>
      <div style="max-height:320px;overflow-y:auto;">${clsRows}</div>
      <div class="modal-actions">
        <button class="btn" id="addClassFromManageBtn">＋ 添加班级</button>
        <button class="btn" id="closeManageBtn" style="background:#6c757d;">关闭</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelectorAll('.edit-class-btn').forEach(b => {
    b.onclick = function() { document.body.removeChild(overlay); showClassForm(this.dataset.id); };
  });
  overlay.querySelectorAll('.del-class-btn').forEach(b => {
    b.onclick = function() {
      const id = this.dataset.id;
      const c = data.classes.find(x => x.id === id);
      if (!c) return;
      const cnt = data.students.filter(s => s.classId === id).length;
      if (!confirm(`确认删除班级「${c.name}」？${cnt ? `该班级下 ${cnt} 名学生将一并删除，且不可恢复。` : ''}`)) return;
      data.classes = data.classes.filter(x => x.id !== id);
      data.students = data.students.filter(s => s.classId !== id);
      saveClassData(data);
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

// 同步班级筛选下拉（添加/编辑/删除班级后调用）
function syncClassFilter() {
  const filter = document.getElementById('classFilter');
  if (!filter) return;
  const data = loadClassData();
  filter.innerHTML = `<option value="">全部班级</option>${data.classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}`;
}

// ========== 新增请假弹窗 ==========
function showLeaveForm() {
  const data = loadClassData();
  if (data.students.length === 0) { alert('请先在「添加学生」中录入学生'); return; }
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <h3>📝 新增请假</h3>
      <div class="form-group">
        <label>学生 *</label>
        <select id="formLeaveStudent">
          ${data.students.map(s => `<option value="${s.id}">${htmlEncode(s.name)}（${htmlEncode(getClassName(s.classId, data))}）</option>`).join('')}
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
        <button class="btn" id="closeLeaveBtn" style="background:#6c757d;">取消</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('saveLeaveBtn').addEventListener('click', function() {
    const studentId = document.getElementById('formLeaveStudent').value;
    const type = document.getElementById('formLeaveType').value;
    const reason = document.getElementById('formLeaveReason').value.trim();
    const date = document.getElementById('formLeaveDate').value || new Date().toISOString().slice(0, 10);
    const duration = document.getElementById('formLeaveDuration').value.trim();
    const attData = loadAttendance();
    attData.records.push({
      id: generateId(),
      studentId,
      date,
      type,
      reason: `${reason}${duration ? ' (时长: ' + duration + ')' : ''}`,
      status: '申请中',
      createdAt: Date.now()
    });
    saveAttendance(attData);
    document.body.removeChild(overlay);
    const leaveList = document.getElementById('leaveList');
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
  const data = loadClassData();
  const attData = loadAttendance();
  const today = new Date().toISOString().slice(0, 10);

  let html = `
    <div class="card">
      <h3>📋 今日考勤</h3>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
        <input type="date" id="attDate" value="${today}" style="padding:6px 12px;border-radius:6px;border:1px solid #ddd;" />
        <select id="attClassFilter" style="padding:6px 12px;border-radius:6px;border:1px solid #ddd;">
          <option value="">全部班级</option>
          ${data.classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
        </select>
        <button class="btn" id="attSaveBtn">💾 保存考勤</button>
        <button class="btn" id="attBackBtn" style="background:#6c757d;">返回</button>
      </div>
      <div id="attendanceList">
        ${renderAttendanceTable()}
      </div>
    </div>
  `;
  return html;
}

function renderAttendanceTable() {
  const data = loadClassData();
  const attData = loadAttendance();
  const date = document.getElementById('attDate')?.value || new Date().toISOString().slice(0, 10);
  const filter = document.getElementById('attClassFilter')?.value || '';
  let students = data.students;
  if (filter) students = students.filter(s => s.classId === filter);

  if (students.length === 0) {
    return '<p style="color:#7f8c8d;text-align:center;padding:20px;">该班级暂无学生</p>';
  }

  let html = `
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
        <thead>
          <tr style="background:#f0f4f8;">
            <th style="padding:8px;text-align:left;border-bottom:2px solid #ddd;">姓名</th>
            <th style="padding:8px;text-align:left;border-bottom:2px solid #ddd;">班级</th>
            <th style="padding:8px;text-align:left;border-bottom:2px solid #ddd;">状态</th>
            <th style="padding:8px;text-align:left;border-bottom:2px solid #ddd;">备注</th>
          </tr>
        </thead>
        <tbody>
  `;

  students.forEach(s => {
    const existing = attData.records.find(r => r.studentId === s.id && r.date === date);
    const status = existing ? existing.type : '正常';
    const reason = existing ? existing.reason || '' : '';
    const className = getClassName(s.classId, data);

    html += `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">${s.name}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${className}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">
          <select class="att-status-select" data-student="${s.id}" style="padding:4px 8px;border-radius:4px;border:1px solid #ddd;">
            ${['正常','缺课','迟到','事假','病假'].map(v => `<option ${v===status?'selected':''}>${v}</option>`).join('')}
          </select>
        </td>
        <td style="padding:8px;border-bottom:1px solid #eee;">
          <input type="text" class="att-reason-input" data-student="${s.id}" value="${reason}" placeholder="原因" style="width:100%;padding:4px 8px;border-radius:4px;border:1px solid #ddd;" />
        </td>
      </tr>
    `;
  });

  html += '</tbody></table></div>';
  return html;
}

// ========== 请假管理 ==========
function renderLeave() {
  const data = loadClassData();
  const attData = loadAttendance();

  let html = `
    <div class="card">
      <h3>📝 请假管理</h3>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
        <button class="btn" id="addLeaveBtn">＋ 新增请假</button>
        <select id="leaveStatusFilter" style="padding:6px 12px;border-radius:6px;border:1px solid #ddd;">
          <option value="">全部状态</option>
          <option value="申请中">申请中</option>
          <option value="已批准">已批准</option>
          <option value="已销假">已销假</option>
          <option value="已拒绝">已拒绝</option>
        </select>
        <button class="btn" id="leaveBackBtn" style="background:#6c757d;">返回</button>
      </div>
      <div id="leaveList">
        ${renderLeaveList()}
      </div>
    </div>
  `;
  return html;
}

function renderLeaveList() {
  const data = loadClassData();
  const attData = loadAttendance();
  const filter = document.getElementById('leaveStatusFilter')?.value || '';

  const leaves = attData.records.filter(r => r.type === '事假' || r.type === '病假');
  let filtered = leaves;
  if (filter) filtered = leaves.filter(r => (r.status || '已批准') === filter);

  if (filtered.length === 0) {
    return '<p style="color:#7f8c8d;text-align:center;padding:20px;">暂无请假记录</p>';
  }

  let html = `
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
        <thead>
          <tr style="background:#f0f4f8;">
            <th style="padding:8px;text-align:left;border-bottom:2px solid #ddd;">学生</th>
            <th style="padding:8px;text-align:left;border-bottom:2px solid #ddd;">日期</th>
            <th style="padding:8px;text-align:left;border-bottom:2px solid #ddd;">类型</th>
            <th style="padding:8px;text-align:left;border-bottom:2px solid #ddd;">原因</th>
            <th style="padding:8px;text-align:left;border-bottom:2px solid #ddd;">状态</th>
            <th style="padding:8px;text-align:left;border-bottom:2px solid #ddd;">操作</th>
          </tr>
        </thead>
        <tbody>
  `;

  filtered.forEach(r => {
    const studentName = getStudentName(r.studentId, data);
    const status = r.status || '已批准';
    html += `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">${studentName}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${r.date}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${r.type}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${r.reason || '-'}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">
          <span style="padding:2px 12px;border-radius:30px;font-size:0.8rem;background:${status==='已批准'?'#d4edda':status==='申请中'?'#fff3cd':'#f8d7da'};color:${status==='已批准'?'#155724':status==='申请中'?'#856404':'#721c24'};">${status}</span>
        </td>
        <td style="padding:8px;border-bottom:1px solid #eee;">
          ${status === '申请中' ? `<button class="approve-leave-btn" data-id="${r.id}" style="background:none;border:none;color:#28a745;cursor:pointer;">✅ 批准</button>` : ''}
          ${status === '已批准' ? `<button class="finish-leave-btn" data-id="${r.id}" style="background:none;border:none;color:#4a6fa5;cursor:pointer;">📌 销假</button>` : ''}
        </td>
      </tr>
    `;
  });

  html += '</tbody></table></div>';
  return html;
}

// ========== 刷新视图 ==========
function refreshClassView() {
  const container = document.getElementById('classContent');
  if (container) {
    container.innerHTML = renderStudentList();
    bindClassEvents();
  }
}

// ========== 绑定事件 ==========
function bindClassEvents() {
  // 编辑学生
  document.querySelectorAll('.edit-student-btn').forEach(btn => {
    btn.onclick = function() {
      showStudentForm(this.dataset.id);
    };
  });

  // 删除学生
  document.querySelectorAll('.del-student-btn').forEach(btn => {
    btn.onclick = function() {
      if (!confirm('确认删除该学生？')) return;
      const data = loadClassData();
      data.students = data.students.filter(s => s.id !== this.dataset.id);
      saveClassData(data);
      refreshClassView();
    };
  });
}

// ========== 初始化 ==========
function initClass() {
  // 添加学生
  document.getElementById('addStudentBtn').addEventListener('click', function() {
    showStudentForm(null);
  });

  // 添加班级（模态表单）
  document.getElementById('addClassBtn').addEventListener('click', function() {
    showClassForm(null);
  });

  // 管理班级（编辑 / 删除 / 查看）
  document.getElementById('manageClassBtn').addEventListener('click', function() {
    showClassManage();
  });

  // 班级筛选
  document.getElementById('classFilter').addEventListener('change', refreshClassView);

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

  // 导出
  document.getElementById('exportClassBtn').addEventListener('click', function() {
    const data = loadClassData();
    const text = JSON.stringify(data, null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `班级数据_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  });

  bindClassEvents();
}

// ========== 考勤事件绑定 ==========
function bindAttendanceEvents() {
  document.getElementById('attBackBtn').addEventListener('click', function() {
    document.getElementById('classContent').innerHTML = renderStudentList();
    bindClassEvents();
  });

  document.getElementById('attSaveBtn').addEventListener('click', function() {
    const date = document.getElementById('attDate').value;
    const attData = loadAttendance();
    document.querySelectorAll('.att-status-select').forEach(sel => {
      const studentId = sel.dataset.student;
      const status = sel.value;
      const reasonInput = document.querySelector(`.att-reason-input[data-student="${studentId}"]`);
      const reason = reasonInput ? reasonInput.value : '';
      const existing = attData.records.find(r => r.studentId === studentId && r.date === date);
      if (existing) {
        existing.type = status;
        existing.reason = reason;
        existing.updatedAt = Date.now();
      } else {
        attData.records.push({
          id: generateId(),
          studentId,
          date,
          type: status,
          reason,
          status: status === '事假' || status === '病假' ? '已批准' : undefined,
          createdAt: Date.now()
        });
      }
    });
    saveAttendance(attData);
    alert('✅ 考勤已保存！');
  });

  document.getElementById('attDate').addEventListener('change', function() {
    document.getElementById('attendanceList').innerHTML = renderAttendanceTable();
  });

  document.getElementById('attClassFilter').addEventListener('change', function() {
    document.getElementById('attendanceList').innerHTML = renderAttendanceTable();
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
  document.querySelectorAll('.approve-leave-btn').forEach(btn => {
    btn.onclick = function() {
      const attData = loadAttendance();
      const record = attData.records.find(r => r.id === this.dataset.id);
      if (record) {
        record.status = '已批准';
        record.approvedAt = Date.now();
        saveAttendance(attData);
        document.getElementById('leaveList').innerHTML = renderLeaveList();
        bindLeaveEvents();
        alert('✅ 请假已批准！');
      }
    };
  });

  // 销假
  document.querySelectorAll('.finish-leave-btn').forEach(btn => {
    btn.onclick = function() {
      const attData = loadAttendance();
      const record = attData.records.find(r => r.id === this.dataset.id);
      if (record) {
        record.status = '已销假';
        record.finishedAt = Date.now();
        saveAttendance(attData);
        document.getElementById('leaveList').innerHTML = renderLeaveList();
        bindLeaveEvents();
        alert('✅ 已销假！');
      }
    };
  });
}

// ========== 暴露到全局 ==========
window.renderClass = renderClass;
window.initClass = initClass;