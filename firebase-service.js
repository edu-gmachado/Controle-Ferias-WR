(function () {
  'use strict';

  const ROOT_COLLECTION = 'companies';
  const SETTINGS_COLLECTION = 'settings';
  const SETTINGS_DOC = 'scale';
  const MEMBERS_COLLECTION = 'members';
  const VACATIONS_COLLECTION = 'vacations';
  const TEMPORARY_CHANGES_COLLECTION = 'temporaryChanges';
  const AUDIT_COLLECTION = 'auditLogs';
  const AUDIT_LIMIT = 100;

  function createFeriasCloudService(authService) {
    let db = null;
    let companyId = 'terceiro-turno';
    let listeners = [];
    let lastRemote = {
      settings: null,
      members: [],
      vacations: [],
      temporaryChanges: [],
      auditLogs: []
    };
    let gotSettings = false;
    let gotMembers = false;
    let gotVacations = false;
    let gotTemporaryChanges = false;
    let temporaryChangesAvailable = true;
    let gotAudit = false;
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
          message: 'Serviço de autenticação Firebase não encontrado.'
        });
      }
    }

    function handleAuthStatus(status) {
      stopListeners();
      syncStarted = false;
      db = authService?.getDb ? authService.getDb() : null;
      companyId = authService?.getCompanyId ? authService.getCompanyId() : companyId;

      if (!status?.configured || !status.authenticated || !status.authorized) {
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
      return Boolean(db && authService?.isViewer?.() && syncStarted);
    }

    function canWrite() {
      return Boolean(db && authService?.isAdmin?.());
    }

    async function setSettings(settings) {
      ensureCanWrite();
      const actor = getActor();
      const batch = db.batch();
      const timestamp = serverTimestamp();

      batch.set(settingsRef(), {
        baseDate: settings.baseDate,
        groups: settings.groups,
        updatedAt: timestamp,
        updatedByUid: actor.uid,
        updatedByEmail: actor.email
      }, { merge: true });

      addAuditToBatch(batch, {
        action: 'update_settings',
        entityType: 'settings',
        entityId: SETTINGS_DOC,
        description: 'Alterou as configurações da escala 6x2.',
        details: { baseDate: settings.baseDate }
      });

      await batch.commit();
    }

    async function upsertMember(member, options = {}) {
      ensureCanWrite();
      const actor = getActor();
      const action = options.action === 'create' ? 'create_member' : 'update_member';
      const timestamp = serverTimestamp();
      const batch = db.batch();
      const payload = {
        name: member.name,
        sector: member.sector,
        group: member.group,
        active: member.active !== false,
        updatedAt: timestamp,
        updatedByUid: actor.uid,
        updatedByEmail: actor.email
      };

      if (action === 'create_member') {
        payload.createdAt = timestamp;
        payload.createdByUid = actor.uid;
        payload.createdByEmail = actor.email;
      }

      batch.set(membersRef().doc(member.id), payload, { merge: true });
      addAuditToBatch(batch, {
        action,
        entityType: 'member',
        entityId: member.id,
        description: `${action === 'create_member' ? 'Adicionou' : 'Alterou'} o colaborador ${member.name}.`,
        details: {
          memberName: member.name,
          sector: member.sector,
          group: member.group,
          active: member.active !== false
        }
      });
      await batch.commit();
    }

    async function deleteMember(memberId, options = {}) {
      ensureCanWrite();
      const [vacations, temporaryChanges] = await Promise.all([
        vacationsRef().where('memberId', '==', memberId).get(),
        temporaryChangesRef().where('memberId', '==', memberId).get()
      ]);
      const batch = db.batch();
      batch.delete(membersRef().doc(memberId));
      vacations.forEach((doc) => batch.delete(doc.ref));
      temporaryChanges.forEach((doc) => batch.delete(doc.ref));

      const memberName = options.memberName || 'colaborador';
      addAuditToBatch(batch, {
        action: 'delete_member',
        entityType: 'member',
        entityId: memberId,
        description: `Excluiu o colaborador ${memberName}${vacations.size ? ` e ${vacations.size} período(s) de férias vinculado(s)` : ''}${temporaryChanges.size ? `, além de ${temporaryChanges.size} alteração(ões) temporária(s)` : ''}.`,
        details: {
          memberName,
          deletedVacations: vacations.size,
          deletedTemporaryChanges: temporaryChanges.size
        }
      });
      await batch.commit();
    }

    async function upsertVacation(vacation, options = {}) {
      ensureCanWrite();
      const actor = getActor();
      const action = options.action === 'create' ? 'create_vacation' : 'update_vacation';
      const timestamp = serverTimestamp();
      const batch = db.batch();
      const payload = {
        memberId: vacation.memberId,
        startDate: vacation.startDate,
        endDate: vacation.endDate,
        notes: vacation.notes || '',
        updatedAt: timestamp,
        updatedByUid: actor.uid,
        updatedByEmail: actor.email
      };

      if (action === 'create_vacation') {
        payload.createdAt = timestamp;
        payload.createdByUid = actor.uid;
        payload.createdByEmail = actor.email;
      }

      batch.set(vacationsRef().doc(vacation.id), payload, { merge: true });
      addAuditToBatch(batch, {
        action,
        entityType: 'vacation',
        entityId: vacation.id,
        description: `${action === 'create_vacation' ? 'Cadastrou' : 'Alterou'} férias de ${options.memberName || 'colaborador'} (${vacation.startDate} a ${vacation.endDate}).`,
        details: {
          memberId: vacation.memberId,
          memberName: options.memberName || '',
          startDate: vacation.startDate,
          endDate: vacation.endDate
        }
      });
      await batch.commit();
    }

    async function deleteVacation(vacationId, options = {}) {
      ensureCanWrite();
      const batch = db.batch();
      batch.delete(vacationsRef().doc(vacationId));
      addAuditToBatch(batch, {
        action: 'delete_vacation',
        entityType: 'vacation',
        entityId: vacationId,
        description: `Excluiu férias de ${options.memberName || 'colaborador'}${options.startDate && options.endDate ? ` (${options.startDate} a ${options.endDate})` : ''}.`,
        details: {
          memberName: options.memberName || '',
          startDate: options.startDate || '',
          endDate: options.endDate || ''
        }
      });
      await batch.commit();
    }


    async function upsertTemporaryChange(change, options = {}) {
      ensureCanWrite();
      const actor = getActor();
      const action = options.action === 'create' ? 'create_temporary_change' : 'update_temporary_change';
      const timestamp = serverTimestamp();
      const batch = db.batch();
      const payload = {
        type: change.type,
        memberId: change.memberId || '',
        name: change.name || '',
        sector: change.sector || '',
        group: change.group || '',
        startDate: change.startDate,
        endDate: change.endDate,
        notes: change.notes || '',
        updatedAt: timestamp,
        updatedByUid: actor.uid,
        updatedByEmail: actor.email
      };

      if (action === 'create_temporary_change') {
        payload.createdAt = timestamp;
        payload.createdByUid = actor.uid;
        payload.createdByEmail = actor.email;
      }

      batch.set(temporaryChangesRef().doc(change.id), payload, { merge: true });
      addAuditToBatch(batch, {
        action,
        entityType: 'temporary_change',
        entityId: change.id,
        description: `${action === 'create_temporary_change' ? 'Criou' : 'Alterou'} uma alteração temporária para ${options.memberName || change.name || 'colaborador'} (${change.startDate} a ${change.endDate}).`,
        details: {
          memberName: options.memberName || change.name || '',
          type: change.type,
          memberId: change.memberId || '',
          startDate: change.startDate,
          endDate: change.endDate
        }
      });
      await batch.commit();
    }

    async function deleteTemporaryChange(changeId, options = {}) {
      ensureCanWrite();
      const batch = db.batch();
      batch.delete(temporaryChangesRef().doc(changeId));
      addAuditToBatch(batch, {
        action: 'delete_temporary_change',
        entityType: 'temporary_change',
        entityId: changeId,
        description: `Excluiu uma alteração temporária de ${options.memberName || 'colaborador'}${options.startDate && options.endDate ? ` (${options.startDate} a ${options.endDate})` : ''}.`,
        details: {
          memberName: options.memberName || '',
          type: options.type || '',
          startDate: options.startDate || '',
          endDate: options.endDate || ''
        }
      });
      await batch.commit();
    }

    async function replaceAll(state, options = {}) {
      ensureCanWrite();
      const [membersSnapshot, vacationsSnapshot, temporaryChangesSnapshot] = await Promise.all([
        membersRef().get(),
        vacationsRef().get(),
        temporaryChangesRef().get()
      ]);

      const writeCount = membersSnapshot.size + vacationsSnapshot.size + temporaryChangesSnapshot.size +
        (state.members || []).length + (state.vacations || []).length + (state.temporaryChanges || []).length + 2;
      if (writeCount > 450) {
        throw new Error('A operação possui dados demais para um único lote seguro. Exporte e importe em partes menores.');
      }

      const actor = getActor();
      const timestamp = serverTimestamp();
      const batch = db.batch();
      membersSnapshot.forEach((doc) => batch.delete(doc.ref));
      vacationsSnapshot.forEach((doc) => batch.delete(doc.ref));
      temporaryChangesSnapshot.forEach((doc) => batch.delete(doc.ref));

      batch.set(settingsRef(), {
        baseDate: state.settings.baseDate,
        groups: state.settings.groups,
        updatedAt: timestamp,
        updatedByUid: actor.uid,
        updatedByEmail: actor.email
      }, { merge: true });

      (state.members || []).forEach((member) => {
        batch.set(membersRef().doc(member.id), {
          name: member.name,
          sector: member.sector,
          group: member.group,
          active: member.active !== false,
          createdAt: timestamp,
          createdByUid: actor.uid,
          createdByEmail: actor.email,
          updatedAt: timestamp,
          updatedByUid: actor.uid,
          updatedByEmail: actor.email
        });
      });

      (state.vacations || []).forEach((vacation) => {
        batch.set(vacationsRef().doc(vacation.id), {
          memberId: vacation.memberId,
          startDate: vacation.startDate,
          endDate: vacation.endDate,
          notes: vacation.notes || '',
          createdAt: timestamp,
          createdByUid: actor.uid,
          createdByEmail: actor.email,
          updatedAt: timestamp,
          updatedByUid: actor.uid,
          updatedByEmail: actor.email
        });
      });

      (state.temporaryChanges || []).forEach((change) => {
        batch.set(temporaryChangesRef().doc(change.id), {
          type: change.type,
          memberId: change.memberId || '',
          name: change.name || '',
          sector: change.sector || '',
          group: change.group || '',
          startDate: change.startDate,
          endDate: change.endDate,
          notes: change.notes || '',
          createdAt: timestamp,
          createdByUid: actor.uid,
          createdByEmail: actor.email,
          updatedAt: timestamp,
          updatedByUid: actor.uid,
          updatedByEmail: actor.email
        });
      });

      addAuditToBatch(batch, {
        action: options.action || 'replace_all',
        entityType: 'database',
        entityId: companyId,
        description: options.description || 'Substituiu os dados de membros, férias e configurações.',
        details: {
          members: (state.members || []).length,
          vacations: (state.vacations || []).length,
          temporaryChanges: (state.temporaryChanges || []).length
        }
      });
      await batch.commit();
    }


    function startRealtimeListeners(status) {
      gotSettings = false;
      gotMembers = false;
      gotVacations = false;
      gotTemporaryChanges = false;
      temporaryChangesAvailable = true;
      gotAudit = !authService?.isAdmin?.();
      lastRemote = { settings: null, members: [], vacations: [], temporaryChanges: [], auditLogs: [] };
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

      listeners.push(temporaryChangesRef().onSnapshot((snapshot) => {
        gotTemporaryChanges = true;
        temporaryChangesAvailable = true;
        lastRemote.temporaryChanges = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        emitRemoteState();
      }, handleTemporarySnapshotError));

      if (authService?.isAdmin?.()) {
        listeners.push(auditRef()
          .orderBy('timestamp', 'desc')
          .limit(AUDIT_LIMIT)
          .onSnapshot((snapshot) => {
            gotAudit = true;
            lastRemote.auditLogs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            emitRemoteState();
          }, handleAuditSnapshotError));
      }

      emitRemoteState();
    }

    function emitRemoteState() {
      if (!gotSettings || !gotMembers || !gotVacations || !gotTemporaryChanges || !gotAudit) return;

      const normalizedState = normalizeRemoteState({
        version: 740,
        settings: lastRemote.settings || undefined,
        members: lastRemote.members || [],
        vacations: lastRemote.vacations || [],
        temporaryChanges: lastRemote.temporaryChanges || [],
        auditLogs: lastRemote.auditLogs || []
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
        message: temporaryChangesAvailable
          ? `Nuvem sincronizada: ${normalizedState.members.length} membro(s), ${normalizedState.vacations.length} férias e ${normalizedState.temporaryChanges.length} alteração(ões) temporária(s).`
          : `Nuvem sincronizada: ${normalizedState.members.length} membro(s) e ${normalizedState.vacations.length} férias. Alterações temporárias estão bloqueadas pelas regras do Firestore.`
      });
    }

    function normalizeRemoteState(remoteState) {
      const settings = normalizeRemoteSettings(remoteState.settings);
      const members = (remoteState.members || []).map((member) => ({
        id: member.id,
        name: member.name || member.nome || 'Sem nome',
        sector: normalizeSectorValue(member.sector || member.setor),
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

      const temporaryChanges = (remoteState.temporaryChanges || []).map((change) => ({
        id: String(change.id || ''),
        type: ['add_member', 'change_sector', 'deactivate_member'].includes(change.type) ? change.type : 'add_member',
        memberId: String(change.memberId || ''),
        name: String(change.name || ''),
        sector: change.type === 'deactivate_member' ? '' : normalizeSectorValue(change.sector),
        group: change.type === 'add_member' ? String(change.group || 'azul') : '',
        startDate: normalizeDateValue(change.startDate),
        endDate: normalizeDateValue(change.endDate),
        notes: String(change.notes || '')
      })).filter((change) => (
        change.id && change.startDate && change.endDate && change.startDate <= change.endDate &&
        ((change.type === 'add_member' && change.name) || (change.type !== 'add_member' && change.memberId))
      ));

      const auditLogs = (remoteState.auditLogs || []).map((log) => ({
        id: String(log.id || ''),
        action: String(log.action || 'unknown'),
        entityType: String(log.entityType || ''),
        entityId: String(log.entityId || ''),
        description: String(log.description || 'Alteração registrada.'),
        userUid: String(log.userUid || ''),
        userEmail: String(log.userEmail || 'Usuário não identificado'),
        userRole: String(log.userRole || 'admin'),
        timestamp: normalizeTimestampValue(log.timestamp) || String(log.clientTimestamp || ''),
        details: log.details && typeof log.details === 'object' ? log.details : {}
      })).filter((log) => log.id);

      auditLogs.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));

      return { version: 740, settings, members, vacations, temporaryChanges, auditLogs };
    }

    function addAuditToBatch(batch, data) {
      const actor = getActor();
      batch.set(auditRef().doc(), {
        action: data.action,
        entityType: data.entityType,
        entityId: String(data.entityId || ''),
        description: data.description,
        details: sanitizeDetails(data.details),
        userUid: actor.uid,
        userEmail: actor.email,
        userRole: actor.role,
        timestamp: serverTimestamp(),
        clientTimestamp: new Date().toISOString()
      });
    }

    function sanitizeDetails(details) {
      if (!details || typeof details !== 'object') return {};
      const output = {};
      Object.entries(details).slice(0, 20).forEach(([key, value]) => {
        if (['string', 'number', 'boolean'].includes(typeof value)) output[key] = value;
        else if (value == null) output[key] = '';
        else output[key] = String(value).slice(0, 500);
      });
      return output;
    }

    function getActor() {
      const user = authService?.getCurrentUser?.();
      if (!user?.uid) throw new Error('Usuário autenticado não encontrado para registrar auditoria.');
      return {
        uid: user.uid,
        email: user.email || user.uid,
        role: authService?.getCurrentRole?.() || 'admin'
      };
    }

    function serverTimestamp() {
      return window.firebase.firestore.FieldValue.serverTimestamp();
    }

    function normalizeSectorValue(value) {
      const normalized = String(value || '')
        .trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s_-]+/g, '');
      if (normalized === 'embalagem') return 'embalagem';
      if (normalized === 'tecnico' || normalized === 'tecnica') return 'tecnico';
      return 'fabricacao';
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

    function normalizeTimestampValue(value) {
      if (!value) return '';
      let date = null;
      if (typeof value === 'string') date = new Date(value);
      else if (typeof value.toDate === 'function') date = value.toDate();
      else if (value instanceof Date) date = value;
      else if (typeof value.seconds === 'number') date = new Date(value.seconds * 1000);
      return date && !Number.isNaN(date.getTime()) ? date.toISOString() : '';
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

    function handleTemporarySnapshotError(error) {
      console.error('Alterações temporárias indisponíveis:', error);
      gotTemporaryChanges = true;
      temporaryChangesAvailable = false;
      lastRemote.temporaryChanges = [];
      emitRemoteState();
      emitStatus({
        mode: 'cloud',
        configured: true,
        authenticated: true,
        authorized: true,
        role: authService?.getCurrentRole?.() || null,
        email: authService?.getCurrentUser?.()?.email || '',
        uid: authService?.getCurrentUser?.()?.uid || '',
        message: 'Dados principais sincronizados, mas alterações temporárias estão bloqueadas. Publique a regra temporaryChanges no Firestore.'
      });
    }

    function handleAuditSnapshotError(error) {
      console.error('Histórico de auditoria indisponível:', error);
      gotAudit = true;
      lastRemote.auditLogs = [];
      emitRemoteState();
      emitStatus({
        mode: 'cloud',
        configured: true,
        authenticated: true,
        authorized: true,
        role: authService?.getCurrentRole?.() || null,
        email: authService?.getCurrentUser?.()?.email || '',
        uid: authService?.getCurrentUser?.()?.uid || '',
        message: 'Dados sincronizados, mas o histórico está bloqueado. Publique as novas regras de auditLogs no Firestore.'
      });
    }

    function stopListeners() {
      listeners.forEach((unsubscribe) => {
        try { unsubscribe(); } catch (_) { /* noop */ }
      });
      listeners = [];
    }

    function rootDoc() { return db.collection(ROOT_COLLECTION).doc(companyId); }
    function settingsRef() { return rootDoc().collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC); }
    function membersRef() { return rootDoc().collection(MEMBERS_COLLECTION); }
    function vacationsRef() { return rootDoc().collection(VACATIONS_COLLECTION); }
    function temporaryChangesRef() { return rootDoc().collection(TEMPORARY_CHANGES_COLLECTION); }
    function auditRef() { return rootDoc().collection(AUDIT_COLLECTION); }

    function ensureCanWrite() {
      if (!canWrite()) throw new Error('Você precisa estar logado como admin para salvar dados na nuvem.');
    }

    function emitStatus(status) { onStatus(status); }

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
      upsertTemporaryChange,
      deleteTemporaryChange,
      replaceAll
    };
  }

  window.FeriasCloud = { create: createFeriasCloudService };
})();
