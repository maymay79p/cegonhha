# Privacidade e tratamento de dados

Este documento descreve como o Cegonha trata dados pessoais na arquitetura atual. Ele serve como documentação técnica do TCC e não substitui uma política jurídica específica de um condomínio que venha a operar o sistema em produção.

## Dados utilizados

O cadastro pode conter nome, e-mail, CPF, telefone, tipo de acesso, bloco, apartamento e vínculo com o condomínio. O sistema também registra dados operacionais de encomendas, previsões, notificações e ações necessárias para auditoria.

## Finalidades

- autenticar a pessoa usuária;
- impedir cadastros duplicados de identificadores;
- localizar corretamente o destinatário de uma encomenda;
- permitir que a Portaria registre chegada e retirada;
- comunicar eventos operacionais;
- manter rastreabilidade de ações críticas;
- avaliar o desempenho do OCR no contexto acadêmico do TCC.

## Minimização

O Cegonha separa o perfil privado (`usuarios`) do diretório operacional (`diretorioUsuarios`). O diretório não deve conter CPF, telefone nem e-mail. Apenas informações necessárias ao uso dentro do condomínio são expostas aos usuários vinculados.

## OCR.Space

Quando a Portaria utiliza OCR, uma cópia reduzida/comprimida da fotografia é enviada temporariamente ao OCR.Space por HTTPS para reconhecimento. O Cegonha não grava a fotografia da etiqueta nem o texto bruto reconhecido no Firestore.

Depois da confirmação, podem permanecer apenas os campos relevantes ao registro e métricas acadêmicas, como tempo de processamento, condição informada da imagem e acerto do primeiro candidato.

## Foto de perfil

A foto de perfil é opcional, redimensionada e comprimida antes da gravação. O usuário pode removê-la pela tela de perfil e ela também é apagada na exclusão da conta.

## Notificações e push

A Central de Avisos usa Firestore. Quando push remoto está habilitado, o dispositivo registra um token Expo associado à conta e ao condomínio. Tokens inativos podem ser removidos automaticamente quando o serviço informa que o dispositivo não está mais registrado.

## Exclusão da conta

A tela **Privacidade e segurança** oferece a ação `Excluir minha conta`. A operação é feita no backend e exige:

- usuário autenticado;
- e-mail verificado;
- confirmação explícita digitando `EXCLUIR`;
- autenticação recente (até 10 minutos).

A exclusão remove, entre outros, perfil ativo, foto, identificadores de unicidade, tokens push, previsões e avisos pessoais.

Registros históricos que precisam permanecer para rastreabilidade não são simplesmente apagados. O backend substitui o UID por um identificador derivado por hash e nomes por `Conta excluída`, além de limpar campos diretamente identificadores. Isso reduz a capacidade de relacionar o histórico à pessoa original sem destruir registros operacionais já concluídos.

Uma Portaria não pode excluir a própria conta se for a última Portaria do condomínio. Caso a conta tenha criado o condomínio, a responsabilidade de `criadoPor` é transferida para outra Portaria antes da exclusão.

## Retenção

A retenção do histórico operacional deve ser definida pelo condomínio responsável pelo uso real do sistema. O projeto acadêmico evita definir um prazo legal universal porque a necessidade pode variar conforme finalidade, contrato e política institucional.

## Segurança de acesso

Os dados não são protegidos apenas pela interface. As regras do Firestore verificam autenticação, e-mail verificado, papel, condomínio e integridade de campos. Operações privilegiadas de exclusão e agendamento são executadas por Cloud Functions.

## Serviços externos

- Firebase Authentication e Cloud Firestore: autenticação e persistência;
- Cloud Functions: automações privilegiadas;
- OCR.Space: OCR de imagem temporária;
- Expo Push Service: entrega opcional de push;
- serviço de mapas do aparelho: abertura de localização quando solicitada.

Nenhuma chave privada de conta de serviço deve ser armazenada no repositório público.
