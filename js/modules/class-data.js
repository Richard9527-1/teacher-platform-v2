// js/modules/class-data.js
// ============================================================
// 班级管理 & 数据分析 - 共用数据层（高级版）
// ============================================================

const CLASS_DATA_KEY = 'classData';
const ATTENDANCE_KEY = 'attendanceData';
const EXAM_KEY = 'examData';

// ========== 默认数据 ==========
function getDefaultClassData() {
  return {
    classes: [
      { id: 'c1', name: '高一（1）班', grade: '高一' },
      { id: 'c2', name: '高一（3）班', grade: '高一' },
      { id: 'c3', name: '高二（2）班', grade: '高二' },
      { id: 'c4', name: '高三（5）班', grade: '高三' }
    ],
    students: [
      { id: 's1', name: '张三', classId: 'c1', gender: '男', phone: '13800001111', parentPhone: '13800002222', address: '北京市朝阳区', notes: '语文基础较好' },
      { id: 's2', name: '李四', classId: 'c1', gender: '女', phone: '13800003333', parentPhone: '13800004444', address: '北京市海淀区', notes: '作文需要加强' },
      { id: 's3', name: '王五', classId: 'c2', gender: '男', phone: '13800005555', parentPhone: '13800006666', address: '北京市东城区', notes: '文言文较弱' },
      { id: 's4', name: '赵六', classId: 'c3', gender: '女', phone: '13800007777', parentPhone: '13800008888', address: '北京市西城区', notes: '阅读能力强' },
      { id: 's5', name: '孙七', classId: 'c4', gender: '男', phone: '13800009999', parentPhone: '13800001111', address: '北京市丰台区', notes: '需要重点关注' }
    ]
  };
}

function getDefaultAttendance() {
  return {
    attendance: [],  // 仅存异常：缺课/迟到（正常=无记录）
    leaves: []       // 请假记录，带 status 字段
  };
}

function getDefaultExams() {
  return {
    exams: [],
    scores: []
  };
}

// ========== 数据操作函数 ==========
function loadClassData() {
  let data = localStorage.getItem(CLASS_DATA_KEY);
  if (!data) {
    data = getDefaultClassData();
    localStorage.setItem(CLASS_DATA_KEY, JSON.stringify(data));
    return data;
  }
  try {
    return JSON.parse(data);
  } catch (e) {
    console.warn('⚠️ 班级数据损坏，已重置', e);
    const defaultData = getDefaultClassData();
    localStorage.setItem(CLASS_DATA_KEY, JSON.stringify(defaultData));
    return defaultData;
  }
}

function saveClassData(data) {
  localStorage.setItem(CLASS_DATA_KEY, JSON.stringify(data));
}

function loadAttendance() {
  let data = localStorage.getItem(ATTENDANCE_KEY);
  if (!data) {
    data = getDefaultAttendance();
    localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(data));
    return data;
  }
  try {
    const parsed = JSON.parse(data);
    // 兼容旧格式迁移：旧版 attData.records 混合了考勤和请假
    if (parsed.records && Array.isArray(parsed.records)) {
      const migrated = getDefaultAttendance();
      parsed.records.forEach(r => {
        if (r.type === '事假' || r.type === '病假') {
          migrated.leaves.push({
            id: r.id,
            studentId: r.studentId,
            date: r.date,
            type: r.type,
            reason: r.reason || '',
            status: r.status || '已批准',
            createdAt: r.createdAt || Date.now(),
            approvedAt: r.approvedAt || null,
            finishedAt: r.finishedAt || null
          });
        } else if (r.type === '缺课' || r.type === '迟到') {
          // 考勤只保留异常记录（正常不存）
          migrated.attendance.push({
            id: r.id,
            studentId: r.studentId,
            date: r.date,
            type: r.type,
            reason: r.reason || '',
            createdAt: r.createdAt || Date.now()
          });
        }
        // type === '正常' 的旧记录直接丢弃（新模型正常=无记录）
      });
      localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(migrated));
      return migrated;
    }
    // 新格式校验
    if (!Array.isArray(parsed.attendance)) parsed.attendance = [];
    if (!Array.isArray(parsed.leaves)) parsed.leaves = [];
    return parsed;
  } catch (e) {
    console.warn('⚠️ 考勤数据损坏，已重置', e);
    const defaultData = getDefaultAttendance();
    localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(defaultData));
    return defaultData;
  }
}

function loadExams() {
  let data = localStorage.getItem(EXAM_KEY);
  if (!data) {
    data = getDefaultExams();
    localStorage.setItem(EXAM_KEY, JSON.stringify(data));
    return data;
  }
  try {
    const parsed = JSON.parse(data);
    if (!parsed.exams || !parsed.scores) throw new Error('数据不完整');
    return parsed;
  } catch (e) {
    console.warn('⚠️ 考试数据损坏，已重置', e);
    const defaultData = getDefaultExams();
    localStorage.setItem(EXAM_KEY, JSON.stringify(defaultData));
    return defaultData;
  }
}

