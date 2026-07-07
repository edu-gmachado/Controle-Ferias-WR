(() => {
  'use strict';

  const STORAGE_KEY = 'controleFerias3TurnoPWA.v5';
  const LEGACY_STORAGE_KEYS = ['controleFerias3TurnoPWA.v4', 'controleFerias3TurnoPWA.v3', 'controleFerias3TurnoPWA.v1'];
  const APP_VERSION = 5;
  const GROUPS = ['azul', 'amarelo', 'vermelho', 'verde'];
  const GROUP_CLASS = { azul: 'blue', amarelo: 'yellow', vermelho: 'red', verde: 'green' };
  const GROUP_DEFAULTS = {
    azul: { name: 'Azul', offset: 0 },
    amarelo: { name: 'Amarelo', offset: 2 },
    vermelho: { name: 'Vermelho', offset: 4 },
    verde: { name: 'Verde', offset: 6 }
  };
  const SECTORS = ['fabricacao', 'embalagem'];
  const SECTOR_LABELS = { fabricacao: 'Fabricação', embalagem: 'Embalagem' };
  const SECTOR_CLASS = { fabricacao: 'fabricacao', embalagem: 'embalagem' };

  const $ = (selector) => document.querySelector(selector);

  let state = createEmptyState();
  let initialLocalState = null;
  let authService = null;
  let dataService = null;
  let cloudConfigured = false;
  let cloudAuthenticated = false;
  let cloudAuthorized = false;
  let cloudRole = null;
  let cloudStatus = { mode: 'local', configured: false, authenticated: false, message: 'Modo local.' };
  let selectedDate = todayISO();
  let currentMonth = selectedDate.slice(0, 7);
  let deferredInstallPrompt = null;

  const els = {};

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    cacheElements();
    ensureStateShape();
    initialLocalState = readMigratableLocalState();
    selectedDate = todayISO();
    currentMonth = selectedDate.slice(0, 7);
    els.selectedDate.value = selectedDate;
    els.monthPicker.value = currentMonth;
    els.filterMonth.value = currentMonth;
    setupEvents();
    registerServiceWorker();
    renderAll();
    initDataLayer();
  }

  function cacheElements() {
    Object.assign(els, {
      cloudPanel: $('#cloudPanel'),
      cloudStatusText: $('#cloudStatusText'),
      cloudBadge: $('#cloudBadge'),
      loginForm: $('#loginForm'),
      loginEmail: $('#loginEmail'),
      loginPassword: $('#loginPassword'),
      cloudActions: $('#cloudActions'),
      logoutBtn: $('#logoutBtn'),
      migrateLocalBtn: $('#migrateLocalBtn'),
      selectedDate: $('#selectedDate'),
      monthPicker: $('#monthPicker'),
      todayBtn: $('#todayBtn'),
      prevMonthBtn: $('#prevMonthBtn'),
      nextMonthBtn: $('#nextMonthBtn'),
      calendarTitle: $('#calendarTitle'),
      calendarGrid: $('#calendarGrid'),
      offlineBadge: $('#offlineBadge'),
      kpiActive: $('#kpiActive'),
      kpiPresent: $('#kpiPresent'),
      kpiCoverage: $('#kpiCoverage'),
      kpiVacation: $('#kpiVacation'),
      kpiVacationImpact: $('#kpiVacationImpact'),
      kpiOff: $('#kpiOff'),
      kpiCritical: $('#kpiCritical'),
      kpiMinimum: $('#kpiMinimum'),
      dayTitle: $('#dayTitle'),
      daySubtitle: $('#daySubtitle'),
      dayStatus: $('#dayStatus'),
      presentList: $('#presentList'),
      vacationList: $('#vacationList'),
      offList: $('#offList'),
      memberForm: $('#memberForm'),
      memberId: $('#memberId'),
      memberName: $('#memberName'),
      memberGroup: $('#memberGroup'),
      memberSector: $('#memberSector'),
      memberActive: $('#memberActive'),
      clearMemberForm: $('#clearMemberForm'),
      membersTable: $('#membersTable'),
      vacationForm: $('#vacationForm'),
      vacationId: $('#vacationId'),
      vacationMember: $('#vacationMember'),
      vacationStart: $('#vacationStart'),
      vacationEnd: $('#vacationEnd'),
      vacationNotes: $('#vacationNotes'),
      vacationWarning: $('#vacationWarning'),
      vacationDayPreview: $('#vacationDayPreview'),
      clearVacationForm: $('#clearVacationForm'),
      filterMember: $('#filterMember'),
      filterMonth: $('#filterMonth'),
      filterStatus: $('#filterStatus'),
      clearFiltersBtn: $('#clearFiltersBtn'),
      vacationsTable: $('#vacationsTable'),
      toggleSettingsBtn: $('#toggleSettingsBtn'),
      settingsForm: $('#settingsForm'),
      baseDate: $('#baseDate'),
      groupSettings: $('#groupSettings'),
      exportBtn: $('#exportBtn'),
      exportBtnTop: $('#exportBtnTop'),
      importFile: $('#importFile'),
      sampleBtn: $('#sampleBtn'),
      resetBtn: $('#resetBtn'),
      installAppBtn: $('#installAppBtn'),
      toast: $('#toast')
    });
  }

  function setupEvents() {
    els.selectedDate.addEventListener('change', () => {
      selectedDate = els.selectedDate.value || todayISO();
      currentMonth = selectedDate.slice(0, 7);
      els.monthPicker.value = currentMonth;
      renderAll();
    });

    els.monthPicker.addEventListener('change', () => {
      currentMonth = els.monthPicker.value || todayISO().slice(0, 7);
      selectedDate = `${currentMonth}-01`;
      els.selectedDate.value = selectedDate;
      renderAll();
    });

    els.todayBtn.addEventListener('click', () => {
      selectedDate = todayISO();
      currentMonth = selectedDate.slice(0, 7);
      els.selectedDate.value = selectedDate;
      els.monthPicker.value = currentMonth;
      renderAll();
    });

    els.prevMonthBtn.addEventListener('click', () => changeMonth(-1));
    els.nextMonthBtn.addEventListener('click', () => changeMonth(1));

    els.memberForm.addEventListener('submit', saveMemberFromForm);
    els.clearMemberForm.addEventListener('click', clearMemberForm);
    els.vacationForm.addEventListener('submit', saveVacationFromForm);
    els.clearVacationForm.addEventListener('click', clearVacationForm);
    ['change', 'input'].forEach((eventName) => {
      els.vacationMember.addEventListener(eventName, renderVacationAssistant);
      els.vacationStart.addEventListener(eventName, renderVacationAssistant);
      els.vacationEnd.addEventListener(eventName, renderVacationAssistant);
    });

    els.filterMember.addEventListener('change', renderVacationsTable);
    els.filterMonth.addEventListener('change', renderVacationsTable);
    els.filterStatus.addEventListener('change', renderVacationsTable);
    els.clearFiltersBtn.addEventListener('click', () => {
      els.filterMember.value = 'all';
      els.filterMonth.value = '';
      els.filterStatus.value = 'all';
      renderVacationsTable();
    });

    els.toggleSettingsBtn.addEventListener('click', () => {
      const hidden = els.settingsForm.classList.toggle('hidden');
      els.toggleSettingsBtn.textContent = hidden ? 'Mostrar configurações de escala' : 'Ocultar configurações de escala';
      els.toggleSettingsBtn.setAttribute('aria-expanded', String(!hidden));
    });

    els.settingsForm.addEventListener('submit', saveSettings);
    els.exportBtn.addEventListener('click', exportBackup);
    els.exportBtnTop.addEventListener('click', exportBackup);
    els.importFile.addEventListener('change', importBackup);
    els.sampleBtn.addEventListener('click', restoreSampleData);
    els.resetBtn.addEventListener('click', resetAllData);
    els.loginForm.addEventListener('submit', loginToCloud);
    els.logoutBtn.addEventListener('click', logoutFromCloud);
    els.migrateLocalBtn.addEventListener('click', migrateLocalDataToCloud);

    els.installAppBtn.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      els.installAppBtn.classList.add('hidden');
    });

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      els.installAppBtn.classList.remove('hidden');
    });
  }

  function initDataLayer() {
    if (!window.FeriasAuthService || typeof window.FeriasAuthService.create !== 'function' ||
        !window.FeriasCloud || typeof window.FeriasCloud.create !== 'function') {
      cloudStatus = {
        mode: 'local',
        configured: false,
        authenticated: false,
        authorized: false,
        role: null,
        message: 'Modo local: serviços Firebase não encontrados.'
      };
      renderCloudPanel();
      return;
    }

    authService = window.FeriasAuthService.create();
    dataService = window.FeriasCloud.create(authService);

    dataService.init({
      onStatus: applyCloudStatus,
      onData: (remoteState) => {
        state = remoteState;
        ensureStateShape();
        renderAll();
      }
    });

    authService.init({
      onStatus: (status) => {
        applyCloudStatus(status);
        if (dataService && typeof dataService.handleAuthStatus === 'function') {
          dataService.handleAuthStatus(status);
        }
      }
    });
  }

  function applyCloudStatus(status) {
    const previousAuthenticated = cloudAuthenticated;
    cloudStatus = status || cloudStatus;
    cloudConfigured = Boolean(cloudStatus.configured);
    cloudAuthenticated = Boolean(cloudStatus.authenticated);
    cloudAuthorized = Boolean(cloudStatus.authorized);
    cloudRole = cloudStatus.role || null;

    if (cloudConfigured && (!cloudAuthenticated || !cloudAuthorized)) {
      state = createEmptyState();
      clearMemberFormSafe();
      clearVacationFormSafe();
      if (previousAuthenticated || state.members.length || state.vacations.length) {
        renderAll();
        return;
      }
    }

    renderCloudPanel();
  }

  function renderCloudPanel() {
    if (!els.cloudStatusText) return;
    const mode = cloudStatus.mode || 'local';
    const configured = Boolean(cloudStatus.configured);
    const authenticated = Boolean(cloudStatus.authenticated);
    const authorized = Boolean(cloudStatus.authorized);
    const role = cloudStatus.role || null;
    const message = cloudStatus.message || 'Modo local.';

    els.cloudStatusText.textContent = message;

    if (!configured) {
      els.cloudBadge.textContent = 'Local';
      els.cloudBadge.className = 'badge alert';
      els.loginForm.classList.add('hidden');
      els.cloudActions.classList.add('hidden');
      els.migrateLocalBtn.disabled = true;
      setEditLock(false);
      return;
    }

    if (configured && !authenticated) {
      els.cloudBadge.textContent = 'Login necessário';
      els.cloudBadge.className = 'badge alert';
      els.loginForm.classList.remove('hidden');
      els.cloudActions.classList.add('hidden');
      els.migrateLocalBtn.disabled = true;
      setEditLock(true);
      return;
    }

    els.loginForm.classList.add('hidden');
    els.cloudActions.classList.remove('hidden');

    if (!authorized) {
      els.cloudBadge.textContent = 'Sem permissão';
      els.cloudBadge.className = 'badge alert';
      els.migrateLocalBtn.disabled = true;
      setEditLock(true);
      return;
    }

    if (role === 'viewer') {
      els.cloudBadge.textContent = 'Visualizador';
      els.cloudBadge.className = 'badge ok';
      els.migrateLocalBtn.disabled = true;
      setEditLock(true);
      return;
    }

    els.cloudBadge.textContent = mode === 'cloud' ? 'Admin' : 'Local';
    els.cloudBadge.className = 'badge ok';
    els.migrateLocalBtn.disabled = false;
    setEditLock(false);
  }

  function setEditLock(locked) {
    const selectors = [
      '#memberForm input', '#memberForm select', '#memberForm button',
      '#vacationForm input', '#vacationForm select', '#vacationForm textarea', '#vacationForm button',
      '#settingsForm input', '#settingsForm button',
      '#sampleBtn', '#resetBtn', '#importFile'
    ];
    document.querySelectorAll(selectors.join(',')).forEach((element) => {
      if (element.id === 'toggleSettingsBtn') return;
      element.disabled = locked;
    });
  }

  function isCloudWriteMode() {
    return Boolean(dataService && dataService.canWrite && dataService.canWrite());
  }

  function canEditData() {
    return !cloudConfigured || isCloudWriteMode();
  }

  function cloudWriteBlockMessage() {
    if (!cloudConfigured) return '';
    if (!cloudAuthenticated) return 'Entre na nuvem antes de alterar dados.';
    if (!cloudAuthorized) return 'Seu usuário não tem permissão neste banco. Confira o documento roles no Firestore.';
    if (cloudRole === 'viewer') return 'Seu acesso é de visualizador. Apenas administradores podem alterar dados.';
    return 'Você precisa estar logado como administrador para alterar dados.';
  }

  function shouldBlockWrite() {
    return cloudConfigured && !isCloudWriteMode();
  }

  async function loginToCloud(event) {
    event.preventDefault();
    if (!authService) return;
    const email = els.loginEmail.value.trim();
    const password = els.loginPassword.value;
    if (!email || !password) {
      showToast('Informe e-mail e senha.');
      return;
    }
    try {
      await authService.login(email, password);
      els.loginPassword.value = '';
      showToast('Login realizado. Sincronização em tempo real ativada.');
    } catch (error) {
      console.error(error);
      showToast('Não foi possível entrar. Confira e-mail, senha e Firebase.');
    }
  }

  async function logoutFromCloud() {
    if (!authService) return;
    try {
      await authService.logout();
      showToast('Você saiu da sincronização em nuvem.');
    } catch (error) {
      console.error(error);
      showToast('Não foi possível sair da nuvem.');
    }
  }

  function clearMemberFormSafe() {
    if (!els.memberId) return;
    clearMemberForm();
  }

  function clearVacationFormSafe() {
    if (!els.vacationId) return;
    clearVacationForm();
  }

  async function migrateLocalDataToCloud() {
    if (!isCloudWriteMode()) {
      showToast(cloudWriteBlockMessage() || 'Entre como administrador para migrar dados locais.');
      return;
    }
    const message = 'Migrar os dados locais salvos neste navegador para a nuvem? Isso substituirá os dados atuais do Firestore para este app.';
    if (!window.confirm(message)) return;
    try {
      const localState = structuredCloneSafe(initialLocalState || readMigratableLocalState());
      if (!localState || (!localState.members.length && !localState.vacations.length)) {
        showToast('Não há dados locais antigos para migrar neste navegador.');
        return;
      }
      ensureExternalStateShape(localState);
      await dataService.replaceAll(localState);
      clearLocalStorageData();
      initialLocalState = null;
      showToast('Dados locais enviados para a nuvem e removidos deste navegador.');
    } catch (error) {
      console.error(error);
      showToast('Não foi possível migrar os dados locais.');
    }
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./service-worker.js')
        .then(() => {
          els.offlineBadge.textContent = 'Offline pronto';
          els.offlineBadge.className = 'badge ok';
        })
        .catch(() => {
          els.offlineBadge.textContent = 'Offline indisponível';
          els.offlineBadge.className = 'badge alert';
        });
    } else {
      els.offlineBadge.textContent = 'Sem suporte offline';
      els.offlineBadge.className = 'badge alert';
    }
  }

  function renderAll() {
    ensureStateShape();
    renderCloudPanel();
    renderSelectors();
    renderSettingsForm();
    renderKpis();
    renderCalendar();
    renderDayDetails();
    renderMembersTable();
    renderVacationsTable();
    renderVacationAssistant();
  }

  function renderSelectors() {
    const groupOptions = GROUPS.map((key) => {
      const group = state.settings.groups[key];
      return `<option value="${key}">${escapeHtml(group.name)}</option>`;
    }).join('');

    const currentMemberGroup = els.memberGroup.value || 'azul';
    els.memberGroup.innerHTML = groupOptions;
    els.memberGroup.value = GROUPS.includes(currentMemberGroup) ? currentMemberGroup : 'azul';

    const currentSector = els.memberSector.value || 'fabricacao';
    els.memberSector.innerHTML = SECTORS
      .map((key) => `<option value="${key}">${SECTOR_LABELS[key]}</option>`)
      .join('');
    els.memberSector.value = SECTORS.includes(currentSector) ? currentSector : 'fabricacao';

    const activeMembers = sortedMembers(state.members.filter((member) => member.active));

    const memberOptions = activeMembers.map((member) => (
      `<option value="${member.id}">${escapeHtml(member.name)} — ${escapeHtml(sectorName(member.sector))} — ${escapeHtml(groupName(member.group))}</option>`
    )).join('');

    const currentVacationMember = els.vacationMember.value;
    els.vacationMember.innerHTML = memberOptions || '<option value="">Cadastre um membro ativo primeiro</option>';
    if (activeMembers.some((member) => member.id === currentVacationMember)) {
      els.vacationMember.value = currentVacationMember;
    }

    const filterCurrent = els.filterMember.value || 'all';
    els.filterMember.innerHTML = '<option value="all">Todos os colaboradores</option>' +
      sortedMembers(state.members)
        .map((member) => `<option value="${member.id}">${escapeHtml(member.name)}</option>`)
        .join('');
    if (filterCurrent === 'all' || state.members.some((member) => member.id === filterCurrent)) {
      els.filterMember.value = filterCurrent;
    }
  }

  function renderSettingsForm() {
    els.baseDate.value = state.settings.baseDate;

    els.groupSettings.innerHTML = GROUPS.map((key) => {
      const group = state.settings.groups[key];
      return `
        <div class="group-config">
          <h4><span class="badge ${GROUP_CLASS[key]}">${escapeHtml(group.name)}</span></h4>
          <div class="group-config-row">
            <div class="field">
              <label for="groupName-${key}">Nome</label>
              <input id="groupName-${key}" data-group-name="${key}" type="text" value="${escapeAttr(group.name)}" />
            </div>
            <div class="field">
              <label for="groupOffset-${key}">Defas.</label>
              <input id="groupOffset-${key}" data-group-offset="${key}" type="number" min="0" max="7" step="1" value="${Number(group.offset) || 0}" />
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderKpis() {
    const day = evaluateDay(selectedDate);
    const attention = getAttentionInfo(day);
    const monthStats = getMonthStats(currentMonth);
    const activeCount = state.members.filter((member) => member.active).length;
    const vacationImpact = day.vacation.filter((item) => item.scheduledToWork).length;

    els.kpiActive.textContent = activeCount;
    els.kpiPresent.textContent = day.present.length;
    els.kpiCoverage.textContent = `${day.coveragePercent}% de cobertura da escala`;
    els.kpiVacation.textContent = day.vacation.length;
    els.kpiVacationImpact.textContent = `${vacationImpact} impactando escala`;
    els.kpiOff.textContent = day.off.length;
    els.kpiCritical.textContent = monthStats.attentionDays;
    els.kpiMinimum.textContent = attention.isAttention
      ? attention.reasons.join(' • ')
      : 'Sem alerta pela regra atual';
  }

  function renderCalendar() {
    const [year, month] = currentMonth.split('-').map(Number);
    const first = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0).getDate();
    const startDay = first.getDay();
    const monthLabel = first.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    els.calendarTitle.textContent = titleCase(monthLabel);

    const cells = [];
    for (let i = 0; i < startDay; i += 1) {
      cells.push('<div class="calendar-day empty" aria-hidden="true"></div>');
    }

    for (let dayNumber = 1; dayNumber <= lastDay; dayNumber += 1) {
      const dateISO = `${currentMonth}-${String(dayNumber).padStart(2, '0')}`;
      const day = evaluateDay(dateISO);
      const attention = getAttentionInfo(day);
      const statusClass = attention.isAttention ? 'alert' : 'ok-day';
      const todayClass = dateISO === todayISO() ? 'today' : '';
      const selectedClass = dateISO === selectedDate ? 'selected' : '';
      const width = Math.max(0, Math.min(100, day.coveragePercent));
      const offGroups = offGroupsForDate(dateISO);
      const colorStrip = renderDayColorStrip(dateISO);
      const bands = renderVacationBands(dateISO, currentMonth);

      cells.push(`
        <button class="calendar-day ${statusClass} ${todayClass} ${selectedClass}" type="button" data-date="${dateISO}" aria-label="Ver detalhes de ${formatDateBR(dateISO)}">
          <span class="calendar-day-top">
            <span class="day-number">${dayNumber}</span>
            <span class="attention-tag ${attention.isAttention ? 'alert' : 'ok'}">${attention.isAttention ? 'Atenção' : 'Boa'}</span>
          </span>
          ${colorStrip}
          <span class="day-colors-label" title="Folga: ${offGroups.map(groupName).join(', ')}">
            Folga: ${offGroups.map(shortGroupName).join(' • ')}
          </span>
          <span class="day-lines">
            <span>Pres. <strong>${day.present.length}</strong></span>
            <span>Férias <strong>${day.vacation.length}</strong></span>
            <span>Folgas <strong>${day.off.length}</strong></span>
          </span>
          ${bands}
          <span class="coverage-bar" title="${day.coveragePercent}% de cobertura"><i style="width:${width}%"></i></span>
        </button>
      `);
    }

    els.calendarGrid.innerHTML = cells.join('');
    els.calendarGrid.querySelectorAll('[data-date]').forEach((button) => {
      button.addEventListener('click', () => {
        selectedDate = button.dataset.date;
        currentMonth = selectedDate.slice(0, 7);
        els.selectedDate.value = selectedDate;
        els.monthPicker.value = currentMonth;
        renderAll();
      });
    });
  }

  function renderDayDetails() {
    const day = evaluateDay(selectedDate);
    const expected = day.expectedWork.length;
    const attention = getAttentionInfo(day);
    const statusText = attention.isAttention ? 'Atenção' : 'Cobertura boa';
    const statusClass = attention.isAttention ? 'alert' : 'ok';
    const workingGroups = workingGroupsForDate(selectedDate).map(groupName).join(', ');
    const reasonText = attention.isAttention ? attention.reasons.join(' • ') : 'Até 2 pessoas de setores diferentes em férias é permitido pela regra.';

    els.dayTitle.textContent = formatLongDate(selectedDate);
    els.daySubtitle.textContent = `3º turno • trabalham: ${workingGroups} • ${statusText}`;
    els.dayStatus.innerHTML = `
      <div class="status-mini"><span>Status</span><strong><span class="pill ${statusClass}">${statusText}</span></strong></div>
      <div class="status-mini"><span>Escalados no dia</span><strong>${expected}</strong></div>
      <div class="status-mini"><span>Presentes</span><strong>${day.present.length}</strong></div>
      <div class="status-mini"><span>Regra de atenção</span><strong class="status-reason">${escapeHtml(reasonText)}</strong></div>
    `;

    renderPeopleList(els.presentList, day.present, 'Nenhum colaborador presente nesta data.', (item) => ({
      title: item.member.name,
      subtitle: `${sectorName(item.member.sector)} • ${groupName(item.member.group)} • dia ${item.cycleDay} do ciclo`,
      badge: groupBadge(item.member.group)
    }));

    renderPeopleList(els.vacationList, day.vacation, 'Nenhum colaborador de férias nesta data.', (item) => ({
      title: item.member.name,
      subtitle: `${formatDateBR(item.vacation.startDate)} a ${formatDateBR(item.vacation.endDate)}${item.vacation.notes ? ` • ${item.vacation.notes}` : ''}`,
      badge: `${sectorBadge(item.member.sector)} ${item.scheduledToWork ? '<span class="pill critical">Impacta escala</span>' : '<span class="pill alert">Cairia em folga</span>'}`
    }));

    renderPeopleList(els.offList, day.off, 'Nenhum colaborador em folga 6x2 nesta data.', (item) => ({
      title: item.member.name,
      subtitle: `${sectorName(item.member.sector)} • ${groupName(item.member.group)} • dia ${item.cycleDay} do ciclo`,
      badge: groupBadge(item.member.group)
    }));
  }

  function renderPeopleList(container, items, emptyMessage, projector) {
    if (!items.length) {
      container.innerHTML = `<div class="empty-msg">${escapeHtml(emptyMessage)}</div>`;
      return;
    }

    container.innerHTML = SECTORS.map((sector) => {
      const sectorItems = sortedItemsByMember(items.filter((item) => item.member.sector === sector));
      return `
        <section class="sector-block">
          <div class="sector-title">
            ${sectorBadge(sector)}
            <small>${sectorItems.length} colaborador${sectorItems.length === 1 ? '' : 'es'}</small>
          </div>
          <div class="sector-list">
            ${sectorItems.length ? sectorItems.map((item) => {
              const data = projector(item);
              return `
                <article class="person-card">
                  <span class="person-meta">
                    <strong>${escapeHtml(data.title)}</strong>
                    <small>${escapeHtml(data.subtitle)}</small>
                  </span>
                  <span class="badges-inline">${data.badge}</span>
                </article>
              `;
            }).join('') : '<div class="empty-msg compact">Nenhum neste setor.</div>'}
          </div>
        </section>
      `;
    }).join('');
  }

  function renderMembersTable() {
    const editable = canEditData();
    const rows = SECTORS.map((sector) => {
      const members = sortedMembers(state.members.filter((member) => member.sector === sector));
      const memberRows = members.map((member) => `
        <tr>
          <td>${escapeHtml(member.name)}</td>
          <td>${sectorBadge(member.sector)}</td>
          <td>${groupBadge(member.group)}</td>
          <td>${member.active ? '<span class="pill ok">Ativo</span>' : '<span class="pill inactive">Inativo</span>'}</td>
          <td>
            ${editable ? `
              <span class="table-actions">
                <button class="icon-btn edit" type="button" data-edit-member="${member.id}">Editar</button>
                <button class="icon-btn delete" type="button" data-delete-member="${member.id}">Excluir</button>
              </span>
            ` : '<span class="muted-cell">Visualização</span>'}
          </td>
        </tr>
      `).join('') || `<tr><td colspan="5" class="muted-cell">Nenhum membro em ${SECTOR_LABELS[sector]}.</td></tr>`;

      return `
        <tr class="sector-row"><td colspan="5">${SECTOR_LABELS[sector]}</td></tr>
        ${memberRows}
      `;
    }).join('');

    els.membersTable.innerHTML = rows || '<tr><td colspan="5">Nenhum membro cadastrado.</td></tr>';

    els.membersTable.querySelectorAll('[data-edit-member]').forEach((button) => {
      button.addEventListener('click', () => editMember(button.dataset.editMember));
    });
    els.membersTable.querySelectorAll('[data-delete-member]').forEach((button) => {
      button.addEventListener('click', () => deleteMember(button.dataset.deleteMember));
    });
  }

  function renderVacationsTable() {
    const today = todayISO();
    const editable = canEditData();
    const filterMember = els.filterMember.value || 'all';
    const filterMonth = els.filterMonth.value || '';
    const filterStatus = els.filterStatus.value || 'all';

    const rows = state.vacations
      .slice()
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .filter((vacation) => {
        if (filterMember !== 'all' && vacation.memberId !== filterMember) return false;
        if (filterMonth && !periodIntersectsMonth(vacation.startDate, vacation.endDate, filterMonth)) return false;
        const status = vacationStatus(vacation, today).key;
        if (filterStatus !== 'all' && status !== filterStatus) return false;
        return true;
      })
      .map((vacation) => {
        const member = memberById(vacation.memberId);
        const status = vacationStatus(vacation, today);
        return `
          <tr>
            <td>${escapeHtml(member ? member.name : 'Colaborador removido')}</td>
            <td>${member ? sectorBadge(member.sector) : '<span class="pill inactive">Sem setor</span>'}</td>
            <td>${member ? groupBadge(member.group) : '-'}</td>
            <td>${formatDateBR(vacation.startDate)}</td>
            <td>${formatDateBR(vacation.endDate)}</td>
            <td>${daysBetween(vacation.startDate, vacation.endDate) + 1}</td>
            <td><span class="pill ${status.className}">${status.label}</span></td>
            <td>${escapeHtml(vacation.notes || '-')}</td>
            <td>
              ${editable ? `
                <span class="table-actions">
                  <button class="icon-btn edit" type="button" data-edit-vacation="${vacation.id}">Editar</button>
                  <button class="icon-btn delete" type="button" data-delete-vacation="${vacation.id}">Excluir</button>
                </span>
              ` : '<span class="muted-cell">Visualização</span>'}
            </td>
          </tr>
        `;
      });

    els.vacationsTable.innerHTML = rows.join('') || '<tr><td colspan="9">Nenhuma férias encontrada para os filtros atuais.</td></tr>';

    els.vacationsTable.querySelectorAll('[data-edit-vacation]').forEach((button) => {
      button.addEventListener('click', () => editVacation(button.dataset.editVacation));
    });
    els.vacationsTable.querySelectorAll('[data-delete-vacation]').forEach((button) => {
      button.addEventListener('click', () => deleteVacation(button.dataset.deleteVacation));
    });
  }

  async function saveMemberFromForm(event) {
    event.preventDefault();
    const name = els.memberName.value.trim();
    const group = els.memberGroup.value;
    const sector = els.memberSector.value;
    const active = els.memberActive.checked;
    const id = els.memberId.value;

    if (!name) {
      showToast('Informe o nome do colaborador.');
      return;
    }
    if (!SECTORS.includes(sector)) {
      showToast('Selecione Fabricação ou Embalagem.');
      return;
    }

    const memberPayload = { id: id || newId('m'), name, group, sector, active };

    try {
      if (isCloudWriteMode()) {
        await dataService.upsertMember(memberPayload);
        showToast(id ? 'Membro atualizado na nuvem.' : 'Membro adicionado na nuvem.');
      } else {
        if (shouldBlockWrite()) {
          showToast(cloudWriteBlockMessage());
          return;
        }

        if (id) {
          const member = memberById(id);
          if (!member) return;
          member.name = name;
          member.group = group;
          member.sector = sector;
          member.active = active;
          showToast('Membro atualizado.');
        } else {
          state.members.push(memberPayload);
          showToast('Membro adicionado.');
        }
        renderAll();
      }

      clearMemberForm();
    } catch (error) {
      console.error(error);
      showToast('Não foi possível salvar o membro. Confira conexão e permissões.');
    }
  }

  function clearMemberForm() {
    els.memberId.value = '';
    els.memberName.value = '';
    els.memberGroup.value = 'azul';
    els.memberSector.value = 'fabricacao';
    els.memberActive.checked = true;
  }

  function editMember(id) {
    const member = memberById(id);
    if (!member) return;
    els.memberId.value = member.id;
    els.memberName.value = member.name;
    els.memberGroup.value = member.group;
    els.memberSector.value = member.sector;
    els.memberActive.checked = member.active;
    els.memberName.focus();
  }

  async function deleteMember(id) {
    const member = memberById(id);
    if (!member) return;
    const hasVacations = state.vacations.some((vacation) => vacation.memberId === id);
    const message = hasVacations
      ? `Excluir ${member.name}? As férias cadastradas para este colaborador também serão removidas.`
      : `Excluir ${member.name}?`;
    if (!window.confirm(message)) return;

    try {
      if (isCloudWriteMode()) {
        await dataService.deleteMember(id);
        showToast('Membro excluído da nuvem.');
      } else {
        if (shouldBlockWrite()) {
          showToast(cloudWriteBlockMessage());
          return;
        }
        state.members = state.members.filter((item) => item.id !== id);
        state.vacations = state.vacations.filter((vacation) => vacation.memberId !== id);
        showToast('Membro excluído.');
        renderAll();
      }
      clearMemberForm();
    } catch (error) {
      console.error(error);
      showToast('Não foi possível excluir o membro.');
    }
  }

  async function saveVacationFromForm(event) {
    event.preventDefault();
    const id = els.vacationId.value;
    const memberId = els.vacationMember.value;
    const startDate = els.vacationStart.value;
    const endDate = els.vacationEnd.value;
    const notes = els.vacationNotes.value.trim();

    if (!memberId || !startDate || !endDate) {
      showToast('Preencha colaborador, início e fim das férias.');
      return;
    }

    if (startDate > endDate) {
      showToast('A data final não pode ser anterior à data inicial.');
      return;
    }

    const sameMemberConflicts = findVacationConflicts(memberId, startDate, endDate, id);
    const otherMemberOverlaps = findVacationOverlapsWithOthers(memberId, startDate, endDate, id);

    if (sameMemberConflicts.length || otherMemberOverlaps.length) {
      const warnings = [];
      if (sameMemberConflicts.length) {
        const text = sameMemberConflicts
          .map((vacation) => `${formatDateBR(vacation.startDate)} a ${formatDateBR(vacation.endDate)}`)
          .join(', ');
        warnings.push(`Conflito com férias já cadastradas para o mesmo colaborador: ${text}.`);
      }
      if (otherMemberOverlaps.length) {
        warnings.push('Sobreposição com férias de outras pessoas:');
        otherMemberOverlaps.forEach((overlap) => {
          warnings.push(`- ${overlap.member.name}: ${overlap.days} dia${overlap.days === 1 ? '' : 's'} sobreposto${overlap.days === 1 ? '' : 's'} (${formatDateBR(overlap.overlapStart)} a ${formatDateBR(overlap.overlapEnd)})`);
        });
      }
      warnings.push('Deseja salvar mesmo assim?');
      if (!window.confirm(warnings.join('\n'))) return;
    }

    const vacationPayload = { id: id || newId('v'), memberId, startDate, endDate, notes };

    try {
      if (isCloudWriteMode()) {
        await dataService.upsertVacation(vacationPayload);
        showToast(id ? 'Férias atualizadas na nuvem.' : 'Férias cadastradas na nuvem.');
      } else {
        if (shouldBlockWrite()) {
          showToast(cloudWriteBlockMessage());
          return;
        }

        if (id) {
          const vacation = state.vacations.find((item) => item.id === id);
          if (!vacation) return;
          vacation.memberId = memberId;
          vacation.startDate = startDate;
          vacation.endDate = endDate;
          vacation.notes = notes;
          showToast('Férias atualizadas.');
        } else {
          state.vacations.push(vacationPayload);
          showToast('Férias cadastradas.');
        }
        renderAll();
      }

      clearVacationForm();
    } catch (error) {
      console.error(error);
      showToast('Não foi possível salvar as férias. Confira conexão e permissões.');
    }
  }

  function clearVacationForm() {
    els.vacationId.value = '';
    els.vacationStart.value = '';
    els.vacationEnd.value = '';
    els.vacationNotes.value = '';
    els.vacationWarning.classList.add('hidden');
    els.vacationWarning.textContent = '';
    els.vacationDayPreview.classList.add('hidden');
    els.vacationDayPreview.innerHTML = '';
  }

  function editVacation(id) {
    const vacation = state.vacations.find((item) => item.id === id);
    if (!vacation) return;
    els.vacationId.value = vacation.id;
    els.vacationMember.value = vacation.memberId;
    els.vacationStart.value = vacation.startDate;
    els.vacationEnd.value = vacation.endDate;
    els.vacationNotes.value = vacation.notes || '';
    renderVacationAssistant();
    els.vacationMember.focus();
  }

  async function deleteVacation(id) {
    const vacation = state.vacations.find((item) => item.id === id);
    if (!vacation) return;
    const member = memberById(vacation.memberId);
    if (!window.confirm(`Excluir férias de ${member ? member.name : 'colaborador'} entre ${formatDateBR(vacation.startDate)} e ${formatDateBR(vacation.endDate)}?`)) return;

    try {
      if (isCloudWriteMode()) {
        await dataService.deleteVacation(id);
        showToast('Férias excluídas da nuvem.');
      } else {
        if (shouldBlockWrite()) {
          showToast(cloudWriteBlockMessage());
          return;
        }
        state.vacations = state.vacations.filter((item) => item.id !== id);
        showToast('Férias excluídas.');
        renderAll();
      }
      clearVacationForm();
    } catch (error) {
      console.error(error);
      showToast('Não foi possível excluir as férias.');
    }
  }

  function renderVacationAssistant() {
    renderVacationWarning();
    renderVacationDayPreview();
  }

  function renderVacationWarning() {
    const id = els.vacationId.value;
    const memberId = els.vacationMember.value;
    const startDate = els.vacationStart.value;
    const endDate = els.vacationEnd.value;

    if (!memberId || !startDate || !endDate || startDate > endDate) {
      els.vacationWarning.classList.add('hidden');
      els.vacationWarning.innerHTML = '';
      return;
    }

    const sameMemberConflicts = findVacationConflicts(memberId, startDate, endDate, id);
    const otherMemberOverlaps = findVacationOverlapsWithOthers(memberId, startDate, endDate, id);
    const blocks = [];

    if (sameMemberConflicts.length) {
      const items = sameMemberConflicts
        .map((vacation) => `<li>${formatDateBR(vacation.startDate)} a ${formatDateBR(vacation.endDate)}</li>`)
        .join('');
      blocks.push(`<strong>Conflito com o mesmo colaborador:</strong><ul>${items}</ul>`);
    }

    if (otherMemberOverlaps.length) {
      const items = otherMemberOverlaps.map((overlap) => `
        <li>
          <strong>${escapeHtml(overlap.member.name)}</strong> — ${overlap.days} dia${overlap.days === 1 ? '' : 's'} sobreposto${overlap.days === 1 ? '' : 's'}
          <small>(${formatDateBR(overlap.overlapStart)} a ${formatDateBR(overlap.overlapEnd)})</small>
        </li>
      `).join('');
      blocks.push(`<strong>Sobreposição com férias de outras pessoas:</strong><ul>${items}</ul>`);
    }

    if (!blocks.length) {
      els.vacationWarning.classList.add('hidden');
      els.vacationWarning.innerHTML = '';
      return;
    }

    els.vacationWarning.innerHTML = blocks.join('');
    els.vacationWarning.classList.remove('hidden');
  }

  function renderVacationDayPreview() {
    const member = memberById(els.vacationMember.value);
    const startDate = els.vacationStart.value;
    const endDate = els.vacationEnd.value;

    if (!member || !startDate || !endDate || startDate > endDate) {
      els.vacationDayPreview.classList.add('hidden');
      els.vacationDayPreview.innerHTML = '';
      return;
    }

    const totalDays = daysBetween(startDate, endDate) + 1;
    const limit = Math.min(totalDays, 62);
    const rows = [];
    for (let index = 0; index < limit; index += 1) {
      const dateISO = addDaysISO(startDate, index);
      const schedule = scheduleForMember(member, dateISO);
      const working = workingGroupsForDate(dateISO);
      const off = offGroupsForDate(dateISO);
      rows.push(`
        <div class="preview-day">
          <strong>${formatShortDate(dateISO)}</strong>
          <span class="preview-colors" title="Trabalham: ${working.map(groupName).join(', ')}. Folga: ${off.map(groupName).join(', ')}">
            ${GROUPS.map((group) => `<i class="color-dot ${GROUP_CLASS[group]} ${working.includes(group) ? '' : 'off'}" title="${escapeAttr(groupName(group))}"></i>`).join('')}
          </span>
          <small>${groupName(member.group)}: ${schedule.works ? 'trabalharia' : 'folga 6x2'}</small>
        </div>
      `);
    }

    els.vacationDayPreview.innerHTML = `
      <div class="preview-title">
        <strong>Cores da escala no período</strong>
        <span>${totalDays} dia${totalDays === 1 ? '' : 's'} corrido${totalDays === 1 ? '' : 's'}</span>
      </div>
      <div class="preview-grid">${rows.join('')}</div>
      ${totalDays > limit ? `<div class="preview-more">Mostrando os primeiros ${limit} dias de ${totalDays}.</div>` : ''}
    `;
    els.vacationDayPreview.classList.remove('hidden');
  }

  async function saveSettings(event) {
    event.preventDefault();
    const baseDate = els.baseDate.value;

    if (!baseDate) {
      showToast('Confira a data-base da escala.');
      return;
    }

    const nextSettings = {
      baseDate,
      groups: structuredCloneSafe(state.settings.groups)
    };

    GROUPS.forEach((key) => {
      const nameInput = document.querySelector(`[data-group-name="${key}"]`);
      const offsetInput = document.querySelector(`[data-group-offset="${key}"]`);
      const name = nameInput.value.trim() || GROUP_DEFAULTS[key].name;
      const offset = normalizeOffset(Number(offsetInput.value));
      nextSettings.groups[key] = { name, offset };
    });

    try {
      if (isCloudWriteMode()) {
        await dataService.setSettings(nextSettings);
        showToast('Configurações salvas na nuvem.');
      } else {
        if (shouldBlockWrite()) {
          showToast(cloudWriteBlockMessage());
          return;
        }
        state.settings = nextSettings;
        showToast('Configurações de escala salvas.');
        renderAll();
      }
    } catch (error) {
      console.error(error);
      showToast('Não foi possível salvar as configurações.');
    }
  }

  function exportBackup() {
    const payload = {
      exportedAt: new Date().toISOString(),
      app: 'Controle de Férias - 3º Turno',
      appVersion: APP_VERSION,
      data: state
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup-ferias-3turno-${todayISO()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast('Backup exportado.');
  }

  function importBackup(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const importedState = parsed.data || parsed;
        validateImportedState(importedState);
        ensureExternalStateShape(importedState);

        if (isCloudWriteMode()) {
          const message = 'Importar este backup para a nuvem? Isso substituirá os dados atuais do Firestore para este app.';
          if (!window.confirm(message)) return;
          await dataService.replaceAll(importedState);
          showToast('Backup importado para a nuvem com sucesso.');
        } else {
          if (shouldBlockWrite()) {
            showToast(cloudWriteBlockMessage() || 'Entre como administrador para importar dados.');
            return;
          }
          state = importedState;
          ensureStateShape();
          clearMemberForm();
          clearVacationForm();
          showToast('Backup importado apenas para esta sessão. Configure a nuvem para manter os dados.');
          renderAll();
        }
      } catch (error) {
        console.error(error);
        showToast('Arquivo inválido. Confira se é um backup JSON deste app.');
      } finally {
        els.importFile.value = '';
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  async function restoreSampleData() {
    if (!window.confirm('Restaurar dados de exemplo? Os dados atuais serão substituídos.')) return;
    const sample = createSampleState();

    try {
      if (isCloudWriteMode()) {
        await dataService.replaceAll(sample);
        showToast('Dados de exemplo enviados para a nuvem.');
      } else {
        if (shouldBlockWrite()) {
          showToast(cloudWriteBlockMessage());
          return;
        }
        state = sample;
        showToast('Dados de exemplo carregados apenas nesta sessão. Configure a nuvem para manter os dados.');
        renderAll();
      }

      clearMemberForm();
      clearVacationForm();
      selectedDate = todayISO();
      currentMonth = selectedDate.slice(0, 7);
      els.selectedDate.value = selectedDate;
      els.monthPicker.value = currentMonth;
      els.filterMonth.value = currentMonth;
    } catch (error) {
      console.error(error);
      showToast('Não foi possível restaurar os dados de exemplo.');
    }
  }

  async function resetAllData() {
    if (!window.confirm('Apagar todos os membros, férias e configurações?')) return;
    const empty = createEmptyState();

    try {
      if (isCloudWriteMode()) {
        await dataService.clearAll(empty);
        showToast('Todos os dados foram apagados da nuvem.');
      } else {
        if (shouldBlockWrite()) {
          showToast(cloudWriteBlockMessage());
          return;
        }
        state = empty;
        showToast('Todos os dados foram apagados desta sessão.');
        renderAll();
      }
      clearMemberForm();
      clearVacationForm();
    } catch (error) {
      console.error(error);
      showToast('Não foi possível apagar os dados.');
    }
  }

  function evaluateDay(dateISO) {
    const activeMembers = state.members.filter((member) => member.active);
    const result = {
      date: dateISO,
      activeMembers,
      expectedWork: [],
      present: [],
      vacation: [],
      off: [],
      coveragePercent: 0
    };

    activeMembers.forEach((member) => {
      const schedule = scheduleForMember(member, dateISO);
      const vacation = vacationForMemberOnDate(member.id, dateISO);
      const item = { member, cycleDay: schedule.cycleDay, scheduledToWork: schedule.works, vacation };

      if (schedule.works) result.expectedWork.push(item);
      if (vacation) result.vacation.push(item);
      else if (schedule.works) result.present.push(item);
      else result.off.push(item);
    });

    const expected = result.expectedWork.length;
    result.coveragePercent = expected ? Math.round((result.present.length / expected) * 100) : 100;
    return result;
  }

  function scheduleForMember(member, dateISO) {
    return scheduleForGroup(member.group, dateISO);
  }

  function scheduleForGroup(groupKey, dateISO) {
    const group = state.settings.groups[groupKey] || GROUP_DEFAULTS.azul;
    const diff = daysBetween(state.settings.baseDate, dateISO);
    const cycleIndex = positiveModulo(diff - Number(group.offset || 0), 8);
    return {
      cycleIndex,
      cycleDay: cycleIndex + 1,
      works: cycleIndex < 6
    };
  }

  function workingGroupsForDate(dateISO) {
    return GROUPS.filter((group) => scheduleForGroup(group, dateISO).works);
  }

  function offGroupsForDate(dateISO) {
    return GROUPS.filter((group) => !scheduleForGroup(group, dateISO).works);
  }

  function renderDayColorStrip(dateISO) {
    const off = offGroupsForDate(dateISO);
    return `
      <span class="calendar-color-strip single-off" aria-label="Cor em folga no dia">
        ${off.map((group) => `<i class="color-segment ${GROUP_CLASS[group]}" title="${escapeAttr(groupName(group))}: folga"></i>`).join('')}
      </span>
    `;
  }

  function renderVacationBands(dateISO, monthISO) {
    const bands = vacationBandsForDate(dateISO, monthISO);
    if (!bands.length) return '<span class="vacation-bands empty-bands"></span>';
    const visible = bands.slice(0, 3).map(({ vacation, member, classNames }) => `
      <span class="vacation-band ${GROUP_CLASS[member.group]} ${classNames}" title="${escapeAttr(member.name)}: ${formatDateBR(vacation.startDate)} a ${formatDateBR(vacation.endDate)}">
        <span>${escapeHtml(firstName(member.name))}</span>
      </span>
    `).join('');
    const more = bands.length > 3 ? `<span class="vacation-band more">+${bands.length - 3}</span>` : '';
    return `<span class="vacation-bands">${visible}${more}</span>`;
  }

  function vacationBandsForDate(dateISO, monthISO) {
    const firstMonthDay = `${monthISO}-01`;
    const [, month] = monthISO.split('-').map(Number);
    const year = Number(monthISO.slice(0, 4));
    const lastMonthDay = `${monthISO}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;

    return state.vacations
      .filter((vacation) => dateISO >= vacation.startDate && dateISO <= vacation.endDate)
      .map((vacation) => ({ vacation, member: memberById(vacation.memberId) }))
      .filter(({ member }) => member && member.active)
      .sort((a, b) => a.member.name.localeCompare(b.member.name, 'pt-BR'))
      .map(({ vacation, member }) => {
        const visibleStart = vacation.startDate < firstMonthDay ? firstMonthDay : vacation.startDate;
        const visibleEnd = vacation.endDate > lastMonthDay ? lastMonthDay : vacation.endDate;
        const classes = [
          dateISO === visibleStart ? 'start' : 'middle',
          dateISO === visibleEnd ? 'end' : 'middle'
        ].join(' ');
        return { vacation, member, classNames: classes };
      });
  }

  function getAttentionInfo(day) {
    const reasons = [];
    if (day.vacation.length >= 3) {
      reasons.push(`${day.vacation.length} pessoas de férias no mesmo dia`);
    }

    const bySector = countBySector(day.vacation);
    Object.entries(bySector).forEach(([sector, count]) => {
      if (count >= 2) reasons.push(`${count} de ${sectorName(sector)} em férias`);
    });

    return { isAttention: reasons.length > 0, reasons };
  }

  function countBySector(items) {
    return items.reduce((acc, item) => {
      const sector = item.member?.sector || 'fabricacao';
      acc[sector] = (acc[sector] || 0) + 1;
      return acc;
    }, {});
  }

  function getMonthStats(monthISO) {
    const [, month] = monthISO.split('-').map(Number);
    const year = Number(monthISO.slice(0, 4));
    const lastDay = new Date(year, month, 0).getDate();
    let attentionDays = 0;
    let maxVacation = 0;

    for (let dayNumber = 1; dayNumber <= lastDay; dayNumber += 1) {
      const dateISO = `${monthISO}-${String(dayNumber).padStart(2, '0')}`;
      const day = evaluateDay(dateISO);
      if (getAttentionInfo(day).isAttention) attentionDays += 1;
      maxVacation = Math.max(maxVacation, day.vacation.length);
    }

    return { attentionDays, maxVacation };
  }

  function findVacationConflicts(memberId, startDate, endDate, ignoreId = '') {
    return state.vacations.filter((vacation) => (
      vacation.memberId === memberId &&
      vacation.id !== ignoreId &&
      periodsOverlap(startDate, endDate, vacation.startDate, vacation.endDate)
    ));
  }

  function findVacationOverlapsWithOthers(memberId, startDate, endDate, ignoreId = '') {
    return state.vacations
      .filter((vacation) => (
        vacation.memberId !== memberId &&
        vacation.id !== ignoreId &&
        periodsOverlap(startDate, endDate, vacation.startDate, vacation.endDate)
      ))
      .map((vacation) => {
        const member = memberById(vacation.memberId);
        const overlapStart = maxISODate(startDate, vacation.startDate);
        const overlapEnd = minISODate(endDate, vacation.endDate);
        return {
          vacation,
          member: member || { id: vacation.memberId, name: 'Colaborador removido', sector: 'fabricacao', group: 'azul' },
          overlapStart,
          overlapEnd,
          days: daysBetween(overlapStart, overlapEnd) + 1
        };
      })
      .sort((a, b) => a.member.name.localeCompare(b.member.name, 'pt-BR'));
  }

  function vacationForMemberOnDate(memberId, dateISO) {
    return state.vacations.find((vacation) => (
      vacation.memberId === memberId && dateISO >= vacation.startDate && dateISO <= vacation.endDate
    ));
  }

  function memberById(id) {
    return state.members.find((member) => member.id === id);
  }

  function groupName(key) {
    return (state.settings.groups[key] && state.settings.groups[key].name) || key;
  }

  function shortGroupName(key) {
    return groupName(key).slice(0, 3);
  }

  function groupBadge(key) {
    return `<span class="pill ${GROUP_CLASS[key] || ''}">${escapeHtml(groupName(key))}</span>`;
  }

  function sectorName(key) {
    return SECTOR_LABELS[key] || 'Fabricação';
  }

  function sectorBadge(key) {
    return `<span class="pill ${SECTOR_CLASS[key] || 'fabricacao'}">${escapeHtml(sectorName(key))}</span>`;
  }

  function sortedMembers(members) {
    return members.slice().sort((a, b) => {
      const sectorDiff = SECTORS.indexOf(a.sector) - SECTORS.indexOf(b.sector);
      if (sectorDiff) return sectorDiff;
      const groupDiff = GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group);
      if (groupDiff) return groupDiff;
      return a.name.localeCompare(b.name, 'pt-BR');
    });
  }

  function sortedItemsByMember(items) {
    return items.slice().sort((a, b) => {
      const groupDiff = GROUPS.indexOf(a.member.group) - GROUPS.indexOf(b.member.group);
      if (groupDiff) return groupDiff;
      return a.member.name.localeCompare(b.member.name, 'pt-BR');
    });
  }

  function changeMonth(delta) {
    const [year, month] = currentMonth.split('-').map(Number);
    const next = new Date(year, month - 1 + delta, 1);
    currentMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
    selectedDate = `${currentMonth}-01`;
    els.monthPicker.value = currentMonth;
    els.selectedDate.value = selectedDate;
    renderAll();
  }

  function readMigratableLocalState() {
    const keys = [STORAGE_KEY, ...LEGACY_STORAGE_KEYS];
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        const candidate = parsed && parsed.data ? parsed.data : parsed;
        if (candidate && typeof candidate === 'object') {
          ensureExternalStateShape(candidate);
          return candidate;
        }
      } catch {
        // ignora entradas antigas inválidas
      }
    }
    return null;
  }

  function clearLocalStorageData() {
    [STORAGE_KEY, ...LEGACY_STORAGE_KEYS].forEach((key) => localStorage.removeItem(key));
  }

  function saveState() {
    // A partir da v5, o app não persiste mais dados operacionais no localStorage.
    // Dados devem ficar no Firestore; localStorage antigo só é usado para migração manual.
  }

  function createEmptyState() {
    return {
      version: APP_VERSION,
      settings: {
        baseDate: todayISO(),
        groups: structuredCloneSafe(GROUP_DEFAULTS)
      },
      members: [],
      vacations: []
    };
  }

  function createSampleState() {
    const baseDate = todayISO();
    const plus = (days) => addDaysISO(baseDate, days);
    return {
      version: APP_VERSION,
      settings: {
        baseDate,
        groups: structuredCloneSafe(GROUP_DEFAULTS)
      },
      members: [
        { id: 'm-ana', name: 'Ana Souza', group: 'azul', sector: 'fabricacao', active: true },
        { id: 'm-bruno', name: 'Bruno Lima', group: 'azul', sector: 'fabricacao', active: true },
        { id: 'm-carla', name: 'Carla Mendes', group: 'amarelo', sector: 'fabricacao', active: true },
        { id: 'm-diego', name: 'Diego Alves', group: 'amarelo', sector: 'fabricacao', active: true },
        { id: 'm-elisa', name: 'Elisa Rocha', group: 'vermelho', sector: 'fabricacao', active: true },
        { id: 'm-felipe', name: 'Felipe Santos', group: 'vermelho', sector: 'fabricacao', active: true },
        { id: 'm-gabriela', name: 'Gabriela Nunes', group: 'verde', sector: 'embalagem', active: true },
        { id: 'm-henrique', name: 'Henrique Costa', group: 'verde', sector: 'embalagem', active: true },
        { id: 'm-iris', name: 'Íris Martins', group: 'azul', sector: 'embalagem', active: true },
        { id: 'm-joao', name: 'João Pereira', group: 'amarelo', sector: 'embalagem', active: true },
        { id: 'm-karina', name: 'Karina Melo', group: 'vermelho', sector: 'embalagem', active: true },
        { id: 'm-lucas', name: 'Lucas Ferreira', group: 'verde', sector: 'embalagem', active: true }
      ],
      vacations: [
        { id: 'v-ana-1', memberId: 'm-ana', startDate: plus(3), endDate: plus(12), notes: 'Férias programadas' },
        { id: 'v-diego-1', memberId: 'm-diego', startDate: plus(8), endDate: plus(18), notes: 'Mesmo setor para testar atenção' },
        { id: 'v-elisa-1', memberId: 'm-elisa', startDate: plus(9), endDate: plus(15), notes: 'Teste de 2 na fabricação' },
        { id: 'v-iris-1', memberId: 'm-iris', startDate: plus(20), endDate: plus(29), notes: 'Cobertura combinada' },
        { id: 'v-karina-1', memberId: 'm-karina', startDate: plus(-5), endDate: plus(2), notes: 'Em andamento' }
      ]
    };
  }

  function ensureStateShape() {
    if (!state || typeof state !== 'object') state = createEmptyState();
    const previousVersion = Number(state.version || 1);
    if (!state.settings) state.settings = createEmptyState().settings;
    if (!state.settings.baseDate) state.settings.baseDate = todayISO();
    if (!state.settings.groups) state.settings.groups = structuredCloneSafe(GROUP_DEFAULTS);

    const looksLikeOldDefaultOrder = previousVersion < APP_VERSION &&
      Number(state.settings.groups?.azul?.offset) === 0 &&
      Number(state.settings.groups?.verde?.offset) === 2 &&
      Number(state.settings.groups?.amarelo?.offset) === 4 &&
      Number(state.settings.groups?.vermelho?.offset) === 6;

    if (looksLikeOldDefaultOrder) {
      state.settings.groups = structuredCloneSafe(GROUP_DEFAULTS);
    }

    GROUPS.forEach((key) => {
      state.settings.groups[key] = {
        name: state.settings.groups[key]?.name || GROUP_DEFAULTS[key].name,
        offset: normalizeOffset(Number(state.settings.groups[key]?.offset ?? GROUP_DEFAULTS[key].offset))
      };
    });

    state.version = APP_VERSION;
    if (!Array.isArray(state.members)) state.members = [];
    if (!Array.isArray(state.vacations)) state.vacations = [];

    state.members = state.members.map((member, index) => ({
      id: member.id || newId('m'),
      name: String(member.name || 'Sem nome'),
      group: GROUPS.includes(member.group) ? member.group : 'azul',
      sector: SECTORS.includes(member.sector) ? member.sector : inferSector(index),
      active: member.active !== false
    }));

    state.vacations = state.vacations
      .filter((vacation) => vacation.memberId && vacation.startDate && vacation.endDate)
      .map((vacation) => ({
        id: vacation.id || newId('v'),
        memberId: vacation.memberId,
        startDate: vacation.startDate,
        endDate: vacation.endDate,
        notes: vacation.notes || ''
      }));
  }

  function ensureExternalStateShape(externalState) {
    const previous = state;
    state = externalState;
    ensureStateShape();
    Object.assign(externalState, structuredCloneSafe(state));
    state = previous;
  }

  function inferSector(index) {
    return index % 2 === 0 ? 'fabricacao' : 'embalagem';
  }

  function validateImportedState(importedState) {
    if (!importedState || typeof importedState !== 'object') throw new Error('Estado ausente');
    if (!Array.isArray(importedState.members)) throw new Error('Membros ausentes');
    if (!Array.isArray(importedState.vacations)) throw new Error('Férias ausentes');
  }

  function vacationStatus(vacation, referenceDate) {
    if (referenceDate >= vacation.startDate && referenceDate <= vacation.endDate) {
      return { key: 'current', label: 'Em andamento', className: 'alert' };
    }
    if (vacation.startDate > referenceDate) {
      return { key: 'future', label: 'Futura', className: 'ok' };
    }
    return { key: 'past', label: 'Encerrada', className: 'inactive' };
  }

  function periodsOverlap(startA, endA, startB, endB) {
    return startA <= endB && startB <= endA;
  }

  function maxISODate(a, b) {
    return a > b ? a : b;
  }

  function minISODate(a, b) {
    return a < b ? a : b;
  }

  function periodIntersectsMonth(startDate, endDate, monthISO) {
    const [year, month] = monthISO.split('-').map(Number);
    const first = `${monthISO}-01`;
    const last = `${monthISO}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
    return periodsOverlap(startDate, endDate, first, last);
  }

  function parseISODate(dateISO) {
    const [year, month, day] = dateISO.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  function todayISO() {
    return formatISODate(new Date());
  }

  function formatISODate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function addDaysISO(dateISO, days) {
    const date = parseISODate(dateISO);
    date.setDate(date.getDate() + days);
    return formatISODate(date);
  }

  function daysBetween(startISO, endISO) {
    const start = parseISODate(startISO);
    const end = parseISODate(endISO);
    return Math.round((end - start) / 86400000);
  }

  function formatDateBR(dateISO) {
    if (!dateISO) return '-';
    return parseISODate(dateISO).toLocaleDateString('pt-BR');
  }

  function formatShortDate(dateISO) {
    return parseISODate(dateISO).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  function formatLongDate(dateISO) {
    return parseISODate(dateISO).toLocaleDateString('pt-BR', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
    });
  }

  function titleCase(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function positiveModulo(number, divisor) {
    return ((number % divisor) + divisor) % divisor;
  }

  function normalizeOffset(value) {
    if (!Number.isFinite(value)) return 0;
    return positiveModulo(Math.round(value), 8);
  }

  function firstName(name) {
    return String(name || '').trim().split(/\s+/)[0] || 'Férias';
  }

  function newId(prefix) {
    if (window.crypto && crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function escapeAttr(value) {
    return escapeHtml(value).replaceAll('`', '&#096;');
  }

  function structuredCloneSafe(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('visible');
    window.clearTimeout(showToast.timeout);
    showToast.timeout = window.setTimeout(() => els.toast.classList.remove('visible'), 2600);
  }
})();
