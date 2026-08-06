// js/modules/class-data.js
// ============================================================
// 班级管理 & 数据分析 - 共用数据层
// ============================================================

const CLASS_DATA_KEY = 'classData';
const ATTENDANCE_KEY = 'attendanceData';
const EXAM_KEY = 'examData';

// ========== 默认数据 ==========
function getDefaultClassData() {
  return {
    classes: [
      { id: 'c1', name: '高一（1）班', grade: '高一', studentCount: 45 },
      { id: 'c2', name: '高一（3）班', grade: '高一', studentCount: 42 },
      { id: 'c3', name: '高二（2）班', grade: '高二', studentCount: 48 },
      { id: 'c4', name: '高三（5）班', grade: '高三', studentCount: 40 }
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
    records: [
      // { id, studentId, date, type: '正常'/'缺课'/'迟到'/'事假'/'病假', reason, duration }
    ]
  };
}

function getDefaultExams() {
  return {
    exams: [
      // { id, name, type: '月考'/'期中'/'期末', date, classId }
    ],
    scores: [
      // { id, examId, studentId, chinese: 总分, dictation: 默写, reading: 阅读, writing: 作文, note: 备注 }
    ]
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
  return JSON.parse(data);
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
    if (!parsed.records) throw new Error('数据不完整');
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
    // 确保数据结构完整
    if (!parsed.exams || !parsed.scores) {
      throw new Error('数据不完整');
    }
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

function saveAttendance(data) {
  localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(data));
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