(function () {
  let entryIdCounter = 0;
  let activeFormType = null;
  let editingEntryId = null;
  let draggedEntryId = null;
  let dragSource = null; // 'pool' | section key
  let dropTargetEntryId = null;
  let dropInsertBefore = false;
  let justDragged = false;

  const sectionOrder = ['education', 'internship', 'projects', 'clubs', 'skills', 'hobbies'];

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
  const entryFormArea = document.getElementById('entry-form-area');
  const formTypeTitle = document.getElementById('form-type-title');
  const entryForm = document.getElementById('entry-form');
  const bulletPoolEl = document.getElementById('bullet-pool');
  const poolEmpty = document.getElementById('pool-empty');
  const resumeSections = document.getElementById('resume-sections');
  const previewModal = document.getElementById('preview-modal');
  const previewContent = document.getElementById('preview-content');

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
      basic: {
        name: basicFields.name.value,
        email: basicFields.email.value,
        phone: basicFields.phone.value,
        location: basicFields.location.value,
        photo: photoData,
      },
      bulletPool: JSON.parse(JSON.stringify(bulletPool)),
      resumeData: JSON.parse(JSON.stringify(resumeData)),
      savedAt: new Date().toISOString(),
    };
  }

  function applyState(snapshot) {
    const data = snapshot || emptyResumeState();

    entryIdCounter = data.entryIdCounter || 0;

    basicFields.name.value = data.basic?.name || '';
    basicFields.email.value = data.basic?.email || '';
    basicFields.phone.value = data.basic?.phone || '';
    basicFields.location.value = data.basic?.location || '';
    photoData = data.basic?.photo || '';
    syncPhotoUI();

    bulletPool.length = 0;
    (data.bulletPool || []).forEach((item) => bulletPool.push(item));

    sectionOrder.forEach((key) => {
      resumeData[key] = Array.isArray(data.resumeData?.[key])
        ? JSON.parse(JSON.stringify(data.resumeData[key]))
        : [];
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

  function handleSave() {
    if (!currentUser) return;
    const snapshot = snapshotState();
    const result = ResumeDB.saveResume(currentUser.phone, snapshot);
    if (!result.ok) {
      showToast(result.error || '保存失败');
      return;
    }
    currentUser = result.user;
    showToast('已保存到数据库');
  }

  function handleLogout() {
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
  document.getElementById('btn-save').addEventListener('click', handleSave);
  document.getElementById('btn-logout').addEventListener('click', handleLogout);

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

  // --- Entry form ---

  function openEntryForm(type, entry = null) {
    const config = sectionConfigs[type];
    if (!config) return;

    activeFormType = type;
    editingEntryId = entry ? entry.id : null;
    entryFormArea.hidden = false;
    formTypeTitle.textContent = entry ? `编辑${config.label}` : config.label;

    let html = '';

    config.fields.forEach((field) => {
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

    html += `
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" id="btn-cancel-form">取消</button>
        <button type="submit" class="btn btn-primary">${entry ? '保存修改' : '添加至要点库'}</button>
      </div>`;

    entryForm.innerHTML = html;

    entryForm.querySelector('#btn-cancel-form').addEventListener('click', closeEntryForm);
    entryForm.addEventListener('submit', handleFormSubmit, { once: true });

    const firstInput = entryForm.querySelector('input, textarea');
    firstInput?.focus();
  }

  function closeEntryForm() {
    activeFormType = null;
    editingEntryId = null;
    entryFormArea.hidden = true;
    entryForm.innerHTML = '';
  }

  function buildEntryFromForm(type) {
    const config = sectionConfigs[type];
    const formData = new FormData(entryForm);
    const entry = { type };

    config.fields.forEach((field) => {
      entry[field.key] = (formData.get(field.key) || '').trim();
    });

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
      return;
    }

    const entry = { id: `e-${++entryIdCounter}`, ...data };
    bulletPool.push(entry);
    closeEntryForm();
    renderBulletPool();
  }

  // --- Entry helpers ---

  function formatEntryHeader(type, entry) {
    switch (type) {
      case 'education': {
        const main = [entry.school, entry.major, entry.degree].filter(Boolean).join(' · ');
        return { main, sub: entry.period || '' };
      }
      case 'internship':
        return { main: [entry.company, entry.role].filter(Boolean).join(' · '), sub: entry.period || '' };
      case 'projects':
        return { main: [entry.name, entry.role].filter(Boolean).join(' · '), sub: entry.period || '' };
      case 'clubs':
        return { main: [entry.org, entry.role].filter(Boolean).join(' · '), sub: entry.period || '' };
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
    return main || sub || sectionConfigs[entry.type].label;
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

  function renderBulletPool() {
    bulletPoolEl.querySelectorAll('.bullet-item').forEach((el) => el.remove());
    poolEmpty.hidden = bulletPool.length > 0;

    bulletPool.forEach((entry) => {
      const el = document.createElement('div');
      el.className = 'bullet-item';
      el.draggable = true;
      el.dataset.entryId = entry.id;

      el.innerHTML = `
        <span class="drag-handle" aria-hidden="true">⠿</span>
        <div class="bullet-item-body">
          <span class="bullet-type-tag">${sectionConfigs[entry.type].label}</span>
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
      });

      bulletPoolEl.appendChild(el);
    });
  }

  // --- Right panel render ---

  function renderResumeSections() {
    resumeSections.innerHTML = '';

    sectionOrder.forEach((section) => {
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
        <h3 class="section-title">${config.label}</h3>
        <div class="section-body drop-zone" data-section="${section}">${bodyHtml}</div>`;

      resumeSections.appendChild(sectionEl);
    });

    resumeSections.querySelectorAll('.resume-entry').forEach((el) => {
      const section = el.closest('.drop-zone').dataset.section;
      setupDrag(el, section);
      setupEntryDropTarget(el, section);
    });

    resumeSections.querySelectorAll('.drop-zone').forEach((zone) => {
      setupDropZone(zone);
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
  });

  // --- Preview ---

  function getFieldValue(key) {
    return basicFields[key]?.value.trim() || '';
  }

  function buildSectionPreviewHtml(section, entries) {
    if (entries.length === 0) return '';

    const label = sectionConfigs[section].label;
    let itemsHtml = '';

    entries.forEach((entry) => {
      const type = entry.type;
      const { main, sub } = formatEntryHeader(type, entry);
      const bullets = entry.bullets || [];

      if (type === 'hobbies') {
        if (bullets.length) itemsHtml += `<li>${bullets.map(escapeHtml).join('、')}</li>`;
        return;
      }

      if (type === 'skills' && !main && bullets.length) {
        itemsHtml += `<li>${bullets.map(escapeHtml).join('、')}</li>`;
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
    const name = getFieldValue('name') || '您的姓名';
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
        ${photoHtml}
        <div class="preview-name">${escapeHtml(name)}</div>
        ${contactHtml}
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
      if (!previewModal.hidden) closePreview();
      addMenu.hidden = true;
      addMenuBtn.setAttribute('aria-expanded', 'false');
    }
  });

  function downloadPdf() {
    const wasHidden = previewModal.hidden;
    if (wasHidden) {
      previewContent.innerHTML = buildPreviewHtml();
      previewModal.hidden = false;
    }

    const name = getFieldValue('name') || '简历';
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
  });

  photoInput.addEventListener('change', () => {
    const file = photoInput.files && photoInput.files[0];
    photoInput.value = '';
    if (!file) return;
    const url = URL.createObjectURL(file);
    cropImg.onload = null;
    cropImg.src = url;
    cropImg.onload = () => initCropAndOpen();
  });

  function getViewportCss() {
    const r = cropView.getBoundingClientRect();
    return { W: r.width, H: r.height };
  }

  let cropState = null;

  function initCropAndOpen() {
    const { W, H } = getViewportCss();
    const natW = cropImg.naturalWidth;
    const natH = cropImg.naturalHeight;
    if (!natW || !natH) return;

    const baseScale = Math.max(W / natW, H / natH); // cover
    cropState = {
      natW, natH,
      baseScale,
      dispScale: W/W >= 0 ? baseScale : baseScale, // dispScale = css px per nat px
      originX: (W - natW * baseScale) / 2,
      originY: (H - natH * baseScale) / 2,
    };
    const maxMultiplier = Math.min(10, (natW / (W / baseScale)) || 10, (natH / (H / baseScale)) || 10);
    cropZoomRange.max = String(Math.max(1.5, Math.min(10, Math.round(maxMultiplier * 10) / 10)));
    cropZoomRange.value = '1';
    cropModal.hidden = false;
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