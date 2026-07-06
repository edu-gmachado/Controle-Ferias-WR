(() => {
  'use strict';

  const STORAGE_KEY = 'controleFerias3TurnoPWA.v1';
  const GROUPS = ['azul', 'verde', 'amarelo', 'vermelho'];
  const GROUP_CLASS = { azul: 'blue', verde: 'green', amarelo: 'yellow', vermelho: 'red' };
  const GROUP_DEFAULTS = {
    azul: { name: 'Azul', offset: 0 },
    verde: { name: 'Verde', offset: 2 },
    amarelo: { name: 'Amarelo', offset: 4 },
    vermelho: { name: 'Vermelho', offset: 6 }
  };

  const $ = (selector) => document.querySelector(selector);

  let state = loadState();
  let selectedDate = todayISO();
  let currentMonth = selectedDate.slice(0, 7);
  let deferredInstallPrompt = null;

  const els = {};

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    cacheElements();
    ensureStateShape();
    selectedDate = todayISO();
    currentMonth = selectedDate.slice(0, 7);
    els.selectedDate.value = selectedDate;
    els.monthPicker.value = currentMonth;
    els.filterMonth.value = currentMonth;
    setupEvents();
    registerServiceWorker();
    renderAll();
  }

  function cacheElements() {
    Object.assign(els, {
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
      clearVacationForm: $('#clearVacationForm'),
      filterMember: $('#filterMember'),
      filterMonth: $('#filterMonth'),
      filterStatus: $('#filterStatus'),
      clearFiltersBtn: $('#clearFiltersBtn'),
      vacationsTable: $('#vacationsTable'),
      settingsForm: $('#settingsForm'),
      baseDate: $('#baseDate'),
      minPresent: $('#minPresent'),
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
      els.vacationMember.addEventListener(eventName, renderVacationWarning);
      els.vacationStart.addEventListener(eventName, renderVacationWarning);
      els.vacationEnd.addEventListener(eventName, renderVacationWarning);
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

    els.settingsForm.addEventListener('submit', saveSettings);
    els.exportBtn.addEventListener('click', exportBackup);
    els.exportBtnTop.addEventListener('click', exportBackup);
    els.importFile.addEventListener('change', importBackup);
    els.sampleBtn.addEventListener('click', restoreSampleData);
    els.resetBtn.addEventListener('click', resetAllData);

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
    saveState();
    renderSelectors();
    renderSettingsForm();
    renderKpis();
    renderCalendar();
    renderDayDetails();
    renderMembersTable();
    renderVacationsTable();
  }

  function renderSelectors() {
    const groupOptions = GROUPS.map((key) => {
      const group = state.settings.groups[key];
      return `<option value="${key}">${escapeHtml(group.name)}</option>`;
    }).join('');

    const currentMemberGroup = els.memberGroup.value || 'azul';
    els.memberGroup.innerHTML = groupOptions;
    els.memberGroup.value = GROUPS.includes(currentMemberGroup) ? currentMemberGroup : 'azul';

    const activeMembers = state.members
      .filter((member) => member.active)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    const memberOptions = activeMembers.map((member) => (
      `<option value="${member.id}">${escapeHtml(member.name)} — ${escapeHtml(groupName(member.group))}</option>`
    )).join('');

    const currentVacationMember = els.vacationMember.value;
    els.vacationMember.innerHTML = memberOptions || '<option value="">Cadastre um membro ativo primeiro</option>';
    if (activeMembers.some((member) => member.id === currentVacationMember)) {
      els.vacationMember.value = currentVacationMember;
    }

    const filterCurrent = els.filterMember.value || 'all';
    els.filterMember.innerHTML = '<option value="all">Todos os colaboradores</option>' +
      state.members
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
        .map((member) => `<option value="${member.id}">${escapeHtml(member.name)}</option>`)
        .join('');
    if (filterCurrent === 'all' || state.members.some((member) => member.id === filterCurrent)) {
      els.filterMember.value = filterCurrent;
    }
  }

  function renderSettingsForm() {
    els.baseDate.value = state.settings.baseDate;
    els.minPresent.value = state.settings.minPresent;

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
    const monthStats = getMonthStats(currentMonth);
    const activeCount = state.members.filter((member) => member.active).length;
    const vacationImpact = day.vacation.filter((item) => item.scheduledToWork).length;

    els.kpiActive.textContent = activeCount;
    els.kpiPresent.textContent = day.present.length;
    els.kpiCoverage.textContent = `${day.coveragePercent}% de cobertura da escala`;
    els.kpiVacation.textContent = day.vacation.length;
    els.kpiVacationImpact.textContent = `${vacationImpact} impactando escala`;
    els.kpiOff.textContent = day.off.length;
    els.kpiCritical.textContent = monthStats.criticalDays;
    els.kpiMinimum.textContent = `Mínimo configurado: ${state.settings.minPresent}`;
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
      const statusClass = day.present.length < state.settings.minPresent
        ? 'critical'
        : day.present.length <= state.settings.minPresent + 1
          ? 'alert'
          : '';
      const todayClass = dateISO === todayISO() ? 'today' : '';
      const selectedClass = dateISO === selectedDate ? 'selected' : '';
      const width = Math.max(0, Math.min(100, day.coveragePercent));

      cells.push(`
        <button class="calendar-day ${statusClass} ${todayClass} ${selectedClass}" type="button" data-date="${dateISO}" aria-label="Ver detalhes de ${formatDateBR(dateISO)}">
          <span class="day-number">${dayNumber}</span>
          <span class="day-lines">
            <span>Presentes <strong>${day.present.length}</strong></span>
            <span>Férias <strong>${day.vacation.length}</strong></span>
            <span>Folgas <strong>${day.off.length}</strong></span>
          </span>
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
    const critical = day.present.length < state.settings.minPresent;
    const alert = !critical && day.present.length <= state.settings.minPresent + 1;
    const statusText = critical ? 'Crítico' : alert ? 'Atenção' : 'Cobertura boa';
    const statusClass = critical ? 'critical' : alert ? 'alert' : 'ok';

    els.dayTitle.textContent = formatLongDate(selectedDate);
    els.daySubtitle.textContent = `Escala calculada para o 3º turno • ${statusText}`;
    els.dayStatus.innerHTML = `
      <div class="status-mini"><span>Status</span><strong><span class="pill ${statusClass}">${statusText}</span></strong></div>
      <div class="status-mini"><span>Escalados no dia</span><strong>${expected}</strong></div>
      <div class="status-mini"><span>Presentes</span><strong>${day.present.length}</strong></div>
      <div class="status-mini"><span>Cobertura</span><strong>${day.coveragePercent}%</strong></div>
    `;

    renderPeopleList(els.presentList, day.present, 'Nenhum colaborador presente nesta data.', (item) => ({
      title: item.member.name,
      subtitle: `${groupName(item.member.group)} • dia ${item.cycleDay} do ciclo`,
      badge: groupBadge(item.member.group)
    }));

    renderPeopleList(els.vacationList, day.vacation, 'Nenhum colaborador de férias nesta data.', (item) => ({
      title: item.member.name,
      subtitle: `${formatDateBR(item.vacation.startDate)} a ${formatDateBR(item.vacation.endDate)}${item.vacation.notes ? ` • ${item.vacation.notes}` : ''}`,
      badge: item.scheduledToWork
        ? '<span class="pill critical">Impacta escala</span>'
        : '<span class="pill alert">Cairia em folga</span>'
    }));

    renderPeopleList(els.offList, day.off, 'Nenhum colaborador em folga 6x2 nesta data.', (item) => ({
      title: item.member.name,
      subtitle: `${groupName(item.member.group)} • dia ${item.cycleDay} do ciclo`,
      badge: groupBadge(item.member.group)
    }));
  }

  function renderPeopleList(container, items, emptyMessage, projector) {
    if (!items.length) {
      container.innerHTML = `<div class="empty-msg">${escapeHtml(emptyMessage)}</div>`;
      return;
    }

    container.innerHTML = items
      .sort((a, b) => a.member.name.localeCompare(b.member.name, 'pt-BR'))
      .map((item) => {
        const data = projector(item);
        return `
          <article class="person-card">
            <span class="person-meta">
              <strong>${escapeHtml(data.title)}</strong>
              <small>${escapeHtml(data.subtitle)}</small>
            </span>
            ${data.badge}
          </article>
        `;
      }).join('');
  }

  function renderMembersTable() {
    const rows = state.members
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      .map((member) => `
        <tr>
          <td>${escapeHtml(member.name)}</td>
          <td>${groupBadge(member.group)}</td>
          <td>${member.active ? '<span class="pill ok">Ativo</span>' : '<span class="pill inactive">Inativo</span>'}</td>
          <td>
            <span class="table-actions">
              <button class="icon-btn edit" type="button" data-edit-member="${member.id}">Editar</button>
              <button class="icon-btn delete" type="button" data-delete-member="${member.id}">Excluir</button>
            </span>
          </td>
        </tr>
      `);

    els.membersTable.innerHTML = rows.join('') || '<tr><td colspan="4">Nenhum membro cadastrado.</td></tr>';

    els.membersTable.querySelectorAll('[data-edit-member]').forEach((button) => {
      button.addEventListener('click', () => editMember(button.dataset.editMember));
    });
    els.membersTable.querySelectorAll('[data-delete-member]').forEach((button) => {
      button.addEventListener('click', () => deleteMember(button.dataset.deleteMember));
    });
  }

  function renderVacationsTable() {
    const today = todayISO();
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
            <td>${formatDateBR(vacation.startDate)}</td>
            <td>${formatDateBR(vacation.endDate)}</td>
            <td>${daysBetween(vacation.startDate, vacation.endDate) + 1}</td>
            <td><span class="pill ${status.className}">${status.label}</span></td>
            <td>${escapeHtml(vacation.notes || '-')}</td>
            <td>
              <span class="table-actions">
                <button class="icon-btn edit" type="button" data-edit-vacation="${vacation.id}">Editar</button>
                <button class="icon-btn delete" type="button" data-delete-vacation="${vacation.id}">Excluir</button>
              </span>
            </td>
          </tr>
        `;
      });

    els.vacationsTable.innerHTML = rows.join('') || '<tr><td colspan="7">Nenhuma férias encontrada para os filtros atuais.</td></tr>';

    els.vacationsTable.querySelectorAll('[data-edit-vacation]').forEach((button) => {
      button.addEventListener('click', () => editVacation(button.dataset.editVacation));
    });
    els.vacationsTable.querySelectorAll('[data-delete-vacation]').forEach((button) => {
      button.addEventListener('click', () => deleteVacation(button.dataset.deleteVacation));
    });
  }

  function saveMemberFromForm(event) {
    event.preventDefault();
    const name = els.memberName.value.trim();
    const group = els.memberGroup.value;
    const active = els.memberActive.checked;
    const id = els.memberId.value;

    if (!name) {
      showToast('Informe o nome do colaborador.');
      return;
    }

    if (id) {
      const member = memberById(id);
      if (!member) return;
      member.name = name;
      member.group = group;
      member.active = active;
      showToast('Membro atualizado.');
    } else {
      state.members.push({ id: newId('m'), name, group, active });
      showToast('Membro adicionado.');
    }

    clearMemberForm();
    renderAll();
  }

  function clearMemberForm() {
    els.memberId.value = '';
    els.memberName.value = '';
    els.memberGroup.value = 'azul';
    els.memberActive.checked = true;
  }

  function editMember(id) {
    const member = memberById(id);
    if (!member) return;
    els.memberId.value = member.id;
    els.memberName.value = member.name;
    els.memberGroup.value = member.group;
    els.memberActive.checked = member.active;
    els.memberName.focus();
  }

  function deleteMember(id) {
    const member = memberById(id);
    if (!member) return;
    const hasVacations = state.vacations.some((vacation) => vacation.memberId === id);
    const message = hasVacations
      ? `Excluir ${member.name}? As férias cadastradas para este colaborador também serão removidas.`
      : `Excluir ${member.name}?`;
    if (!window.confirm(message)) return;
    state.members = state.members.filter((item) => item.id !== id);
    state.vacations = state.vacations.filter((vacation) => vacation.memberId !== id);
    clearMemberForm();
    showToast('Membro excluído.');
    renderAll();
  }

  function saveVacationFromForm(event) {
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

    const conflicts = findVacationConflicts(memberId, startDate, endDate, id);
    if (conflicts.length) {
      const proceed = window.confirm('Existe conflito com outro período do mesmo colaborador. Deseja salvar mesmo assim?');
      if (!proceed) return;
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
      state.vacations.push({ id: newId('v'), memberId, startDate, endDate, notes });
      showToast('Férias cadastradas.');
    }

    clearVacationForm();
    renderAll();
  }

  function clearVacationForm() {
    els.vacationId.value = '';
    els.vacationStart.value = '';
    els.vacationEnd.value = '';
    els.vacationNotes.value = '';
    els.vacationWarning.classList.add('hidden');
    els.vacationWarning.textContent = '';
  }

  function editVacation(id) {
    const vacation = state.vacations.find((item) => item.id === id);
    if (!vacation) return;
    els.vacationId.value = vacation.id;
    els.vacationMember.value = vacation.memberId;
    els.vacationStart.value = vacation.startDate;
    els.vacationEnd.value = vacation.endDate;
    els.vacationNotes.value = vacation.notes || '';
    renderVacationWarning();
    els.vacationMember.focus();
  }

  function deleteVacation(id) {
    const vacation = state.vacations.find((item) => item.id === id);
    if (!vacation) return;
    const member = memberById(vacation.memberId);
    if (!window.confirm(`Excluir férias de ${member ? member.name : 'colaborador'} entre ${formatDateBR(vacation.startDate)} e ${formatDateBR(vacation.endDate)}?`)) return;
    state.vacations = state.vacations.filter((item) => item.id !== id);
    clearVacationForm();
    showToast('Férias excluídas.');
    renderAll();
  }

  function renderVacationWarning() {
    const id = els.vacationId.value;
    const memberId = els.vacationMember.value;
    const startDate = els.vacationStart.value;
    const endDate = els.vacationEnd.value;

    if (!memberId || !startDate || !endDate || startDate > endDate) {
      els.vacationWarning.classList.add('hidden');
      els.vacationWarning.textContent = '';
      return;
    }

    const conflicts = findVacationConflicts(memberId, startDate, endDate, id);
    if (!conflicts.length) {
      els.vacationWarning.classList.add('hidden');
      els.vacationWarning.textContent = '';
      return;
    }

    const text = conflicts.map((vacation) => `${formatDateBR(vacation.startDate)} a ${formatDateBR(vacation.endDate)}`).join(', ');
    els.vacationWarning.textContent = `Atenção: existe sobreposição com ${text}.`;
    els.vacationWarning.classList.remove('hidden');
  }

  function saveSettings(event) {
    event.preventDefault();
    const baseDate = els.baseDate.value;
    const minPresent = Number(els.minPresent.value);

    if (!baseDate || !Number.isFinite(minPresent) || minPresent < 1) {
      showToast('Confira a data-base e o mínimo de presentes.');
      return;
    }

    state.settings.baseDate = baseDate;
    state.settings.minPresent = Math.round(minPresent);

    GROUPS.forEach((key) => {
      const nameInput = document.querySelector(`[data-group-name="${key}"]`);
      const offsetInput = document.querySelector(`[data-group-offset="${key}"]`);
      const name = nameInput.value.trim() || GROUP_DEFAULTS[key].name;
      const offset = normalizeOffset(Number(offsetInput.value));
      state.settings.groups[key] = { name, offset };
    });

    showToast('Configurações salvas.');
    renderAll();
  }

  function exportBackup() {
    const payload = {
      exportedAt: new Date().toISOString(),
      app: 'Controle de Férias - 3º Turno',
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
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const importedState = parsed.data || parsed;
        validateImportedState(importedState);
        state = importedState;
        ensureStateShape();
        saveState();
        clearMemberForm();
        clearVacationForm();
        showToast('Backup importado com sucesso.');
        renderAll();
      } catch (error) {
        console.error(error);
        showToast('Arquivo inválido. Confira se é um backup JSON deste app.');
      } finally {
        els.importFile.value = '';
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  function restoreSampleData() {
    if (!window.confirm('Restaurar dados de exemplo? Os dados atuais serão substituídos.')) return;
    state = createSampleState();
    saveState();
    clearMemberForm();
    clearVacationForm();
    selectedDate = todayISO();
    currentMonth = selectedDate.slice(0, 7);
    els.selectedDate.value = selectedDate;
    els.monthPicker.value = currentMonth;
    els.filterMonth.value = currentMonth;
    showToast('Dados de exemplo restaurados.');
    renderAll();
  }

  function resetAllData() {
    if (!window.confirm('Apagar todos os membros, férias e configurações?')) return;
    state = createEmptyState();
    saveState();
    clearMemberForm();
    clearVacationForm();
    showToast('Todos os dados foram apagados.');
    renderAll();
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
    const group = state.settings.groups[member.group] || GROUP_DEFAULTS.azul;
    const diff = daysBetween(state.settings.baseDate, dateISO);
    const cycleIndex = positiveModulo(diff - Number(group.offset || 0), 8);
    return {
      cycleIndex,
      cycleDay: cycleIndex + 1,
      works: cycleIndex < 6
    };
  }

  function getMonthStats(monthISO) {
    const [, month] = monthISO.split('-').map(Number);
    const year = Number(monthISO.slice(0, 4));
    const lastDay = new Date(year, month, 0).getDate();
    let criticalDays = 0;
    let maxVacation = 0;

    for (let dayNumber = 1; dayNumber <= lastDay; dayNumber += 1) {
      const dateISO = `${monthISO}-${String(dayNumber).padStart(2, '0')}`;
      const day = evaluateDay(dateISO);
      if (day.present.length < state.settings.minPresent) criticalDays += 1;
      maxVacation = Math.max(maxVacation, day.vacation.length);
    }

    return { criticalDays, maxVacation };
  }

  function findVacationConflicts(memberId, startDate, endDate, ignoreId = '') {
    return state.vacations.filter((vacation) => (
      vacation.memberId === memberId &&
      vacation.id !== ignoreId &&
      periodsOverlap(startDate, endDate, vacation.startDate, vacation.endDate)
    ));
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

  function groupBadge(key) {
    return `<span class="pill ${GROUP_CLASS[key] || ''}">${escapeHtml(groupName(key))}</span>`;
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

  function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSampleState();
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : createSampleState();
    } catch {
      return createSampleState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function createEmptyState() {
    return {
      version: 1,
      settings: {
        baseDate: todayISO(),
        minPresent: 6,
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
      version: 1,
      settings: {
        baseDate,
        minPresent: 6,
        groups: structuredCloneSafe(GROUP_DEFAULTS)
      },
      members: [
        { id: 'm-ana', name: 'Ana Souza', group: 'azul', active: true },
        { id: 'm-bruno', name: 'Bruno Lima', group: 'azul', active: true },
        { id: 'm-carla', name: 'Carla Mendes', group: 'azul', active: true },
        { id: 'm-diego', name: 'Diego Alves', group: 'verde', active: true },
        { id: 'm-elisa', name: 'Elisa Rocha', group: 'verde', active: true },
        { id: 'm-felipe', name: 'Felipe Santos', group: 'verde', active: true },
        { id: 'm-gabriela', name: 'Gabriela Nunes', group: 'amarelo', active: true },
        { id: 'm-henrique', name: 'Henrique Costa', group: 'amarelo', active: true },
        { id: 'm-iris', name: 'Íris Martins', group: 'amarelo', active: true },
        { id: 'm-joao', name: 'João Pereira', group: 'vermelho', active: true },
        { id: 'm-karina', name: 'Karina Melo', group: 'vermelho', active: true },
        { id: 'm-lucas', name: 'Lucas Ferreira', group: 'vermelho', active: true }
      ],
      vacations: [
        { id: 'v-ana-1', memberId: 'm-ana', startDate: plus(3), endDate: plus(12), notes: 'Férias programadas' },
        { id: 'v-diego-1', memberId: 'm-diego', startDate: plus(8), endDate: plus(18), notes: '' },
        { id: 'v-iris-1', memberId: 'm-iris', startDate: plus(20), endDate: plus(29), notes: 'Cobertura combinada' },
        { id: 'v-karina-1', memberId: 'm-karina', startDate: plus(-5), endDate: plus(2), notes: 'Em andamento' }
      ]
    };
  }

  function ensureStateShape() {
    if (!state || typeof state !== 'object') state = createSampleState();
    if (!state.settings) state.settings = createEmptyState().settings;
    if (!state.settings.baseDate) state.settings.baseDate = todayISO();
    if (!state.settings.minPresent) state.settings.minPresent = 6;
    if (!state.settings.groups) state.settings.groups = structuredCloneSafe(GROUP_DEFAULTS);
    GROUPS.forEach((key) => {
      state.settings.groups[key] = {
        name: state.settings.groups[key]?.name || GROUP_DEFAULTS[key].name,
        offset: normalizeOffset(Number(state.settings.groups[key]?.offset ?? GROUP_DEFAULTS[key].offset))
      };
    });
    if (!Array.isArray(state.members)) state.members = [];
    if (!Array.isArray(state.vacations)) state.vacations = [];

    state.members = state.members.map((member) => ({
      id: member.id || newId('m'),
      name: String(member.name || 'Sem nome'),
      group: GROUPS.includes(member.group) ? member.group : 'azul',
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