function saveExams(data) {
  localStorage.setItem(EXAM_KEY, JSON.stringify(data));
}

function saveAttendance(data) {
  localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(data));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// ========== 工具函数 ==========
function getStudentsByClass(classId, classData) {
  return classData.students.filter(s => s.classId === classId);
}

function getClassName(classId, classData) {
  const cls = classData.classes.find(c => c.id === classId);
  return cls ? cls.name : '未知班级';
}

function getStudentName(studentId, classData) {
  const student = classData.students.find(s => s.id === studentId);
  return student ? student.name : '未知学生';
}

function getExamName(examId, examData) {
  const exam = examData.exams.find(e => e.id === examId);
  return exam ? exam.name : '未知考试';
}

// XSS 防护：HTML 实体转义
function htmlEncode(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ========== 班级下拉复用 ==========
function renderClassOptions(selectedId) {
  const data = loadClassData();
  let html = '<option value="">全部班级</option>';
  data.classes.forEach(c => {
    html += `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${htmlEncode(c.name)}</option>`;
  });
  return html;
}

// ========== 级联删除 ==========
function cascadeDeleteClass(classId) {
  const data = loadClassData();
  const attData = loadAttendance();
  const examData = loadExams();

  // 删除班级
  data.classes = data.classes.filter(c => c.id !== classId);
  // 级联删除该班级下所有学生
  data.students = data.students.filter(s => s.classId !== classId);
  // 级联删除考勤异常记录
  attData.attendance = attData.attendance.filter(a => {
    const s = data.students.find(st => st.id === a.studentId);
    return s; // 学生还在的保留（已被上面 filter 排除的不在的学生记录也删掉）
  });
  // 更精确：直接按被删学生 ID 过滤
  const deletedStudentIds = data.students.map(s => s.id); // 不对，这里 students 已经删过了
  // 重新来：先记要删的学生 ID，再操作
  saveClassData(data);

  // 二次清理：清理孤儿考勤/请假/成绩
  const newData = loadClassData();
  const aliveStudentIds = new Set(newData.students.map(s => s.id));
  const aliveClassIds = new Set(newData.classes.map(c => c.id));

  const attData2 = loadAttendance();
  attData2.attendance = attData2.attendance.filter(a => aliveStudentIds.has(a.studentId));
  attData2.leaves = attData2.leaves.filter(l => aliveStudentIds.has(l.studentId));
  saveAttendance(attData2);

  const examData2 = loadExams();
  examData2.exams = examData2.exams.filter(e => aliveClassIds.has(e.classId));
  examData2.scores = examData2.scores.filter(s => aliveStudentIds.has(s.studentId));
  saveExams(examData2);
}

function cascadeDeleteStudent(studentId) {
  const attData = loadAttendance();
  const examData = loadExams();

  // 级联删除该学生的考勤记录
  attData.attendance = attData.attendance.filter(a => a.studentId !== studentId);
  attData.leaves = attData.leaves.filter(l => l.studentId !== studentId);
  saveAttendance(attData);

  // 级联删除该学生的成绩记录
  examData.scores = examData.scores.filter(s => s.studentId !== studentId);
  saveExams(examData);

  // 最后从班级数据中删除学生（由调用方 saveClassData）
}

// ========== Excel 导出/导入 ==========
var CLASS_EXCEL_REQUIRED = ['classes', 'students', 'attendance', 'leaves', 'exams', 'scores'];

function exportClassExcel(withData) {
  if (typeof XLSX === 'undefined') {
    alert('⚠️ Excel 库未加载，请刷新页面重试');
    return;
  }

  const data = loadClassData();
  const attData = loadAttendance();
  const examData = loadExams();

  var wb = XLSX.utils.book_new();

  // Sheet 1: 班级
  var classRows = withData ? data.classes.map(function(c, i) {
    return { '序号': i + 1, '班级ID': c.id, '班级名称': c.name, '年级': c.grade || '' };
  }) : [{ '序号': '', '班级ID': '', '班级名称': '', '年级': '' }];
  var classWs = XLSX.utils.json_to_sheet(classRows);
  XLSX.utils.book_append_sheet(wb, classWs, '班级');

  // Sheet 2: 学生
  var studentRows = withData ? data.students.map(function(s, i) {
    return { '序号': i + 1, '学生ID': s.id, '姓名': s.name, '班级ID': s.classId, '性别': s.gender || '', '联系电话': s.phone || '', '家长电话': s.parentPhone || '', '家庭地址': s.address || '', '备注': s.notes || '' };
  }) : [{ '序号': '', '学生ID': '', '姓名': '', '班级ID': '', '性别': '', '联系电话': '', '家长电话': '', '家庭地址': '', '备注': '' }];
  var studentWs = XLSX.utils.json_to_sheet(studentRows);
  XLSX.utils.book_append_sheet(wb, studentWs, '学生');

  // Sheet 3: 考勤
  var attRows = withData ? attData.attendance.map(function(a, i) {
    return { '序号': i + 1, '记录ID': a.id, '学生ID': a.studentId, '日期': a.date, '类型': a.type, '原因': a.reason || '' };
  }) : [{ '序号': '', '记录ID': '', '学生ID': '', '日期': '', '类型': '', '原因': '' }];
  var attWs = XLSX.utils.json_to_sheet(attRows);
  forceTextColumnFromSource(attWs, 'B'); // 日期列强制文本
  XLSX.utils.book_append_sheet(wb, attWs, '考勤');

  // Sheet 4: 请假
  var leaveRows = withData ? attData.leaves.map(function(l, i) {
    return { '序号': i + 1, '记录ID': l.id, '学生ID': l.studentId, '日期': l.date, '类型': l.type, '原因': l.reason || '', '状态': l.status || '' };
  }) : [{ '序号': '', '记录ID': '', '学生ID': '', '日期': '', '类型': '', '原因': '', '状态': '' }];
  var leaveWs = XLSX.utils.json_to_sheet(leaveRows);
  forceTextColumnFromSource(leaveWs, 'D');
  XLSX.utils.book_append_sheet(wb, leaveWs, '请假');

  // Sheet 5: 考试
  var examRows = withData ? examData.exams.map(function(e, i) {
    return { '序号': i + 1, '考试ID': e.id, '考试名称': e.name, '类型': e.type, '班级ID': e.classId, '日期': e.date || '' };
  }) : [{ '序号': '', '考试ID': '', '考试名称': '', '类型': '', '班级ID': '', '日期': '' }];
  var examWs = XLSX.utils.json_to_sheet(examRows);
  forceTextColumnFromSource(examWs, 'F');
  XLSX.utils.book_append_sheet(wb, examWs, '考试');

  // Sheet 6: 成绩
  var scoreRows = withData ? examData.scores.map(function(sc, i) {
    return { '序号': i + 1, '成绩ID': sc.id, '考试ID': sc.examId, '学生ID': sc.studentId, '总分': sc.chinese || 0, '默写': sc.dictation || 0, '阅读': sc.reading || 0, '作文': sc.writing || 0, '备注': sc.note || '' };
  }) : [{ '序号': '', '成绩ID': '', '考试ID': '', '学生ID': '', '总分': '', '默写': '', '阅读': '', '作文': '', '备注': '' }];
  var scoreWs = XLSX.utils.json_to_sheet(scoreRows);
  XLSX.utils.book_append_sheet(wb, scoreWs, '成绩');

  var filename = withData
    ? '班级数据_' + new Date().toISOString().slice(0, 10) + '.xlsx'
    : '班级数据_空白模板.xlsx';
  XLSX.writeFile(wb, filename);
}

// 把指定列强制为文本格式（防日期串被 Excel 转序列号）
function forceTextColumnFromSource(ws, colLetter) {
  if (!ws || !colLetter) return;
  var range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (var row = range.s.r; row <= range.e.r; row++) {
    var addr = colLetter + (row + 1);
    var cell = ws[addr];
    if (cell) {
      cell.t = 's'; // 文本类型
      cell.z = '@'; // 文本格式
    }
  }
}

// 解析 Excel 工作簿为对象数组
function sheetToObjects(ws) {
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { raw: true });
}

