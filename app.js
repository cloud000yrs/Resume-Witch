(function () {
  let entryIdCounter = 0;
  let activeFormType = null;
  let editingEntryId = null;
  let draggedEntryId = null;
  let dragSource = null; // 'pool' | section key
  let dropTargetEntryId = null;
  let dropInsertBefore = false;
  let justDragged = false;
  let activePoolFilter = 'all';
  let activePoolLang = 'zh';
  let resumeLanguage = 'zh';
  let formPeriod = { start: null, end: null }; // 表单中起止时间（年月）

  const DEFAULT_SECTION_ORDER = ['education', 'internship', 'projects', 'clubs', 'skills', 'hobbies'];
  let sectionOrder = [...DEFAULT_SECTION_ORDER];

  const sectionConfigs = {
    education: {
      label: '教育背景',
      fields: [
        { key: 'school', label: '学校', placeholder: 'XX大学', required: true },
        { key: 'major', label: '专业', placeholder: '计算机科学与技术' },
        { key: 'degree', label: '学历', placeholder: '本科' },
        { key: 'period', label: '起止时间', placeholder: '2020.09 - 2024.06' },
      ],
      textarea: { key: 'details', label: '补充说明', placeholder: '每行一条，如荣誉、课程等' },
    },
    internship: {
      label: '实习经历',
      fields: [
        { key: 'company', label: '公司', placeholder: 'XX科技有限公司', required: true },
        { key: 'role', label: '职位', placeholder: '前端开发实习生' },
        { key: 'period', label: '起止时间', placeholder: '2023.06 - 2023.09' },
      ],
      textarea: { key: 'details', label: '工作内容', placeholder: '每行一条' },
    },
    projects: {
      label: '项目经历',
      fields: [
        { key: 'name', label: '项目名称', placeholder: '简历生成器', required: true },
        { key: 'role', label: '担任角色', placeholder: '负责人' },
        { key: 'period', label: '起止时间', placeholder: '2024.01 - 2024.03' },
      ],
      textarea: { key: 'details', label: '项目描述', placeholder: '每行一条' },
    },
    clubs: {
      label: '社团经历',
      fields: [
        { key: 'org', label: '社团名称', placeholder: 'XX社团', required: true },
        { key: 'role', label: '担任职位', placeholder: '部长 / 干事' },
        { key: 'period', label: '起止时间', placeholder: '2022.09 - 2023.06' },
      ],
      textarea: { key: 'details', label: '工作内容', placeholder: '每行一条' },
    },
    skills: {
      label: '专业技能',
      fields: [
        { key: 'category', label: '技能类别', placeholder: '编程语言 / 工具框架' },
      ],
      textarea: { key: 'items', label: '技能内容', placeholder: '如：JavaScript、Python、React' },
    },
    hobbies: {
      label: '兴趣爱好',
      fields: [],
      textarea: { key: 'items', label: '兴趣爱好', placeholder: '每行一条' },
    },
  };

  const bulletPool = [];
  const resumeData = {
    education: [],
    internship: [],
    projects: [],
    clubs: [],
    skills: [],
    hobbies: [],
  };

  const basicFields = {
    name: document.getElementById('field-name'),
    email: document.getElementById('field-email'),
    phone: document.getElementById('field-phone'),
    location: document.getElementById('field-location'),
  };

  let currentUser = null;
  let photoData = ''; // 一寸证件照 dataURL

  const authScreen = document.getElementById('auth-screen');
  const appEl = document.getElementById('app');
  const authForm = document.getElementById('auth-form');
  const authError = document.getElementById('auth-error');
  const userBadge = document.getElementById('user-badge');
  const toastEl = document.getElementById('toast');

  const addMenuBtn = document.getElementById('btn-add-menu');
  const addMenu = document.getElementById('add-menu');
  const entryModal = document.getElementById('entry-modal');
  const entryModalTitle = document.getElementById('entry-modal-title');
  const entryForm = document.getElementById('entry-form');
  const bulletPoolEl = document.getElementById('bullet-pool');
  const poolEmpty = document.getElementById('pool-empty');
  const poolFilters = document.getElementById('pool-filters');
  const resumeSections = document.getElementById('resume-sections');
  const previewModal = document.getElementById('preview-modal');
  const previewContent = document.getElementById('preview-content');
  const languageBtn = document.getElementById('btn-language');
  const libraryModal = document.getElementById('library-modal');
  const libraryList = document.getElementById('library-list');
  const librarySaveForm = document.getElementById('library-save-form');
  const libraryName = document.getElementById('library-name');

  // --- Auth ---

  function showToast(message, duration = 2200) {
    toastEl.textContent = message;
    toastEl.hidden = false;
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      toastEl.hidden = true;
    }, duration);
  }

  function showAuthError(msg) {
    authError.textContent = msg;
    authError.hidden = !msg;
  }

  function emptyResumeState() {
    return {
      entryIdCounter: 0,
      language: 'zh',
      basic: { name: '', email: '', phone: '', location: '', photo: '' },
      bulletPool: [],
      resumeData: {
        education: [],
        internship: [],
        projects: [],
        clubs: [],
        skills: [],
        hobbies: [],
      },
    };
  }

  function snapshotState() {
    return {
      entryIdCounter,
      language: resumeLanguage,
      basic: {
        name: basicFields.name.value,
        email: basicFields.email.value,
        phone: basicFields.phone.value,
        location: basicFields.location.value,
        photo: photoData,
      },
      bulletPool: JSON.parse(JSON.stringify(bulletPool)),
      resumeData: JSON.parse(JSON.stringify(resumeData)),
      sectionOrder: [...sectionOrder],
      savedAt: new Date().toISOString(),
    };
  }

  function applyState(snapshot) {
    const data = snapshot || emptyResumeState();

    entryIdCounter = data.entryIdCounter || 0;
    resumeLanguage = data.language === 'en' ? 'en' : 'zh';
    syncLanguageButton();

    basicFields.name.value = data.basic?.name || '';
    basicFields.email.value = data.basic?.email || '';
    basicFields.phone.value = data.basic?.phone || '';
    basicFields.location.value = data.basic?.location || '';
    photoData = data.basic?.photo || '';
    syncPhotoUI();

    bulletPool.length = 0;
    (data.bulletPool || []).forEach((item) => bulletPool.push(item));

    // 恢复板块顺序（缺失或非法时回退默认）
    if (Array.isArray(data.sectionOrder) && data.sectionOrder.length) {
      const saved = data.sectionOrder.filter((key) => sectionConfigs[key]);
      const missing = DEFAULT_SECTION_ORDER.filter((key) => !saved.includes(key));
      sectionOrder = saved.concat(missing);
    } else {
      sectionOrder = [...DEFAULT_SECTION_ORDER];
    }

    sectionOrder.forEach((key) => {
      resumeData[key] = Array.isArray(data.resumeData?.[key])
        ? JSON.parse(JSON.stringify(data.resumeData[key]))
        : [];
    });

    // 兼容旧数据：字符串 period（如 "2020.09 - 2024.06"）转为 {start,end} 结构
    [...bulletPool, ...sectionOrder.flatMap((key) => resumeData[key])].forEach((item) => {
      if (item && typeof item.period === 'string') {
        const parsed = parsePeriodValue(item.period);
        if (parsed) item.period = parsed;
      }
    });

    closeEntryForm();
    renderBulletPool();
    renderResumeSections();
  }

  function enterApp(user, isNew) {
    currentUser = user;
    authScreen.hidden = true;
    appEl.hidden = false;
    userBadge.textContent = user.username;

    if (isNew || !user.resume) {
      applyState(emptyResumeState());
      if (isNew) showToast('注册成功，开始编辑简历吧');
    } else {
      applyState(user.resume);
      showToast(`欢迎回来，${user.username}`);
    }
  }

  function handleAuthSubmit(e) {
    e.preventDefault();
    showAuthError('');

    const username = document.getElementById('auth-username').value;
    const phone = document.getElementById('auth-phone').value;
    const result = ResumeDB.loginOrRegister(username, phone);

    if (!result.ok) {
      showAuthError(result.error);
      return;
    }

    enterApp(result.user, result.isNew);
  }

  // --- 自动保存：所有改动防抖写入数据库 ---
  let autoSaveTimer = null;

  function scheduleAutoSave() {
    if (!currentUser) return;
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      if (!currentUser) return;
      const result = ResumeDB.saveResume(currentUser.phone, snapshotState());
      if (result.ok) currentUser = result.user;
    }, 600);
  }

  Object.values(basicFields).forEach((el) => el.addEventListener('input', scheduleAutoSave));

  function handleLogout() {
    clearTimeout(autoSaveTimer);
    ResumeDB.logout();
    currentUser = null;
    applyState(emptyResumeState());
    appEl.hidden = true;
    authScreen.hidden = false;
    showAuthError('');
    document.getElementById('auth-username').value = '';
    document.getElementById('auth-phone').value = '';
    document.getElementById('auth-username').focus();
  }

  authForm.addEventListener('submit', handleAuthSubmit);
  document.getElementById('btn-logout').addEventListener('click', handleLogout);

  const englishSectionLabels = {
    education: 'Education', internship: 'Internship Experience', projects: 'Project Experience',
    clubs: 'Extracurricular Activities', skills: 'Skills', hobbies: 'Interests',
  };

  function sectionLabel(type) {
    return resumeLanguage === 'en' ? englishSectionLabels[type] : sectionConfigs[type].label;
  }

  function syncLanguageButton() {
    const isEnglish = resumeLanguage === 'en';
    languageBtn.textContent = isEnglish ? 'English Resume' : '中文简历';
    languageBtn.setAttribute('aria-pressed', String(isEnglish));
  }

  languageBtn.addEventListener('click', () => {
    resumeLanguage = resumeLanguage === 'zh' ? 'en' : 'zh';
    syncLanguageButton();
    renderBulletPool();
    renderResumeSections();
    showToast(resumeLanguage === 'en' ? '已切换为英文板块名' : '已切换为中文板块名');
    scheduleAutoSave();
  });

  // --- Resume library ---

  function formatLibraryDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
    });
  }

  function renderLibrary() {
    if (!currentUser) return;
    const works = ResumeDB.listResumes(currentUser.phone);
    if (!works.length) {
      libraryList.innerHTML = '<p class="library-empty">仓库还是空的。为当前组合命名后即可保存到这里。</p>';
      return;
    }
    libraryList.innerHTML = works.map((work) => `
      <article class="library-item" data-work-id="${escapeAttr(work.id)}">
        <div class="library-item-info"><div class="library-item-name">${escapeHtml(work.name)}</div><div class="library-item-meta">更新于 ${escapeHtml(formatLibraryDate(work.updatedAt))}</div></div>
        <div class="library-item-actions">
          <button type="button" class="btn btn-primary btn-sm" data-library-action="export">下载 PDF</button>
          <button type="button" class="btn btn-ghost btn-sm btn-danger" data-library-action="delete">删除</button>
        </div>
      </article>`).join('');
  }

  function openLibrary() {
    if (!currentUser) return;
    renderLibrary();
    libraryModal.hidden = false;
    document.body.style.overflow = 'hidden';
    libraryName.focus();
  }

  function closeLibrary() {
    libraryModal.hidden = true;
    libraryName.value = '';
    document.body.style.overflow = '';
  }

  document.getElementById('btn-library').addEventListener('click', openLibrary);
  libraryModal.querySelectorAll('[data-library-close]').forEach((el) => el.addEventListener('click', closeLibrary));

  librarySaveForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!currentUser) return;
    const result = ResumeDB.addResumeWork(currentUser.phone, libraryName.value, snapshotState());
    if (!result.ok) return showToast(result.error || '保存失败');
    currentUser = ResumeDB.getUser(currentUser.phone);
    libraryName.value = '';
    renderLibrary();
    showToast('已存入简历仓库');
  });

  libraryList.addEventListener('click', (e) => {
    const action = e.target.closest('[data-library-action]')?.dataset.libraryAction;
    const item = e.target.closest('[data-work-id]');
    if (!action || !item || !currentUser) return;
    const work = ResumeDB.listResumes(currentUser.phone).find((entry) => entry.id === item.dataset.workId);
    if (!work) return showToast('该简历已不存在');
    if (action === 'delete') {
      if (!window.confirm(`确定删除「${work.name}」吗？`)) return;
      ResumeDB.deleteResumeWork(currentUser.phone, work.id);
      currentUser = ResumeDB.getUser(currentUser.phone);
      renderLibrary();
      showToast('已删除');
      return;
    }
    if (action === 'export') {
      exportLibraryResumeAsPdf(work);
    }
  });

  // --- 投递记录 ---

  const applicationsScreen = document.getElementById('applications-screen');
  const applicationForm = document.getElementById('application-form');
  const applicationList = document.getElementById('application-list');

  function normalizeAppLink(link) {
    const raw = String(link || '').trim();
    if (!raw) return '';
    return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw) ? raw : `https://${raw}`;
  }

  function applicationResultBadge(app) {
    if (app.result === 'success') return '<span class="app-badge app-badge-success">success</span>';
    if (app.result === 'failed') return '<span class="app-badge app-badge-failed">failed</span>';
    return '<span class="app-badge app-badge-pending">进行中</span>';
  }

  function renderApplications() {
    if (!currentUser) return;
    const apps = ResumeDB.listApplications(currentUser.phone);
    if (!apps.length) {
      applicationList.innerHTML = '<p class="application-empty">还没有投递记录，添加第一条吧</p>';
      return;
    }
    const selected = (value, current) => (value === current ? ' selected' : '');
    applicationList.innerHTML = `
      <table class="app-table">
        <thead>
          <tr>
            <th class="app-col-title">公司 / 岗位</th>
            <th class="app-col-result">结果</th>
            <th class="app-col-interview">面试</th>
            <th class="app-col-note">备注</th>
            <th class="app-col-actions">操作</th>
          </tr>
        </thead>
        <tbody>
        ${apps.map((app) => {
          // 有链接时标题整体可点击跳转，无链接时为纯文本
          const titleInner = `<strong>${escapeHtml(app.company)}</strong>
                <span class="app-position">${escapeHtml(app.position)}</span>`;
          const titleHtml = app.link
            ? `<a class="app-title-link" href="${escapeAttr(normalizeAppLink(app.link))}" target="_blank" rel="noopener" title="${escapeAttr(normalizeAppLink(app.link))}">${titleInner}</a>`
            : `<div class="app-title-plain">${titleInner}</div>`;
          return `
          <tr class="app-row ${app.result ? `is-${app.result}` : ''}" data-app-id="${escapeAttr(app.id)}">
            <td class="app-cell app-cell-title">${titleHtml}</td>
            <td class="app-cell app-cell-result">
              <span class="app-cell-label">结果</span>
              ${applicationResultBadge(app)}
              <select class="app-select" data-app-field="result">
                <option value="">未定</option>
                <option value="success"${selected('success', app.result)}>success</option>
                <option value="failed"${selected('failed', app.result)}>failed</option>
              </select>
            </td>
            <td class="app-cell app-cell-interview">
              <span class="app-cell-label">面试</span>
              <select class="app-select" data-app-field="interview">
                <option value="">未选择</option>
                <option value="yes"${selected('yes', app.interview)}>有</option>
                <option value="no"${selected('no', app.interview)}>无</option>
              </select>
            </td>
            <td class="app-cell app-cell-note">
              <span class="app-cell-label">备注</span>
              <input type="text" class="app-note" data-app-field="note" placeholder="添加备注…" maxlength="200" value="${escapeAttr(app.note || '')}">
            </td>
            <td class="app-cell app-cell-actions">
              <button type="button" class="btn btn-ghost btn-sm btn-danger" data-app-action="delete">删除</button>
            </td>
          </tr>`;
        }).join('')}
        </tbody>
      </table>`;
  }

  function openApplications() {
    if (!currentUser) return;
    renderApplications();
    appEl.hidden = true;
    applicationsScreen.hidden = false;
    document.getElementById('app-company').focus();
  }

  function closeApplications() {
    applicationsScreen.hidden = true;
    appEl.hidden = false;
  }

  document.getElementById('btn-applications').addEventListener('click', openApplications);
  document.getElementById('btn-applications-back').addEventListener('click', closeApplications);

  applicationForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!currentUser) return;
    const result = ResumeDB.addApplication(currentUser.phone, {
      company: document.getElementById('app-company').value,
      position: document.getElementById('app-position').value,
      link: document.getElementById('app-link').value,
    });
    if (!result.ok) return showToast(result.error || '添加失败');
    currentUser = ResumeDB.getUser(currentUser.phone);
    applicationForm.reset();
    renderApplications();
    showToast('已添加投递记录');
  });

  applicationList.addEventListener('change', (e) => {
    const fieldEl = e.target.closest('[data-app-field]');
    const item = e.target.closest('[data-app-id]');
    if (!fieldEl || !item || !currentUser) return;
    const patch = { [fieldEl.dataset.appField]: fieldEl.value };
    const result = ResumeDB.updateApplication(currentUser.phone, item.dataset.appId, patch);
    if (!result.ok) return showToast(result.error || '更新失败');
    currentUser = ResumeDB.getUser(currentUser.phone);
    // 重渲染以刷新状态徽标，同时保持其他未提交的输入不丢失（change 事件即当前值）
    renderApplications();
  });

  applicationList.addEventListener('click', (e) => {
    const action = e.target.closest('[data-app-action]')?.dataset.appAction;
    const item = e.target.closest('[data-app-id]');
    if (!action || !item || !currentUser) return;
    if (action === 'delete') {
      const app = ResumeDB.listApplications(currentUser.phone).find((entry) => entry.id === item.dataset.appId);
      if (!app) return showToast('该记录已不存在');
      if (!window.confirm(`确定删除「${app.company} - ${app.position}」吗？`)) return;
      ResumeDB.deleteApplication(currentUser.phone, app.id);
      currentUser = ResumeDB.getUser(currentUser.phone);
      renderApplications();
      showToast('已删除');
    }
  });

  // 仓库里的简历独立导出：临时套用其状态生成 PDF，不影响当前工作区
  function exportLibraryResumeAsPdf(work) {
    const previousSnapshot = snapshotState();
    applyState(work.resume);
    downloadPdf(work.name);
    // 下载弹窗关闭后再恢复，避免用户看到当前工作区被临时覆盖
    const restore = () => applyState(previousSnapshot);
    const observer = new MutationObserver(() => {
      if (previewModal.hidden) {
        observer.disconnect();
        restore();
      }
    });
    observer.observe(previewModal, { attributes: true, attributeFilter: ['hidden'] });
    // 兜底：若 html2pdf 异常没关闭弹窗，3 秒后强制恢复
    setTimeout(() => { observer.disconnect(); restore(); }, 3000);
  }

  // --- Add menu ---

  addMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = !addMenu.hidden;
    addMenu.hidden = isOpen;
    addMenuBtn.setAttribute('aria-expanded', String(!isOpen));
  });

  document.addEventListener('click', () => {
    addMenu.hidden = true;
    addMenuBtn.setAttribute('aria-expanded', 'false');
  });

  addMenu.querySelectorAll('.add-menu-item').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openEntryForm(btn.dataset.type);
      addMenu.hidden = true;
      addMenuBtn.setAttribute('aria-expanded', 'false');
    });
  });

  // --- 起止时间（仅年月）解析与格式化 ---

  const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTH_EN_MAP = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

  // 兼容旧数据："2026.07 - 2026.09" / "Sep 2026 - Jun 2027" → { start:{y,m}, end:{y,m} }
  // 结束为"至今 / Present"时：end = 'present'
  function parsePeriodValue(str) {
    if (!str || typeof str !== 'string') return null;
    const s = str.trim();

    const isPresent = /(至今|现在|present|current|now)/i.test(s);

    const zh = [...s.matchAll(/(\d{4})\s*[.\-/年]\s*(\d{1,2})/g)];
    if (zh.length) {
      const mk = (m) => {
        const y = Number(m[1]);
        const mth = Number(m[2]);
        return (mth >= 1 && mth <= 12) ? { y, m: mth } : null;
      };
      const start = mk(zh[0]);
      if (start) return { start, end: isPresent ? 'present' : (zh[1] ? mk(zh[1]) : null) };
    }

    const en = [...s.matchAll(/([A-Za-z]{3})[a-z]*\.?\s+(\d{4})/g)];
    if (en.length) {
      const mk = (m) => {
        const mth = MONTH_EN_MAP[m[1].toLowerCase()];
        return mth ? { y: Number(m[2]), m: mth } : null;
      };
      const start = mk(en[0]);
      if (start) return { start, end: isPresent ? 'present' : (en[1] ? mk(en[1]) : null) };
    }

    return null;
  }

  // 结构化 period → 展示文本。zh: "2026.07 - 2026.09" / "2026.07 - 至今"；en: "Sep 2026 - Jun 2027" / "Sep 2026 - Present"
  function formatPeriod(period, lang) {
    if (!period) return '';
    if (typeof period === 'string') return period; // 未识别的旧格式原样展示
    const fmt = (p) => {
      if (!p) return '';
      if (p === 'present') return lang === 'en' ? 'Present' : '至今';
      return lang === 'en'
        ? `${MONTH_EN[p.m - 1]} ${p.y}`
        : `${p.y}.${String(p.m).padStart(2, '0')}`;
    };
    return [fmt(period.start), fmt(period.end)].filter(Boolean).join(' - ');
  }

  function entryPeriodText(entry) {
    return formatPeriod(entry?.period, entry?.lang === 'en' ? 'en' : 'zh');
  }

  function buildPeriodFieldHtml(label) {
    const monthBtns = Array.from({ length: 12 }, (_, i) =>
      `<button type="button" class="period-month" data-month="${i + 1}">${i + 1}月</button>`).join('');
    const col = (side, title) => `
      <div class="period-col" data-period-side="${side}">
        <div class="period-col-title">${title}</div>
        <div class="period-nav">
          <button type="button" class="period-nav-btn" data-period-step="-1" aria-label="上一年">‹</button>
          <span class="period-year-label" data-period-year>—</span>
          <button type="button" class="period-nav-btn" data-period-step="1" aria-label="下一年">›</button>
        </div>
        <div class="period-months">${monthBtns}</div>
        ${side === 'end' ? '<button type="button" class="period-present" data-period-present>至今 / Present</button>' : ''}
      </div>`;
    return `
      <div class="form-field form-field-period">
        <span>${label}</span>
        <div class="period-control" data-period-control>
          <button type="button" class="period-btn" data-period-toggle>
            <span class="period-btn-icon" aria-hidden="true">📅</span>
            <span class="period-btn-text" data-period-text>点击选择年月</span>
          </button>
          <div class="period-popover" data-period-popover hidden>
            ${col('start', '开始')}
            ${col('end', '结束')}
            <button type="button" class="period-clear" data-period-clear>清除时间</button>
          </div>
        </div>
      </div>`;
  }

  function setupPeriodControl() {
    const control = entryForm.querySelector('[data-period-control]');
    if (!control) return;

    const popover = control.querySelector('[data-period-popover]');
    const textEl = control.querySelector('[data-period-text]');
    const thisYear = new Date().getFullYear();
    const viewYear = {
      start: formPeriod.start?.y || thisYear,
      end: formPeriod.end?.y || thisYear,
    };

    function currentLang() {
      return entryForm.querySelector('input[name="lang"]:checked')?.value === 'en' ? 'en' : 'zh';
    }

    function refresh() {
      textEl.textContent = formatPeriod(formPeriod, currentLang()) || '点击选择年月';
      ['start', 'end'].forEach((side) => {
        const col = control.querySelector(`[data-period-side="${side}"]`);
        const sel = formPeriod[side];
        col.querySelector('[data-period-year]').textContent = `${viewYear[side]}年`;
        col.querySelectorAll('.period-month').forEach((btn) => {
          btn.classList.toggle('is-selected', !!sel && typeof sel === 'object' && Number(btn.dataset.month) === sel.m && sel.y === viewYear[side]);
        });
        const presentBtn = col.querySelector('[data-period-present]');
        if (presentBtn) presentBtn.classList.toggle('is-selected', sel === 'present');
      });
    }

    control.querySelector('[data-period-toggle]').addEventListener('click', (e) => {
      e.stopPropagation();
      popover.hidden = !popover.hidden;
      refresh();
    });

    control.querySelectorAll('[data-period-step]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const side = btn.closest('[data-period-side]').dataset.periodSide;
        viewYear[side] += Number(btn.dataset.periodStep);
        refresh();
      });
    });

    control.querySelectorAll('.period-month').forEach((btn) => {
      btn.addEventListener('click', () => {
        const side = btn.closest('[data-period-side]').dataset.periodSide;
        formPeriod[side] = { y: viewYear[side], m: Number(btn.dataset.month) };
        refresh();
      });
    });

    // 结束时间可选"至今 / Present"
    control.querySelector('[data-period-present]')?.addEventListener('click', () => {
      formPeriod.end = 'present';
      refresh();
    });

    control.querySelector('[data-period-clear]').addEventListener('click', () => {
      formPeriod.start = null;
      formPeriod.end = null;
      refresh();
    });

    // 切换要点语言时，按钮上的时间格式随之切换（中文 2026.07 / 英文 Sep 2026）
    entryForm.querySelectorAll('input[name="lang"]').forEach((radio) => {
      radio.addEventListener('change', refresh);
    });

    refresh();
  }

  // 点击选择器外部时关闭日历弹层（全局一次注册，随表单销毁自动失效）
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-period-control]')) return;
    document.querySelectorAll('[data-period-popover]').forEach((pop) => { pop.hidden = true; });
  });

  // --- Entry form ---

  function openEntryForm(type, entry = null) {
    const config = sectionConfigs[type];
    if (!config) return;

    activeFormType = type;
    editingEntryId = entry ? entry.id : null;
    entryModal.hidden = false;
    entryModalTitle.textContent = entry ? `编辑${config.label}` : `新增${config.label}`;

    let html = '';

    config.fields.forEach((field) => {
      if (field.key === 'period') {
        html += buildPeriodFieldHtml(field.label);
        return;
      }
      const value = entry ? (entry[field.key] || '') : '';
      html += `
        <label class="form-field">
          <span>${field.label}${field.required ? ' <em>*</em>' : ''}</span>
          <input type="text" name="${field.key}" placeholder="${field.placeholder || ''}" value="${escapeAttr(value)}"${field.required ? ' required' : ''}>
        </label>`;
    });

    if (config.textarea) {
      const value = entry && entry.bullets?.length ? entry.bullets.join('\n') : '';
      html += `
        <label class="form-field">
          <span>${config.textarea.label}</span>
          <textarea name="${config.textarea.key}" rows="4" placeholder="${config.textarea.placeholder || ''}">${escapeHtml(value)}</textarea>
        </label>`;
    }

    const selectedLang = entry?.lang === 'en' ? 'en' : (entry?.lang === 'zh' ? 'zh' : activePoolLang);
    html += `
      <fieldset class="color-picker"><legend>要点语言</legend>
        <div class="lang-options">
          <label class="lang-option"><input type="radio" name="lang" value="zh"${selectedLang === 'zh' ? ' checked' : ''}><span>中文</span></label>
          <label class="lang-option"><input type="radio" name="lang" value="en"${selectedLang === 'en' ? ' checked' : ''}><span>English</span></label>
        </div>
      </fieldset>`;

    const selectedColor = entry?.color || 'blue';
    const colors = ['red', 'orange', 'blue', 'green', 'yellow', 'purple', 'gray'];
    html += `<fieldset class="color-picker"><legend>要点框颜色</legend><div class="color-options">${colors.map((color) => `<label class="color-option color-${color}"><input type="radio" name="color" value="${color}"${selectedColor === color ? ' checked' : ''}><span aria-label="${color}"></span></label>`).join('')}</div></fieldset>`;

    html += `
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" id="btn-cancel-form">取消</button>
        <button type="submit" class="btn btn-primary">${entry ? '保存修改' : '添加至要点库'}</button>
      </div>`;

    entryForm.innerHTML = html;

    // 初始化起止时间选择器（编辑时回填已选年月）
    const initialPeriod = entry
      ? (typeof entry.period === 'string' ? parsePeriodValue(entry.period) : entry.period)
      : null;
    formPeriod = {
      start: initialPeriod?.start ? { ...initialPeriod.start } : null,
      end: initialPeriod?.end === 'present' ? 'present' : (initialPeriod?.end ? { ...initialPeriod.end } : null),
    };
    setupPeriodControl();

    entryForm.querySelector('#btn-cancel-form').addEventListener('click', closeEntryForm);
    entryForm.addEventListener('submit', handleFormSubmit, { once: true });

    const firstInput = entryForm.querySelector('input, textarea');
    firstInput?.focus();
  }

  function closeEntryForm() {
    activeFormType = null;
    editingEntryId = null;
    entryModal.hidden = true;
    entryForm.innerHTML = '';
  }

  entryModal.querySelectorAll('[data-entry-close]').forEach((el) => {
    el.addEventListener('click', closeEntryForm);
  });

  function buildEntryFromForm(type) {
    const config = sectionConfigs[type];
    const formData = new FormData(entryForm);
    const entry = { type, color: formData.get('color') || 'blue', lang: formData.get('lang') === 'en' ? 'en' : 'zh' };

    config.fields.forEach((field) => {
      if (field.key === 'period') return; // 起止时间来自日历选择器
      entry[field.key] = (formData.get(field.key) || '').trim();
    });

    entry.period = (formPeriod.start || formPeriod.end)
      ? {
          start: formPeriod.start ? { ...formPeriod.start } : null,
          end: formPeriod.end === 'present' ? 'present' : (formPeriod.end ? { ...formPeriod.end } : null),
        }
      : null;

    if (config.textarea) {
      const raw = (formData.get(config.textarea.key) || '').trim();
      entry.bullets = raw ? raw.split('\n').map((s) => s.trim()).filter(Boolean) : [];
    } else {
      entry.bullets = [];
    }

    return entry;
  }

  function validateEntryForm(type, entry) {
    const config = sectionConfigs[type];
    const requiredField = config.fields.find((f) => f.required);
    if (requiredField && !entry[requiredField.key]) {
      entryForm.querySelector(`[name="${requiredField.key}"]`)?.focus();
      return false;
    }

    if (type === 'skills' || type === 'hobbies') {
      if (entry.bullets.length === 0 && config.fields.every((f) => !entry[f.key])) {
        entryForm.querySelector('textarea')?.focus();
        return false;
      }
    }

    return true;
  }

  function handleFormSubmit(e) {
    e.preventDefault();
    const data = buildEntryFromForm(activeFormType);
    if (!validateEntryForm(activeFormType, data)) {
      entryForm.addEventListener('submit', handleFormSubmit, { once: true });
      return;
    }

    if (editingEntryId) {
      const found = findEntry(editingEntryId);
      if (found) {
        Object.assign(found.entry, data);
        found.entry.type = activeFormType;
      }
      closeEntryForm();
      renderBulletPool();
      renderResumeSections();
      scheduleAutoSave();
      return;
    }

    const entry = { id: `e-${++entryIdCounter}`, ...data };
    bulletPool.push(entry);
    closeEntryForm();
    renderBulletPool();
    scheduleAutoSave();
  }

  // --- Entry helpers ---

  function formatEntryHeader(type, entry) {
    switch (type) {
      case 'education': {
        const main = [entry.school, entry.major, entry.degree].filter(Boolean).join(' · ');
        return { main, sub: entryPeriodText(entry) };
      }
      case 'internship':
        return { main: [entry.company, entry.role].filter(Boolean).join(' · '), sub: entryPeriodText(entry) };
      case 'projects':
        return { main: [entry.name, entry.role].filter(Boolean).join(' · '), sub: entryPeriodText(entry) };
      case 'clubs':
        return { main: [entry.org, entry.role].filter(Boolean).join(' · '), sub: entryPeriodText(entry) };
      case 'skills':
        return { main: entry.category || '', sub: '' };
      case 'hobbies':
        return { main: entry.bullets?.join('、') || '', sub: '' };
      default:
        return { main: '', sub: '' };
    }
  }

  function getEntrySummary(entry) {
    const { main, sub } = formatEntryHeader(entry.type, entry);
    if (main && sub) return `${main}（${sub}）`;
    return main || sub || sectionLabel(entry.type);
  }

  function findEntry(id) {
    const inPool = bulletPool.find((e) => e.id === id);
    if (inPool) return { entry: inPool, location: 'pool' };

    for (const section of sectionOrder) {
      const entry = resumeData[section].find((e) => e.id === id);
      if (entry) return { entry, location: section };
    }
    return null;
  }

  function reorderInArray(arr, entryId, targetEntryId, insertBefore) {
    const fromIdx = arr.findIndex((e) => e.id === entryId);
    const toIdx = arr.findIndex((e) => e.id === targetEntryId);
    if (fromIdx === -1 || toIdx === -1) return;

    const [item] = arr.splice(fromIdx, 1);
    let newIdx = arr.findIndex((e) => e.id === targetEntryId);
    if (newIdx === -1) return;
    if (!insertBefore) newIdx += 1;
    arr.splice(newIdx, 0, item);
  }

  function insertEntryAt(section, entry, targetEntryId, insertBefore) {
    const arr = resumeData[section];
    if (!targetEntryId) {
      arr.push(entry);
      return;
    }
    const toIdx = arr.findIndex((e) => e.id === targetEntryId);
    if (toIdx === -1) {
      arr.push(entry);
      return;
    }
    const insertIdx = insertBefore ? toIdx : toIdx + 1;
    arr.splice(insertIdx, 0, entry);
  }

  function clearDropIndicators() {
    document.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach((el) => {
      el.classList.remove('drag-over-top', 'drag-over-bottom');
    });
    dropTargetEntryId = null;
  }

  function removeEntryFromLocation(id) {
    const poolIdx = bulletPool.findIndex((e) => e.id === id);
    if (poolIdx !== -1) {
      bulletPool.splice(poolIdx, 1);
      return 'pool';
    }
    for (const section of sectionOrder) {
      const idx = resumeData[section].findIndex((e) => e.id === id);
      if (idx !== -1) {
        resumeData[section].splice(idx, 1);
        return section;
      }
    }
    return null;
  }

  function buildEntryContentHtml(entry) {
    const type = entry.type;
    const { main, sub } = formatEntryHeader(type, entry);
    const bullets = entry.bullets || [];
    const bulletsHtml = bullets.length
      ? `<ul class="entry-bullets">${bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`
      : '';

    if (type === 'skills' && !entry.category && bullets.length) {
      return bulletsHtml;
    }
    if (type === 'hobbies') {
      return bullets.length
        ? `<ul class="entry-bullets inline">${bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`
        : '';
    }

    return `
      ${main ? `<div class="entry-main">${escapeHtml(main)}</div>` : ''}
      ${sub ? `<div class="entry-sub">${escapeHtml(sub)}</div>` : ''}
      ${bulletsHtml}`;
  }

  // --- Bullet pool render ---

  poolFilters.addEventListener('click', (e) => {
    const button = e.target.closest('[data-filter]');
    if (!button) return;
    activePoolFilter = button.dataset.filter;
    poolFilters.querySelectorAll('.pool-filter').forEach((item) => item.classList.toggle('is-active', item === button));
    renderBulletPool();
  });

  const poolLangFilters = document.getElementById('pool-lang-filters');

  poolLangFilters.addEventListener('click', (e) => {
    const button = e.target.closest('[data-lang]');
    if (!button) return;
    activePoolLang = button.dataset.lang === 'en' ? 'en' : 'zh';
    poolLangFilters.querySelectorAll('.pool-filter').forEach((item) => item.classList.toggle('is-active', item === button));
    renderBulletPool();
  });

  function renderBulletPool() {
    bulletPoolEl.querySelectorAll('.bullet-item').forEach((el) => el.remove());
    const langEntries = bulletPool.filter((entry) => (entry.lang || 'zh') === activePoolLang);
    const visibleEntries = activePoolFilter === 'all' ? langEntries : langEntries.filter((entry) => entry.type === activePoolFilter);
    poolEmpty.hidden = visibleEntries.length > 0;
    poolEmpty.textContent = langEntries.length ? '该类别暂无要点' : '暂无该语言要点，点击「增加要点」添加';

    visibleEntries.forEach((entry) => {
      const el = document.createElement('div');
      el.className = `bullet-item color-${entry.color || 'blue'}`;
      el.draggable = true;
      el.dataset.entryId = entry.id;

      el.innerHTML = `
        <span class="drag-handle" aria-hidden="true">⠿</span>
        <div class="bullet-item-body">
          <span class="bullet-type-tag">${sectionLabel(entry.type)}</span>
          <span class="bullet-summary">${escapeHtml(getEntrySummary(entry))}</span>
        </div>
        <button type="button" class="btn-remove" aria-label="删除">&times;</button>`;

      setupDrag(el, 'pool');
      el.querySelector('.bullet-item-body').addEventListener('click', (e) => {
        if (justDragged) return;
        e.stopPropagation();
        openEntryForm(entry.type, entry);
      });
      el.querySelector('.btn-remove').addEventListener('click', (e) => {
        e.stopPropagation();
        removeEntryFromLocation(entry.id);
        renderBulletPool();
        scheduleAutoSave();
      });

      bulletPoolEl.appendChild(el);
    });
  }

  // --- Right panel render ---

  function renderResumeSections() {
    resumeSections.innerHTML = '';

    sectionOrder.forEach((section, index) => {
      const entries = resumeData[section];
      const config = sectionConfigs[section];

      const sectionEl = document.createElement('div');
      sectionEl.className = 'resume-section';
      sectionEl.dataset.section = section;

      let bodyHtml = '<p class="drop-hint">拖入要点</p>';

      entries.forEach((entry) => {
        bodyHtml += `
          <div class="resume-entry" draggable="true" data-entry-id="${entry.id}">
            <span class="drag-handle" aria-hidden="true">⠿</span>
            <div class="entry-content">${buildEntryContentHtml(entry)}</div>
            <button type="button" class="btn-entry-remove" data-entry-id="${entry.id}" aria-label="移回要点库">&times;</button>
          </div>`;
      });

      sectionEl.innerHTML = `
        <h3 class="section-title">
          <span class="section-title-text">${sectionLabel(section)}</span>
          <span class="section-move-actions">
            <button type="button" class="btn-section-move" data-move="up" data-section="${section}" aria-label="上移板块"${index === 0 ? ' disabled' : ''}>↑</button>
            <button type="button" class="btn-section-move" data-move="down" data-section="${section}" aria-label="下移板块"${index === sectionOrder.length - 1 ? ' disabled' : ''}>↓</button>
          </span>
        </h3>
        <div class="section-body drop-zone" data-section="${section}">${bodyHtml}</div>`;

      resumeSections.appendChild(sectionEl);
    });

    resumeSections.querySelectorAll('.resume-entry').forEach((el) => {
      const section = el.closest('.drop-zone').dataset.section;
      setupDrag(el, section);
      setupEntryDropTarget(el, section);

      el.querySelector('.entry-content').addEventListener('click', () => {
        if (justDragged) return;
        const found = findEntry(el.dataset.entryId);
        if (found) openEntryForm(found.entry.type, found.entry);
      });
    });

    resumeSections.querySelectorAll('.drop-zone').forEach((zone) => {
      setupDropZone(zone);
    });

    resumeSections.querySelectorAll('.btn-section-move').forEach((btn) => {
      btn.addEventListener('click', () => {
        const direction = btn.dataset.move === 'up' ? -1 : 1;
        const index = sectionOrder.indexOf(btn.dataset.section);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= sectionOrder.length) return;
        [sectionOrder[index], sectionOrder[target]] = [sectionOrder[target], sectionOrder[index]];
        renderResumeSections();
        scheduleAutoSave();
      });
    });

    resumeSections.querySelectorAll('.btn-entry-remove').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.entryId;
        const found = findEntry(id);
        if (!found || found.location === 'pool') return;
        removeEntryFromLocation(id);
        bulletPool.push(found.entry);
        renderBulletPool();
        renderResumeSections();
        scheduleAutoSave();
      });
    });

    updateDropHints();
  }

  function updateDropHints() {
    document.querySelectorAll('.drop-zone').forEach((zone) => {
      const hint = zone.querySelector('.drop-hint');
      if (!hint) return;
      hint.hidden = zone.querySelector('.resume-entry') !== null;
    });
  }

  // --- Drag & drop ---

  function setupDrag(el, source) {
    el.addEventListener('dragstart', (e) => {
      if (e.target.closest('.btn-remove, .btn-entry-remove')) {
        e.preventDefault();
        return;
      }
      draggedEntryId = el.dataset.entryId;
      dragSource = source;
      el.classList.add('dragging');
      justDragged = true;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', draggedEntryId);
    });

    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      draggedEntryId = null;
      dragSource = null;
      clearDropIndicators();
      document.querySelectorAll('.drag-over').forEach((z) => z.classList.remove('drag-over'));
      setTimeout(() => {
        justDragged = false;
      }, 0);
    });
  }

  function setupEntryDropTarget(el, section) {
    el.addEventListener('dragover', (e) => {
      if (!draggedEntryId || draggedEntryId === el.dataset.entryId) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';

      const rect = el.getBoundingClientRect();
      const insertBefore = e.clientY < rect.top + rect.height / 2;

      clearDropIndicators();
      dropTargetEntryId = el.dataset.entryId;
      dropInsertBefore = insertBefore;
      el.classList.add(insertBefore ? 'drag-over-top' : 'drag-over-bottom');
    });

    el.addEventListener('dragleave', (e) => {
      if (!el.contains(e.relatedTarget)) {
        el.classList.remove('drag-over-top', 'drag-over-bottom');
      }
    });

    el.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.classList.remove('drag-over-top', 'drag-over-bottom');
      if (!draggedEntryId || draggedEntryId === el.dataset.entryId) return;

      const targetSection = section;
      const found = findEntry(draggedEntryId);
      if (!found) return;

      if (dragSource === 'pool') {
        removeEntryFromLocation(draggedEntryId);
        insertEntryAt(targetSection, found.entry, el.dataset.entryId, dropInsertBefore);
      } else if (dragSource === targetSection) {
        reorderInArray(resumeData[targetSection], draggedEntryId, el.dataset.entryId, dropInsertBefore);
      } else {
        removeEntryFromLocation(draggedEntryId);
        insertEntryAt(targetSection, found.entry, el.dataset.entryId, dropInsertBefore);
      }

      clearDropIndicators();
      renderBulletPool();
      renderResumeSections();
      scheduleAutoSave();
    });
  }

  function setupDropZone(zone) {
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', (e) => {
      if (!zone.contains(e.relatedTarget)) {
        zone.classList.remove('drag-over');
      }
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      if (!draggedEntryId) return;

      const targetSection = zone.dataset.section;
      const found = findEntry(draggedEntryId);
      if (!found) return;

      if (dragSource === 'pool') {
        removeEntryFromLocation(draggedEntryId);
        resumeData[targetSection].push(found.entry);
      } else if (dragSource === targetSection) {
        const arr = resumeData[targetSection];
        const fromIdx = arr.findIndex((item) => item.id === draggedEntryId);
        if (fromIdx !== -1 && fromIdx !== arr.length - 1) {
          const [item] = arr.splice(fromIdx, 1);
          arr.push(item);
        }
      } else {
        removeEntryFromLocation(draggedEntryId);
        resumeData[targetSection].push(found.entry);
      }

      clearDropIndicators();
      renderBulletPool();
      renderResumeSections();
      scheduleAutoSave();
    });
  }

  bulletPoolEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    bulletPoolEl.classList.add('drag-over');
  });

  bulletPoolEl.addEventListener('dragleave', (e) => {
    if (!bulletPoolEl.contains(e.relatedTarget)) {
      bulletPoolEl.classList.remove('drag-over');
    }
  });

  bulletPoolEl.addEventListener('drop', (e) => {
    e.preventDefault();
    bulletPoolEl.classList.remove('drag-over');
    if (!draggedEntryId || dragSource === 'pool') return;

    const found = findEntry(draggedEntryId);
    if (!found || found.location === 'pool') return;

    removeEntryFromLocation(draggedEntryId);
    bulletPool.push(found.entry);
    renderBulletPool();
    renderResumeSections();
    scheduleAutoSave();
  });

  // --- Preview ---

  function getFieldValue(key) {
    return basicFields[key]?.value.trim() || '';
  }

  function buildSectionPreviewHtml(section, entries) {
    if (entries.length === 0) return '';

    const label = sectionLabel(section);
    let itemsHtml = '';

    entries.forEach((entry) => {
      const type = entry.type;
      const { main, sub } = formatEntryHeader(type, entry);
      const bullets = entry.bullets || [];

      if (type === 'hobbies') {
        if (bullets.length) itemsHtml += `<li>${bullets.map(escapeHtml).join(resumeLanguage === 'en' ? ', ' : '、')}</li>`;
        return;
      }

      if (type === 'skills' && !main && bullets.length) {
        itemsHtml += `<li>${bullets.map(escapeHtml).join(resumeLanguage === 'en' ? ', ' : '、')}</li>`;
        return;
      }

      const headParts = [];
      if (main) headParts.push(`<strong>${escapeHtml(main)}</strong>`);
      if (sub) headParts.push(`<span class="preview-period">${escapeHtml(sub)}</span>`);

      if (bullets.length) {
        itemsHtml += `<li>
          <div class="preview-entry-head">${headParts.join(' ')}</div>
          <ul class="preview-sub-bullets">${bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>
        </li>`;
      } else if (headParts.length) {
        itemsHtml += `<li><div class="preview-entry-head">${headParts.join(' ')}</div></li>`;
      }
    });

    if (!itemsHtml) return '';

    return `
      <div class="preview-section">
        <div class="preview-section-title">${label}</div>
        <ul>${itemsHtml}</ul>
      </div>`;
  }

  function buildPreviewHtml() {
    const name = getFieldValue('name') || (resumeLanguage === 'en' ? 'Your Name' : '您的姓名');
    const photoHtml = photoData ? `<div class="preview-photo"><img src="${photoData}" alt=""></div>` : '';
    const email = getFieldValue('email');
    const phone = getFieldValue('phone');
    const location = getFieldValue('location');

    const contacts = [email, phone, location].filter(Boolean);
    const contactHtml = contacts.length
      ? `<div class="preview-contact">${contacts.map((c) => `<span>${escapeHtml(c)}</span>`).join('')}</div>`
      : '';

    let sectionsHtml = '';
    sectionOrder.forEach((section) => {
      sectionsHtml += buildSectionPreviewHtml(section, resumeData[section]);
    });

    return `
      <div class="preview-header">
        <div class="preview-main">
          <div class="preview-name">${escapeHtml(name)}</div>
          ${contactHtml}
        </div>
        ${photoHtml}
      </div>
      ${sectionsHtml}`;
  }

  function openPreview() {
    previewContent.innerHTML = buildPreviewHtml();
    previewModal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closePreview() {
    previewModal.hidden = true;
    document.body.style.overflow = '';
  }

  document.getElementById('btn-preview').addEventListener('click', openPreview);

  previewModal.querySelectorAll('[data-close]').forEach((el) => {
    el.addEventListener('click', closePreview);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!entryModal.hidden) closeEntryForm();
      if (!previewModal.hidden) closePreview();
      if (!libraryModal.hidden) closeLibrary();
      addMenu.hidden = true;
      addMenuBtn.setAttribute('aria-expanded', 'false');
    }
  });

  function downloadPdf(filenameBase) {
    const wasHidden = previewModal.hidden;
    if (wasHidden) {
      previewContent.innerHTML = buildPreviewHtml();
      previewModal.hidden = false;
    }

    const name = String(filenameBase || getFieldValue('name') || '简历').replace(/[\\/:*?"<>|]/g, '_');
    const opt = {
      margin: 0,
      filename: `${name}_简历.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    };

    html2pdf()
      .set(opt)
      .from(previewContent)
      .save()
      .then(() => {
        if (wasHidden) closePreview();
      });
  }

  document.getElementById('btn-download').addEventListener('click', downloadPdf);
  document.getElementById('btn-download-modal').addEventListener('click', downloadPdf);

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/"/g, '&quot;');
  }


  // ===== 一寸照上传与裁剪 =====
  const photoImgEl = document.getElementById('photo-img');
  const photoPlaceholder = document.getElementById('photo-placeholder');
  const btnUploadPhoto = document.getElementById('btn-upload-photo');
  const btnRemovePhoto = document.getElementById('btn-remove-photo');
  const photoInput = document.getElementById('photo-input');

  const cropModal = document.getElementById('crop-modal');
  const cropView = document.getElementById('crop-view');
  const cropImg = document.getElementById('crop-img');
  const cropZoomRange = document.getElementById('crop-zoom-range');
  const btnCropConfirm = document.getElementById('btn-crop-confirm');

  const CROP_OUT_W = 300;   // 输出约一寸宽（25mm 高分辨率）
  const CROP_OUT_H = 420;   // 宽:高 = 1:1.4

  function syncPhotoUI() {
    const has = !!photoData;
    if (has) {
      photoImgEl.src = photoData;
      photoImgEl.hidden = false;
      photoPlaceholder.hidden = true;
      btnRemovePhoto.hidden = false;
    } else {
      photoImgEl.removeAttribute('src');
      photoImgEl.hidden = true;
      photoPlaceholder.hidden = false;
      btnRemovePhoto.hidden = true;
    }
  }

  btnUploadPhoto.addEventListener('click', () => photoInput.click());

  btnRemovePhoto.addEventListener('click', () => {
    photoData = '';
    syncPhotoUI();
    scheduleAutoSave();
  });

  photoInput.addEventListener('change', () => {
    const file = photoInput.files && photoInput.files[0];
    photoInput.value = '';
    if (!file) return;
    const url = URL.createObjectURL(file);
    // 先显示裁剪弹窗，确保能测到真实布局尺寸
    cropModal.hidden = false;
    cropImg.src = url;
    cropImg.decode = cropImg.decode || function(){ return Promise.resolve(); };
    cropImg.decode().then(() => {
      // 等一帧让弹窗布局完成
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (getCropViewSize().w > 0 && getCropViewSize().h > 0) initCropAndOpen();
        else setTimeout(initCropAndOpen, 40);
      }));
    }).catch(() => {
      setTimeout(initCropAndOpen, 40);
    });
  });

  function getCropViewSize() {
    const r = cropView.getBoundingClientRect();
    return { w: r.width, h: r.height };
  }

  // 兼容别称：返回 {W,H}（被 renderCrop/clampCrop/zoom/doCrop 使用；此时弹窗已显示，尺寸有效）
  function getViewportCss() {
    const r = cropView.getBoundingClientRect();
    return { W: r.width, H: r.height };
  }

  let cropState = null;

  function initCropAndOpen() {
    let W = getCropViewSize().w;
    let H = getCropViewSize().h;
    cropModal.hidden = false;
    if (!W) W = 260;     // CSS fallback
    if (!H) H = 364;
    const natW = cropImg.naturalWidth;
    const natH = cropImg.naturalHeight;
    if (!natW || !natH) return;

    const baseScale = Math.max(W / natW, H / natH); // cover 铺满一寸框
    cropState = {
      natW, natH,
      baseScale,
      dispScale: baseScale,
      originX: (W - natW * baseScale) / 2,
      originY: (H - natH * baseScale) / 2,
    };
    const maxM = Math.min(10, (natW * baseScale) / W || 10, (natH * baseScale) / H || 10);
    cropZoomRange.max = String(Math.max(1.5, Math.min(10, Math.round(maxM * 10) / 10)));
    cropZoomRange.value = '1';
    renderCrop();
  }
  function renderCrop() {
    if (!cropState) return;
    const st = cropState;
    const { W, H } = getViewportCss();
    const dispW = st.natW * st.dispScale;
    const dispH = st.natH * st.dispScale;
    cropImg.style.width = dispW + 'px';
    cropImg.style.height = dispH + 'px';
    cropImg.style.left = st.originX + 'px';
    cropImg.style.top = st.originY + 'px';
  }

  function clampCrop() {
    const st = cropState;
    const { W, H } = getViewportCss();
    const dispW = st.natW * st.dispScale;
    const dispH = st.natH * st.dispScale;
    const minX = Math.min(0, W - dispW);
    const minY = Math.min(0, H - dispH);
    st.originX = Math.max(minX, Math.min(0, st.originX));
    st.originY = Math.max(minY, Math.min(0, st.originY));
  }

  cropZoomRange.addEventListener('input', () => {
    if (!cropState) return;
    const { W, H } = getViewportCss();
    const k = parseFloat(cropZoomRange.value || '1');
    const newScale = cropState.baseScale * k;
    const factor = newScale / cropState.dispScale;
    const cx = W / 2;
    const cy = H / 2;
    cropState.originX = cx + (cropState.originX - cx) * factor;
    cropState.originY = cy + (cropState.originY - cy) * factor;
    cropState.dispScale = newScale;
    clampCrop();
    renderCrop();
  });

  // 拖动
  let dragStart = null;
  cropView.addEventListener('pointerdown', (e) => {
    if (!cropState) return;
    dragStart = { x: e.clientX, y: e.clientY, ox: cropState.originX, oy: cropState.originY };
    cropView.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  cropView.addEventListener('pointermove', (e) => {
    if (!dragStart || !cropState) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    cropState.originX = dragStart.ox + dx;
    cropState.originY = dragStart.oy + dy;
    clampCrop();
    renderCrop();
  });
  cropView.addEventListener('pointerup', (e) => {
    dragStart = null;
    try { cropView.releasePointerCapture(e.pointerId); } catch (_) {}
  });
  cropView.addEventListener('pointercancel', () => { dragStart = null; });
  // 鼠标滚轮缩放
  cropView.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (!cropState) return;
    const cur = parseFloat(cropZoomRange.value || '1');
    const step = e.deltaY < 0 ? cur * 1.08 : cur / 1.08;
    const clamped = Math.max(1, Math.min(parseFloat(cropZoomRange.max || '10'), step));
    cropZoomRange.value = String(clamped);
    cropZoomRange.dispatchEvent(new Event('input'));
  }, { passive: false });

  // 打开/关闭裁剪
  cropModal.querySelectorAll('[data-crop-close]').forEach((el) => {
    el.addEventListener('click', () => {
      cropModal.hidden = true;
      cropImg.removeAttribute('src');
      cropImg.onload = null;
      if (cropImg.src) { try { URL.revokeObjectURL(cropImg.src.split('?')[0]); } catch (_) {} }
      try { URL.revokeObjectURL(cropImg.currentSrc || ''); } catch (_) {}
      cropState = null;
    });
  });

  function doCrop() {
    if (!cropState) return;
    const { natW, natH, dispScale, originX, originY } = cropState;
    const { W, H } = getViewportCss();
    const srcX = -originX / dispScale;
    const srcY = -originY / dispScale;
    const srcW = W / dispScale;
    const srcH = H / dispScale;
    const cx = document.createElement('canvas');
    cx.width = CROP_OUT_W;
    cx.height = CROP_OUT_H;
    const ctx = cx.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cropImg, srcX, srcY, srcW, srcH, 0, 0, CROP_OUT_W, CROP_OUT_H);
    photoData = cx.toDataURL('image/jpeg', 0.92);
    syncPhotoUI();
    cropModal.hidden = true;
    try { URL.revokeObjectURL(cropImg.currentSrc || ''); } catch (_) {}
    cropImg.removeAttribute('src');
    cropState = null;
    scheduleAutoSave();
  }

  btnCropConfirm.addEventListener('click', doCrop);
  // Ctrl/Cmd+Enter 确认
  cropModal.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });

  renderBulletPool();
  renderResumeSections();

  // 恢复会话，或显示登录页
  const sessionUser = ResumeDB.getSession();
  if (sessionUser) {
    enterApp(sessionUser, false);
  } else {
    authScreen.hidden = false;
    appEl.hidden = true;
    document.getElementById('auth-username').focus();
  }

})();
