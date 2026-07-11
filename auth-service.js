(function () {
  'use strict';

  const ROOT_COLLECTION = 'companies';
  const VALID_ROLES = ['admin', 'viewer'];

  function createFeriasAuthService() {
    const configWrapper = window.FERIAS_FIREBASE_CONFIG || {};
    const firebaseConfig = configWrapper.firebaseConfig || {};
    const companyId = configWrapper.companyId || 'terceiro-turno';

    let app = null;
    let auth = null;
    let db = null;
    let currentUser = null;
    let currentRole = null;
    let configured = isConfigured(configWrapper, firebaseConfig);
    let roleUnsubscribe = null;
    let lastStatus = {
      mode: configured ? 'cloud' : 'local',
      configured,
      authenticated: false,
      authorized: false,
      role: null,
      email: '',
      uid: '',
      message: configured
        ? 'Firebase configurado. Entre para sincronizar os dados.'
        : 'Modo local: preencha firebase-config.js para ativar sincronização em tempo real.'
    };
    let onStatus = () => {};

    function init(callbacks) {
      onStatus = callbacks?.onStatus || onStatus;

      if (!configured) {
        emitStatus(lastStatus);
        return;
      }

      if (!window.firebase || !window.firebase.initializeApp) {
        configured = false;
        emitStatus({
          mode: 'local',
          configured: false,
          authenticated: false,
          authorized: false,
          role: null,
          email: '',
          uid: '',
          message: 'Firebase configurado, mas o SDK não carregou. O app continuará local até haver internet.'
        });
        return;
      }

      try {
        app = window.firebase.apps && window.firebase.apps.length
          ? window.firebase.app()
          : window.firebase.initializeApp(firebaseConfig);
        auth = window.firebase.auth(app);
        db = window.firebase.firestore(app);

        // A persistência do login é escolhida no envio do formulário.
        // Não altere aqui: isso preserva corretamente a opção “Continuar conectado”.
        enableOptionalPersistence();

        auth.onAuthStateChanged((user) => {
          currentUser = user || null;
          currentRole = null;
          stopRoleListener();

          if (!currentUser) {
            emitStatus({
              mode: 'cloud',
              configured: true,
              authenticated: false,
              authorized: false,
              role: null,
              email: '',
              uid: '',
              message: 'Firebase configurado. Entre com e-mail e senha para sincronizar os dados.'
            });
            return;
          }

          emitStatus({
            mode: 'cloud',
            configured: true,
            authenticated: true,
            authorized: false,
            role: null,
            email: currentUser.email || '',
            uid: currentUser.uid,
            message: 'Login realizado. Verificando permissões do usuário...'
          });
          listenToCurrentUserRole();
        });
      } catch (error) {
        console.error(error);
        configured = false;
        emitStatus({
          mode: 'local',
          configured: false,
          authenticated: false,
          authorized: false,
          role: null,
          email: '',
          uid: '',
          message: 'Não foi possível iniciar o Firebase. Confira firebase-config.js.'
        });
      }
    }

    function enableOptionalPersistence() {
      try {
        db.enablePersistence({ synchronizeTabs: true }).catch((error) => {
          console.info('Persistência offline do Firestore não ativada:', error?.code || error?.message || error);
        });
      } catch (error) {
        console.info('Persistência offline do Firestore indisponível:', error?.message || error);
      }
    }

    function listenToCurrentUserRole() {
      if (!currentUser || !db) return;
      const ref = db
        .collection(ROOT_COLLECTION)
        .doc(companyId)
        .collection('roles')
        .doc(currentUser.uid);

      roleUnsubscribe = ref.onSnapshot((snapshot) => {
        const data = snapshot.exists ? snapshot.data() : null;
        const role = data && VALID_ROLES.includes(data.role) ? data.role : null;
        currentRole = role;

        if (!role) {
          emitStatus({
            mode: 'cloud',
            configured: true,
            authenticated: true,
            authorized: false,
            role: null,
            email: currentUser.email || '',
            uid: currentUser.uid,
            message: 'Usuário autenticado, mas sem permissão. Crie o documento roles com este UID no Firestore.'
          });
          return;
        }

        const label = role === 'admin' ? 'Administrador' : 'Visualizador';
        emitStatus({
          mode: 'cloud',
          configured: true,
          authenticated: true,
          authorized: true,
          role,
          email: currentUser.email || '',
          uid: currentUser.uid,
          message: `Nuvem ativa como ${label}: ${currentUser.email || currentUser.uid}.`
        });
      }, (error) => {
        console.error(error);
        currentRole = null;
        emitStatus({
          mode: 'cloud',
          configured: true,
          authenticated: Boolean(currentUser),
          authorized: false,
          role: null,
          email: currentUser?.email || '',
          uid: currentUser?.uid || '',
          message: 'Não foi possível ler a permissão do usuário. Confira o documento roles e as regras do Firestore.'
        });
      });
    }

    async function login(email, password, keepConnected = false) {
      if (!configured || !auth) throw new Error('Firebase não configurado.');

      const persistence = keepConnected
        ? window.firebase.auth.Auth.Persistence.LOCAL
        : window.firebase.auth.Auth.Persistence.SESSION;

      try {
        await auth.setPersistence(persistence);
      } catch (error) {
        console.error('Não foi possível definir a persistência do login:', error);
        throw new Error('Não foi possível configurar a permanência do login neste navegador.');
      }

      await auth.signInWithEmailAndPassword(email, password);
    }

    async function logout() {
      if (!auth) return;
      await auth.signOut();
    }

    function stopRoleListener() {
      if (!roleUnsubscribe) return;
      try { roleUnsubscribe(); } catch (_) { /* noop */ }
      roleUnsubscribe = null;
    }

    function emitStatus(status) {
      lastStatus = {
        ...lastStatus,
        ...status,
        configured: Boolean(status.configured),
        authenticated: Boolean(status.authenticated),
        authorized: Boolean(status.authorized),
        role: status.role || null
      };
      onStatus(lastStatus);
    }

    function getDb() {
      return db;
    }

    function getCompanyId() {
      return companyId;
    }

    function getCurrentUser() {
      return currentUser;
    }

    function getCurrentRole() {
      return currentRole;
    }

    function getLastStatus() {
      return { ...lastStatus };
    }

    function isConfiguredForCloud() {
      return Boolean(configured);
    }

    function isAuthenticated() {
      return Boolean(currentUser);
    }

    function isAuthorized() {
      return Boolean(currentUser && currentRole);
    }

    function isViewer() {
      return Boolean(currentUser && VALID_ROLES.includes(currentRole));
    }

    function isAdmin() {
      return Boolean(currentUser && currentRole === 'admin');
    }

    return {
      init,
      login,
      logout,
      getDb,
      getCompanyId,
      getCurrentUser,
      getCurrentRole,
      getLastStatus,
      isConfiguredForCloud,
      isAuthenticated,
      isAuthorized,
      isViewer,
      isAdmin
    };
  }

  function isConfigured(wrapper, firebaseConfig) {
    if (!wrapper || wrapper.enabled !== true) return false;
    if (!firebaseConfig || typeof firebaseConfig !== 'object') return false;
    const required = ['apiKey', 'authDomain', 'projectId', 'appId'];
    return required.every((key) => {
      const value = String(firebaseConfig[key] || '');
      return value && !value.includes('COLE_') && !value.includes('SEU_PROJETO') && !value.includes('000000');
    });
  }

  window.FeriasAuthService = { create: createFeriasAuthService };
})();
