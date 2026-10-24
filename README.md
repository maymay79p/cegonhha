<p align="center">
  <img src="assets/cegonha-mark.png" width="180" alt="Logo do Cegonha" />
</p>

<h1 align="center">Cegonha</h1>

<p align="center">Aplicativo de gerenciamento de encomendas para condomínios, desenvolvido com React Native, Expo, TypeScript e Firebase.</p>

## Perfis do sistema

- **Morador** — acompanha encomendas, entregas previstas, avisos, Mural e dados da própria conta.
- **Portaria** — registra e entrega encomendas, utiliza OCR, aprova vínculos, modera o Mural e consulta relatórios.

O perfil de síndico e o chat privado não fazem parte do escopo atual. A comunicação entre Morador e Portaria ocorre pela Central de Avisos e pelo Mural coletivo do condomínio.

## Rodar o projeto

```bash
git pull origin main
npm run setup
npm start
```

O fluxo principal funciona no Expo Go. Google Sign-In nativo e push remoto exigem uma Development Build/APK.

## Recursos principais

- cadastro, login, recuperação de senha e verificação de e-mail;
- perfis Morador e Portaria com permissões separadas;
- vínculo com condomínio mediante código e aprovação;
- registro, histórico e confirmação de retirada de encomendas;
- código de retirada de seis dígitos;
- OCR de etiquetas por câmera ou galeria usando OCR.Space;
- sugestão de morador a partir de nome, CPF, bloco e apartamento reconhecidos;
- confirmação humana antes de registrar uma leitura OCR;
- entregas previstas pelo Morador;
- Central de Avisos em tempo real;
- push notification opcional em build nativa;
- lembrete automático para encomendas há mais de três dias aguardando retirada;
- Mural em tempo real com filtro de linguagem imprópria, denúncia e moderação;
- Central de Denúncias para os dois perfis;
- relatórios e indicadores para a Portaria;
- endereço/localização do condomínio;
- acessibilidade, tema claro/escuro/sistema e tela de privacidade;
- exclusão de conta com remoção de dados pessoais e anonimização dos registros que precisam permanecer para auditoria.

## Identidade visual

A marca oficial é a cegonha rosa em estilo de impressão/carimbo. A identidade está integrada ao ícone instalado, adaptive icon Android, favicon, login, onboarding e abertura nativa do Android. Os arquivos oficiais ficam em `assets/` e as regras de uso estão em [`docs/IDENTIDADE_VISUAL.md`](docs/IDENTIDADE_VISUAL.md).

## Segurança

A autorização não depende apenas das telas. As Firestore Rules verificam autenticação, e-mail confirmado, perfil, condomínio e integridade dos dados gravados. Entre as proteções atuais estão:

- isolamento entre condomínios;
- separação de privilégios Morador/Portaria;
- aprovação obrigatória para nova Portaria entrar em condomínio existente;
- validação de autoria no Mural, denúncias, notificações, OCR e auditoria;
- validação do Morador/Portaria reais ao registrar encomendas;
- CPF, telefone e e-mail com reservas de unicidade sem leitura pública;
- registros de encomendas não podem ser apagados pelo cliente;
- endereço do condomínio fica em documento privado;
- exclusão de conta é executada pelo backend, exige autenticação recente e impede apagar a última Portaria do condomínio;
- CI audita dependências, executa emuladores Firebase e procura padrões de credenciais privadas.

As regras versionadas só passam a valer no Firebase real após o deploy.

## OCR e privacidade

O OCR.Space recebe temporariamente uma versão comprimida da imagem por HTTPS. O Cegonha não persiste a foto da etiqueta nem o texto bruto reconhecido no Firestore. Após a confirmação ficam somente campos relevantes e métricas necessárias ao funcionamento/avaliação acadêmica.

Mais detalhes: [`docs/PRIVACIDADE.md`](docs/PRIVACIDADE.md).

## Lembrete de 3 dias

Além da verificação feita quando a Portaria abre o aplicativo, o backend possui uma Cloud Function agendada para localizar encomendas pendentes há pelo menos três dias, marcar o lembrete como enviado, criar aviso para o Morador e registrar auditoria.

A rotina independente do aparelho só fica ativa depois que as Cloud Functions forem publicadas no projeto Firebase real.

## Exclusão de conta

Em **Privacidade e segurança**, o usuário pode solicitar a exclusão definitiva da conta. O fluxo exige confirmação explícita e autenticação recente. Dados pessoais removíveis são apagados; registros operacionais que precisam continuar íntegros, como encomendas e auditorias históricas, são anonimizados como **Conta removida**.

Para evitar deixar um condomínio sem administração operacional, a última conta da Portaria não pode ser excluída enquanto não existir outra Portaria vinculada.

## Firebase

Somente Firestore Rules:

```bash
npm run firebase:deploy
```

Somente backend:

```bash
npm run firebase:deploy:backend
```

Regras + backend completo:

```bash
npm run firebase:deploy:prod
```

O backend inclui push, lembrete agendado e exclusão segura de conta. A publicação de Cloud Functions pode exigir configuração/faturamento compatível no projeto Firebase.

## APK e build

APK preview assinada pelo EAS:

```bash
npm run build:final:android
```

O GitHub Actions também executa `expo prebuild` e compila uma APK Android debug de validação. Quando a pipeline passa, essa APK fica disponível como artifact temporário da execução.

## Validação automática

O workflow **Validar Cegonha** executa instalação reproduzível, auditoria de vulnerabilidades, Expo/TypeScript, parser OCR, pesquisa, emuladores Firebase, testes ofensivos das regras, Expo Doctor, bundle Expo Go, prebuild Android, compilação de APK debug, testes das Functions e busca por assinaturas comuns de credenciais privadas.

O teste de fluxo percorre cadastro/vínculo, chegada da encomenda, aviso, código de retirada, solicitação e confirmação da retirada.

## Documentação do TCC

- [Arquitetura](docs/ARQUITETURA.md)
- [Modelo de dados](docs/MODELO_DE_DADOS.md)
- [Testes](docs/TESTES.md)
- [Privacidade](docs/PRIVACIDADE.md)
- [Identidade visual](docs/IDENTIDADE_VISUAL.md)
- [Configuração de push](docs/PUSH_SETUP.md)
- [Como rodar o app](docs/RODAR_APP.md)
- [Checklist de finalização](docs/FINALIZACAO.md)

## Estado de entrega

O repositório contém o código e a configuração da versão final do TCC. **Deploy no Firebase real, build EAS assinado e teste físico em um aparelho são etapas externas ao código e não devem ser considerados concluídos apenas porque a configuração está versionada.** Consulte [`docs/FINALIZACAO.md`](docs/FINALIZACAO.md) para o checklist final.
