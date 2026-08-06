function renderDashboard() {
  return `
    <div class="card">
      <div class="panel-head">
        <h2 class="panel-title"><i class="fas fa-smile" style="color:#ffb74d;"></i> 欢迎使用语文智备Pro</h2>
        <span class="panel-sub">今天也祝您备课顺利！</span>
      </div>
      <div class="stat-grid">
        <div class="stat-item"><div class="num">4</div><div class="label">今日课程</div></div>
        <div class="stat-item"><div class="num">3</div><div class="label">待备课</div></div>
        <div class="stat-item"><div class="num">28</div><div class="label">待批作文</div></div>
        <div class="stat-item"><div class="num">1258</div><div class="label">资源数量</div></div>
      </div>
    </div>

    <div class="card">
      <div class="panel-head">
        <h2 class="panel-title"><i class="fas fa-clock"></i> 今日教学安排</h2>
        <span class="badge">更新于 2026-07-07</span>
      </div>
      <table class="schedule-table">
        <thead><tr><th>时间</th><th>班级</th><th>课程</th><th>状态</th></tr></thead>
        <tbody>
          <tr><td>08:00</td><td>高一（1）班</td><td>《劝学》</td><td><span class="status done">已完成</span></td></tr>
          <tr><td>10:00</td><td>高一（3）班</td><td>作文训练</td><td><span class="status ongoing">进行中</span></td></tr>
          <tr><td>14:00</td><td>高二（2）班</td><td>《阿房宫赋》</td><td><span class="status pending">未开始</span></td></tr>
          <tr><td>16:00</td><td>高三（5）班</td><td>高考阅读专题</td><td><span class="status pending">未开始</span></td></tr>
        </tbody>
      </table>
    </div>

    <div class="card">
      <div class="panel-head"><h2 class="panel-title"><i class="fas fa-bolt"></i> 快捷功能</h2></div>
      <div class="quick-grid">
        <div class="quick-item" data-module="lesson"><i class="fas fa-file-signature"></i><span>新建教案</span><span class="sub">快速创建教学设计</span></div>
        <div class="quick-item" data-module="essay"><i class="fas fa-edit"></i><span>作文批改</span><span class="sub">进入作文管理中心</span></div>
        <div class="quick-item" data-module="resource"><i class="fas fa-book"></i><span>教材资源</span><span class="sub">浏览课文、文言文、古诗词</span></div>
        <div class="quick-item" data-module="exam"><i class="fas fa-file-pdf"></i><span>智能组卷</span><span class="sub">生成课堂练习和试卷</span></div>
        <div class="quick-item" data-module="class"><i class="fas fa-user-graduate"></i><span>学生管理</span><span class="sub">查看班级和成绩</span></div>
        <div class="quick-item" data-module="settings"><i class="fas fa-cog"></i><span>系统设置</span><span class="sub">备份、恢复及主题设置</span></div>
      </div>
    </div>
  `;
}

function initDashboard() {
  document.querySelectorAll('.quick-item').forEach(item => {
    item.addEventListener('click', function() {
      const mod = this.dataset.module;
      if (mod && typeof showModule === 'function') {
        showModule(mod);
      }
    });
  });
}

renderDashboard.init = initDashboard;