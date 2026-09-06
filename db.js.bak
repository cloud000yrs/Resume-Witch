/**
 * 本地用户数据库（基于 localStorage）
 * 以手机号为唯一标识，保存用户信息与最后一次简历内容
 */
const ResumeDB = (function () {
  const DB_KEY = 'resume_witch_db_v1';
  const SESSION_KEY = 'resume_witch_session';

  function readDB() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (!raw) return { users: {} };
      const data = JSON.parse(raw);
      if (!data.users || typeof data.users !== 'object') return { users: {} };
      return data;
    } catch {
      return { users: {} };
    }
  }

  function writeDB(data) {
    localStorage.setItem(DB_KEY, JSON.stringify(data));
  }

  function normalizePhone(phone) {
    return String(phone || '').replace(/\D/g, '');
  }

  function isValidPhone(phone) {
    return /^1\d{10}$/.test(normalizePhone(phone));
  }

  function getUser(phone) {
    const key = normalizePhone(phone);
    return readDB().users[key] || null;
  }

  function listUsers() {
    return Object.values(readDB().users);
  }

  /**
   * 登录或注册
   * - 手机号不存在：自动注册
   * - 手机号存在且用户名一致：登录
   * - 手机号存在但用户名不同：报错
   */
  function loginOrRegister(username, phone) {
    const name = String(username || '').trim();
    const phoneKey = normalizePhone(phone);

    if (!name) {
      return { ok: false, error: '请输入用户名' };
    }
    if (!isValidPhone(phoneKey)) {
      return { ok: false, error: '请输入正确的 11 位手机号' };
    }

    const db = readDB();
    const existing = db.users[phoneKey];

    if (!existing) {
      const user = {
        username: name,
        phone: phoneKey,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        resume: null,
      };
      db.users[phoneKey] = user;
      writeDB(db);
      setSession(phoneKey);
      return { ok: true, user, isNew: true };
    }

    if (existing.username !== name) {
      return {
        ok: false,
        error: `该手机号已注册用户「${existing.username}」，请使用正确用户名登录`,
      };
    }

    setSession(phoneKey);
    return { ok: true, user: existing, isNew: false };
  }

  function saveResume(phone, resumeSnapshot) {
    const phoneKey = normalizePhone(phone);
    const db = readDB();
    const user = db.users[phoneKey];
    if (!user) return { ok: false, error: '用户不存在' };

    user.resume = resumeSnapshot;
    user.updatedAt = new Date().toISOString();
    db.users[phoneKey] = user;
    writeDB(db);
    return { ok: true, user };
  }

  function loadResume(phone) {
    const user = getUser(phone);
    return user ? user.resume : null;
  }

  function setSession(phone) {
    sessionStorage.setItem(SESSION_KEY, normalizePhone(phone));
  }

  function getSession() {
    const phone = sessionStorage.getItem(SESSION_KEY);
    if (!phone) return null;
    return getUser(phone);
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function logout() {
    clearSession();
  }

  return {
    loginOrRegister,
    saveResume,
    loadResume,
    getUser,
    getSession,
    logout,
    listUsers,
    isValidPhone,
    normalizePhone,
  };
})();
