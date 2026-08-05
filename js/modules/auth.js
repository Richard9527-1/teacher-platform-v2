// js/modules/auth.js
// ============================================================
// 用户认证模块 - 独立管理
// ============================================================

const AUTH_USER_KEY = 'auth_users';
const AUTH_SESSION_KEY = 'auth_session';
const AUTH_INITIAL_PW_KEY = 'auth_initial_pw';

// 生成初始随机密码（仅首次初始化用，避免源码硬编码默认密码导致泄露即沦陷）
function genInitialPassword() {
  const s = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let pw = '';
  for (let i = 0; i < 8; i++) pw += s[Math.floor(Math.random() * s.length)];
  return pw;
}

// 会话令牌（不含密码，避免明文泄露）
function genSessionToken() {
  return 'tk_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

// ========== 默认管理员账户（密码不写死，首次初始化时随机生成） ==========
const DEFAULT_ADMIN = {
  username: 'admin',
  role: 'admin',
  createdAt: Date.now()
};

// ========== 初始化 ==========
function initAuth() {
  if (!localStorage.getItem(AUTH_USER_KEY)) {
    const initialPw = genInitialPassword();
    const admin = Object.assign({}, DEFAULT_ADMIN, { password: btoa(initialPw) });
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify([admin]));
    }
}
initAuth();

// ========== 用户管理 ==========
function getUsers() {
  return JSON.parse(localStorage.getItem(AUTH_USER_KEY) || '[]');
}

function saveUsers(users) {
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(users));
}

function findUser(username) {
  const users = getUsers();
  return users.find(u => u.username === username);
}

// ========== 登录 ==========
function authLogin(username, password) {
  const users = getUsers();
  const encoded = btoa(password);
  const user = users.find(u => u.username === username && u.password === encoded);
  
  if (user) {
    // 保存会话（不含密码，仅含令牌与时间戳，用于判断是否隔天）
    const session = {
      username: user.username,
      role: user.role,
      loginTime: Date.now(),
      loginDate: new Date().toDateString(), // 用于判断是否同一天
      token: genSessionToken()
    };
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    // 首次登录后清除初始密码提示
    try { localStorage.removeItem(AUTH_INITIAL_PW_KEY); } catch (e) {}
    return { success: true, user: { username: user.username, role: user.role } };
  }
  return { success: false, message: '用户名或密码错误' };
}

// ========== 获取当前登录用户 ==========
function getCurrentAuthUser() {
  const session = JSON.parse(localStorage.getItem(AUTH_SESSION_KEY) || 'null');
  if (!session) return null;
  
  // 验证用户是否存在
  const users = getUsers();
  const user = users.find(u => u.username === session.username && u.role === session.role);
  if (!user) return null;
  
  return {
    username: user.username,
    role: user.role,
    loginTime: session.loginTime,
    loginDate: session.loginDate
  };
}

// ========== 检查登录状态（是否有效） ==========
function checkAuthStatus() {
  const user = getCurrentAuthUser();
  if (!user) return { valid: false, reason: '未登录' };
  
  // 检查是否隔天（登录日期与当前日期不同）
  const today = new Date().toDateString();
  if (user.loginDate !== today) {
    // 隔天，需要重新登录
    authLogout();
    return { valid: false, reason: '已过期，请重新登录' };
  }
  
  return { valid: true, user: user };
}

// ========== 退出登录 ==========
function authLogout() {
  localStorage.removeItem(AUTH_SESSION_KEY);
}

// ========== 修改密码 ==========
function authChangePassword(username, oldPassword, newPassword) {
  const users = getUsers();
  const user = users.find(u => u.username === username);
  
  if (!user) {
    return { success: false, message: '用户不存在' };
  }
  
  if (btoa(oldPassword) !== user.password) {
    return { success: false, message: '原密码错误' };
  }
  
  if (newPassword.length < 4) {
    return { success: false, message: '新密码至少4位' };
  }
  
  user.password = btoa(newPassword);
  saveUsers(users);

  // 密码已改，清除初始密码提示（会话不含密码，无需更新）
  try { localStorage.removeItem(AUTH_INITIAL_PW_KEY); } catch (e) {}

  return { success: true, message: '密码修改成功' };
}

// ========== 管理员：添加用户 ==========
function authAddUser(username, password, role) {
  const users = getUsers();
  if (users.find(u => u.username === username)) {
    return { success: false, message: '用户名已存在' };
  }
  if (password.length < 4) {
    return { success: false, message: '密码至少4位' };
  }
  users.push({
    username: username,
    password: btoa(password),
    role: role || 'teacher',
    createdAt: Date.now()
  });
  saveUsers(users);
  return { success: true, message: '用户添加成功' };
}

// ========== 管理员：删除用户 ==========
function authDeleteUser(username) {
  if (username === 'admin') {
    return { success: false, message: '不能删除管理员' };
  }
  let users = getUsers();
  users = users.filter(u => u.username !== username);
  saveUsers(users);
  return { success: true, message: '用户已删除' };
}

// ========== 管理员：获取所有用户 ==========
function authGetAllUsers() {
  return getUsers().map(u => ({
    username: u.username,
    role: u.role,
    createdAt: u.createdAt
  }));
}

// ========== 检查是否为管理员 ==========
function authIsAdmin() {
  const user = getCurrentAuthUser();
  return user && user.role === 'admin';
}

// ========== 暴露到全局 ==========
window.authLogin = authLogin;
window.authLogout = authLogout;
window.authChangePassword = authChangePassword;
window.authAddUser = authAddUser;
window.authDeleteUser = authDeleteUser;
window.authGetAllUsers = authGetAllUsers;
window.authIsAdmin = authIsAdmin;
window.getCurrentAuthUser = getCurrentAuthUser;
window.checkAuthStatus = checkAuthStatus;
window.AUTH_SESSION_KEY = AUTH_SESSION_KEY;
window.AUTH_INITIAL_PW_KEY = AUTH_INITIAL_PW_KEY;