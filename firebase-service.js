(function () {
  'use strict';

  const ROOT_COLLECTION = 'companies';
  const SETTINGS_COLLECTION = 'settings';
  const SETTINGS_DOC = 'scale';
  const MEMBERS_COLLECTION = 'members';
  const VACATIONS_COLLECTION = 'vacations';

  function createFeriasCloudService(authService) {
    let db = null;
    let companyId = 'terceiro-turno';
    let listeners = [];
    let lastRemote = {
      settings: null,
      members: [],
      vacations: []
    };
    let gotSettings = false;
    let gotMembers = false;
    let gotVacations = false;
    let syncStarted = false;
    let onData = () => {};
    let onStatus = () => {};

    function init(callbacks) {
      onData = callbacks?.onData || onData;
      onStatus = callbacks?.onStatus || onStatus;

      if (!authService || typeof authService.getDb !== 'function') {
        emitStatus({
          mode: 'local',
          configured: false,
          authenticated: false,
          authorized: false,
          role: null,
          message: 'Modo local: serviço de autenticação Firebase não encontrado.'
        });
      }
    }

    function handleAuthStatus(status) {
      stopListeners();
      syncStarted = false;
      db = authService?.getDb ? authService.getDb() : null;
      companyId = authService?.getCompanyId ? authService.getCompanyId() : companyId;

      if (!status?.configured) {
        emitStatus(status);
        return;
      }

      if (!status.authenticated || !status.authorized) {
        emitStatus(status);
        return;
      }

      if (!db) {
        emitStatus({
          ...status,
          message: 'Permissão encontrada, mas o banco Firestore ainda não está disponível.'
        });
        return;
      }

      startRealtimeListeners(status);
    }

    function isReady() {
      return Boolean(db && authService && authService.isViewer && authService.isViewer() && syncStarted);
    }

    function canWrite() {
      return Boolean(db && authService && authService.isAdmin && authService.isAdmin());
    }

    async function setSettings(settings) {
      ensureCanWrite();
      await settingsRef().set({
        baseDate: settings.baseDate,
        groups: settings.groups,
        updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }

    async function upsertMember(member) {
      ensureCanWrite();
      await membersRef().doc(member.id).set({
        name: member.name,
        sector: member.sector,
        group: member.group,
        active: member.active !== false,
        updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }

    async function deleteMember(memberId) {
      ensureCanWrite();
      const batch = db.batch();
      batch.delete(membersRef().doc(memberId));
      const vacations = await vacationsRef().where('memberId', '==', memberId).get();
      vacations.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }

    async function upsertVacation(vacation) {
      ensureCanWrite();
      await vacationsRef().doc(vacation.id).set({
        memberId: vacation.memberId,
        startDate: vacation.startDate,
        endDate: vacation.endDate,
        notes: vacation.notes || '',
        updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }

    async function deleteVacation(vacationId) {
      ensureCanWrite();
      await vacationsRef().doc(vacationId).delete();
    }

    async function replaceAll(state) {
      ensureCanWrite();
      const batch = db.batch();
      const [membersSnapshot, vacationsSnapshot] = await Promise.all([
        membersRef().get(),
        vacationsRef().get()
      ]);

      membersSnapshot.forEach((doc) => batch.delete(doc.ref));
      vacationsSnapshot.forEach((doc) => batch.delete(doc.ref));

      batch.set(settingsRef(), {
        baseDate: state.settings.baseDate,
        groups: state.settings.groups,
        updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      (state.members || []).forEach((member) => {
        batch.set(membersRef().doc(member.id), {
          name: member.name,
          sector: member.sector,
          group: member.group,
          active: member.active !== false,
          updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
        });
      });

      (state.vacations || []).forEach((vacation) => {
        batch.set(vacationsRef().doc(vacation.id), {
          memberId: vacation.memberId,
          startDate: vacation.startDate,
          endDate: vacation.endDate,
          notes: vacation.notes || '',
          updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
        });
      });

      await batch.commit();
    }

    async function clearAll(emptyState) {
      await replaceAll(emptyState);
    }

    function startRealtimeListeners(status) {
      gotSettings = false;
      gotMembers = false;
      gotVacations = false;
      lastRemote = { settings: null, members: [], vacations: [] };
      syncStarted = true;

      emitStatus({
        ...status,
        message: `${status.message || 'Nuvem ativa.'} Sincronizando dados em tempo real...`
      });

      listeners.push(settingsRef().onSnapshot((snapshot) => {
        gotSettings = true;
        lastRemote.settings = snapshot.exists ? snapshot.data() : null;
        emitRemoteState();
      }, handleSnapshotError));

      listeners.push(membersRef().onSnapshot((snapshot) => {
        gotMembers = true;
        lastRemote.members = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        emitRemoteState();
      }, handleSnapshotError));

      listeners.push(vacationsRef().onSnapshot((snapshot) => {
        gotVacations = true;
        lastRemote.vacations = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        emitRemoteState();
      }, handleSnapshotError));
    }

    function emitRemoteState() {
      if (!gotSettings || !gotMembers || !gotVacations) return;

      const normalizedState = normalizeRemoteState({
        version: 53,
        settings: lastRemote.settings || undefined,
        members: lastRemote.members || [],
        vacations: lastRemote.vacations || []
      });

      onData(normalizedState);

      emitStatus({
        mode: 'cloud',
        configured: Boolean(authService?.isConfiguredForCloud?.()),
        authenticated: Boolean(authService?.isAuthenticated?.()),
        authorized: Boolean(authService?.isAuthorized?.()),
        role: authService?.getCurrentRole?.() || null,
        email: authService?.getCurrentUser?.()?.email || '',
        uid: authService?.getCurrentUser?.()?.uid || '',
        message: `Nuvem sincronizada: ${normalizedState.members.length} membro(s), ${normalizedState.vacations.length} férias e configurações carregadas.`
      });
    }

    function normalizeRemoteState(remoteState) {
      const settings = normalizeRemoteSettings(remoteState.settings);
      const members = (remoteState.members || []).map((member) => ({
        id: member.id,
        name: member.name || member.nome || 'Sem nome',
        sector: member.sector || member.setor || 'fabricacao',
        group: member.group || member.cor || member.color || 'azul',
        active: member.active !== false && member.ativo !== false
      }));

      const vacations = (remoteState.vacations || []).map((vacation) => ({
        id: String(vacation.id || ''),
        memberId: String(vacation.memberId || vacation.member || vacation.colaboradorId || ''),
        startDate: normalizeDateValue(vacation.startDate || vacation.inicio || vacation.dataInicio),
        endDate: normalizeDateValue(vacation.endDate || vacation.fim || vacation.dataFim),
        notes: vacation.notes || vacation.note || vacation.observacao || ''
      })).filter((vacation) => vacation.id && vacation.memberId && vacation.startDate && vacation.endDate && vacation.startDate <= vacation.endDate);

      return {
        version: 53,
        settings,
        members,
        vacations
      };
    }

    function normalizeDateValue(value) {
      if (!value) return '';
      let date = null;
      if (typeof value === 'string') {
        const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!match) return '';
        const candidate = `${match[1]}-${match[2]}-${match[3]}`;
        const [year, month, day] = candidate.split('-').map(Number);
        date = new Date(year, month - 1, day);
        return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? candidate : '';
      }
      if (typeof value.toDate === 'function') date = value.toDate();
      else if (value instanceof Date) date = value;
      else if (typeof value.seconds === 'number') date = new Date(value.seconds * 1000);
      if (!date || Number.isNaN(date.getTime())) return '';
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    function normalizeRemoteSettings(settings) {
      if (!settings || typeof settings !== 'object') return undefined;

      const normalized = { ...settings };

      if (!normalized.groups && Array.isArray(normalized.groupsOrder)) {
        const defaultOffsets = { azul: 0, amarelo: 2, vermelho: 4, verde: 6 };
        normalized.groups = {};
        normalized.groupsOrder.forEach((key) => {
          normalized.groups[key] = {
            name: String(key).charAt(0).toUpperCase() + String(key).slice(1),
            offset: defaultOffsets[key] ?? 0
          };
        });
      }

      return normalized;
    }

    function handleSnapshotError(error) {
      console.error(error);
      emitStatus({
        mode: 'cloud',
        configured: Boolean(authService?.isConfiguredForCloud?.()),
        authenticated: Boolean(authService?.isAuthenticated?.()),
        authorized: Boolean(authService?.isAuthorized?.()),
        role: authService?.getCurrentRole?.() || null,
        email: authService?.getCurrentUser?.()?.email || '',
        uid: authService?.getCurrentUser?.()?.uid || '',
        message: 'Erro ao sincronizar. Verifique as regras do Firestore, o documento roles e a conexão.'
      });
    }

    function stopListeners() {
      listeners.forEach((unsubscribe) => {
        try { unsubscribe(); } catch (_) { /* noop */ }
      });
      listeners = [];
    }

    function rootDoc() {
      return db.collection(ROOT_COLLECTION).doc(companyId);
    }

    function settingsRef() {
      return rootDoc().collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC);
    }

    function membersRef() {
      return rootDoc().collection(MEMBERS_COLLECTION);
    }

    function vacationsRef() {
      return rootDoc().collection(VACATIONS_COLLECTION);
    }

    function ensureCanWrite() {
      if (!canWrite()) throw new Error('Você precisa estar logado como admin para salvar dados na nuvem.');
    }

    function emitStatus(status) {
      onStatus(status);
    }

    return {
      init,
      handleAuthStatus,
      isReady,
      canWrite,
      setSettings,
      upsertMember,
      deleteMember,
      upsertVacation,
      deleteVacation,
      replaceAll,
      clearAll
    };
  }

  window.FeriasCloud = { create: createFeriasCloudService };
})();
