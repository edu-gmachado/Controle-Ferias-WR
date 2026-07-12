(() => {
  'use strict';

  const STORAGE_KEY = 'controleFerias3TurnoPWA.v5.10';
  const LEGACY_STORAGE_KEYS = ['controleFerias3TurnoPWA.v4', 'controleFerias3TurnoPWA.v3', 'controleFerias3TurnoPWA.v1'];
  const APP_VERSION = 740;
  const VACATIONS_PAGE_SIZE = 15;
  const GROUPS = ['azul', 'amarelo', 'vermelho', 'verde'];
  const GROUP_CLASS = { azul: 'blue', amarelo: 'yellow', vermelho: 'red', verde: 'green' };
  const GROUP_DEFAULTS = {
    azul: { name: 'Azul', offset: 0 },
    amarelo: { name: 'Amarelo', offset: 2 },
    vermelho: { name: 'Vermelho', offset: 4 },
    verde: { name: 'Verde', offset: 6 }
  };
  const SECTORS = ['fabricacao', 'embalagem', 'tecnico'];
  const SECTOR_LABELS = { fabricacao: 'Fabricação', embalagem: 'Embalagem', tecnico: 'Técnico' };
  const SECTOR_CLASS = { fabricacao: 'fabricacao', embalagem: 'embalagem', tecnico: 'tecnico' };

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
  let suppressCalendarClickUntil = 0;
  let vacationPage = 1;

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
    els.filterMonth.value = '';
    setupEvents();
    registerServiceWorker();
    renderAll();
    initDataLayer();
  }

  function cacheElements() {
    Object.assign(els, {
      loginScreen: $('#loginScreen'),
      appShell: $('#appShell'),
      loginStatusText: $('#loginStatusText'),
      loginLogoutBtn: $('#loginLogoutBtn'),
      cloudPanel: $('#cloudPanel'),
      cloudStatusText: $('#cloudStatusText'),
      cloudBadge: $('#cloudBadge'),
      loginForm: $('#loginForm'),
      loginEmail: $('#loginEmail'),
      loginPassword: $('#loginPassword'),
      keepConnected: $('#keepConnected'),
      cloudActions: $('#cloudActions'),
      logoutBtn: $('#logoutBtn'),
      migrateLocalBtn: $('#migrateLocalBtn'),
      selectedDate: $('#selectedDate'),
      monthPicker: $('#monthPicker'),
      todayBtn: $('#todayBtn'),
      prevMonthBtn: $('#prevMonthBtn'),
      nextMonthBtn: $('#nextMonthBtn'),
      calendarPanel: $('.calendar-panel'),
      calendarScrollShell: $('.calendar-scroll-shell'),
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
      presentCount: $('#presentCount'),
      vacationCount: $('#vacationCount'),
      offCount: $('#offCount'),
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
      vacationHistorySummary: $('#vacationHistorySummary'),
      vacationPagination: $('#vacationPagination'),
      vacationFirstPageBtn: $('#vacationFirstPageBtn'),
      vacationPrevPageBtn: $('#vacationPrevPageBtn'),
      vacationPageInfo: $('#vacationPageInfo'),
      vacationNextPageBtn: $('#vacationNextPageBtn'),
      vacationLastPageBtn: $('#vacationLastPageBtn'),
      temporaryChangeForm: $('#temporaryChangeForm'),
      temporaryChangeId: $('#temporaryChangeId'),
      temporaryChangeType: $('#temporaryChangeType'),
      temporaryExistingMemberField: $('#temporaryExistingMemberField'),
      temporaryMemberId: $('#temporaryMemberId'),
      temporaryNewNameField: $('#temporaryNewNameField'),
      temporaryMemberName: $('#temporaryMemberName'),
      temporarySectorField: $('#temporarySectorField'),
      temporarySector: $('#temporarySector'),
      temporaryGroupField: $('#temporaryGroupField'),
      temporaryGroup: $('#temporaryGroup'),
      temporaryStart: $('#temporaryStart'),
      temporaryEnd: $('#temporaryEnd'),
      temporaryNotes: $('#temporaryNotes'),
      clearTemporaryChangeForm: $('#clearTemporaryChangeForm'),
      temporaryChangesTable: $('#temporaryChangesTable'),
      toggleMembersBtn: $('#toggleMembersBtn'),
      membersPanelContent: $('#membersPanelContent'),
      settingsPanel: $('#settingsPanel'),
      toggleSettingsBtn: $('#toggleSettingsBtn'),
      settingsForm: $('#settingsForm'),
      baseDate: $('#baseDate'),
      groupSettings: $('#groupSettings'),
      toggleAuditBtn: $('#toggleAuditBtn'),
      auditHistoryContent: $('#auditHistoryContent'),
      auditSummary: $('#auditSummary'),
      auditUserFilter: $('#auditUserFilter'),
      auditActionFilter: $('#auditActionFilter'),
      auditTable: $('#auditTable'),
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
    setupCalendarSwipe();
    setupCalendarResponsiveFit();

    els.memberForm.addEventListener('submit', saveMemberFromForm);
    els.clearMemberForm.addEventListener('click', clearMemberForm);
    els.vacationForm.addEventListener('submit', saveVacationFromForm);
    els.clearVacationForm.addEventListener('click', clearVacationForm);
    ['change', 'input'].forEach((eventName) => {
      els.vacationMember.addEventListener(eventName, renderVacationAssistant);
      els.vacationStart.addEventListener(eventName, renderVacationAssistant);
      els.vacationEnd.addEventListener(eventName, renderVacationAssistant);
    });

    els.filterMember.addEventListener('change', () => {
      // A visão geral sempre volta para férias em andamento/futuras.
      // Ao selecionar uma pessoa, o histórico completo fica disponível.
      els.filterMonth.value = '';
      els.filterStatus.value = 'all';
      vacationPage = 1;
      renderVacationsTable();
    });
    els.filterMonth.addEventListener('change', () => { vacationPage = 1; renderVacationsTable(); });
    els.filterStatus.addEventListener('change', () => { vacationPage = 1; renderVacationsTable(); });
    els.clearFiltersBtn.addEventListener('click', () => {
      els.filterMember.value = 'all';
      els.filterMonth.value = '';
      els.filterStatus.value = 'all';
      vacationPage = 1;
      renderVacationsTable();
    });

    els.vacationFirstPageBtn.addEventListener('click', () => { vacationPage = 1; renderVacationsTable(); });
    els.vacationPrevPageBtn.addEventListener('click', () => { vacationPage = Math.max(1, vacationPage - 1); renderVacationsTable(); });
    els.vacationNextPageBtn.addEventListener('click', () => { vacationPage += 1; renderVacationsTable(); });
    els.vacationLastPageBtn.addEventListener('click', () => {
      vacationPage = Number(els.vacationLastPageBtn.dataset.lastPage || 1);
      renderVacationsTable();
    });

    els.temporaryChangeType.addEventListener('change', renderTemporaryChangeFields);
    els.temporaryChangeForm.addEventListener('submit', saveTemporaryChangeFromForm);
    els.clearTemporaryChangeForm.addEventListener('click', clearTemporaryChangeForm);

    els.toggleMembersBtn.addEventListener('click', () => {
      const hidden = els.membersPanelContent.classList.toggle('hidden');
      els.toggleMembersBtn.textContent = hidden ? 'Mostrar membros do time' : 'Ocultar membros do time';
      els.toggleMembersBtn.setAttribute('aria-expanded', String(!hidden));
    });

    els.toggleSettingsBtn.addEventListener('click', () => {
      const hidden = els.settingsForm.classList.toggle('hidden');
      els.toggleSettingsBtn.textContent = hidden ? 'Mostrar configurações de escala' : 'Ocultar configurações de escala';
      els.toggleSettingsBtn.setAttribute('aria-expanded', String(!hidden));
    });

    els.toggleAuditBtn.addEventListener('click', () => {
      const hidden = els.auditHistoryContent.classList.toggle('hidden');
      els.toggleAuditBtn.textContent = hidden ? 'Ver histórico de alterações' : 'Ocultar histórico de alterações';
      els.toggleAuditBtn.setAttribute('aria-expanded', String(!hidden));
    });
    els.auditUserFilter.addEventListener('change', renderAuditHistory);
    els.auditActionFilter.addEventListener('change', renderAuditHistory);

    els.settingsForm.addEventListener('submit', saveSettings);
    els.exportBtn.addEventListener('click', exportBackup);
    els.exportBtnTop.addEventListener('click', exportBackup);
    els.importFile.addEventListener('change', importBackup);
    els.sampleBtn.addEventListener('click', restoreSampleData);
    els.resetBtn.addEventListener('click', resetAllData);
    els.loginForm.addEventListener('submit', loginToCloud);
    els.logoutBtn.addEventListener('click', logoutFromCloud);
    els.loginLogoutBtn.addEventListener('click', logoutFromCloud);
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
      clearTemporaryChangeFormSafe();
      if (previousAuthenticated || state.members.length || state.vacations.length) {
        renderAll();
        return;
      }
    }

    renderCloudPanel();
  }

  function renderCloudPanel() {
    if (!els.cloudStatusText) return;
    updateAdminOnlyVisibility();
    const mode = cloudStatus.mode || 'local';
    const configured = Boolean(cloudStatus.configured);
    const authenticated = Boolean(cloudStatus.authenticated);
    const authorized = Boolean(cloudStatus.authorized);
    const role = cloudStatus.role || null;
    const message = cloudStatus.message || 'Aguardando login.';

    els.cloudStatusText.textContent = message;
    els.loginStatusText.textContent = message;

    // A tela de login depende somente da autenticação. Depois que o Firebase
    // confirma o usuário, o app é aberto imediatamente e a permissão passa a
    // ser informada dentro do painel da nuvem. Isso evita prender um usuário
    // válido na tela cheia de login durante a leitura do documento roles/UID.
    setAuthenticatedLayout(configured && authenticated);

    if (!configured) {
      setAuthenticatedLayout(false);
      els.cloudBadge.textContent = 'Configuração necessária';
      els.cloudBadge.className = 'badge alert';
      els.loginForm.classList.add('hidden');
      els.loginLogoutBtn.classList.add('hidden');
      els.cloudActions.classList.add('hidden');
      els.migrateLocalBtn.disabled = true;
      setEditLock(true);
      return;
    }

    if (!authenticated) {
      setAuthenticatedLayout(false);
      els.cloudBadge.textContent = 'Login necessário';
      els.cloudBadge.className = 'badge alert';
      els.loginForm.classList.remove('hidden');
      els.loginLogoutBtn.classList.add('hidden');
      els.cloudActions.classList.add('hidden');
      els.migrateLocalBtn.disabled = true;
      setEditLock(true);
      return;
    }

    if (!authorized) {
      setAuthenticatedLayout(true);
      const isCheckingRole = /verificando permiss/i.test(message);
      els.cloudBadge.textContent = isCheckingRole ? 'Verificando acesso' : 'Sem permissão';
      els.cloudBadge.className = 'badge alert';
      els.loginForm.classList.add('hidden');
      els.loginLogoutBtn.classList.add('hidden');
      els.cloudActions.classList.remove('hidden');
      els.migrateLocalBtn.classList.add('hidden');
      els.migrateLocalBtn.disabled = true;
      setEditLock(true);
      return;
    }

    setAuthenticatedLayout(true);
    els.loginForm.classList.add('hidden');
    els.loginLogoutBtn.classList.add('hidden');
    els.cloudActions.classList.remove('hidden');

    if (role === 'viewer') {
      els.migrateLocalBtn.classList.add('hidden');
      els.cloudBadge.textContent = 'Visualizador';
      els.cloudBadge.className = 'badge ok';
      els.migrateLocalBtn.disabled = true;
      setEditLock(true);
      return;
    }

    els.cloudBadge.textContent = mode === 'cloud' ? 'Admin' : 'Local';
    els.cloudBadge.className = 'badge ok';
    els.migrateLocalBtn.classList.remove('hidden');
    els.migrateLocalBtn.disabled = false;
    setEditLock(false);
  }

  function setAuthenticatedLayout(isAuthenticated) {
    const showApp = Boolean(isAuthenticated);
    els.loginScreen.classList.toggle('hidden', showApp);
    els.appShell.classList.toggle('hidden', !showApp);
    els.loginScreen.setAttribute('aria-hidden', String(showApp));
    els.appShell.setAttribute('aria-hidden', String(!showApp));

    // Evita que controles da tela escondida permaneçam focáveis em leitores
    // de tela ou em navegação por teclado.
    if ('inert' in els.loginScreen) els.loginScreen.inert = showApp;
    if ('inert' in els.appShell) els.appShell.inert = !showApp;
    document.body.classList.toggle('user-authenticated', showApp);
  }

  function updateAdminOnlyVisibility() {
    if (!els.settingsPanel) return;
    const firebaseEnabled = Boolean(window.FERIAS_FIREBASE_CONFIG && window.FERIAS_FIREBASE_CONFIG.enabled);
    const shouldHideSettings = firebaseEnabled ? cloudRole !== 'admin' : false;
    els.settingsPanel.classList.toggle('hidden', shouldHideSettings);

    if (shouldHideSettings) {
      els.settingsForm.classList.add('hidden');
      els.toggleSettingsBtn.textContent = 'Mostrar configurações de escala';
      els.toggleSettingsBtn.setAttribute('aria-expanded', 'false');
    }
  }

  function setEditLock(locked) {
    const selectors = [
      '#memberForm input', '#memberForm select', '#memberForm button',
      '#vacationForm input', '#vacationForm select', '#vacationForm textarea', '#vacationForm button',
      '#temporaryChangeForm input', '#temporaryChangeForm select', '#temporaryChangeForm textarea', '#temporaryChangeForm button',
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
    const keepConnected = Boolean(els.keepConnected && els.keepConnected.checked);
    if (!email || !password) {
      showToast('Informe e-mail e senha.');
      return;
    }
    try {
      await authService.login(email, password, keepConnected);
      els.loginPassword.value = '';
      showToast(keepConnected
        ? 'Login realizado. Este dispositivo permanecerá conectado.'
        : 'Login realizado. A sessão termina ao fechar o navegador.');
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

  function clearTemporaryChangeFormSafe() {
    if (!els.temporaryChangeId) return;
    clearTemporaryChangeForm();
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
      if (!localState || (!localState.members.length && !localState.vacations.length && !(localState.temporaryChanges || []).length)) {
        showToast('Não há dados locais antigos para migrar neste navegador.');
        return;
      }
      ensureExternalStateShape(localState);
      await dataService.replaceAll(localState, { action: 'migration', description: 'Migrou dados locais antigos para a nuvem.' });
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
      navigator.serviceWorker.register('./service-worker.js?v=7.4.0', { updateViaCache: 'none' })
        .then((registration) => {
          registration.update().catch(() => {});
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
    renderAuditHistory();
    renderKpis();
    renderCalendar();
    renderDayDetails();
    renderMembersTable();
    renderTemporaryChangesTable();
    renderVacationsTable();
    renderVacationAssistant();
    renderTemporaryChangeFields();
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

    const activeMembers = sortMembersAlphabetically(state.members.filter((member) => member.active));

    const memberOptions = activeMembers.map((member) => (
      `<option value="${member.id}">${escapeHtml(member.name)} — ${escapeHtml(sectorName(member.sector))} — ${escapeHtml(groupName(member.group))}</option>`
    )).join('');

    const currentVacationMember = els.vacationMember.value;
    els.vacationMember.innerHTML = memberOptions || '<option value="">Cadastre um membro ativo primeiro</option>';
    if (activeMembers.some((member) => member.id === currentVacationMember)) {
      els.vacationMember.value = currentVacationMember;
    }

    const temporaryGroupCurrent = els.temporaryGroup.value || 'azul';
    els.temporaryGroup.innerHTML = groupOptions;
    els.temporaryGroup.value = GROUPS.includes(temporaryGroupCurrent) ? temporaryGroupCurrent : 'azul';

    const temporaryMemberCurrent = els.temporaryMemberId.value;
    els.temporaryMemberId.innerHTML = activeMembers.length
      ? activeMembers.map((member) => `<option value="${member.id}">${escapeHtml(member.name)} — ${escapeHtml(sectorName(member.sector))}</option>`).join('')
      : '<option value="">Cadastre um membro ativo primeiro</option>';
    if (activeMembers.some((member) => member.id === temporaryMemberCurrent)) {
      els.temporaryMemberId.value = temporaryMemberCurrent;
    }

    const filterCurrent = els.filterMember.value || 'all';
    els.filterMember.innerHTML = '<option value="all">Todos os colaboradores</option>' +
      sortMembersAlphabetically(state.members)
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


  function renderAuditHistory() {
    if (!els.auditSummary || !els.auditTable) return;

    const logs = Array.isArray(state.auditLogs) ? state.auditLogs : [];
    const currentUser = els.auditUserFilter.value || 'all';
    const currentAction = els.auditActionFilter.value || 'all';

    const users = [...new Set(logs.map((log) => log.userEmail).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
    els.auditUserFilter.innerHTML = '<option value="all">Todos os administradores</option>' +
      users.map((email) => `<option value="${escapeAttr(email)}">${escapeHtml(email)}</option>`).join('');
    if (currentUser === 'all' || users.includes(currentUser)) els.auditUserFilter.value = currentUser;

    const actions = [...new Set(logs.map((log) => log.action).filter(Boolean))];
    els.auditActionFilter.innerHTML = '<option value="all">Todas as ações</option>' +
      actions.map((action) => `<option value="${escapeAttr(action)}">${escapeHtml(auditActionLabel(action))}</option>`).join('');
    if (currentAction === 'all' || actions.includes(currentAction)) els.auditActionFilter.value = currentAction;

    const latest = logs[0];
    if (latest) {
      els.auditSummary.innerHTML = `
        <span>Última alteração</span>
        <strong>${escapeHtml(latest.userEmail)}</strong>
        <small>${escapeHtml(formatAuditDate(latest.timestamp))} • ${escapeHtml(auditActionLabel(latest.action))}</small>
      `;
    } else {
      els.auditSummary.innerHTML = `
        <span>Última alteração</span>
        <strong>Nenhum registro disponível</strong>
        <small>O histórico começa após publicar a v6.8 e as novas regras do Firestore.</small>
      `;
    }

    const filtered = logs.filter((log) => {
      if (els.auditUserFilter.value !== 'all' && log.userEmail !== els.auditUserFilter.value) return false;
      if (els.auditActionFilter.value !== 'all' && log.action !== els.auditActionFilter.value) return false;
      return true;
    });

    els.auditTable.innerHTML = filtered.length ? filtered.map((log) => `
      <tr>
        <td><time datetime="${escapeAttr(log.timestamp)}">${escapeHtml(formatAuditDate(log.timestamp))}</time></td>
        <td><strong>${escapeHtml(log.userEmail)}</strong></td>
        <td><span class="audit-action-pill">${escapeHtml(auditActionLabel(log.action))}</span></td>
        <td>${escapeHtml(log.description)}</td>
      </tr>
    `).join('') : '<tr><td colspan="4" class="muted-cell">Nenhuma alteração encontrada para os filtros escolhidos.</td></tr>';
  }

  function auditActionLabel(action) {
    const labels = {
      create_member: 'Membro adicionado',
      update_member: 'Membro alterado',
      delete_member: 'Membro excluído',
      create_vacation: 'Férias cadastradas',
      update_vacation: 'Férias alteradas',
      delete_vacation: 'Férias excluídas',
      create_temporary_change: 'Alteração temporária criada',
      update_temporary_change: 'Alteração temporária editada',
      delete_temporary_change: 'Alteração temporária excluída',
      update_settings: 'Escala alterada',
      migration: 'Migração local',
      import_backup: 'Backup importado',
      restore_sample: 'Exemplo restaurado',
      reset_all: 'Dados apagados',
      replace_all: 'Dados substituídos'
    };
    return labels[action] || 'Alteração';
  }

  function formatAuditDate(value) {
    if (!value) return 'Data pendente';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Data pendente';
    return date.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function renderKpis() {
    const day = evaluateDay(selectedDate);
    const attention = getAttentionInfo(day);
    const monthStats = getMonthStats(currentMonth);
    const activeCount = day.activeMembers.length;
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
      const offGroups = offGroupsForDate(dateISO);
      const colorStrip = renderDayColorStrip(dateISO);
      const vacationBands = vacationBandsForDate(dateISO, currentMonth);
      const bands = renderVacationBands(dateISO, currentMonth, vacationBands);
      const density = els.calendarPanel?.dataset.calendarDensity || 'regular';
      const heightProfile = {
        regular: { base: 118, content: 96, band: 22 },
        compact: { base: 108, content: 88, band: 20 },
        narrow: { base: 98, content: 81, band: 18 },
        tiny: { base: 90, content: 74, band: 16 },
        micro: { base: 84, content: 69, band: 15 }
      }[density] || { base: 118, content: 96, band: 22 };
      const dynamicHeight = Math.max(
        heightProfile.base,
        heightProfile.content + (vacationBands.length * heightProfile.band)
      );

      cells.push(`
        <button class="calendar-day ${statusClass} ${todayClass} ${selectedClass} ${vacationBands.length > 1 ? 'multiple-vacations' : ''}" style="--day-min-height:${dynamicHeight}px" type="button" data-date="${dateISO}" aria-label="Ver detalhes de ${formatDateBR(dateISO)}">
          <span class="calendar-day-top">
            <span class="day-number">${dayNumber}</span>
            <span class="attention-tag ${attention.isAttention ? 'alert' : 'ok'}"><span class="attention-label-full">${attention.isAttention ? 'Atenção' : 'Boa'}</span><span class="attention-label-short">${attention.isAttention ? 'Aten.' : 'Boa'}</span></span>
          </span>
          ${colorStrip}
          <span class="day-colors-label" title="Folga: ${offGroups.map(groupName).join(', ')}">
            Folga: ${offGroups.map(shortGroupName).join(' • ')}
          </span>
          <span class="day-lines">
            <span><span class="metric-label">Pres.</span><strong>${day.present.length}</strong></span>
            <span><span class="metric-label">Férias</span><strong>${day.vacation.length}</strong></span>
            <span><span class="metric-label">Folgas</span><strong>${day.off.length}</strong></span>
          </span>
          ${bands}
        </button>
      `);
    }

    els.calendarGrid.innerHTML = cells.join('');
    els.calendarGrid.querySelectorAll('[data-date]').forEach((button) => {
      button.addEventListener('click', () => {
        if (Date.now() < suppressCalendarClickUntil) return;
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
      <div class="status-mini status-overview"><span>Status</span><strong><span class="pill ${statusClass}">${statusText}</span></strong></div>
      <div class="status-mini status-scheduled"><span>Escalados no dia</span><strong>${expected}</strong></div>
      <div class="status-mini status-present"><span>Presentes</span><strong>${day.present.length}</strong></div>
      <div class="status-mini status-attention"><span>Regra de atenção</span><strong class="status-reason">${escapeHtml(reasonText)}</strong></div>
    `;

    if (els.presentCount) els.presentCount.textContent = day.present.length;
    if (els.vacationCount) els.vacationCount.textContent = day.vacation.length;
    if (els.offCount) els.offCount.textContent = day.off.length;

    renderPeopleList(els.presentList, day.present, 'Nenhum colaborador presente nesta data.', (item) => ({
      title: item.member.name,
      group: item.member.group
    }));

    renderPeopleList(els.vacationList, day.vacation, 'Nenhum colaborador de férias nesta data.', (item) => ({
      title: item.member.name,
      group: item.member.group
    }));

    renderPeopleList(els.offList, day.off, 'Nenhum colaborador em folga 6x2 nesta data.', (item) => ({
      title: item.member.name,
      group: item.member.group
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
              const avatarClass = GROUP_CLASS[data.group] || '';
              return `
                <article class="person-card compact-person-card">
                  <span class="person-avatar ${avatarClass}" aria-hidden="true" title="${escapeAttr(groupName(data.group))}">${escapeHtml(personInitials(data.title))}</span>
                  <span class="person-meta">
                    <span class="person-name-row">
                      <strong>${escapeHtml(data.title)}</strong>
                    </span>
                  </span>
                  <span class="group-color-pill ${avatarClass}">${escapeHtml(groupName(data.group))}</span>
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


  function renderTemporaryChangeFields() {
    if (!els.temporaryChangeType) return;
    const type = els.temporaryChangeType.value || 'add_member';
    const isAdd = type === 'add_member';
    const isSectorChange = type === 'change_sector';

    els.temporaryExistingMemberField.classList.toggle('hidden', isAdd);
    els.temporaryNewNameField.classList.toggle('hidden', !isAdd);
    els.temporarySectorField.classList.toggle('hidden', type === 'deactivate_member');
    els.temporaryGroupField.classList.toggle('hidden', !isAdd);

    els.temporaryMemberId.required = !isAdd;
    els.temporaryMemberName.required = isAdd;
    els.temporarySector.required = isAdd || isSectorChange;
    els.temporaryGroup.required = isAdd;
  }

  function renderTemporaryChangesTable() {
    if (!els.temporaryChangesTable) return;
    const editable = canEditData();
    const today = todayISO();
    const changes = state.temporaryChanges
      .slice()
      .sort((a, b) => {
        const statusDiff = temporaryChangeStatusRank(a, today) - temporaryChangeStatusRank(b, today);
        if (statusDiff) return statusDiff;
        return a.startDate.localeCompare(b.startDate) || temporaryChangeMemberName(a).localeCompare(temporaryChangeMemberName(b), 'pt-BR');
      });

    els.temporaryChangesTable.innerHTML = changes.length ? changes.map((change) => {
      const status = vacationStatus(change, today);
      return `
        <tr>
          <td><span class="pill temporary-type">${escapeHtml(temporaryChangeTypeLabel(change.type))}</span></td>
          <td>${escapeHtml(temporaryChangeMemberName(change))}</td>
          <td>${temporaryChangeDescriptionHtml(change)}</td>
          <td>${formatDateBR(change.startDate)}</td>
          <td>${formatDateBR(change.endDate)}</td>
          <td>${escapeHtml(change.notes || '-')}</td>
          <td>
            ${editable ? `
              <span class="table-actions">
                <button class="icon-btn edit" type="button" data-edit-temporary="${change.id}">Editar</button>
                <button class="icon-btn delete" type="button" data-delete-temporary="${change.id}">Excluir</button>
              </span>
            ` : '<span class="muted-cell">Visualização</span>'}
            <span class="pill ${status.className} temporary-status-pill">${status.label}</span>
          </td>
        </tr>
      `;
    }).join('') : '<tr><td colspan="7" class="muted-cell">Nenhuma alteração temporária cadastrada.</td></tr>';

    els.temporaryChangesTable.querySelectorAll('[data-edit-temporary]').forEach((button) => {
      button.addEventListener('click', () => editTemporaryChange(button.dataset.editTemporary));
    });
    els.temporaryChangesTable.querySelectorAll('[data-delete-temporary]').forEach((button) => {
      button.addEventListener('click', () => deleteTemporaryChange(button.dataset.deleteTemporary));
    });
  }

  function temporaryChangeStatusRank(change, today) {
    const status = vacationStatus(change, today).key;
    return status === 'current' ? 0 : status === 'future' ? 1 : 2;
  }

  function temporaryChangeTypeLabel(type) {
    const labels = {
      add_member: 'Novo membro',
      change_sector: 'Troca de setor',
      deactivate_member: 'Inativação'
    };
    return labels[type] || 'Alteração';
  }

  function temporaryChangeMemberName(change) {
    if (change.type === 'add_member') return change.name || 'Membro temporário';
    return memberById(change.memberId)?.name || 'Membro removido';
  }

  function temporaryChangeDescriptionHtml(change) {
    if (change.type === 'add_member') {
      return `${sectorBadge(change.sector)} ${groupBadge(change.group)}`;
    }
    if (change.type === 'change_sector') {
      return `Setor temporário: ${sectorBadge(change.sector)}`;
    }
    return '<span class="pill inactive">Inativo no período</span>';
  }

  async function saveTemporaryChangeFromForm(event) {
    event.preventDefault();
    const id = els.temporaryChangeId.value;
    const type = els.temporaryChangeType.value;
    const memberId = els.temporaryMemberId.value;
    const name = els.temporaryMemberName.value.trim();
    const sector = normalizeSector(els.temporarySector.value);
    const group = GROUPS.includes(els.temporaryGroup.value) ? els.temporaryGroup.value : 'azul';
    const startDate = els.temporaryStart.value;
    const endDate = els.temporaryEnd.value;
    const notes = els.temporaryNotes.value.trim();

    if (!['add_member', 'change_sector', 'deactivate_member'].includes(type)) {
      showToast('Selecione um tipo válido de alteração temporária.');
      return;
    }
    if (!startDate || !endDate || startDate > endDate) {
      showToast('Confira as datas da alteração temporária.');
      return;
    }
    if (type === 'add_member' && !name) {
      showToast('Informe o nome do membro temporário.');
      return;
    }
    if (type !== 'add_member' && !memberId) {
      showToast('Selecione o membro que receberá a alteração temporária.');
      return;
    }

    const conflicts = findTemporaryChangeConflicts({ id, type, memberId, name, startDate, endDate });
    if (conflicts.length) {
      const details = conflicts.map((change) => `${temporaryChangeTypeLabel(change.type)} — ${formatDateBR(change.startDate)} a ${formatDateBR(change.endDate)}`).join('\n');
      showToast('Existe outra alteração temporária conflitante no mesmo período.');
      window.alert(`Não foi possível salvar porque já existe uma alteração temporária conflitante:\n${details}\n\nAjuste as datas para evitar regras simultâneas sobre a mesma pessoa.`);
      return;
    }

    const payload = {
      id: id || newId('t'),
      type,
      memberId: type === 'add_member' ? '' : memberId,
      name: type === 'add_member' ? name : '',
      sector: type === 'deactivate_member' ? '' : sector,
      group: type === 'add_member' ? group : '',
      startDate,
      endDate,
      notes
    };

    try {
      if (isCloudWriteMode()) {
        await dataService.upsertTemporaryChange(payload, {
          action: id ? 'update' : 'create',
          memberName: temporaryChangeMemberName(payload)
        });
        upsertTemporaryChangeInMemory(payload);
        renderAll();
        showToast(id ? 'Alteração temporária atualizada na nuvem.' : 'Alteração temporária cadastrada na nuvem.');
      } else {
        if (shouldBlockWrite()) {
          showToast(cloudWriteBlockMessage());
          return;
        }
        upsertTemporaryChangeInMemory(payload);
        renderAll();
        showToast(id ? 'Alteração temporária atualizada.' : 'Alteração temporária cadastrada.');
      }
      clearTemporaryChangeForm();
    } catch (error) {
      console.error(error);
      showToast('Não foi possível salvar a alteração temporária. Confira as regras do Firestore.');
    }
  }

  function upsertTemporaryChangeInMemory(payload) {
    const normalized = normalizeTemporaryChange(payload);
    const index = state.temporaryChanges.findIndex((item) => String(item.id) === String(normalized.id));
    if (index >= 0) state.temporaryChanges[index] = normalized;
    else state.temporaryChanges.push(normalized);
  }

  function clearTemporaryChangeForm() {
    els.temporaryChangeId.value = '';
    els.temporaryChangeType.value = 'add_member';
    els.temporaryMemberName.value = '';
    els.temporarySector.value = 'fabricacao';
    els.temporaryGroup.value = 'azul';
    els.temporaryStart.value = '';
    els.temporaryEnd.value = '';
    els.temporaryNotes.value = '';
    renderTemporaryChangeFields();
  }

  function editTemporaryChange(id) {
    const change = state.temporaryChanges.find((item) => item.id === id);
    if (!change) return;
    els.temporaryChangeId.value = change.id;
    els.temporaryChangeType.value = change.type;
    els.temporaryMemberId.value = change.memberId || '';
    els.temporaryMemberName.value = change.name || '';
    els.temporarySector.value = change.sector || 'fabricacao';
    els.temporaryGroup.value = change.group || 'azul';
    els.temporaryStart.value = change.startDate;
    els.temporaryEnd.value = change.endDate;
    els.temporaryNotes.value = change.notes || '';
    renderTemporaryChangeFields();
    els.temporaryChangeType.focus();
  }

  async function deleteTemporaryChange(id) {
    const change = state.temporaryChanges.find((item) => item.id === id);
    if (!change) return;
    if (!window.confirm(`Excluir a alteração temporária de ${temporaryChangeMemberName(change)} entre ${formatDateBR(change.startDate)} e ${formatDateBR(change.endDate)}?`)) return;

    try {
      if (isCloudWriteMode()) {
        await dataService.deleteTemporaryChange(id, {
          memberName: temporaryChangeMemberName(change),
          type: change.type,
          startDate: change.startDate,
          endDate: change.endDate
        });
        state.temporaryChanges = state.temporaryChanges.filter((item) => item.id !== id);
        renderAll();
        showToast('Alteração temporária excluída da nuvem.');
      } else {
        if (shouldBlockWrite()) {
          showToast(cloudWriteBlockMessage());
          return;
        }
        state.temporaryChanges = state.temporaryChanges.filter((item) => item.id !== id);
        renderAll();
        showToast('Alteração temporária excluída.');
      }
      clearTemporaryChangeForm();
    } catch (error) {
      console.error(error);
      showToast('Não foi possível excluir a alteração temporária.');
    }
  }

  function findTemporaryChangeConflicts(candidate) {
    return state.temporaryChanges.filter((change) => {
      if (String(change.id) === String(candidate.id || '')) return false;
      if (!periodsOverlap(candidate.startDate, candidate.endDate, change.startDate, change.endDate)) return false;

      if (candidate.type === 'add_member') {
        return change.type === 'add_member' &&
          normalizeComparableName(change.name) === normalizeComparableName(candidate.name);
      }

      return change.type !== 'add_member' && String(change.memberId) === String(candidate.memberId);
    });
  }

  function renderVacationsTable() {
    const today = todayISO();
    const editable = canEditData();
    const filterMember = els.filterMember.value || 'all';
    const filterMonth = els.filterMonth.value || '';
    let filterStatus = els.filterStatus.value || 'all';
    const isGeneralView = filterMember === 'all';

    // Na visão geral, períodos encerrados nunca aparecem. Eles ficam
    // disponíveis somente quando um colaborador específico é selecionado.
    const pastOption = els.filterStatus.querySelector('option[value="past"]');
    if (pastOption) pastOption.disabled = isGeneralView;
    if (isGeneralView && filterStatus === 'past') {
      els.filterStatus.value = 'all';
      filterStatus = 'all';
    }

    renderVacationHistorySummary(filterMember, today);

    const filteredVacations = state.vacations
      .slice()
      .filter((vacation) => {
        if (!vacation.startDate || !vacation.endDate) return false;
        if (!isGeneralView && vacation.memberId !== filterMember) return false;
        if (isGeneralView && vacation.endDate < today) return false;
        if (filterMonth && !periodIntersectsMonth(vacation.startDate, vacation.endDate, filterMonth)) return false;
        const status = vacationStatus(vacation, today).key;
        if (filterStatus !== 'all' && status !== filterStatus) return false;
        return true;
      })
      .sort((a, b) => compareVacationsByProximity(a, b, today));

    const totalItems = filteredVacations.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / VACATIONS_PAGE_SIZE));
    vacationPage = Math.min(Math.max(1, vacationPage), totalPages);
    const pageStart = (vacationPage - 1) * VACATIONS_PAGE_SIZE;
    const pageItems = filteredVacations.slice(pageStart, pageStart + VACATIONS_PAGE_SIZE);

    const rows = pageItems.map((vacation) => {
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

    const emptyMessage = isGeneralView
      ? 'Nenhuma férias em andamento ou futura cadastrada.'
      : 'Nenhuma férias encontrada para este colaborador e os filtros atuais.';
    els.vacationsTable.innerHTML = rows.join('') || `<tr><td colspan="9">${emptyMessage}</td></tr>`;

    const showPagination = totalItems > VACATIONS_PAGE_SIZE;
    els.vacationPagination.classList.toggle('hidden', !showPagination);
    els.vacationPageInfo.textContent = totalItems
      ? `Página ${vacationPage} de ${totalPages} • ${pageStart + 1}–${Math.min(pageStart + VACATIONS_PAGE_SIZE, totalItems)} de ${totalItems}`
      : 'Nenhum período';
    els.vacationFirstPageBtn.disabled = vacationPage <= 1;
    els.vacationPrevPageBtn.disabled = vacationPage <= 1;
    els.vacationNextPageBtn.disabled = vacationPage >= totalPages;
    els.vacationLastPageBtn.disabled = vacationPage >= totalPages;
    els.vacationLastPageBtn.dataset.lastPage = String(totalPages);

    els.vacationsTable.querySelectorAll('[data-edit-vacation]').forEach((button) => {
      button.addEventListener('click', () => editVacation(button.dataset.editVacation));
    });
    els.vacationsTable.querySelectorAll('[data-delete-vacation]').forEach((button) => {
      button.addEventListener('click', () => deleteVacation(button.dataset.deleteVacation));
    });
  }

  function compareVacationsByProximity(a, b, today) {
    const statusOrder = { current: 0, future: 1, past: 2 };
    const statusA = vacationStatus(a, today).key;
    const statusB = vacationStatus(b, today).key;
    const rankDiff = statusOrder[statusA] - statusOrder[statusB];
    if (rankDiff) return rankDiff;

    if (statusA === 'past') {
      const endDiff = b.endDate.localeCompare(a.endDate);
      if (endDiff) return endDiff;
      return b.startDate.localeCompare(a.startDate);
    }

    if (statusA === 'current') {
      const endDiff = a.endDate.localeCompare(b.endDate);
      if (endDiff) return endDiff;
    }

    const startDiff = a.startDate.localeCompare(b.startDate);
    if (startDiff) return startDiff;
    const endDiff = a.endDate.localeCompare(b.endDate);
    if (endDiff) return endDiff;
    const memberA = memberById(a.memberId)?.name || '';
    const memberB = memberById(b.memberId)?.name || '';
    return memberA.localeCompare(memberB, 'pt-BR');
  }

  function renderVacationHistorySummary(memberId, today) {
    if (!els.vacationHistorySummary) return;

    if (!memberId || memberId === 'all') {
      els.vacationHistorySummary.classList.add('hidden');
      els.vacationHistorySummary.innerHTML = '';
      return;
    }

    const member = memberById(memberId);
    const periods = state.vacations
      .filter((vacation) => vacation.memberId === memberId)
      .slice()
      .sort((a, b) => a.startDate.localeCompare(b.startDate));

    const totalDays = periods.reduce((sum, vacation) => (
      sum + daysBetween(vacation.startDate, vacation.endDate) + 1
    ), 0);
    const statusCounts = periods.reduce((counts, vacation) => {
      const key = vacationStatus(vacation, today).key;
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {});

    const nextPeriod = periods.find((vacation) => vacation.endDate >= today);
    const nextText = nextPeriod
      ? `${formatDateBR(nextPeriod.startDate)} a ${formatDateBR(nextPeriod.endDate)}`
      : 'Nenhum período atual ou futuro';

    els.vacationHistorySummary.classList.remove('hidden');
    els.vacationHistorySummary.innerHTML = `
      <div class="history-person">
        <span class="history-avatar">${escapeHtml(personInitials(member ? member.name : '?'))}</span>
        <div>
          <small>Histórico completo</small>
          <strong>${escapeHtml(member ? member.name : 'Colaborador removido')}</strong>
          <span>${member ? `${escapeHtml(sectorName(member.sector))} • ${escapeHtml(groupName(member.group))}` : 'Sem cadastro ativo'}</span>
        </div>
      </div>
      <div class="history-metrics">
        <div><small>Períodos cadastrados</small><strong>${periods.length}</strong></div>
        <div><small>Dias corridos somados</small><strong>${totalDays}</strong></div>
        <div><small>Em andamento</small><strong>${statusCounts.current || 0}</strong></div>
        <div><small>Futuros</small><strong>${statusCounts.future || 0}</strong></div>
        <div><small>Encerrados</small><strong>${statusCounts.past || 0}</strong></div>
      </div>
      <div class="history-next">
        <small>Próximo/atual período</small>
        <strong>${escapeHtml(nextText)}</strong>
      </div>
    `;
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
      showToast('Selecione Fabricação, Embalagem ou Técnico.');
      return;
    }

    const memberPayload = { id: id || newId('m'), name, group, sector, active };

    try {
      if (isCloudWriteMode()) {
        await dataService.upsertMember(memberPayload, { action: id ? 'update' : 'create' });
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
    els.memberSector.value = normalizeSector(member.sector);
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
        await dataService.deleteMember(id, { memberName: member.name });
        showToast('Membro excluído da nuvem.');
      } else {
        if (shouldBlockWrite()) {
          showToast(cloudWriteBlockMessage());
          return;
        }
        state.members = state.members.filter((item) => item.id !== id);
        state.vacations = state.vacations.filter((vacation) => vacation.memberId !== id);
        state.temporaryChanges = state.temporaryChanges.filter((change) => change.memberId !== id);
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

    const overlapAnalysis = analyzeVacationOverlapRules(memberId, startDate, endDate, id);

    if (overlapAnalysis.sameMemberConflicts.length || overlapAnalysis.alertRanges.length) {
      const warnings = buildVacationOverlapConfirmation(overlapAnalysis);
      warnings.push('Deseja salvar mesmo assim?');
      if (!window.confirm(warnings.join('\n'))) return;
    }

    const vacationPayload = { id: id || newId('v'), memberId, startDate, endDate, notes };

    try {
      if (isCloudWriteMode()) {
        await dataService.upsertVacation(vacationPayload, { action: id ? 'update' : 'create', memberName: memberById(memberId)?.name || 'colaborador' });
        upsertVacationInMemory(vacationPayload);
        renderAll();
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

  function upsertVacationInMemory(vacationPayload) {
    const normalized = {
      id: String(vacationPayload.id),
      memberId: String(vacationPayload.memberId),
      startDate: normalizeISODateValue(vacationPayload.startDate),
      endDate: normalizeISODateValue(vacationPayload.endDate),
      notes: vacationPayload.notes || ''
    };
    const index = state.vacations.findIndex((item) => String(item.id) === normalized.id);
    if (index >= 0) state.vacations[index] = normalized;
    else state.vacations.push(normalized);
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
        await dataService.deleteVacation(id, { memberName: member?.name || 'colaborador', startDate: vacation.startDate, endDate: vacation.endDate });
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

    const analysis = analyzeVacationOverlapRules(memberId, startDate, endDate, id);
    const blocks = [];

    if (analysis.sameMemberConflicts.length) {
      const items = analysis.sameMemberConflicts
        .map((vacation) => `<li>${formatDateBR(vacation.startDate)} a ${formatDateBR(vacation.endDate)}</li>`)
        .join('');
      blocks.push(`<strong>Conflito com férias já cadastradas para o mesmo colaborador:</strong><ul>${items}</ul>`);
    }

    if (analysis.alertRanges.length) {
      const items = analysis.alertRanges.map((range) => `
        <li>
          <strong>${formatDateBR(range.startDate)}${range.startDate === range.endDate ? '' : ` a ${formatDateBR(range.endDate)}`}</strong>
          <small>${escapeHtml(range.reason)}. Pessoas já de férias: ${escapeHtml(range.names.join(', '))}.</small>
        </li>
      `).join('');
      blocks.push(`<strong>Confirmação necessária pela regra de cobertura:</strong><ul>${items}</ul>`);
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
      const off = offGroupsForDate(dateISO);
      rows.push(`
        <div class="preview-day">
          <strong>${formatShortDate(dateISO)}</strong>
          <span class="preview-colors" title="Folga: ${off.map(groupName).join(', ')}">
            ${off.map((group) => `<i class="color-dot ${GROUP_CLASS[group]}" title="${escapeAttr(groupName(group))}: folga"></i>`).join('')}
          </span>
          <small>Folga do dia: ${off.map(groupName).join(' • ')}. ${groupName(member.group)}: ${schedule.works ? 'trabalharia' : 'folga 6x2'}</small>
        </div>
      `);
    }

    els.vacationDayPreview.innerHTML = `
      <div class="preview-title">
        <strong>Cor de folga no período</strong>
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
      app: 'Controle de Férias - WR - 3º turno',
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
          await dataService.replaceAll(importedState, { action: 'import_backup', description: 'Importou um backup JSON e substituiu os dados da nuvem.' });
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
          clearTemporaryChangeForm();
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
        await dataService.replaceAll(sample, { action: 'restore_sample', description: 'Restaurou os dados de exemplo do aplicativo.' });
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
      clearTemporaryChangeForm();
      selectedDate = todayISO();
      currentMonth = selectedDate.slice(0, 7);
      els.selectedDate.value = selectedDate;
      els.monthPicker.value = currentMonth;
      els.filterMonth.value = '';
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
        await dataService.clearAll(empty, { action: 'reset_all', description: 'Apagou todos os membros e férias da nuvem.' });
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
      clearTemporaryChangeForm();
    } catch (error) {
      console.error(error);
      showToast('Não foi possível apagar os dados.');
    }
  }

  function effectiveMembersForDate(dateISO) {
    const activeChanges = state.temporaryChanges.filter((change) => (
      dateISO >= change.startDate && dateISO <= change.endDate
    ));

    const result = [];
    state.members.filter((member) => member.active).forEach((member) => {
      const memberChanges = activeChanges.filter((item) => item.type !== 'add_member' && item.memberId === member.id);
      const inactiveChange = memberChanges.find((item) => item.type === 'deactivate_member');
      if (inactiveChange) return;
      const sectorChange = memberChanges.find((item) => item.type === 'change_sector');
      result.push({
        ...member,
        sector: sectorChange ? sectorChange.sector : member.sector,
        temporaryChangeId: sectorChange?.id || '',
        temporaryChangeType: sectorChange?.type || ''
      });
    });

    activeChanges
      .filter((change) => change.type === 'add_member')
      .forEach((change) => {
        result.push({
          id: `temporary:${change.id}`,
          name: change.name,
          sector: change.sector,
          group: change.group,
          active: true,
          temporary: true,
          temporaryChangeId: change.id,
          temporaryChangeType: change.type
        });
      });

    return result;
  }

  function effectiveMemberByIdOnDate(memberId, dateISO) {
    return effectiveMembersForDate(dateISO).find((member) => String(member.id) === String(memberId)) || null;
  }

  function evaluateDay(dateISO) {
    const activeMembers = effectiveMembersForDate(dateISO);
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

  function renderVacationBands(dateISO, monthISO, preparedBands = null) {
    const bands = preparedBands || vacationBandsForDate(dateISO, monthISO);
    if (!bands.length) return '<span class="vacation-bands empty-bands"></span>';

    const content = bands.map(({ vacation, member, classNames }) => `
      <span class="vacation-band ${GROUP_CLASS[member.group]} ${classNames} ${vacationNameSizeClass(member.name)}" title="${escapeAttr(member.name)}: ${formatDateBR(vacation.startDate)} a ${formatDateBR(vacation.endDate)}">
        <i class="vacation-group-dot ${GROUP_CLASS[member.group]}" aria-hidden="true"></i>
        <span>${escapeHtml(member.name)}</span>
      </span>
    `).join('');

    return `<span class="vacation-bands" aria-label="${bands.length} pessoa${bands.length === 1 ? '' : 's'} de férias">${content}</span>`;
  }

  function vacationNameSizeClass(name) {
    const length = String(name || '').trim().length;
    if (length >= 22) return 'vacation-name-xlong';
    if (length >= 15) return 'vacation-name-long';
    if (length >= 10) return 'vacation-name-medium';
    return 'vacation-name-short';
  }

  function vacationBandsForDate(dateISO, monthISO) {
    const firstMonthDay = `${monthISO}-01`;
    const [, month] = monthISO.split('-').map(Number);
    const year = Number(monthISO.slice(0, 4));
    const lastMonthDay = `${monthISO}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;

    return state.vacations
      .filter((vacation) => dateISO >= vacation.startDate && dateISO <= vacation.endDate)
      .map((vacation) => ({ vacation, member: effectiveMemberByIdOnDate(vacation.memberId, dateISO) }))
      .filter(({ member }) => member && member.active)
      .sort((a, b) => {
        const groupDiff = GROUPS.indexOf(a.member.group) - GROUPS.indexOf(b.member.group);
        return groupDiff || a.member.name.localeCompare(b.member.name, 'pt-BR');
      })
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
    const normalizedStart = normalizeISODateValue(startDate);
    const normalizedEnd = normalizeISODateValue(endDate);
    if (!normalizedStart || !normalizedEnd) return [];
    return state.vacations.filter((vacation) => (
      String(vacation.memberId) === String(memberId) &&
      String(vacation.id) !== String(ignoreId) &&
      periodsOverlap(normalizedStart, normalizedEnd, vacation.startDate, vacation.endDate)
    ));
  }

  function analyzeVacationOverlapRules(memberId, startDate, endDate, ignoreId = '') {
    const normalizedStart = normalizeISODateValue(startDate);
    const normalizedEnd = normalizeISODateValue(endDate);
    const sameMemberConflicts = findVacationConflicts(memberId, normalizedStart, normalizedEnd, ignoreId);
    if (!normalizedStart || !normalizedEnd || normalizedStart > normalizedEnd) {
      return { sameMemberConflicts, alertRanges: [] };
    }

    const dayAlerts = [];
    const totalDays = daysBetween(normalizedStart, normalizedEnd) + 1;

    for (let index = 0; index < totalDays; index += 1) {
      const dateISO = addDaysISO(normalizedStart, index);
      const candidateMember = effectiveMemberByIdOnDate(memberId, dateISO) || memberById(memberId);
      if (!candidateMember) continue;

      const existing = state.vacations
        .filter((vacation) => (
          String(vacation.memberId) !== String(memberId) &&
          String(vacation.id) !== String(ignoreId) &&
          dateISO >= vacation.startDate &&
          dateISO <= vacation.endDate
        ))
        .map((vacation) => ({
          vacation,
          member: effectiveMemberByIdOnDate(vacation.memberId, dateISO)
        }))
        .filter((item) => item.member);

      const sameSector = existing.filter((item) => item.member.sector === candidateMember.sector);
      const totalTrigger = existing.length >= 2;
      const sectorTrigger = sameSector.length >= 1;
      if (!totalTrigger && !sectorTrigger) continue;

      const relevant = totalTrigger ? existing : sameSector;
      const names = [...new Set(relevant.map((item) => item.member.name))]
        .sort((a, b) => a.localeCompare(b, 'pt-BR'));
      const reasons = [];
      if (totalTrigger) reasons.push(`já existem ${existing.length} pessoas de férias`);
      if (sectorTrigger) {
        reasons.push(`${sameSector.length} do mesmo setor (${sectorName(candidateMember.sector)})`);
      }

      dayAlerts.push({
        dateISO,
        reason: reasons.join(' e '),
        names
      });
    }

    return {
      sameMemberConflicts,
      alertRanges: mergeVacationAlertDays(dayAlerts)
    };
  }

  function mergeVacationAlertDays(dayAlerts) {
    const ranges = [];
    dayAlerts.forEach((alert) => {
      const signature = `${alert.reason}|${alert.names.join('|')}`;
      const previous = ranges[ranges.length - 1];
      if (previous && previous.signature === signature && addDaysISO(previous.endDate, 1) === alert.dateISO) {
        previous.endDate = alert.dateISO;
        return;
      }
      ranges.push({
        startDate: alert.dateISO,
        endDate: alert.dateISO,
        reason: alert.reason,
        names: alert.names,
        signature
      });
    });
    return ranges.map(({ signature, ...range }) => range);
  }

  function buildVacationOverlapConfirmation(analysis) {
    const warnings = [];
    if (analysis.sameMemberConflicts.length) {
      const text = analysis.sameMemberConflicts
        .map((vacation) => `${formatDateBR(vacation.startDate)} a ${formatDateBR(vacation.endDate)}`)
        .join(', ');
      warnings.push(`Conflito com férias já cadastradas para o mesmo colaborador: ${text}.`);
    }

    if (analysis.alertRanges.length) {
      warnings.push('A nova férias exige confirmação pela regra de cobertura:');
      analysis.alertRanges.forEach((range) => {
        const period = range.startDate === range.endDate
          ? formatDateBR(range.startDate)
          : `${formatDateBR(range.startDate)} a ${formatDateBR(range.endDate)}`;
        warnings.push(`- ${period}: ${range.reason}. Pessoas já de férias: ${range.names.join(', ')}.`);
      });
    }
    return warnings;
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

  function normalizeSector(value, fallback = 'fabricacao') {
    const normalized = String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\s_-]+/g, '');

    if (normalized === 'fabricacao' || normalized === 'fabrica') return 'fabricacao';
    if (normalized === 'embalagem') return 'embalagem';
    if (normalized === 'tecnico' || normalized === 'tecnica') return 'tecnico';
    return SECTORS.includes(fallback) ? fallback : 'fabricacao';
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

  function sortMembersAlphabetically(members) {
    return members.slice().sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
  }

  function sortedItemsByMember(items) {
    return items.slice().sort((a, b) => {
      const groupDiff = GROUPS.indexOf(a.member.group) - GROUPS.indexOf(b.member.group);
      if (groupDiff) return groupDiff;
      return a.member.name.localeCompare(b.member.name, 'pt-BR');
    });
  }


  function setupCalendarResponsiveFit() {
    const shell = els.calendarScrollShell;
    const panel = els.calendarPanel;
    if (!shell || !panel) return;

    let lastDensity = '';
    const updateDensity = () => {
      const width = shell.clientWidth || window.innerWidth;
      const density = width <= 330 ? 'micro'
        : width <= 390 ? 'tiny'
        : width <= 470 ? 'narrow'
        : width <= 620 ? 'compact'
        : 'regular';

      if (density === lastDensity) return;
      lastDensity = density;
      panel.dataset.calendarDensity = density;
    };

    updateDensity();
    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(updateDensity);
      observer.observe(shell);
    } else {
      window.addEventListener('resize', updateDensity, { passive: true });
    }
  }

  function setupCalendarSwipe() {
    const surface = els.calendarScrollShell;
    if (!surface) return;

    let gesture = null;
    const MIN_DISTANCE = 82;
    const MAX_DURATION = 650;
    const HORIZONTAL_RATIO = 1.35;

    surface.addEventListener('touchstart', (event) => {
      if (event.touches.length !== 1) {
        gesture = null;
        return;
      }

      const touch = event.touches[0];
      gesture = {
        startX: touch.clientX,
        startY: touch.clientY,
        startedAt: Date.now()
      };
    }, { passive: true });

    surface.addEventListener('touchend', (event) => {
      if (!gesture || event.changedTouches.length !== 1) {
        gesture = null;
        return;
      }

      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - gesture.startX;
      const deltaY = touch.clientY - gesture.startY;
      const duration = Date.now() - gesture.startedAt;
      gesture = null;

      const horizontal = Math.abs(deltaX) >= MIN_DISTANCE
        && Math.abs(deltaX) > Math.abs(deltaY) * HORIZONTAL_RATIO;
      const quickEnough = duration <= MAX_DURATION;

      if (!horizontal || !quickEnough) return;

      suppressCalendarClickUntil = Date.now() + 550;
      const monthDelta = deltaX < 0 ? 1 : -1;
      animateCalendarSwipe(monthDelta);
    }, { passive: true });

    surface.addEventListener('touchcancel', () => {
      gesture = null;
    }, { passive: true });
  }

  function animateCalendarSwipe(delta) {
    const panel = els.calendarPanel;
    const animationClass = delta > 0 ? 'calendar-swipe-next' : 'calendar-swipe-prev';

    if (panel) {
      panel.classList.remove('calendar-swipe-next', 'calendar-swipe-prev');
      void panel.offsetWidth;
      panel.classList.add(animationClass);
    }

    changeMonth(delta);

    if (els.calendarScrollShell) {
      els.calendarScrollShell.scrollLeft = 0;
    }

    window.setTimeout(() => {
      panel?.classList.remove('calendar-swipe-next', 'calendar-swipe-prev');
    }, 280);
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
    // A partir da v5.1, o app não persiste mais dados operacionais no localStorage.
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
      vacations: [],
      temporaryChanges: [],
      auditLogs: []
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
      temporaryChanges: [],
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
    if (!Array.isArray(state.temporaryChanges)) state.temporaryChanges = [];
    if (!Array.isArray(state.auditLogs)) state.auditLogs = [];

    state.members = state.members.map((member, index) => ({
      id: member.id || newId('m'),
      name: String(member.name || 'Sem nome'),
      group: GROUPS.includes(member.group) ? member.group : 'azul',
      sector: normalizeSector(member.sector ?? member.setor, inferSector(index)),
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

    state.temporaryChanges = state.temporaryChanges
      .map(normalizeTemporaryChange)
      .filter((change) => (
        change.id && change.type && change.startDate && change.endDate && change.startDate <= change.endDate
      ));

    state.auditLogs = state.auditLogs.map((log) => ({
      id: String(log.id || ''),
      action: String(log.action || 'unknown'),
      entityType: String(log.entityType || ''),
      entityId: String(log.entityId || ''),
      description: String(log.description || 'Alteração registrada.'),
      userUid: String(log.userUid || ''),
      userEmail: String(log.userEmail || 'Usuário não identificado'),
      userRole: String(log.userRole || 'admin'),
      timestamp: String(log.timestamp || log.clientTimestamp || ''),
      details: log.details && typeof log.details === 'object' ? log.details : {}
    })).filter((log) => log.id).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  function ensureExternalStateShape(externalState) {
    const previous = state;
    state = externalState;
    ensureStateShape();
    Object.assign(externalState, structuredCloneSafe(state));
    state = previous;
  }

  function normalizeTemporaryChange(change) {
    const type = ['add_member', 'change_sector', 'deactivate_member'].includes(change?.type)
      ? change.type
      : 'add_member';
    return {
      id: String(change?.id || newId('t')),
      type,
      memberId: type === 'add_member' ? '' : String(change?.memberId || ''),
      name: type === 'add_member' ? String(change?.name || 'Membro temporário').trim() : '',
      sector: type === 'deactivate_member' ? '' : normalizeSector(change?.sector, 'fabricacao'),
      group: type === 'add_member' && GROUPS.includes(change?.group) ? change.group : (type === 'add_member' ? 'azul' : ''),
      startDate: normalizeISODateValue(change?.startDate),
      endDate: normalizeISODateValue(change?.endDate),
      notes: String(change?.notes || '')
    };
  }

  function normalizeComparableName(value) {
    return String(value || '')
      .trim()
      .toLocaleLowerCase('pt-BR')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
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

  function normalizeISODateValue(value) {
    if (!value) return '';
    if (typeof value === 'string') {
      const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (!match) return '';
      const normalized = `${match[1]}-${match[2]}-${match[3]}`;
      return isValidISODate(normalized) ? normalized : '';
    }
    if (value instanceof Date && !Number.isNaN(value.getTime())) return formatISODate(value);
    if (typeof value.toDate === 'function') return formatISODate(value.toDate());
    if (typeof value.seconds === 'number') return formatISODate(new Date(value.seconds * 1000));
    return '';
  }

  function isValidISODate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = parseISODate(value);
    return !Number.isNaN(parsed.getTime()) && formatISODate(parsed) === value;
  }

  function dateOrdinal(value) {
    const normalized = normalizeISODateValue(value);
    if (!normalized) return Number.NaN;
    const [year, month, day] = normalized.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  }

  function periodsOverlap(startA, endA, startB, endB) {
    const aStart = dateOrdinal(startA);
    const aEnd = dateOrdinal(endA);
    const bStart = dateOrdinal(startB);
    const bEnd = dateOrdinal(endB);
    if ([aStart, aEnd, bStart, bEnd].some(Number.isNaN)) return false;
    if (aStart > aEnd || bStart > bEnd) return false;
    return aStart <= bEnd && bStart <= aEnd;
  }

  function maxISODate(a, b) {
    const normalizedA = normalizeISODateValue(a);
    const normalizedB = normalizeISODateValue(b);
    return dateOrdinal(normalizedA) >= dateOrdinal(normalizedB) ? normalizedA : normalizedB;
  }

  function minISODate(a, b) {
    const normalizedA = normalizeISODateValue(a);
    const normalizedB = normalizeISODateValue(b);
    return dateOrdinal(normalizedA) <= dateOrdinal(normalizedB) ? normalizedA : normalizedB;
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

  function personInitials(name) {
    return String(name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || '?';
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
