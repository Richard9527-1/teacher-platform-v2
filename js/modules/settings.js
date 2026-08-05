// js/modules/settings.js
// ============================================================
// 设置中心 - 完整功能版
// ============================================================

// ========== 默认配置 ==========
const SETTINGS_KEY = 'appSettings';
const BACKUP_KEY = 'appBackups';
const LOG_KEY = 'operationLogs';

const DEFAULT_SETTINGS = {
  // 一、数据管理
  autoBackup: false,
  backupInterval: 7, // 天
  exportFormat: 'json',

  // 二、基础教学配置
  grades: ['高一', '高二', '高三'],
  classes: {},
  textbookVersion: '统编版',
  semester: { start: '', end: '', examPeriods: [] },

  // 三、备课&教材偏好
  defaultLessonTemplate: { objectives: '', keyPoints: '', process: '' },
  showTranslation: true,
  showNotes: true,
  showExamPoints: true,

  // 四、成绩&考勤配置
  scoreRanges: { excellent: 90, good: 80, pass: 60 },
  alertThresholds: { scoreDrop: 10, absenceCount: 3 },

  // 五、界面偏好
  theme: 'light',
  defaultView: 'list',
  fontSize: 'medium',
  sidebarCollapsed: false,
  notificationsEnabled: true,

  // 六、系统
  // 七、权限（单机版默认单用户）
  // 八、打印模板
  printTemplate: 'default'
};

// ========== 工具函数 ==========
function loadSettings() {
  const data = localStorage.getItem(SETTINGS_KEY);
  if (!data) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
    return DEFAULT_SETTINGS;
  }
  try {
    const parsed = JSON.parse(data);
    // 合并默认值，防止新增字段缺失
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  applySettings(settings);
}

function applySettings(settings) {
  // 主题
  if (settings.theme === 'dark') {
    document.body.classList.add('dark');
  } else {
    document.body.classList.remove('dark');
  }
  // 字体大小
  document.documentElement.style.fontSize =
    settings.fontSize === 'small' ? '14px' :
    settings.fontSize === 'large' ? '18px' : '16px';
  // 侧边栏
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) {
    sidebar.style.display = settings.sidebarCollapsed ? 'none' : '';
  }
  // 通知开关（通过全局变量控制）
  window._notificationsEnabled = settings.notificationsEnabled;
}

function addLog(action, detail) {
  const logs = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
  logs.unshift({
    id: Date.now().toString(36),
    action,
    detail,
    time: new Date().toISOString()
  });
  if (logs.length > 100) logs.pop(); // 最多保留100条
  localStorage.setItem(LOG_KEY, JSON.stringify(logs));
}

// ========== 渲染主界面 ==========
function renderSettings() {
  const settings = loadSettings();
  return `
    <div class="card">
      <h2>⚙️ 设置中心</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:8px;margin-bottom:16px;">
        <button class="btn" data-tab="data" style="background:#4a6fa5;">📦 数据管理</button>
        <button class="btn" data-tab="teaching" style="background:#6c757d;">📚 教学配置</button>
        <button class="btn" data-tab="lesson" style="background:#6c757d;">📝 备课偏好</button>
        <button class="btn" data-tab="score" style="background:#6c757d;">📊 成绩分析</button>
        <button class="btn" data-tab="ui" style="background:#6c757d;">🎨 界面偏好</button>
        <button class="btn" data-tab="system" style="background:#6c757d;">🖥️ 系统</button>
        <button class="btn" data-tab="log" style="background:#6c757d;">📋 操作日志</button>
      </div>
      <div id="settingsContent">
        ${renderDataTab(settings)}
      </div>
    </div>
  `;
}

