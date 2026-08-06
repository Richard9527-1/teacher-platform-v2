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

// 应用版本信息（用于设置中心展示）
const APP_VERSION = '语文智备Pro v3.0';
const APP_UPDATE_DATE = '2026-07-08';

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
      <div class="panel-head"><h2 class="panel-title">⚙️ 设置中心</h2></div>
      <div class="settings-tabs">
        <button class="btn btn-secondary active" data-tab="data">📦 数据管理</button>
        <button class="btn btn-secondary" data-tab="teaching">📚 教学配置</button>
        <button class="btn btn-secondary" data-tab="lesson">📝 备课偏好</button>
        <button class="btn btn-secondary" data-tab="score">📊 成绩分析</button>
        <button class="btn btn-secondary" data-tab="ui">🎨 界面偏好</button>
        <button class="btn btn-secondary" data-tab="system">🖥️ 系统</button>
        <button class="btn btn-secondary" data-tab="log">📋 操作日志</button>
        <button class="btn btn-secondary" data-tab="help">❓ 帮助</button>
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
      <div style="background:var(--bg);padding:12px;border-radius:var(--radius-md);">
        <h4>💾 分类备份</h4>
        <div class="btn-group" style="margin:8px 0;">
          <button class="btn btn-sm" onclick="backupCategory('lessonTasks')">备课</button>
          <button class="btn btn-sm" onclick="backupCategory('classData')">班级</button>
          <button class="btn btn-sm" onclick="backupCategory('examData')">试卷</button>
          <button class="btn btn-sm" onclick="backupCategory('attendanceData')">考勤</button>
          <button class="btn btn-sm" onclick="backupCategory('scheduleData')">课程表</button>
          <button class="btn btn-sm btn-success" onclick="backupAll()">📦 全部</button>
        </div>
        <div style="font-size:0.8rem;color:var(--text-light);">备份文件: ${backupList.length} 个</div>
      </div>

      <!-- 分类恢复 -->
      <div style="background:var(--bg);padding:12px;border-radius:var(--radius-md);">
        <h4>📂 恢复数据</h4>
        <div class="btn-group" style="margin:8px 0;">
          <button class="btn btn-sm" onclick="restoreCategory()">从文件恢复</button>
          <button class="btn btn-sm btn-info" onclick="showBackupList()">📋 查看备份</button>
        </div>
        <div style="font-size:0.8rem;color:var(--text-light);">选择备份文件恢复对应数据</div>
      </div>

      <!-- 导出格式 -->
      <div style="background:var(--bg);padding:12px;border-radius:var(--radius-md);">
        <h4>📤 导出格式</h4>
        <select id="exportFormat" class="da-select" onchange="updateSetting('exportFormat',this.value)">
          <option value="json" ${settings.exportFormat==='json'?'selected':''}>JSON</option>
          <option value="excel" ${settings.exportFormat==='excel'?'selected':''}>Excel (.xlsx)</option>
        </select>
        <div style="margin-top:8px;">
          <button class="btn btn-sm btn-success" onclick="exportAllData()">📥 导出全部数据</button>
        </div>
      </div>

      <!-- 选择性清除 -->
      <div style="background:var(--bg);padding:12px;border-radius:var(--radius-md);">
        <h4>🗑️ 选择性清除</h4>
        <div class="btn-group" style="margin:8px 0;">
          <button class="btn btn-sm btn-danger" onclick="clearCategory('lessonTasks')">备课</button>
          <button class="btn btn-sm btn-danger" onclick="clearCategory('classData')">班级</button>
          <button class="btn btn-sm btn-danger" onclick="clearCategory('examData')">试卷</button>
          <button class="btn btn-sm btn-danger" onclick="clearCategory('attendanceData')">考勤</button>
          <button class="btn btn-sm btn-danger" onclick="clearCategory('scheduleData')">课程表</button>
        </div>
      </div>

      <!-- 自动备份 -->
      <div style="background:var(--bg);padding:12px;border-radius:var(--radius-md);grid-column:span 2;">
        <h4>🔄 自动备份</h4>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <label>
            <input type="checkbox" ${settings.autoBackup?'checked':''} onchange="updateSetting('autoBackup',this.checked)" />
            启用自动备份
          </label>
          <label>
            周期:
            <select class="da-select" onchange="updateSetting('backupInterval',parseInt(this.value))">
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
    <div class="settings-grid">

      <!-- 年级管理 -->
      <div class="settings-card">
        <h4>🏫 年级管理</h4>
        <div class="chip-row">
          ${grades.map(g => `<span class="chip">${g}<span class="chip-x" onclick="removeGrade('${g}')" title="删除年级">✕</span></span>`).join('')}
        </div>
        <div class="inline-form">
          <input type="text" id="newGradeInput" placeholder="新年级名称" />
          <button class="btn btn-sm" onclick="addGrade()">添加</button>
        </div>
        <p class="hint">班级请在左侧「班级管理」模块维护；此处的年级仅作为通用标签（用于备课/课程表的年级下拉）。</p>
      </div>

      <!-- 学期时间 -->
      <div class="settings-card span-2">
        <h4>📅 学期时间设置</h4>
        <div class="inline-form wrap">
          <label>开学日期 <input type="date" value="${settings.semester.start||''}" onchange="updateSemester('start',this.value)" /></label>
          <label>结束日期 <input type="date" value="${settings.semester.end||''}" onchange="updateSemester('end',this.value)" /></label>
          <label>考试周期 <input type="text" placeholder="期中/期末" value="${(settings.semester.examPeriods||[]).join('、')}" onchange="updateSemester('examPeriods',this.value.split('、').filter(Boolean))" /></label>
        </div>
        <p class="hint">联动备课截止日期和上课日期的默认值</p>
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
      <div style="background:var(--bg);padding:12px;border-radius:var(--radius-md);grid-column:span 2;">
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
      <div style="background:var(--bg);padding:12px;border-radius:var(--radius-md);">
        <h4>📖 教材展示设置</h4>
        <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px;">
          <label><input type="checkbox" ${settings.showTranslation?'checked':''} onchange="updateSetting('showTranslation',this.checked)" /> 默认显示译文</label>
          <label><input type="checkbox" ${settings.showNotes?'checked':''} onchange="updateSetting('showNotes',this.checked)" /> 默认显示注释</label>
          <label><input type="checkbox" ${settings.showExamPoints?'checked':''} onchange="updateSetting('showExamPoints',this.checked)" /> 默认显示考点</label>
        </div>
      </div>

      <!-- 素材存储路径 -->
      <div style="background:var(--bg);padding:12px;border-radius:var(--radius-md);">
        <h4>📁 素材存储</h4>
        <div style="font-size:0.85rem;color:var(--text-light);margin-top:8px;">
          <p>当前存储: localStorage（本地）</p>
          <p>已用空间: ${getStorageUsage()}</p>
          <p style="font-size:0.75rem;color:var(--text-light);">所有素材附件均存储在浏览器本地，建议定期备份。</p>
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
      <div style="background:var(--bg);padding:12px;border-radius:var(--radius-md);">
        <h4>📊 分数区间自定义</h4>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px;">
          <label>优秀 ≥ <input type="number" value="${settings.scoreRanges.excellent||90}" onchange="updateScoreRange('excellent',parseInt(this.value))" style="width:60px;padding:2px 4px;border-radius:4px;border:1px solid #ddd;background:var(--bg);color:var(--text);" /></label>
          <label>良好 ≥ <input type="number" value="${settings.scoreRanges.good||80}" onchange="updateScoreRange('good',parseInt(this.value))" style="width:60px;padding:2px 4px;border-radius:4px;border:1px solid #ddd;background:var(--bg);color:var(--text);" /></label>
          <label>及格 ≥ <input type="number" value="${settings.scoreRanges.pass||60}" onchange="updateScoreRange('pass',parseInt(this.value))" style="width:60px;padding:2px 4px;border-radius:4px;border:1px solid #ddd;background:var(--bg);color:var(--text);" /></label>
        </div>
      </div>

      <!-- 预警阈值 -->
      <div style="background:var(--bg);padding:12px;border-radius:var(--radius-md);">
        <h4>⚠️ 预警阈值设置</h4>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px;">
          <label>成绩下滑 ≥ <input type="number" value="${settings.alertThresholds.scoreDrop||10}" onchange="updateAlertThreshold('scoreDrop',parseInt(this.value))" style="width:60px;padding:2px 4px;border-radius:4px;border:1px solid #ddd;background:var(--bg);color:var(--text);" /> 分</label>
          <label>缺勤 ≥ <input type="number" value="${settings.alertThresholds.absenceCount||3}" onchange="updateAlertThreshold('absenceCount',parseInt(this.value))" style="width:60px;padding:2px 4px;border-radius:4px;border:1px solid #ddd;background:var(--bg);color:var(--text);" /> 次</label>
        </div>
        <div style="margin-top:6px;font-size:0.85rem;color:var(--text-light);">超过阈值自动触发预警提醒</div>
      </div>

      <!-- 报表样式已移除（无对应导出逻辑消费，属死字段） -->
      <div style="background:var(--bg);padding:12px;border-radius:var(--radius-md);grid-column:span 2;">
        <h4>📄 报表导出</h4>
        <p class="hint">成绩与试卷报表将沿用系统默认排版导出；如需自定义报表样式，可在对应模块提出。</p>
      </div>
    </div>
  `;
}

// ========== 五、界面与通用偏好 ==========
function renderUITab(settings) {
  return `
    <h3>🎨 界面与通用偏好</h3>
    <div class="settings-grid cols-3">

      <div class="settings-card">
        <h4>🎨 主题切换</h4>
        <div class="btn-group">
          <button class="btn btn-secondary ${settings.theme==='light'?'active':''}" onclick="updateSetting('theme','light');renderTab('ui');">☀️ 浅色</button>
          <button class="btn btn-secondary ${settings.theme==='dark'?'active':''}" onclick="updateSetting('theme','dark');renderTab('ui');">🌙 深色</button>
        </div>
      </div>

      <div class="settings-card">
        <h4>📋 默认视图</h4>
        <div class="btn-group">
          <button class="btn btn-secondary ${settings.defaultView==='list'?'active':''}" onclick="updateSetting('defaultView','list');location.reload();">📋 列表</button>
          <button class="btn btn-secondary ${settings.defaultView==='kanban'?'active':''}" onclick="updateSetting('defaultView','kanban');location.reload();">📊 看板</button>
        </div>
      </div>

      <div class="settings-card">
        <h4>🔤 字体大小</h4>
        <div class="btn-group">
          <button class="btn btn-secondary ${settings.fontSize==='small'?'active':''}" onclick="updateSetting('fontSize','small');renderTab('ui');">小</button>
          <button class="btn btn-secondary ${settings.fontSize==='medium'?'active':''}" onclick="updateSetting('fontSize','medium');renderTab('ui');">中</button>
          <button class="btn btn-secondary ${settings.fontSize==='large'?'active':''}" onclick="updateSetting('fontSize','large');renderTab('ui');">大</button>
        </div>
      </div>

      <div class="settings-card">
        <h4>📂 侧边栏</h4>
        <div class="btn-group">
          <button class="btn btn-secondary ${!settings.sidebarCollapsed?'active':''}" onclick="updateSetting('sidebarCollapsed',false);renderTab('ui');">展开</button>
          <button class="btn btn-secondary ${settings.sidebarCollapsed?'active':''}" onclick="updateSetting('sidebarCollapsed',true);renderTab('ui');">收起</button>
        </div>
      </div>

      <div class="settings-card span-2">
        <h4>🔔 通知弹窗</h4>
        <div class="inline-form">
          <label><input type="checkbox" ${settings.notificationsEnabled!==false?'checked':''} onchange="updateSetting('notificationsEnabled',this.checked)" /> 启用通知</label>
          <span class="hint">任务到期、学情异常时弹出提醒</span>
        </div>
      </div>
    </div>
  `;
}

// ========== 六、系统 ==========

// 账户安全：单机公开分发版「打开即用」，无登录拦截，修改密码入口已移除。
// 若未来接入 auth.js 的真实账号体系，可在此恢复 renderAccountTab / handleChangePassword。

function renderSystemTab(settings) {
  const logs = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
  return `
    <h3>🖥️ 系统与本地存储</h3>
    <div class="settings-grid">

      <div class="settings-card">
        <h4>💾 存储占用</h4>
        <div class="storage-bar-wrap">
          <div class="storage-bar-row">
            <span>已用空间</span>
            <span id="storageUsed">${getStorageUsage()}</span>
          </div>
          <div class="storage-bar"><div class="storage-bar-fill" style="width:${getStoragePercent()}%"></div></div>
          <div class="storage-bar-scale"><span>0 MB</span><span id="storageLimit">~10 MB</span></div>
        </div>
        <p class="hint">数据保存在浏览器本地（localStorage），建议定期备份。</p>
      </div>

      <div class="settings-card">
        <h4>📌 版本信息</h4>
        <p>当前版本: <strong>${APP_VERSION}</strong></p>
        <p>上次更新: ${APP_UPDATE_DATE}</p>
        <button class="btn btn-sm" onclick="checkUpdate()">🔄 检查更新</button>
      </div>

      <div class="settings-card">
        <h4>🔄 重置系统</h4>
        <div class="btn-group wrap">
          <button class="btn btn-sm btn-warning" onclick="resetSettings()">重置设置</button>
          <button class="btn btn-sm btn-danger" onclick="resetAll()">⚠️ 恢复出厂</button>
        </div>
        <p class="hint">重置设置不影响业务数据，恢复出厂将清除所有数据。</p>
      </div>

      <div class="settings-card span-2">
        <h4>📋 操作日志（最近10条）</h4>
        <div class="log-list">
          ${logs.slice(0,10).map(log =>
            `<div class="log-item">
              <span>${log.action} ${log.detail||''}</span>
              <span class="log-time">${new Date(log.time).toLocaleString()}</span>
            </div>`
          ).join('') || '<div class="hint">暂无操作记录</div>'}
        </div>
        <button class="btn btn-sm btn-danger" onclick="clearLogs()">清空日志</button>
      </div>
    </div>
  `;
}

// ========== 操作日志 Tab ==========
function renderLogTab(settings) {
  const logs = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
  return `
    <h3>📋 完整操作日志</h3>
    <div style="background:var(--bg);padding:12px;border-radius:var(--radius-md);max-height:500px;overflow-y:auto;">
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
      <button class="btn btn-danger" onclick="clearLogs()">清空所有日志</button>
      <button class="btn btn-success" onclick="exportLogs()">导出日志</button>
    </div>
  `;
}

// ========== 帮助与关于 ==========
function renderHelpTab(settings) {
  return `
    <h3>❓ 帮助与关于</h3>
    <div class="settings-grid">
      <div class="settings-card span-2">
        <h4>📌 关于本应用</h4>
        <p>版本：<strong>${APP_VERSION}</strong>（更新于 ${APP_UPDATE_DATE}）</p>
        <p>面向高中语文教师的备课与班级管理工具，纯前端 PWA，数据保存在本机浏览器。</p>
      </div>
      <div class="settings-card">
        <h4>💾 数据备份建议</h4>
        <ul class="help-list">
          <li>在「数据管理」中可分类备份/恢复，或导出全部数据为 JSON。</li>
          <li>建议开启自动备份（按周期自动留存历史备份）。</li>
          <li>更换设备或浏览器前，务必先「导出全部数据」。</li>
        </ul>
        <button class="btn btn-sm" onclick="restoreCategory()">📂 从备份恢复数据</button>
      </div>
      <div class="settings-card">
        <h4>🔄 数据迁移向导</h4>
        <p class="hint">旧版本或他处导出的备份文件，可点上方「从备份恢复数据」一键导入；分类备份会保留多个历史版本。</p>
      </div>
      <div class="settings-card span-2">
        <h4>⌨️ 使用提示</h4>
        <ul class="help-list">
          <li>顶部搜索框可快速检索课文、班级、备课与待办。</li>
          <li>教材详情页支持全文/拼音/注释/译文/讲解/赏析/考点切换与语音朗读。</li>
          <li>工作台首页可查看当日剩余课程、备课与待办。</li>
        </ul>
      </div>
    </div>
  `;
}

// ========== 自动备份（由 app.js 启动时调用） ==========
function runAutoBackupIfNeeded() {
  const s = loadSettings();
  if (!s.autoBackup) return;
  const last = parseInt(localStorage.getItem('lastAutoBackup') || '0', 10);
  const intervalMs = (s.backupInterval || 7) * 86400000;
  if (Date.now() - last < intervalMs) return;
  const keys = ['lessonTasks', 'classData', 'examData', 'attendanceData', 'scheduleData'];
  const nameMap = { lessonTasks: '备课', classData: '班级', examData: '试卷', attendanceData: '考勤', scheduleData: '课程表' };
  const backups = JSON.parse(localStorage.getItem(BACKUP_KEY) || '[]');
  const stamp = new Date().toISOString();
  keys.forEach(k => {
    const data = localStorage.getItem(k);
    if (data) backups.push({ id: Date.now().toString(36) + '_' + k, key: k, name: nameMap[k] || k, data, time: stamp, auto: true });
  });
  while (backups.length > 50) backups.shift();
  localStorage.setItem(BACKUP_KEY, JSON.stringify(backups));
  localStorage.setItem('lastAutoBackup', String(Date.now()));
  addLog('自动备份', '已完成');
}

// ========== 备份列表（UI 化，替代 alert/prompt） ==========
function restoreBackupByIdx(idx) {
  const backups = JSON.parse(localStorage.getItem(BACKUP_KEY) || '[]');
  const b = backups[idx];
  if (!b) return;
  if (!confirm(`确定恢复备份「${b.name}」？当前对应数据将被覆盖。`)) return;
  localStorage.setItem(b.key, b.data);
  addLog('恢复', `${b.name} (${b.key})`);
  alert(`✅ ${b.name} 已恢复`);
  location.reload();
}

function deleteBackupByIdx(idx) {
  const backups = JSON.parse(localStorage.getItem(BACKUP_KEY) || '[]');
  if (!confirm('确定删除该备份？')) return;
  backups.splice(idx, 1);
  localStorage.setItem(BACKUP_KEY, JSON.stringify(backups));
  addLog('删除备份', '');
  showBackupList();
}

window.runAutoBackupIfNeeded = runAutoBackupIfNeeded;
window.restoreBackupByIdx = restoreBackupByIdx;
window.deleteBackupByIdx = deleteBackupByIdx;

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
  const content = document.getElementById('settingsContent');
  if (!content) return;
  content.innerHTML = `
    <h3>📋 备份列表（${backups.length}）</h3>
    <div class="settings-grid">
      <div class="settings-card span-2">
        ${backups.length === 0
          ? '<p class="hint">暂无备份记录，可在「数据管理」中创建分类或全量备份。</p>'
          : `<div class="backup-list">` + backups.slice().reverse().map((b, i) => {
              const idx = backups.length - 1 - i;
              return `<div class="backup-item">
                <div class="backup-meta"><strong>${b.name}</strong> <span class="hint">${new Date(b.time).toLocaleString()}</span>${b.auto ? ' <span class="tag-auto">自动</span>' : ''}</div>
                <div class="btn-group">
                  <button class="btn btn-sm" onclick="restoreBackupByIdx(${idx})">恢复</button>
                  <button class="btn btn-sm btn-danger" onclick="deleteBackupByIdx(${idx})">删除</button>
                </div>
              </div>`;
            }).join('') + `</div>`
        }
        <button class="btn btn-sm" onclick="renderTab('data')" style="margin-top:8px;">← 返回数据管理</button>
      </div>
    </div>
  `;
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
  const date = new Date().toISOString().slice(0, 10);
  // Excel 模式：用已内置的 SheetJS 生成真实 .xlsx（每个分类一个 sheet，内容为对应 JSON 文本，可再导入）
  if (format === 'excel' && typeof XLSX !== 'undefined') {
    const wb = XLSX.utils.book_new();
    const sheets = { '备课': data.lessonTasks, '班级': data.classData, '试卷': data.examData, '考勤': data.attendanceData, '课程表': data.scheduleData };
    Object.keys(sheets).forEach(name => {
      const val = sheets[name];
      const arr = Array.isArray(val) ? val : [val];
      const ws = XLSX.utils.json_to_sheet(arr.map(r => ({ '数据(JSON)': JSON.stringify(r) })));
      XLSX.utils.book_append_sheet(wb, ws, name);
    });
    XLSX.writeFile(wb, `全部数据_${date}.xlsx`);
    addLog('导出', '全部数据(Excel)');
    alert('✅ 数据已导出为 Excel');
    return;
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `全部数据_${date}.json`;
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
  saveSettings(settings);
  addLog('添加年级', name);
  input.value = '';
  renderTab('teaching');
}

function removeGrade(grade) {
  if (!confirm(`确定删除 ${grade} 吗？`)) return;
  const settings = loadSettings();
  settings.grades = settings.grades.filter(g => g !== grade);
  saveSettings(settings);
  addLog('删除年级', grade);
  renderTab('teaching');
}

// saveClasses：班级统一由「班级管理」模块（class-data.js）维护，设置中的班级编辑已移除。

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

// 缓存清理：当前版本图片/附件均不持久化到 localStorage，无本地缓存可清，功能已下线。

function checkUpdate() {
  alert(`当前版本：${APP_VERSION}\n更新日期：${APP_UPDATE_DATE}\n\n本应用为 GitHub Pages 静态分发版，暂不支持在线更新；\n获取新版本请从仓库拉取最新文件覆盖本地。`);
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
    'log': renderLogTab,
    'help': renderHelpTab
  };
  if (map[tab]) {
    content.innerHTML = map[tab](settings);
  }
  // 高亮按钮：用 active 类切换（统一主色 / 暗色自动适配）
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
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
// window.saveClasses 已移除（班级统一由「班级管理」模块维护）
window.updateSemester = updateSemester;
window.updateTemplate = updateTemplate;
window.updateScoreRange = updateScoreRange;
window.updateAlertThreshold = updateAlertThreshold;
window.updateSetting = updateSetting;
window.getStorageUsage = getStorageUsage;
window.getStoragePercent = getStoragePercent;
// window.clearCache 已移除（缓存清理为无效空壳，功能下线）
window.checkUpdate = checkUpdate;
window.resetSettings = resetSettings;
window.resetAll = resetAll;
window.clearLogs = clearLogs;
window.exportLogs = exportLogs;
window.loadSettings = loadSettings;
window.saveSettings = saveSettings;
window.applySettings = applySettings;
window.addLog = addLog;