# Controle de Férias — 3º Turno

Dashboard PWA para controle de férias, presença diária e escala 6x2 com 4 cores/grupos.

O projeto foi criado para funcionar como site estático, sem backend e sem banco de dados externo. Os dados ficam salvos no navegador usando `localStorage` e podem ser exportados/importados por arquivo JSON.

## Funcionalidades

- Cadastro, edição, inativação e exclusão de membros do time.
- Cadastro, edição e exclusão de férias.
- Validação de sobreposição de férias para o mesmo colaborador.
- Escala 6x2 com 4 cores/grupos.
- Dashboard fixo para o 3º turno.
- Visualização diária de:
  - presentes;
  - colaboradores de férias;
  - colaboradores em folga 6x2;
  - cobertura da escala.
- Calendário mensal interativo.
- Indicadores de cobertura, férias, folgas e dias críticos.
- Filtros de férias por colaborador, mês e situação.
- Configuração de data-base da escala, nomes das cores e defasagem de cada grupo.
- Backup e restauração via JSON.
- PWA instalável e com funcionamento offline após o primeiro acesso.

## Estrutura dos arquivos

```text
controle-ferias-3turno-pwa/
├── index.html
├── styles.css
├── app.js
├── manifest.json
├── service-worker.js
├── README.md
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

## Como usar localmente

Basta abrir o arquivo `index.html` no navegador.

Para testar completamente o PWA e o service worker, é recomendado usar um servidor local simples. Exemplo com Python:

```bash
python -m http.server 8080
```

Depois acesse no navegador:

```text
http://localhost:8080
```

## Como publicar no GitHub Pages

1. Crie um repositório no GitHub.
2. Envie todos os arquivos desta pasta para o repositório.
3. No GitHub, acesse **Settings** > **Pages**.
4. Em **Build and deployment**, escolha:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
5. Salve.
6. Aguarde o GitHub gerar o link do Pages.

## Como funciona a escala 6x2

A escala usa ciclo de 8 dias:

- Dias 1 a 6: trabalho;
- Dias 7 e 8: folga.

Cada colaborador pertence a um grupo/cor. Cada grupo possui uma defasagem de 0 a 7 dias em relação à data-base.

Configuração padrão:

- Azul: defasagem 0;
- Verde: defasagem 2;
- Amarelo: defasagem 4;
- Vermelho: defasagem 6.

Na data-base, o grupo com defasagem 0 está no 1º dia de trabalho. Os outros grupos são calculados automaticamente a partir da própria defasagem.

## Como trocar membros do time

Na seção **Membros do time**, você pode:

- adicionar novo colaborador;
- editar nome;
- trocar grupo/cor;
- marcar como ativo ou inativo;
- excluir colaborador.

Colaboradores inativos não entram nos cálculos de presença, férias ou folga.

## Como cadastrar férias

Na seção **Cadastro de férias**:

1. Escolha o colaborador.
2. Informe a data inicial.
3. Informe a data final.
4. Adicione uma observação, se necessário.
5. Salve.

Se houver sobreposição com outro período do mesmo colaborador, o sistema exibirá alerta.

## Regra de classificação diária

Para cada data, o sistema faz a seguinte classificação:

1. Verifica se o colaborador está ativo.
2. Verifica se está de férias.
3. Calcula se ele estaria trabalhando ou folgando pela escala 6x2.
4. Classifica como:
   - **Presente**: estaria trabalhando e não está de férias;
   - **Férias**: está dentro de um período cadastrado de férias;
   - **Folga 6x2**: não está de férias e caiu em folga pela escala.

Quando a pessoa está de férias em um dia que seria de trabalho, aparece como **Impacta escala**. Quando está de férias em um dia que cairia em folga, aparece como **Cairia em folga**.

## Backup e restauração

Use a seção **Backup e dados** para:

- exportar um backup `.json`;
- importar um backup `.json`;
- restaurar dados de exemplo;
- apagar todos os dados.

Como os dados ficam no navegador, o backup JSON é importante para trocar de computador ou celular.

## Observações importantes

- O app não usa servidor ou banco de dados.
- Cada navegador/dispositivo terá seu próprio conjunto de dados.
- Para compartilhar os dados com outra pessoa, exporte o JSON e peça para ela importar no app.
- Após o primeiro carregamento online, o app pode funcionar offline graças ao service worker.
