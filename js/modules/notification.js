// js/modules/notification.js
// ============================================================
// 系统通知模块
// ============================================================

const NOTIFICATION_KEY = 'appNotifications';

// ===== 加载通知 =====
function loadNotifications() {
  return JSON.parse(localStorage.getItem(NOTIFICATION_KEY) || '[]');
}

function saveNotifications(notifications) {
  localStorage.setItem(NOTIFICATION_KEY, JSON.stringify(notifications));
}

// ===== 生成通知（自动检测） =====
function generateNotifications() {
  const notifications = [];
  const tasks = JSON.parse(localStorage.getItem('lessonTasks') || '[]');
  const today = new Date().toISOString().slice(0, 10);
  
  // 1. 即将上课提醒（红色报警）
  try {
    const { next } = getTodayRemaining();
    if (next) {
      const now = new Date();
      const [h, m] = next.time.split(':').map(Number);
      const classTime = new Date();
      classTime.setHours(h, m, 0, 0);
      const diff = (classTime - now) / 1000 / 60;
      if (diff > 0 && diff <= 5) {
        notifications.push({
          id: 'class_soon_' + Date.now(),
          type: 'danger',
          title: '🔴 即将上课！',
          content: `${next.subject || '语文'} · ${next.text} 将在 ${next.time} 开始，请做好准备！`,
          time: next.time,
          read: false,
          createdAt: Date.now()
        });
      }
    }
  } catch(e) {}
  
  // 2. 逾期任务
  const overdue = tasks.filter(t => 
    !t.archived && 
    t.status !== '已完成' && 
    t.deadline && 
    t.deadline < today
  );
  overdue.forEach(t => {
    notifications.push({
      id: 'overdue_' + t.id,
      type: 'warning',
      title: '⚠️ 任务已逾期',
      content: `《${t.title}》原定于 ${t.deadline} 完成，请及时处理！`,
      time: t.deadline,
      read: false,
      createdAt: Date.now()
    });
  });
  
  // 3. 今日截止任务
  const dueToday = tasks.filter(t => 
    !t.archived && 
    t.status !== '已完成' && 
    t.deadline === today
  );
  dueToday.forEach(t => {
    notifications.push({
      id: 'due_today_' + t.id,
      type: 'info',
      title: '📋 今日截止',
      content: `《${t.title}》今天截止，请尽快完成备课！`,
      time: t.deadline,
      read: false,
      createdAt: Date.now()
    });
  });
  
  // 按时间排序（最新的在前）
  notifications.sort((a, b) => b.createdAt - a.createdAt);

  // 保存到 localStorage
  if (notifications.length > 0) {
    saveNotifications(notifications);
  }
  return notifications;
}


// ===== 渲染通知列表 =====
function renderNotification() {
  // 进入页面时自动生成最新通知
  const notifications = autoCheckNotifications();
  const unread = notifications.filter(n => !n.read).length;
  
  let html = `
    <div class="card">
      <h2>🔔 系统通知</h2>
      <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;align-items:center;">
        <div style="background:var(--bg);padding:8px 16px;border-radius:8px;">
          <span style="font-weight:700;font-size:1.2rem;color:${unread > 0 ? '#dc3545' : '#4a6fa5'};">${unread}</span>
          <span style="color:var(--text-light);"> 条未读</span>
        </div>
        <button class="btn" id="markAllReadBtn" style="background:#4a6fa5;">全部标记已读</button>
        <button class="btn" id="clearNotificationsBtn" style="background:#6c757d;">清空通知</button>
        <button class="btn" style="background:#28a745;" id="refreshNotificationsBtn" onclick="refreshNotifications()">🔄 刷新</button>
      </div>
      <div id="notificationList">
        ${renderNotificationList(notifications)}
      </div>
    </div>
  `;
  return html;
}

// ===== 刷新通知 =====
// ===== 刷新通知（带反馈） =====
function refreshNotifications() {
  const btn = document.querySelector('#refreshNotificationsBtn');
  // 按钮反馈
  if (btn) {
    btn.textContent = '⏳ 刷新中...';
    btn.style.opacity = '0.7';
    btn.disabled = true;
  }
  
  // 模拟延迟，让用户看到反馈
  setTimeout(function() {
    const notifications = autoCheckNotifications();
    const listEl = document.getElementById('notificationList');
    if (listEl) {
      listEl.innerHTML = renderNotificationList(notifications);
    }
    // 更新未读数量
    const unread = notifications.filter(n => !n.read).length;
    const countEl = document.querySelector('.notification-count');
    if (countEl) {
      countEl.textContent = unread;
      countEl.style.color = unread > 0 ? '#dc3545' : '#4a6fa5';
    }
    // 更新工作台角标
    updateNotificationBadge();
    
    // 恢复按钮
    if (btn) {
      btn.textContent = '🔄 刷新';
      btn.style.opacity = '1';
      btn.disabled = false;
    }
    
    // 显示提示
    showToast('✅ 已刷新，共 ' + notifications.length + ' 条通知');
    console.log('✅ 通知已刷新');
  }, 300);
}

