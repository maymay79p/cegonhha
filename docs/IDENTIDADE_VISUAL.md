# Identidade visual do Cegonha

A marca oficial do Cegonha utiliza uma cegonha estilizada dentro de um selo circular com textura de impressão/carimbo. A solução foi escolhida para manter uma aparência humana e memorável sem perder legibilidade como ícone de aplicativo.

## Marca

A arte é monocromática em rosa e não inclui o nome dentro do símbolo. O nome **Cegonha** aparece separadamente quando necessário, usando a família EB Garamond já adotada pelo aplicativo.

## Aplicações

A marca é usada nos pontos de identidade do produto:

- ícone instalado do aplicativo;
- ícone adaptativo Android;
- splash/tela de abertura;
- login;
- onboarding;
- favicon web;
- materiais de apresentação quando apropriado.

Ela não é repetida em todas as telas operacionais para evitar poluição visual. Dentro do sistema, a continuidade da identidade é mantida pela paleta, tipografia, espaçamentos e componentes.

## Paleta

A interface mantém tons quentes e rosa escuro com contraste suficiente para botões/texto. A arte do símbolo pode usar um rosa mais vibrante, enquanto `theme.ts` usa tons funcionais mais escuros no tema claro e mais claros no tema escuro para preservar contraste.

Principais cores de interface:

- fundo claro: `#F8F5F0`;
- rosa de ação no tema claro: `#A74364`;
- rosa suave: `#F5E6EC`;
- destaque escuro da Portaria: `#44383E`;
- rosa de ação no tema escuro: `#E58CAA`.

## Arquivos técnicos

`app.json` referencia:

- `assets/icon.png`;
- `assets/splash-icon.png`;
- `assets/adaptive-icon.png`;
- `assets/favicon.png`.

A interface usa `assets/branding/cegonha-mark.png` por meio do componente `components/BrandLogo.tsx`.

Para manter o repositório reproduzível, `scripts/prepare-brand-assets.cjs` prepara os PNGs oficiais a partir da fonte incorporada antes de desenvolvimento/build. Os comandos `npm start`, `npm run dev`, `npm run build:preview:android` e o `postinstall` executam essa preparação.

## Regras de uso

- não distorcer a proporção da cegonha;
- manter respiro ao redor do círculo;
- não adicionar gradientes ou cores diferentes dentro da marca principal;
- não substituir a textura de impressão por sombras ou efeitos 3D;
- em fundos escuros, preferir a versão com transparência e garantir contraste;
- no ícone adaptativo, respeitar área segura para evitar corte pelos launchers Android.