// 解析上传的 Excel 文件并导入
function parseClassWorkbook(wb) {
  if (!wb || !wb.SheetNames || wb.SheetNames.length === 0) {
    alert('❌ 无效的 Excel 文件');
    return false;
  }

  var sheets = {};
  wb.SheetNames.forEach(function(name) {
    sheets[name] = sheetToObjects(wb.Sheets[name]);
  });

  // 校验必需 Sheet
  var missing = CLASS_EXCEL_REQUIRED.filter(function(name) { return !sheets[name]; });
  if (missing.length > 0) {
    alert('❌ Excel 缺少必需的工作表：' + missing.join('、') + '\n请使用「下载模板」获取标准模板');
    return false;
  }

  // 构建导入数据
  var imported = {
    classes: [],
    students: [],
    attendance: [],
    leaves: [],
    exams: [],
    scores: []
  };

  // 解析各 Sheet（跳过空行和表头行）
  sheets.classes.forEach(function(row) {
    if (!row['班级名称']) return;
    imported.classes.push({ id: row['班级ID'] || generateId(), name: String(row['班级名称']).trim(), grade: String(row['年级'] || '').trim() });
  });

  sheets.students.forEach(function(row) {
    if (!row['姓名']) return;
    imported.students.push({
      id: row['学生ID'] || generateId(),
      name: String(row['姓名']).trim(),
      classId: String(row['班级ID'] || '').trim(),
      gender: String(row['性别'] || '男').trim(),
      phone: String(row['联系电话'] || '').trim(),
      parentPhone: String(row['家长电话'] || '').trim(),
      address: String(row['家庭地址'] || '').trim(),
      notes: String(row['备注'] || '').trim()
    });
  });

  sheets['考勤'].forEach(function(row) {
    if (!row['学生ID']) return;
    imported.attendance.push({
      id: row['记录ID'] || generateId(),
      studentId: String(row['学生ID']).trim(),
      date: String(row['日期'] || '').trim(),
      type: String(row['类型'] || '').trim(),
      reason: String(row['原因'] || '').trim(),
      createdAt: Date.now()
    });
  });

  sheets['请假'].forEach(function(row) {
    if (!row['学生ID']) return;
    imported.leaves.push({
      id: row['记录ID'] || generateId(),
      studentId: String(row['学生ID']).trim(),
      date: String(row['日期'] || '').trim(),
      type: String(row['类型'] || '').trim(),
      reason: String(row['原因'] || '').trim(),
      status: String(row['状态'] || '已批准').trim(),
      createdAt: Date.now()
    });
  });

  sheets['考试'].forEach(function(row) {
    if (!row['考试名称']) return;
    imported.exams.push({
      id: row['考试ID'] || generateId(),
      name: String(row['考试名称']).trim(),
      type: String(row['类型'] || '月考').trim(),
      classId: String(row['班级ID'] || '').trim(),
      date: String(row['日期'] || '').trim(),
      createdAt: Date.now()
    });
  });

  sheets['成绩'].forEach(function(row) {
    if (!row['学生ID']) return;
    imported.scores.push({
      id: row['成绩ID'] || generateId(),
      examId: String(row['考试ID'] || '').trim(),
      studentId: String(row['学生ID'] || '').trim(),
      chinese: parseFloat(row['总分']) || 0,
      dictation: parseFloat(row['默写']) || 0,
      reading: parseFloat(row['阅读']) || 0,
      writing: parseFloat(row['作文']) || 0,
      note: String(row['备注'] || '').trim(),
      createdAt: Date.now()
    });
  });

  // 写入 localStorage
  saveClassData({ classes: imported.classes, students: imported.students });
  saveAttendance({ attendance: imported.attendance, leaves: imported.leaves });
  saveExams({ exams: imported.exams, scores: imported.scores });
  return true;
}

