# Privacidade e tratamento de dados

Este documento descreve as decisões técnicas do Cegonha relacionadas a privacidade. Ele não substitui orientação jurídica.

## Dados utilizados

O Cegonha pode utilizar nome, e-mail, CPF, telefone, bloco, apartamento, vínculo com condomínio, foto opcional de perfil e registros relacionados a encomendas. Esses dados são usados para identificar corretamente o destinatário, permitir comunicação operacional e manter rastreabilidade das entregas.

## OCR

Para reconhecer uma etiqueta, o aplicativo envia temporariamente uma versão comprimida da imagem ao **OCR.Space por HTTPS**. O Cegonha não salva a foto da etiqueta nem o texto bruto reconhecido no Firestore. Depois da confirmação da Portaria, ficam somente os campos relevantes e métricas acadêmicas da leitura.

## Separação por condomínio

As Firestore Rules limitam acesso conforme autenticação, perfil e condomínio. Moradores não podem listar perfis privados alheios; a Portaria acessa apenas os dados necessários ao condomínio ao qual está vinculada.

## Exclusão de conta

A tela **Privacidade e segurança** oferece exclusão de conta. A operação:

- exige autenticação recente;
- remove perfil, diretório, foto, tokens de push e identificadores de unicidade;
- remove previsões e solicitações pessoais que já não precisam permanecer;
- anonimiza autoria em registros comunitários e operacionais que precisam ser preservados;
- anonimiza encomendas/auditorias em vez de apagar o histórico do condomínio;
- impede a exclusão da última conta da Portaria para não deixar o condomínio sem responsável.

A exclusão é executada por uma Cloud Function com privilégios administrativos, evitando que o cliente receba permissões amplas de exclusão no Firestore.

## Segredos e credenciais

Arquivos `.env`, contas de serviço e chaves privadas não devem ser versionados. O CI procura assinaturas comuns de credenciais privadas. Identificadores públicos do Firebase/OAuth podem existir no cliente; a segurança depende principalmente de Authentication, Firestore Rules e configuração correta do backend.
