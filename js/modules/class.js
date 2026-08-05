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

  // 添加班级
  document.getElementById('addClassBtn').addEventListener('click', function() {
    const name = prompt('请输入班级名称（如：高一（2）班）：');
    if (!name || name.trim() === '') return;
    const data = loadClassData();
    data.classes.push({ id: generateId(), name: name.trim(), grade: name.trim().substring(0, 2), studentCount: 0 });
    saveClassData(data);
    refreshClassView();
    // 更新筛选下拉
    const filter = document.getElementById('classFilter');
    if (filter) {
      filter.innerHTML = `<option value="">全部班级</option>${data.classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}`;
    }
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
    const data = loadClassData();
    const studentNames = data.students.map(s => `${s.name} (${getClassName(s.classId, data)})`);
    // 简单处理：让用户输入学生姓名和请假信息
    const name = prompt('请输入学生姓名：');
    if (!name) return;
    const student = data.students.find(s => s.name === name.trim());
    if (!student) { alert('未找到该学生，请确认姓名'); return; }
    const type = confirm('点击确定=病假，取消=事假') ? '病假' : '事假';
    const reason = prompt('请输入请假原因：') || '';
    const date = prompt('请输入请假日期（YYYY-MM-DD）：') || new Date().toISOString().slice(0, 10);
    const duration = prompt('请输入请假时长（如：2小时、1天）：') || '';

    const attData = loadAttendance();
    attData.records.push({
      id: generateId(),
      studentId: student.id,
      date,
      type,
      reason: `${reason} (时长: ${duration})`,
      status: '申请中',
      createdAt: Date.now()
    });
    saveAttendance(attData);
    document.getElementById('leaveList').innerHTML = renderLeaveList();
    bindLeaveEvents();
    alert('✅ 请假申请已提交！');
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