// 解析旧版 JSON 备份文件
function parseClassJson(jsonData) {
  if (!jsonData) { alert('❌ 无效的数据文件'); return false; }
  try {
    if (jsonData.classes && jsonData.students) {
      saveClassData({ classes: jsonData.classes, students: jsonData.students });
    }
    if (jsonData.attendance !== undefined && jsonData.leaves !== undefined) {
      saveAttendance({ attendance: jsonData.attendance || [], leaves: jsonData.leaves || [] });
    } else if (jsonData.records) {
      // 兼容旧格式：走 loadAttendance 迁移逻辑
      localStorage.setItem(ATTENDANCE_KEY, JSON.stringify({ records: jsonData.records }));
      loadAttendance(); // 触发迁移
    }
    if (jsonData.exams && jsonData.scores) {
      saveExams({ exams: jsonData.exams, scores: jsonData.scores });
    }
    return true;
  } catch (e) {
    alert('❌ 数据解析失败：' + e.message);
    return false;
  }
}

// ========== 暴露到全局 ==========
window.loadClassData = loadClassData;
window.saveClassData = saveClassData;
window.loadAttendance = loadAttendance;
window.saveAttendance = saveAttendance;
window.loadExams = loadExams;
window.saveExams = saveExams;
window.getStudentsByClass = getStudentsByClass;
window.getClassName = getClassName;
window.getStudentName = getStudentName;
window.getExamName = getExamName;
window.generateId = generateId;
window.htmlEncode = htmlEncode;
window.renderClassOptions = renderClassOptions;
window.cascadeDeleteClass = cascadeDeleteClass;
window.cascadeDeleteStudent = cascadeDeleteStudent;
window.exportClassExcel = exportClassExcel;
window.parseClassWorkbook = parseClassWorkbook;
window.parseClassJson = parseClassJson;
window.CLASS_EXCEL_REQUIRED = CLASS_EXCEL_REQUIRED;
