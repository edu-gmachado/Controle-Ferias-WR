# Controle de Férias — 3º Turno PWA v4

Dashboard PWA para controle de férias do **3º turno**, com escala **6x2 em 4 cores**, divisão visual entre **Fabricação** e **Embalagem** e sincronização em tempo real via **Firebase Authentication + Cloud Firestore**.

A v4 reorganiza a camada de código conforme a arquitetura proposta:

- `auth-service.js`: inicialização Firebase, login, logout, leitura do papel do usuário e controle de permissão.
- `firebase-service.js`: leitura/gravação no Firestore e listeners em tempo real.
- `app.js`: interface, cálculo da escala 6x2, renderização e regras de negócio.
- `firebase-config.js`: configuração pública do app Web Firebase.

Sem Firebase configurado, o app continua funcionando em **modo local** usando `localStorage`.

## Principais recursos

- Cadastro, edição e exclusão de membros do time.
- Setores fixos: **Fabricação** e **Embalagem**.
- Cores da escala na ordem: **Azul → Amarelo → Vermelho → Verde**.
- Cadastro, edição e exclusão de férias.
- Calendário mensal com:
  - cores da escala por dia;
  - faixa de férias com nome do colaborador;
  - indicação de **Cobertura boa** ou **Atenção**.
- Criticidade:
  - **Atenção** quando houver 3 ou mais pessoas de férias no mesmo dia;
  - **Atenção** quando houver 2 ou mais pessoas do mesmo setor de férias;
  - 2 pessoas de setores diferentes continuam como **Cobertura boa**.
- Aviso de sobreposição ao cadastrar férias:
  - conflito com o mesmo colaborador;
  - sobreposição com férias de outras pessoas;
  - nome da pessoa, período e quantidade de dias sobrepostos.
- Exportação e importação de backup `.json`.
- PWA instalável com service worker e ícones.
- Sincronização em tempo real com Firestore quando configurado.
- Permissões por papel:
  - `admin`: visualiza e edita tudo;
  - `viewer`: apenas visualiza.

## Estrutura dos arquivos

```text
controle-ferias-3turno-pwa-v4/
├── index.html
├── styles.css
├── app.js
├── firebase-config.js
├── auth-service.js
├── firebase-service.js
├── manifest.json
├── service-worker.js
├── README.md
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

## Modo local

Sem configurar o Firebase, o app usa o `localStorage` do navegador. Nesse modo:

- os dados ficam apenas no dispositivo/navegador usado;
- o backup JSON deve ser usado para levar dados para outro aparelho;
- não há sincronização em tempo real.

## Ativar sincronização em tempo real com Firebase

### 1. Criar projeto no Firebase

1. Acesse o Firebase Console.
2. Crie um novo projeto, por exemplo: `controle-ferias-3turno`.
3. O Google Analytics pode ficar desativado se você não precisar dele.

### 2. Criar app Web

1. Entre no projeto Firebase.
2. Vá em **Project settings**.
3. Em **Your apps**, clique no ícone Web `</>`.
4. Registre o app, por exemplo: `controle-ferias-pwa`.
5. Copie o objeto `firebaseConfig`.

### 3. Configurar `firebase-config.js`

Abra o arquivo `firebase-config.js` e substitua os valores de exemplo:

```javascript
window.FERIAS_FIREBASE_CONFIG = {
  enabled: true,
  companyId: 'terceiro-turno',
  firebaseConfig: {
    apiKey: 'SUA_API_KEY',
    authDomain: 'SEU_PROJETO.firebaseapp.com',
    projectId: 'SEU_PROJETO',
    storageBucket: 'SEU_PROJETO.appspot.com',
    messagingSenderId: 'SEU_MESSAGING_SENDER_ID',
    appId: 'SEU_APP_ID'
  }
};
```

Atenção: troque `enabled: false` para `enabled: true`.

### 4. Ativar Authentication

1. No Firebase, vá em **Build → Authentication**.
2. Clique em **Get started**.
3. Vá em **Sign-in method**.
4. Ative **Email/Password**.
5. Crie pelo menos um usuário em **Users**.
6. Copie o **UID** do usuário criado.

### 5. Criar Firestore Database

1. No Firebase, vá em **Build → Firestore Database**.
2. Clique em **Create database**.
3. Escolha a região desejada.
4. Crie a estrutura de dados abaixo.

## Estrutura do Firestore

Crie manualmente pelo menos:

```text
companies/
  terceiro-turno/
    settings/
      scale
    roles/
      SEU_UID
