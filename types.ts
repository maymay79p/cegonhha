import { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type TipoUsuario = 'morador' | 'porteiro';
export type StatusEncomenda = 'prevista' | 'recebida' | 'pendente' | 'retirada';

export type Morador = {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  cpf?: string;
  bloco?: string;
  apartamento?: string;
  tipo: TipoUsuario;
  condominioId: string;
  condominioNome?: string;
  condominioCodigo?: string;
  fotoPerfil?: string;
};

export type HistoricoEvento = {
  tipo: 'prevista' | 'recebida' | 'pendente' | 'retirada' | 'lembrete';
  titulo: string;
  data: string;
  atorId?: string;
  atorNome?: string;
  observacao?: string;
};

export type Encomenda = {
  id: string;
  moradorId: string;
  moradorNome: string;
  bloco: string;
  apartamento: string;
  descricao?: string;
  status: StatusEncomenda;
  recebidaEm?: any;
  retiradaEm?: any;
  porteiroId: string;
  porteiroNome?: string;
  retiradaPorId?: string;
  retiradaPorNome?: string;
  ocrScore?: number;
  origem?: 'ocr' | 'manual';
  condominioId: string;
  codigoReferencia?: string;
  historico?: HistoricoEvento[];
  lembrete3dEnviado?: boolean;
};

export type Previsao = {
  id: string;
  moradorId: string;
  condominioId: string;
  descricao: string;
  codigoRastreio?: string;
  transportadora?: string;
  previsao?: string;
  atrasada?: boolean;
  criadaEm?: any;
};

export type CandidatoOCR = Morador & { score: number };

export type ResultadoOCR = {
  texto: string;
  nome?: string | null;
  cpf?: string | null;
  bloco?: string | null;
  apartamento?: string | null;
  candidatos: CandidatoOCR[];
  tempoMs?: number;
  motor?: 'ocr-space';
};

export type OCRMeta = {
  tipoTexto: 'impresso' | 'manuscrito';
  iluminacao: 'boa' | 'media' | 'ruim';
  tempoMs: number;
  topCandidatoId?: string;
  topScore?: number;
  nomeDetectado?: string;
  cpfDetectado?: string;
  blocoDetectado?: string;
  apartamentoDetectado?: string;
  reconheceuNome: boolean;
  reconheceuCpf: boolean;
  reconheceuBloco: boolean;
  reconheceuApartamento: boolean;
};

export type CondominioLocalizacao = {
  endereco?: string;
  latitude?: number | null;
  longitude?: number | null;
};

export type RootStackParamList = {
  Login: undefined;
  Register: { tipoInicial?: 'morador' | 'porteiro' } | undefined;
  RecuperaSenha: undefined;
  Home: undefined;
  OCR: undefined;
  OCRHistorico: undefined;
  EncomendaForm: {
    candidato?: CandidatoOCR;
    ocrMeta?: OCRMeta;
  } | undefined;
  Detalhes: { encomenda: Encomenda };
  Relatorios: undefined;
  Denuncias: undefined;
  Notificacoes: undefined;
  Perfil: undefined;
  Previsoes: undefined;
  SolicitacoesCondominio: undefined;
  Privacidade: undefined;
  Mural: undefined;
  Condominio: undefined;
  CodigoCondominio: undefined;
};

export type NavigationProps = NativeStackNavigationProp<RootStackParamList>;
