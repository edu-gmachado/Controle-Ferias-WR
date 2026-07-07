/*
  CONFIGURAÇÃO DO FIREBASE — V4
  1) Crie um projeto no Firebase.
  2) Ative Authentication > Email/Senha.
  3) Ative Firestore Database.
  4) Copie a configuração Web do Firebase para firebaseConfig.
  5) Troque enabled para true.
  6) Crie companies/terceiro-turno/roles/SEU_UID com role admin.
*/

window.FERIAS_FIREBASE_CONFIG = {
  enabled: true,
  companyId: 'terceiro-turno',
  firebaseConfig: {
    apiKey: 'AIzaSyBXYrkiF_mF0DimYgBcwAgt5jyFEO0C9MM',
    authDomain: 'ferias-wr.firebaseapp.com',
    projectId: 'ferias-wr',
    storageBucket: 'ferias-wr.firebasestorage.app',
    messagingSenderId: '816595205809',
    appId: '1:816595205809:web:262461a7556a166a4eac90'
  }
};
