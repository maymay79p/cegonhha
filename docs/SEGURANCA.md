# Segurança do Cegonha

A segurança do Cegonha é baseada em defesa em profundidade. Validações visuais melhoram a experiência, mas não são tratadas como barreira de autorização.

## Autenticação

- acesso protegido exige Firebase Authentication;
- contas por e-mail/senha precisam confirmar o endereço de e-mail;
- recuperação e alteração de senha usam mecanismos do Firebase;
- exclusão de conta exige sessão recente;
- login Google é opcional e depende de build nativa.

## Autorização no Firestore

`firestore.rules` confere a identidade autenticada e o documento real do usuário. As regras aplicam:

- isolamento entre condomínios;
- diferenciação de Morador e Portaria;
- exigência de vínculo válido;
- validação de autoria e nomes contra o perfil real;
- restrição dos campos que podem ser criados/alterados;
- preservação de campos imutáveis em registros críticos.

## Portaria e vínculo

Conhecer o código de um condomínio não é suficiente para obter privilégios de Portaria. Uma nova conta de Portaria que tenta entrar em condomínio existente passa pelo fluxo de solicitação e precisa da aprovação de outra Portaria já vinculada.

A exclusão da última Portaria do condomínio é bloqueada pelo backend.

## Encomendas

Na criação e atualização de encomendas, as regras verificam identidade da Portaria, condomínio e Morador. O cliente não pode trocar arbitrariamente destinatário nem código de retirada depois da criação, e encomendas não podem ser apagadas pelo aplicativo como forma de apagar histórico.

## Mural e denúncias

As regras vinculam publicação, resposta e denúncia aos registros reais. Isso impede que um cliente modificado:

- publique em nome de outro usuário;
- responda apontando para autor falso;
- denuncie texto/autor que não correspondem à publicação;
- modere denúncia fora do próprio condomínio;
- crie banimento para usuário de outro condomínio.

## Dados sensíveis

- CPF, telefone e e-mail não ficam no diretório compartilhado;
- reservas de unicidade não possuem leitura pública;
- endereço do condomínio fica separado do documento público operacional;
- a imagem e o texto bruto do OCR não são persistidos;
- credenciais privadas, contas de serviço e arquivos de chave são ignorados pelo Git.

## Cloud Functions

Operações que exigem autoridade administrativa são executadas no backend usando Admin SDK:

- exclusão/anomização de conta;
- processamento diário de lembrete de três dias;
- envio de push disparado por notificações.

A Cloud Function de exclusão valida autenticação, e-mail verificado, frase de confirmação e `auth_time` recente.

## Dependências e supply chain

O `package-lock.json` é versionado. O CI usa `npm ci` e executa auditoria de vulnerabilidades. O workflow também confirma a versão corrigida do `@grpc/grpc-js` usada pelo projeto e busca padrões comuns de chaves privadas/segredos versionados.

## Testes de segurança

Os emuladores Firebase executam cenários legítimos e ataques esperados. Tentativas indevidas devem resultar em `permission-denied`. Consulte `docs/TESTES.md`.

## Limitações e evolução

Nenhum sistema pode ser declarado invulnerável. Para uma implantação pública de maior escala, recomenda-se ainda:

- App Check/device attestation em builds nativas;
- monitoramento de logs e alertas;
- política formal de retenção e resposta a incidentes;
- revisão periódica de dependências;
- controles administrativos de backup/recuperação adequados ao condomínio.

App Check não é ativado no protótipo Expo Go porque sua configuração móvel robusta exige integração nativa e deve ser validada junto da estratégia de distribuição da APK.