// ===== 轻提示（Toast） =====
function showToast(message) {
  // 移除旧的toast
  const oldToast = document.querySelector('.toast-message');
  if (oldToast) oldToast.remove();
  
  const toast = document.createElement('div');
  toast.className = 'toast-message';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%);
    background: #28a745;
    color: #fff;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 0.95rem;
    z-index: 9999;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    animation: fadeInUp 0.3s ease;
  `;
  document.body.appendChild(toast);
  
  setTimeout(function() {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.5s';
    setTimeout(function() { toast.remove(); }, 500);
  }, 2000);
}

// ===== 暴露到全局 =====
window.refreshNotifications = refreshNotifications;

// ===== 渲染通知列表 =====
function renderNotificationList(notifications) {
  if (notifications.length === 0) {
    return '<p style="color:#7f8c8d;text-align:center;padding:30px;">暂无通知 🎉</p>';
  }
  
  let html = '<div style="display:flex;flex-direction:column;gap:8px;">';
  notifications.forEach(n => {
    const bgColor = n.type === 'danger' ? '#f8d7da' : (n.type === 'warning' ? '#fff3cd' : '#d1ecf1');
    const borderColor = n.type === 'danger' ? '#dc3545' : (n.type === 'warning' ? '#ffc107' : '#17a2b8');
    const textColor = n.type === 'danger' ? '#721c24' : (n.type === 'warning' ? '#856404' : '#0c5460');
    const isUnread = !n.read;
    html += `
      <div style="background:${bgColor};border-left:4px solid ${borderColor};padding:12px 16px;border-radius:8px;display:flex;justify-content:space-between;align-items:center;${isUnread ? 'font-weight:500;' : 'opacity:0.7;'}">
        <div style="flex:1;">
          <div style="font-weight:600;">${n.title}</div>
          <div style="font-size:0.9rem;color:${textColor};">${n.content}</div>
          <div style="font-size:0.8rem;color:var(--text-light);margin-top:4px;">${n.time || ''}</div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          ${isUnread ? `<button onclick="markNotificationRead('${n.id}')" style="background:none;border:none;color:#4a6fa5;cursor:pointer;font-size:0.8rem;">已读</button>` : ''}
        </div>
      </div>
    `;
  });
  html += '</div>';
  return html;
}

// ===== 标记已读 =====
function markNotificationRead(id) {
  const notifications = JSON.parse(localStorage.getItem(NOTIFICATION_KEY) || '[]');
  const n = notifications.find(item => item.id === id);
  if (n) n.read = true;
  saveNotifications(notifications);
  refreshNotificationView();
}

// ===== 全部标记已读 =====
function markAllRead() {
  const notifications = JSON.parse(localStorage.getItem(NOTIFICATION_KEY) || '[]');
  notifications.forEach(n => n.read = true);
  saveNotifications(notifications);
  refreshNotificationView();
}

// ===== 清空通知 =====
function clearNotifications() {
  if (!confirm('确认清空所有通知？')) return;
  saveNotifications([]);
  refreshNotificationView();
}

// ===== 刷新视图 =====
function refreshNotificationView() {
  const container = document.getElementById('notificationList');
  if (container) {
    const notifications = generateNotifications();
    container.innerHTML = renderNotificationList(notifications);
  }
  // 更新工作台通知数量
  const countEl = document.getElementById('notificationCount');
  if (countEl) {
    const unread = generateNotifications().filter(n => !n.read).length;
    countEl.textContent = unread;
    countEl.style.color = unread > 0 ? '#dc3545' : '#4a6fa5';
  }
}

// ===== 初始化 =====
function initNotification() {
  document.getElementById('markAllReadBtn').addEventListener('click', markAllRead);
  document.getElementById('clearNotificationsBtn').addEventListener('click', clearNotifications);
  // 刷新按钮
  const refreshBtn = document.getElementById('refreshNotificationsBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', function() {
      autoCheckNotifications();
      refreshNotificationView();
    });
  }
}

// ===== 暴露到全局 =====
window.renderNotification = renderNotification;
window.initNotification = initNotification;
window.markNotificationRead = markNotificationRead;
window.markAllRead = markAllRead;
window.clearNotifications = clearNotifications;
window.refreshNotificationView = refreshNotificationView;
window.generateNotifications = generateNotifications;

// ===== 自动检查并生成通知 =====
function autoCheckNotifications() {
  // 生成通知
  const notifications = generateNotifications();
  // 保存到 localStorage
  saveNotifications(notifications);
  // 更新工作台通知数量
  updateNotificationBadge();
  return notifications;
}

// ===== 更新工作台通知角标 =====
function updateNotificationBadge() {
  const notifications = loadNotifications();
  const unread = notifications.filter(n => !n.read).length;
  const countEl = document.getElementById('notificationCount');
  if (countEl) {
    countEl.textContent = unread;
    countEl.style.color = unread > 0 ? '#dc3545' : '#4a6fa5';
    const labelEl = document.querySelector('#notificationStat .sub-info');
    if (labelEl) {
      labelEl.textContent = unread > 0 ? '🔴 有未读通知' : '✅ 暂无通知';
    }
  }
}

// ===== 暴露新函数 =====
window.autoCheckNotifications = autoCheckNotifications;
window.updateNotificationBadge = updateNotificationBadge;