// ========== 一、数据管理 ==========
function renderDataTab(settings) {
  const backupList = JSON.parse(localStorage.getItem(BACKUP_KEY) || '[]');
  return `
    <h3>📦 数据管理</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">

      <!-- 分类备份 -->
      <div style="background:var(--bg);padding:12px;border-radius:8px;">
        <h4>💾 分类备份</h4>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0;">
          <button class="btn" onclick="backupCategory('lessonTasks')" style="padding:4px 12px;font-size:0.8rem;">备课</button>
          <button class="btn" onclick="backupCategory('classData')" style="padding:4px 12px;font-size:0.8rem;">班级</button>
          <button class="btn" onclick="backupCategory('examData')" style="padding:4px 12px;font-size:0.8rem;">试卷</button>
          <button class="btn" onclick="backupCategory('attendanceData')" style="padding:4px 12px;font-size:0.8rem;">考勤</button>
          <button class="btn" onclick="backupCategory('scheduleData')" style="padding:4px 12px;font-size:0.8rem;">课程表</button>
          <button class="btn" onclick="backupAll()" style="padding:4px 12px;font-size:0.8rem;background:#28a745;">📦 全部</button>
        </div>
        <div style="font-size:0.8rem;color:var(--text-light);">备份文件: ${backupList.length} 个</div>
      </div>

      <!-- 分类恢复 -->
      <div style="background:var(--bg);padding:12px;border-radius:8px;">
        <h4>📂 恢复数据</h4>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0;">
          <button class="btn" onclick="restoreCategory()" style="padding:4px 12px;font-size:0.8rem;">从文件恢复</button>
          <button class="btn" onclick="showBackupList()" style="padding:4px 12px;font-size:0.8rem;background:#17a2b8;">📋 查看备份</button>
        </div>
        <div style="font-size:0.8rem;color:var(--text-light);">选择备份文件恢复对应数据</div>
      </div>

      <!-- 导出格式 -->
      <div style="background:var(--bg);padding:12px;border-radius:8px;">
        <h4>📤 导出格式</h4>
        <select id="exportFormat" style="width:100%;padding:6px;border-radius:6px;border:1px solid #ddd;background:var(--bg);color:var(--text);" onchange="updateSetting('exportFormat',this.value)">
          <option value="json" ${settings.exportFormat==='json'?'selected':''}>JSON</option>
          <option value="excel" ${settings.exportFormat==='excel'?'selected':''}>Excel (.xlsx)</option>
        </select>
        <div style="margin-top:8px;">
          <button class="btn" onclick="exportAllData()" style="padding:4px 16px;font-size:0.85rem;background:#28a745;">📥 导出全部数据</button>
        </div>
      </div>

      <!-- 选择性清除 -->
      <div style="background:var(--bg);padding:12px;border-radius:8px;">
        <h4>🗑️ 选择性清除</h4>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0;">
          <button class="btn" onclick="clearCategory('lessonTasks')" style="padding:4px 12px;font-size:0.8rem;background:#dc3545;">备课</button>
          <button class="btn" onclick="clearCategory('classData')" style="padding:4px 12px;font-size:0.8rem;background:#dc3545;">班级</button>
          <button class="btn" onclick="clearCategory('examData')" style="padding:4px 12px;font-size:0.8rem;background:#dc3545;">试卷</button>
          <button class="btn" onclick="clearCategory('attendanceData')" style="padding:4px 12px;font-size:0.8rem;background:#dc3545;">考勤</button>
          <button class="btn" onclick="clearCategory('scheduleData')" style="padding:4px 12px;font-size:0.8rem;background:#dc3545;">课程表</button>
        </div>
      </div>

      <!-- 自动备份 -->
      <div style="background:var(--bg);padding:12px;border-radius:8px;grid-column:span 2;">
        <h4>🔄 自动备份</h4>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <label>
            <input type="checkbox" ${settings.autoBackup?'checked':''} onchange="updateSetting('autoBackup',this.checked)" />
            启用自动备份
          </label>
          <label>
            周期:
            <select onchange="updateSetting('backupInterval',parseInt(this.value))" style="padding:4px 8px;border-radius:6px;border:1px solid #ddd;background:var(--bg);color:var(--text);">
              <option value="1" ${settings.backupInterval===1?'selected':''}>每天</option>
              <option value="3" ${settings.backupInterval===3?'selected':''}>3天</option>
              <option value="7" ${settings.backupInterval===7?'selected':''}>7天</option>
              <option value="14" ${settings.backupInterval===14?'selected':''}>14天</option>
              <option value="30" ${settings.backupInterval===30?'selected':''}>30天</option>
            </select>
          </label>
          <span style="font-size:0.85rem;color:var(--text-light);">下次备份: ${getNextBackupTime(settings.backupInterval)}</span>
        </div>
      </div>
    </div>
  `;
}