```

Depois, o PWA consegue criar `members` e `vacations` automaticamente.

### Documento `companies/terceiro-turno/settings/scale`

Campos recomendados:

```json
{
  "baseDate": "2026-07-01",
  "groups": {
    "azul": { "name": "Azul", "offset": 0 },
    "amarelo": { "name": "Amarelo", "offset": 2 },
    "vermelho": { "name": "Vermelho", "offset": 4 },
    "verde": { "name": "Verde", "offset": 6 }
  }
}
```

### Documento `companies/terceiro-turno/roles/SEU_UID`

Para administrador:

```json
{
  "email": "seuemail@exemplo.com",
  "role": "admin"
}
```

Para visualizador:

```json
{
  "email": "usuario@exemplo.com",
  "role": "viewer"
}
```

## Regras de segurança recomendadas

Use regras por papel. Assim, usuário sem login não acessa nada; `viewer` só lê; `admin` lê e escreve.

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /companies/{companyId} {

      function signedIn() {
        return request.auth != null;
      }

      function rolePath(uid) {
        return /databases/$(database)/documents/companies/$(companyId)/roles/$(uid);
      }

      function hasRole() {
        return signedIn() && exists(rolePath(request.auth.uid));
      }

      function userRole() {
        return get(rolePath(request.auth.uid)).data.role;
      }

      function isAdmin() {
        return hasRole() && userRole() == "admin";
      }

      function isViewer() {
        return hasRole() && userRole() in ["admin", "viewer"];
      }

      match /settings/{docId} {
        allow read: if isViewer();
        allow write: if isAdmin();
      }

      match /members/{memberId} {
        allow read: if isViewer();
        allow create, update, delete: if isAdmin();
      }

      match /vacations/{vacationId} {
        allow read: if isViewer();
        allow create, update, delete: if isAdmin();
      }

      match /roles/{userId} {
        allow read: if signedIn() && (request.auth.uid == userId || isAdmin());
        allow create, update, delete: if isAdmin();
      }
    }
  }
}
```

## Como os dados ficam no Firestore

```text
companies/
  terceiro-turno/
    settings/
      scale
    roles/
      UID_DO_USUARIO
    members/
      membro_001
      membro_002
    vacations/
      ferias_001
      ferias_002
```

O valor `terceiro-turno` vem de `companyId` no `firebase-config.js`.

## Migrar dados locais para a nuvem

Depois de configurar e entrar como `admin`:

1. Abra o PWA.
2. Faça login no painel **Sincronização em tempo real**.
3. Clique em **Migrar dados locais para a nuvem**.
4. Confirme.

Isso substitui os dados atuais do Firestore pelos dados salvos localmente neste navegador.

Também é possível usar **Importar backup .json**. Quando a nuvem estiver ativa como `admin`, o backup importado será enviado para o Firestore.

## Publicar no GitHub Pages

1. Suba todos os arquivos extraídos para a raiz do repositório.
2. Garanta que o `index.html` esteja na raiz.
3. Vá em **Settings → Pages**.
4. Escolha:

```text
Source: Deploy from a branch
Branch: main
Folder: / root
```

5. Salve e aguarde o deploy.

## Atualizar uma versão anterior

Substitua os arquivos antigos pelos arquivos desta pasta. Como o service worker usa cache, depois do deploy pode ser necessário:

- recarregar a página algumas vezes;
- abrir em aba anônima;
- ou limpar os dados do site no navegador.

## Observações importantes

- O PWA depende de internet para sincronizar com Firebase.
- Sem internet, o app pode mostrar dados em cache/local, mas a sincronização real acontece quando a conexão volta.
- O arquivo `firebase-config.js` contém dados públicos de configuração do app Web. A segurança real vem das regras do Firestore e do Authentication.
- Não use regras abertas em produção.
- Usuários com `role: "viewer"` verão os dados, mas os formulários e botões de edição ficam bloqueados no PWA.
