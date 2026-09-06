/** 本地用户与简历仓库（基于 localStorage） */
const ResumeDB = (function () {
  const DB_KEY = 'resume_witch_db_v1';
  const SESSION_KEY = 'resume_witch_session';

  function readDB() {
    try {
      const data = JSON.parse(localStorage.getItem(DB_KEY) || '{"users":{}}');
      return data && data.users && typeof data.users === 'object' ? data : { users: {} };
    } catch { return { users: {} }; }
  }
  function writeDB(data) { localStorage.setItem(DB_KEY, JSON.stringify(data)); }
  function normalizePhone(phone) { return String(phone || '').replace(/\D/g, ''); }
  function isValidPhone(phone) { return /^1\d{10}$/.test(normalizePhone(phone)); }
  function getUser(phone) { return readDB().users[normalizePhone(phone)] || null; }
  function worksOf(user) { if (!Array.isArray(user.saved_resumes)) user.saved_resumes = []; return user.saved_resumes; }
  function newWorkId() { return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`; }

  function loginOrRegister(username, phone) {
    const name = String(username || '').trim();
    const phoneKey = normalizePhone(phone);
    if (!name) return { ok: false, error: '请输入用户名' };
    if (!isValidPhone(phoneKey)) return { ok: false, error: '请输入正确的 11 位手机号' };
    const db = readDB();
    const existing = db.users[phoneKey];
    if (!existing) {
      const user = { username: name, phone: phoneKey, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), resume: null, saved_resumes: [] };
      db.users[phoneKey] = user;
      writeDB(db);
      setSession(phoneKey);
      return { ok: true, user, isNew: true };
    }
    if (existing.username !== name) return { ok: false, error: `该手机号已注册用户「${existing.username}」，请使用正确用户名登录` };
    setSession(phoneKey);
    return { ok: true, user: existing, isNew: false };
  }

  function saveResume(phone, resume) {
    const db = readDB();
    const user = db.users[normalizePhone(phone)];
    if (!user) return { ok: false, error: '用户不存在' };
    user.resume = resume;
    user.updatedAt = new Date().toISOString();
    writeDB(db);
    return { ok: true, user };
  }
  function listResumes(phone) {
    const user = getUser(phone);
    return user ? worksOf(user).slice().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)) : [];
  }
  function loadResume(phone) { const user = getUser(phone); return user ? user.resume : null; }
  function listUsers() { return Object.values(readDB().users); }
  function addResumeWork(phone, name, resume) {
    const db = readDB();
    const user = db.users[normalizePhone(phone)];
    const cleanName = String(name || '').trim();
    if (!user) return { ok: false, error: '用户不存在' };
    if (!cleanName) return { ok: false, error: '请输入简历名称' };
    const now = new Date().toISOString();
    const work = { id: newWorkId(), name: cleanName, createdAt: now, updatedAt: now, resume };
    worksOf(user).push(work);
    user.updatedAt = now;
    writeDB(db);
    return { ok: true, work };
  }
  function deleteResumeWork(phone, workId) {
    const db = readDB();
    const user = db.users[normalizePhone(phone)];
    if (!user) return { ok: false, error: '用户不存在' };
    const list = worksOf(user);
    const index = list.findIndex((work) => work.id === workId);
    if (index < 0) return { ok: false, error: '简历不存在' };
    list.splice(index, 1);
    user.updatedAt = new Date().toISOString();
    writeDB(db);
    return { ok: true };
  }
  function updateResumeWork(phone, workId, patch) {
    const db = readDB();
    const user = db.users[normalizePhone(phone)];
    if (!user) return { ok: false, error: '用户不存在' };
    const work = worksOf(user).find((entry) => entry.id === workId);
    if (!work) return { ok: false, error: '简历不存在' };
    if (typeof patch?.name === 'string') {
      const name = patch.name.trim();
      if (!name) return { ok: false, error: '简历名称不能为空' };
      work.name = name;
    }
    if (patch?.resume !== undefined) work.resume = patch.resume;
    work.updatedAt = new Date().toISOString();
    user.updatedAt = work.updatedAt;
    writeDB(db);
    return { ok: true, work };
  }
  function setSession(phone) { sessionStorage.setItem(SESSION_KEY, normalizePhone(phone)); }
  function getSession() { const phone = sessionStorage.getItem(SESSION_KEY); return phone ? getUser(phone) : null; }
  function logout() { sessionStorage.removeItem(SESSION_KEY); }

  return { loginOrRegister, saveResume, loadResume, listUsers, listResumes, addResumeWork, updateResumeWork, deleteResumeWork, getUser, getSession, logout, isValidPhone, normalizePhone };
})();