// ========== 二、基础教学配置 ==========
function renderTeachingTab(settings) {
  const grades = settings.grades || ['高一', '高二', '高三'];
  return `
    <h3>📚 基础教学配置</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">

      <!-- 年级班级管理 -->
      <div style="background:var(--bg);padding:12px;border-radius:8px;">
        <h4>🏫 年级班级管理</h4>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0;">
          ${grades.map(g => `<span style="background:var(--card-bg);padding:4px 12px;border-radius:30px;border:1px solid #ddd;display:inline-flex;align-items:center;gap:6px;">
            ${g}
            <span onclick="removeGrade('${g}')" style="cursor:pointer;color:#dc3545;">✕</span>
          </span>`).join('')}
        </div>
        <div style="display:flex;gap:6px;margin-top:6px;">
          <input type="text" id="newGradeInput" placeholder="新年级名称" style="flex:1;padding:4px 8px;border-radius:6px;border:1px solid #ddd;background:var(--bg);color:var(--text);" />
          <button class="btn" onclick="addGrade()" style="padding:4px 12px;font-size:0.85rem;">添加</button>
        </div>
        <div style="margin-top:8px;">
          <label style="font-size:0.85rem;">班级管理</label>
          <div id="classManager">
            ${grades.map(g => `
              <div style="display:flex;align-items:center;gap:6px;margin-top:4px;">
                <span style="min-width:60px;font-weight:600;">${g}</span>
                <input type="text" id="classInput_${g}" placeholder="班级名，逗号分隔" value="${(settings.classes[g]||[]).join('、')}" style="flex:1;padding:4px 8px;border-radius:6px;border:1px solid #ddd;background:var(--bg);color:var(--text);font-size:0.85rem;" />
                <button class="btn" onclick="saveClasses('${g}')" style="padding:2px 10px;font-size:0.8rem;">保存</button>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- 教材版本 -->
      <div style="background:var(--bg);padding:12px;border-radius:8px;">
        <h4>📖 教材版本</h4>
        <select id="textbookVersion" style="width:100%;padding:6px;border-radius:6px;border:1px solid #ddd;background:var(--bg);color:var(--text);" onchange="updateSetting('textbookVersion',this.value)">
          <option value="统编版" ${settings.textbookVersion==='统编版'?'selected':''}>统编版（当前）</option>
          <option value="人教版" ${settings.textbookVersion==='人教版'?'selected':''}>人教版</option>
          <option value="苏教版" ${settings.textbookVersion==='苏教版'?'selected':''}>苏教版</option>
          <option value="自定义" ${settings.textbookVersion==='自定义'?'selected':''}>自定义</option>
        </select>
        <div style="margin-top:8px;font-size:0.85rem;color:var(--text-light);">切换教材版本影响教材资源中心的数据展示</div>
      </div>

      <!-- 学期时间 -->
      <div style="background:var(--bg);padding:12px;border-radius:8px;grid-column:span 2;">
        <h4>📅 学期时间设置</h4>
        <div style="display:flex;gap:12px;flex-wrap:wrap;">
          <label>开学日期: <input type="date" value="${settings.semester.start||''}" onchange="updateSemester('start',this.value)" style="padding:4px 8px;border-radius:6px;border:1px solid #ddd;background:var(--bg);color:var(--text);" /></label>
          <label>结束日期: <input type="date" value="${settings.semester.end||''}" onchange="updateSemester('end',this.value)" style="padding:4px 8px;border-radius:6px;border:1px solid #ddd;background:var(--bg);color:var(--text);" /></label>
          <label>考试周期: <input type="text" placeholder="期中/期末" value="${(settings.semester.examPeriods||[]).join('、')}" onchange="updateSemester('examPeriods',this.value.split('、').filter(Boolean))" style="padding:4px 8px;border-radius:6px;border:1px solid #ddd;background:var(--bg);color:var(--text);" /></label>
        </div>
        <div style="margin-top:6px;font-size:0.85rem;color:var(--text-light);">联动备课截止日期和上课日期的默认值</div>
      </div>
    </div>
  `;
}

// ========== 三、备课&教材偏好 ==========
function renderLessonTab(settings) {
  return `
    <h3>📝 备课 & 教材偏好</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">

      <!-- 默认备课模板 -->
      <div style="background:var(--bg);padding:12px;border-radius:8px;grid-column:span 2;">
        <h4>📋 默认备课模板</h4>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
          <div>
            <label style="font-size:0.85rem;">教学目标</label>
            <textarea id="tmplObjectives" rows="2" style="width:100%;padding:4px 8px;border-radius:6px;border:1px solid #ddd;background:var(--bg);color:var(--text);font-size:0.85rem;" onchange="updateTemplate('objectives',this.value)">${settings.defaultLessonTemplate.objectives||''}</textarea>
          </div>
          <div>
            <label style="font-size:0.85rem;">教学重难点</label>
            <textarea id="tmplKeyPoints" rows="2" style="width:100%;padding:4px 8px;border-radius:6px;border:1px solid #ddd;background:var(--bg);color:var(--text);font-size:0.85rem;" onchange="updateTemplate('keyPoints',this.value)">${settings.defaultLessonTemplate.keyPoints||''}</textarea>
          </div>
          <div>
            <label style="font-size:0.85rem;">教学过程/作业</label>
            <textarea id="tmplProcess" rows="2" style="width:100%;padding:4px 8px;border-radius:6px;border:1px solid #ddd;background:var(--bg);color:var(--text);font-size:0.85rem;" onchange="updateTemplate('process',this.value)">${settings.defaultLessonTemplate.process||''}</textarea>
          </div>
        </div>
      </div>

      <!-- 教材展示设置 -->
      <div style="background:var(--bg);padding:12px;border-radius:8px;">
        <h4>📖 教材展示设置</h4>
        <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px;">
          <label><input type="checkbox" ${settings.showTranslation?'checked':''} onchange="updateSetting('showTranslation',this.checked)" /> 默认显示译文</label>
          <label><input type="checkbox" ${settings.showNotes?'checked':''} onchange="updateSetting('showNotes',this.checked)" /> 默认显示注释</label>
          <label><input type="checkbox" ${settings.showExamPoints?'checked':''} onchange="updateSetting('showExamPoints',this.checked)" /> 默认显示考点</label>
        </div>
      </div>

      <!-- 素材存储路径 -->
      <div style="background:var(--bg);padding:12px;border-radius:8px;">
        <h4>📁 素材存储</h4>
        <div style="font-size:0.85rem;color:var(--text-light);margin-top:8px;">
          <p>当前存储: localStorage（本地）</p>
          <p>已用空间: ${getStorageUsage()}</p>
          <p style="font-size:0.75rem;color:#6c757d;">所有素材附件均存储在浏览器本地，建议定期备份。</p>
        </div>
      </div>
    </div>
  `;
}

// ========== 四、成绩&考勤配置 ==========
function renderScoreTab(settings) {
  return `
    <h3>📊 成绩 & 考勤数据分析配置</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">

      <!-- 分数区间 -->
      <div style="background:var(--bg);padding:12px;border-radius:8px;">
        <h4>📊 分数区间自定义</h4>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px;">
          <label>优秀 ≥ <input type="number" value="${settings.scoreRanges.excellent||90}" onchange="updateScoreRange('excellent',parseInt(this.value))" style="width:60px;padding:2px 4px;border-radius:4px;border:1px solid #ddd;background:var(--bg);color:var(--text);" /></label>
          <label>良好 ≥ <input type="number" value="${settings.scoreRanges.good||80}" onchange="updateScoreRange('good',parseInt(this.value))" style="width:60px;padding:2px 4px;border-radius:4px;border:1px solid #ddd;background:var(--bg);color:var(--text);" /></label>
          <label>及格 ≥ <input type="number" value="${settings.scoreRanges.pass||60}" onchange="updateScoreRange('pass',parseInt(this.value))" style="width:60px;padding:2px 4px;border-radius:4px;border:1px solid #ddd;background:var(--bg);color:var(--text);" /></label>
        </div>
      </div>

      <!-- 预警阈值 -->
      <div style="background:var(--bg);padding:12px;border-radius:8px;">
        <h4>⚠️ 预警阈值设置</h4>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px;">
          <label>成绩下滑 ≥ <input type="number" value="${settings.alertThresholds.scoreDrop||10}" onchange="updateAlertThreshold('scoreDrop',parseInt(this.value))" style="width:60px;padding:2px 4px;border-radius:4px;border:1px solid #ddd;background:var(--bg);color:var(--text);" /> 分</label>
          <label>缺勤 ≥ <input type="number" value="${settings.alertThresholds.absenceCount||3}" onchange="updateAlertThreshold('absenceCount',parseInt(this.value))" style="width:60px;padding:2px 4px;border-radius:4px;border:1px solid #ddd;background:var(--bg);color:var(--text);" /> 次</label>
        </div>
        <div style="margin-top:6px;font-size:0.85rem;color:var(--text-light);">超过阈值自动触发预警提醒</div>
      </div>

      <!-- 报表样式 -->
      <div style="background:var(--bg);padding:12px;border-radius:8px;grid-column:span 2;">
        <h4>📄 报表导出默认样式</h4>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:8px;">
          <label><input type="radio" name="reportStyle" ${settings.reportStyle==='compact'?'checked':''} onchange="updateSetting('reportStyle','compact')" /> 紧凑型</label>
          <label><input type="radio" name="reportStyle" ${settings.reportStyle==='detailed'?'checked':''} onchange="updateSetting('reportStyle','detailed')" /> 详细型</label>
          <label><input type="radio" name="reportStyle" ${!settings.reportStyle||settings.reportStyle==='default'?'checked':''} onchange="updateSetting('reportStyle','default')" /> 默认</label>
        </div>
      </div>
    </div>
  `;
}

// ========== 五、界面与通用偏好 ==========
function renderUITab(settings) {
  return `
    <h3>🎨 界面与通用偏好</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;">

      <!-- 主题 -->
      <div style="background:var(--bg);padding:12px;border-radius:8px;">
        <h4>🎨 主题切换</h4>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button class="btn" onclick="updateSetting('theme','light');location.reload();" style="${settings.theme==='light'?'background:#4a6fa5':'background:#6c757d'};">☀️ 浅色</button>
          <button class="btn" onclick="updateSetting('theme','dark');location.reload();" style="${settings.theme==='dark'?'background:#4a6fa5':'background:#6c757d'};">🌙 深色</button>
        </div>
      </div>

      <!-- 列表视图 -->
      <div style="background:var(--bg);padding:12px;border-radius:8px;">
        <h4>📋 默认视图</h4>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button class="btn" onclick="updateSetting('defaultView','list');location.reload();" style="${settings.defaultView==='list'?'background:#4a6fa5':'background:#6c757d'};">📋 列表</button>
          <button class="btn" onclick="updateSetting('defaultView','kanban');location.reload();" style="${settings.defaultView==='kanban'?'background:#4a6fa5':'background:#6c757d'};">📊 看板</button>
        </div>
      </div>

      <!-- 字体大小 -->
      <div style="background:var(--bg);padding:12px;border-radius:8px;">
        <h4>🔤 字体大小</h4>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button class="btn" onclick="updateSetting('fontSize','small');location.reload();" style="${settings.fontSize==='small'?'background:#4a6fa5':'background:#6c757d'};">小</button>
          <button class="btn" onclick="updateSetting('fontSize','medium');location.reload();" style="${settings.fontSize==='medium'?'background:#4a6fa5':'background:#6c757d'};">中</button>
          <button class="btn" onclick="updateSetting('fontSize','large');location.reload();" style="${settings.fontSize==='large'?'background:#4a6fa5':'background:#6c757d'};">大</button>
        </div>
      </div>

      <!-- 侧边栏 -->
      <div style="background:var(--bg);padding:12px;border-radius:8px;">
        <h4>📂 侧边栏</h4>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button class="btn" onclick="updateSetting('sidebarCollapsed',false);location.reload();" style="${!settings.sidebarCollapsed?'background:#4a6fa5':'background:#6c757d'};">展开</button>
          <button class="btn" onclick="updateSetting('sidebarCollapsed',true);location.reload();" style="${settings.sidebarCollapsed?'background:#4a6fa5':'background:#6c757d'};">收起</button>
        </div>
      </div>

      <!-- 通知开关 -->
      <div style="background:var(--bg);padding:12px;border-radius:8px;grid-column:span 2;">
        <h4>🔔 通知弹窗</h4>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <label><input type="checkbox" ${settings.notificationsEnabled!==false?'checked':''} onchange="updateSetting('notificationsEnabled',this.checked)" /> 启用通知</label>
          <span style="font-size:0.85rem;color:var(--text-light);margin-left:12px;">任务到期、学情异常时弹出提醒</span>
        </div>
      </div>
    </div>
  `;
}

// ========== 六、系统 ==========

// ---- 修改密码界面 ----
function renderAccountTab(settings) {
  const user = getCurrentAuthUser();
  if (!user) return '<p>请先登录</p>';
  
  return `
    <h3>🔐 账户安全</h3>
    <div style="background:var(--bg);padding:16px;border-radius:8px;max-width:400px;">
      <p style="margin-bottom:12px;">当前用户：<strong>${user.username}</strong>（${user.role === 'admin' ? '管理员' : '教师'}）</p>
      <div class="form-group">
        <label>原密码</label>
        <input type="password" id="oldPwdInput" style="width:100%;padding:8px;border-radius:6px;border:1px solid #ddd;background:var(--bg);color:var(--text);" />
      </div>
      <div class="form-group">
        <label>新密码</label>
        <input type="password" id="newPwdInput" style="width:100%;padding:8px;border-radius:6px;border:1px solid #ddd;background:var(--bg);color:var(--text);" />
      </div>
      <div class="form-group">
        <label>确认新密码</label>
        <input type="password" id="confirmPwdInput" style="width:100%;padding:8px;border-radius:6px;border:1px solid #ddd;background:var(--bg);color:var(--text);" />
      </div>
      <button class="btn" onclick="handleChangePassword()" style="background:#4a6fa5;">修改密码</button>
      <div id="pwdResult" style="margin-top:8px;color:#28a745;"></div>
    </div>
  `;
}

// 修改密码处理函数
function handleChangePassword() {
  const oldPwd = document.getElementById('oldPwdInput').value;
  const newPwd = document.getElementById('newPwdInput').value;
  const confirmPwd = document.getElementById('confirmPwdInput').value;
  const resultEl = document.getElementById('pwdResult');
  
  if (newPwd !== confirmPwd) {
    resultEl.style.color = '#dc3545';
    resultEl.textContent = '两次密码不一致';
    return;
  }
  
  const user = getCurrentAuthUser();
  if (!user) {
    resultEl.style.color = '#dc3545';
    resultEl.textContent = '请先登录';
    return;
  }
  
  const result = authChangePassword(user.username, oldPwd, newPwd);
  resultEl.style.color = result.success ? '#28a745' : '#dc3545';
  resultEl.textContent = result.message;
  
  if (result.success) {
    document.getElementById('oldPwdInput').value = '';
    document.getElementById('newPwdInput').value = '';
    document.getElementById('confirmPwdInput').value = '';
  }
}

window.handleChangePassword = handleChangePassword;

function renderSystemTab(settings) {
  const logs = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
  return `
    <h3>🖥️ 系统与本地存储</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">

      <!-- 存储占用 -->
      <div style="background:var(--bg);padding:12px;border-radius:8px;">
        <h4>💾 存储占用</h4>
        <div style="margin-top:8px;">
          <div style="display:flex;justify-content:space-between;font-size:0.9rem;">
            <span>已用空间</span>
            <span id="storageUsed">${getStorageUsage()}</span>
          </div>
          <div style="width:100%;height:8px;background:#e9ecef;border-radius:4px;margin-top:4px;overflow:hidden;">
            <div id="storageBar" style="height:100%;background:#4a6fa5;width:${getStoragePercent()}%;border-radius:4px;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:var(--text-light);margin-top:2px;">
            <span>0 MB</span>
            <span id="storageLimit">~5 MB</span>
          </div>
        </div>
      </div>

      <!-- 缓存清理 -->
      <div style="background:var(--bg);padding:12px;border-radius:8px;">
        <h4>🧹 缓存清理</h4>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">
          <button class="btn" onclick="clearCache('images')" style="padding:4px 12px;font-size:0.8rem;background:#dc3545;">清理图片缓存</button>
          <button class="btn" onclick="clearCache('attachments')" style="padding:4px 12px;font-size:0.8rem;background:#dc3545;">清理附件缓存</button>
          <button class="btn" onclick="clearCache('all')" style="padding:4px 12px;font-size:0.8rem;background:#dc3545;">清理全部缓存</button>
        </div>
        <div style="font-size:0.8rem;color:var(--text-light);margin-top:6px;">只清理临时缓存，不删除业务数据</div>
      </div>

      <!-- 版本检测 -->
      <div style="background:var(--bg);padding:12px;border-radius:8px;">
        <h4>📌 版本信息</h4>
        <div style="margin-top:8px;font-size:0.9rem;">
          <p>当前版本: <strong>语文智备Pro v3.0</strong></p>
          <p>上次更新: 2026-07-08</p>
          <button class="btn" onclick="checkUpdate()" style="padding:4px 16px;font-size:0.85rem;background:#17a2b8;">🔄 检查更新</button>
        </div>
      </div>

      <!-- 重置配置 -->
      <div style="background:var(--bg);padding:12px;border-radius:8px;">
        <h4>🔄 重置系统</h4>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">
          <button class="btn" onclick="resetSettings()" style="padding:4px 12px;font-size:0.8rem;background:#ffc107;">重置设置</button>
          <button class="btn" onclick="resetAll()" style="padding:4px 12px;font-size:0.8rem;background:#dc3545;">⚠️ 恢复出厂</button>
        </div>
        <div style="font-size:0.8rem;color:var(--text-light);margin-top:6px;">重置设置不影响业务数据，恢复出厂将清除所有数据</div>
      </div>

      <!-- 操作日志 -->
      <div style="background:var(--bg);padding:12px;border-radius:8px;grid-column:span 2;">
        <h4>📋 操作日志（最近10条）</h4>
        <div style="max-height:150px;overflow-y:auto;margin-top:8px;font-size:0.85rem;">
          ${logs.slice(0,10).map(log =>
            `<div style="padding:4px 8px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;">
              <span>${log.action} ${log.detail||''}</span>
              <span style="color:var(--text-light);font-size:0.75rem;">${new Date(log.time).toLocaleString()}</span>
            </div>`
          ).join('') || '<div style="color:var(--text-light);padding:8px;">暂无操作记录</div>'}
        </div>
        <button class="btn" onclick="clearLogs()" style="padding:2px 12px;font-size:0.8rem;background:#dc3545;margin-top:6px;">清空日志</button>
      </div>
    </div>
  `;
}

// ========== 操作日志 Tab ==========
function renderLogTab(settings) {
  const logs = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
  return `
    <h3>📋 完整操作日志</h3>
    <div style="background:var(--bg);padding:12px;border-radius:8px;max-height:500px;overflow-y:auto;">
      ${logs.length===0?'<div style="color:var(--text-light);padding:20px;text-align:center;">暂无操作记录</div>':
        logs.map(log =>
          `<div style="padding:6px 12px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">
            <div>
              <span style="font-weight:500;">${log.action}</span>
              ${log.detail ? `<span style="color:var(--text-light);font-size:0.9rem;">${log.detail}</span>` : ''}
            </div>
            <span style="color:var(--text-light);font-size:0.75rem;">${new Date(log.time).toLocaleString()}</span>
          </div>`
        ).join('')
      }
    </div>
    <div style="margin-top:8px;display:flex;gap:8px;">
      <button class="btn" onclick="clearLogs()" style="padding:4px 16px;background:#dc3545;">清空所有日志</button>
      <button class="btn" onclick="exportLogs()" style="padding:4px 16px;background:#28a745;">导出日志</button>
    </div>
  `;
}

// ========== 功能函数 ==========

// ---- 数据管理 ----
function backupCategory(key) {
  const data = localStorage.getItem(key);
  if (!data) { alert('该分类暂无数据可备份'); return; }
  const backup = {
    id: Date.now().toString(36),
    key: key,
    name: { lessonTasks: '备课', classData: '班级', examData: '试卷', attendanceData: '考勤', scheduleData: '课程表' }[key] || key,
    data: data,
    time: new Date().toISOString()
  };
  const backups = JSON.parse(localStorage.getItem(BACKUP_KEY) || '[]');
  backups.push(backup);
  localStorage.setItem(BACKUP_KEY, JSON.stringify(backups));
  addLog('备份', `${backup.name} (${key})`);
  alert(`✅ ${backup.name} 已备份`);
}

function backupAll() {
  const keys = ['lessonTasks', 'classData', 'examData', 'attendanceData', 'scheduleData'];
  keys.forEach(k => backupCategory(k));
  alert('✅ 所有数据已备份');
}

function restoreCategory() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.key && data.data) {
          localStorage.setItem(data.key, data.data);
          addLog('恢复', `${data.name} (${data.key})`);
          alert(`✅ ${data.name} 已恢复`);
        } else if (data.lessonTasks || data.classData) {
          // 全量备份格式
          Object.keys(data).forEach(k => {
            if (['lessonTasks', 'classData', 'examData', 'attendanceData', 'scheduleData'].includes(k)) {
              localStorage.setItem(k, JSON.stringify(data[k]));
            }
          });
          addLog('恢复', '全部数据');
          alert('✅ 全部数据已恢复');
        } else {
          alert('❌ 无效的备份文件');
        }
        location.reload();
      } catch {
        alert('❌ 文件解析失败');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function showBackupList() {
  const backups = JSON.parse(localStorage.getItem(BACKUP_KEY) || '[]');
  if (backups.length === 0) {
    alert('暂无备份记录');
    return;
  }
  const list = backups.map((b, i) =>
    `${i+1}. ${b.name} - ${new Date(b.time).toLocaleString()}`
  ).join('\n');
  alert(`📋 备份列表:\n\n${list}\n\n点击确认后选择要恢复的备份序号:`);
  const idx = parseInt(prompt('请输入要恢复的备份序号:'));
  if (idx > 0 && idx <= backups.length) {
    const b = backups[idx - 1];
    localStorage.setItem(b.key, b.data);
    addLog('恢复', `${b.name} (${b.key})`);
    alert(`✅ ${b.name} 已恢复`);
    location.reload();
  }
}

function clearCategory(key) {
  if (!confirm(`确定要清除 ${key} 的所有数据吗？此操作不可恢复！`)) return;
  localStorage.removeItem(key);
  addLog('清除', key);
  alert(`✅ ${key} 已清除`);
  location.reload();
}

function exportAllData() {
  const settings = loadSettings();
  const format = settings.exportFormat || 'json';
  const data = {
    lessonTasks: JSON.parse(localStorage.getItem('lessonTasks') || '[]'),
    classData: JSON.parse(localStorage.getItem('classData') || '{}'),
    examData: JSON.parse(localStorage.getItem('examData') || '{}'),
    attendanceData: JSON.parse(localStorage.getItem('attendanceData') || '{}'),
    scheduleData: JSON.parse(localStorage.getItem('scheduleData') || '{}'),
    settings: settings,
    exportTime: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `全部数据_${new Date().toISOString().slice(0,10)}.${format==='excel'?'xlsx':'json'}`;
  a.click();
  addLog('导出', '全部数据');
  alert('✅ 数据已导出');
}

function getNextBackupTime(interval) {
  const d = new Date();
  d.setDate(d.getDate() + interval);
  return d.toLocaleDateString();
}

// ---- 教学配置 ----
function addGrade() {
  const input = document.getElementById('newGradeInput');
  const name = input.value.trim();
  if (!name) return;
  const settings = loadSettings();
  if (!settings.grades) settings.grades = [];
  if (settings.grades.includes(name)) { alert('该年级已存在'); return; }
  settings.grades.push(name);
  if (!settings.classes) settings.classes = {};
  settings.classes[name] = [];
  saveSettings(settings);
  addLog('添加年级', name);
  input.value = '';
  renderTab('teaching');
}

function removeGrade(grade) {
  if (!confirm(`确定删除 ${grade} 吗？`)) return;
  const settings = loadSettings();
  settings.grades = settings.grades.filter(g => g !== grade);
  delete settings.classes[grade];
  saveSettings(settings);
  addLog('删除年级', grade);
  renderTab('teaching');
}

function saveClasses(grade) {
  const input = document.getElementById(`classInput_${grade}`);
  const classes = input.value.split('、').map(s => s.trim()).filter(Boolean);
  const settings = loadSettings();
  if (!settings.classes) settings.classes = {};
  settings.classes[grade] = classes;
  saveSettings(settings);
  addLog('编辑班级', `${grade}: ${classes.join('、')}`);
  alert(`✅ ${grade} 班级已保存`);
}

function updateSemester(field, value) {
  const settings = loadSettings();
  if (!settings.semester) settings.semester = { start: '', end: '', examPeriods: [] };
  settings.semester[field] = value;
  saveSettings(settings);
  addLog('更新学期', `${field}: ${value}`);
}

// ---- 备课偏好 ----
function updateTemplate(field, value) {
  const settings = loadSettings();
  if (!settings.defaultLessonTemplate) settings.defaultLessonTemplate = {};
  settings.defaultLessonTemplate[field] = value;
  saveSettings(settings);
}

// ---- 成绩配置 ----
function updateScoreRange(key, value) {
  const settings = loadSettings();
  if (!settings.scoreRanges) settings.scoreRanges = { excellent: 90, good: 80, pass: 60 };
  settings.scoreRanges[key] = value;
  saveSettings(settings);
}

function updateAlertThreshold(key, value) {
  const settings = loadSettings();
  if (!settings.alertThresholds) settings.alertThresholds = { scoreDrop: 10, absenceCount: 3 };
  settings.alertThresholds[key] = value;
  saveSettings(settings);
}

// ---- 通用设置 ----
function updateSetting(key, value) {
  const settings = loadSettings();
  settings[key] = value;
  saveSettings(settings);
  addLog('更新设置', `${key}: ${value}`);
}

// ---- 存储管理 ----
function getStorageUsage() {
  let total = 0;
  for (const key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      total += localStorage[key].length * 2; // UTF-16
    }
  }
  return (total / 1024 / 1024).toFixed(2) + ' MB';
}

function getStoragePercent() {
  let total = 0;
  for (const key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      total += localStorage[key].length * 2;
    }
  }
  const max = 10 * 1024 * 1024; // Chrome 等浏览器对单个源 localStorage 的实际上限约 10MB
  return Math.min((total / max) * 100, 100);
}

function clearCache(type) {
  if (!confirm(`确定清理${type==='images'?'图片':type==='attachments'?'附件':'全部'}缓存吗？`)) return;
  // 仅清理本应用命名空间下的缓存键（tp_cache_ 前缀）；当前版本图片/附件不落 localStorage，无缓存时如实告知
  let removed = 0;
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.indexOf('tp_cache_') === 0) keys.push(k);
  }
  if (type === 'all') {
    keys.forEach(k => { localStorage.removeItem(k); removed++; });
  } else {
    const prefix = type === 'images' ? 'tp_cache_img_' : 'tp_cache_att_';
    keys.filter(k => k.indexOf(prefix) === 0).forEach(k => { localStorage.removeItem(k); removed++; });
  }
  if (removed > 0) {
    alert(`✅ 已清理 ${removed} 项缓存`);
  } else {
    alert('暂无缓存可清理（当前版本图片/附件不持久化到本地）');
  }
  addLog('清理缓存', type + (removed > 0 ? `(${removed})` : '(空)'));
}

function checkUpdate() {
  alert('当前已是最新版本 v3.0\n(检查更新功能需要联网)');
}

function resetSettings() {
  if (!confirm('重置所有设置为默认值？')) return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
  addLog('重置设置', '全部');
  alert('✅ 设置已重置');
  location.reload();
}

function resetAll() {
  if (!confirm('⚠️ 恢复出厂将清除所有数据！确定继续？')) return;
  if (!confirm('再次确认：所有数据将被永久删除！')) return;
  localStorage.clear();
  alert('✅ 已恢复出厂设置');
  location.reload();
}

function clearLogs() {
  if (!confirm('确定清空所有操作日志？')) return;
  localStorage.removeItem(LOG_KEY);
  addLog('清空日志', '所有');
  renderTab('log');
}

function exportLogs() {
  const logs = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
  const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `操作日志_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
}

// ---- Tab 切换 ----
function renderTab(tab) {
  const settings = loadSettings();
  const content = document.getElementById('settingsContent');
  if (!content) return;
  const map = {
    'data': renderDataTab,
    'teaching': renderTeachingTab,
    'lesson': renderLessonTab,
    'score': renderScoreTab,
    'ui': renderUITab,
    'system': renderSystemTab,
    'log': renderLogTab
  };
  if (map[tab]) {
    content.innerHTML = map[tab](settings);
  }
  // 高亮按钮
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.style.background = btn.dataset.tab === tab ? '#4a6fa5' : '#6c757d';
  });
}

// ========== 初始化 ==========
function initSettings() {
  // Tab 切换
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', function() {
      renderTab(this.dataset.tab);
    });
  });

  // 应用当前设置
  const settings = loadSettings();
  applySettings(settings);

  // 日志：进入设置
  addLog('查看', '设置中心');
}

// ========== 暴露全局 ==========
window.renderSettings = renderSettings;
window.initSettings = initSettings;
window.renderTab = renderTab;
window.backupCategory = backupCategory;
window.backupAll = backupAll;
window.restoreCategory = restoreCategory;
window.showBackupList = showBackupList;
window.clearCategory = clearCategory;
window.exportAllData = exportAllData;
window.addGrade = addGrade;
window.removeGrade = removeGrade;
window.saveClasses = saveClasses;
window.updateSemester = updateSemester;
window.updateTemplate = updateTemplate;
window.updateScoreRange = updateScoreRange;
window.updateAlertThreshold = updateAlertThreshold;
window.updateSetting = updateSetting;
window.getStorageUsage = getStorageUsage;
window.getStoragePercent = getStoragePercent;
window.clearCache = clearCache;
window.checkUpdate = checkUpdate;
window.resetSettings = resetSettings;
window.resetAll = resetAll;
window.clearLogs = clearLogs;
window.exportLogs = exportLogs;
window.loadSettings = loadSettings;
window.saveSettings = saveSettings;
window.applySettings = applySettings;
window.addLog = addLog;