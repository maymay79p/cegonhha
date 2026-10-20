import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, TouchableOpacity, View } from 'react-native';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AppText as Text } from '../components/AppText';
import { EmptyState, LoadingCards } from '../components/States';
import { radius, ThemeColors } from '../theme';

const DIA = 86400000;
const PERIODOS = [7, 14, 30] as const;
type Periodo = typeof PERIODOS[number];

function inicioDoDia(data = new Date()) {
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function timestampMs(valor: any) {
  return valor?.toDate?.()?.getTime?.() || 0;
}

function dataCurta(ms: number) {
  return new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function dataHora(ms:number){
  return ms ? new Date(ms).toLocaleString('pt-BR') : '';
}

function csvCelula(valor:unknown){
  return `"${String(valor ?? '').replace(/"/g,'""')}"`;
}

function escaparHtml(valor:unknown){
  return String(valor ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

function statusLegivel(status:unknown){
  return String(status||'').toLowerCase()==='retirada'?'Retirada':'Pendente';
}

function origemLegivel(origem:unknown){
  const valor=String(origem||'').toLowerCase();
  if(valor==='ocr')return'OCR';
  if(valor==='manual')return'Manual';
  return valor?valor.charAt(0).toUpperCase()+valor.slice(1):'—';
}

export default function Relatorios({navigation}:any){
  const {perfil}=useAuth();
  const {colors}=useTheme();
  const styles=useMemo(()=>makeStyles(colors),[colors]);
  const [encomendas,setEncomendas]=useState<any[]>([]);
  const [testes,setTestes]=useState<any[]>([]);
  const [solicitacoes,setSolicitacoes]=useState<any[]>([]);
  const [denuncias,setDenuncias]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [periodo,setPeriodo]=useState<Periodo>(7);
  const [exportando,setExportando]=useState(false);

  useEffect(()=>{
    if(!perfil?.condominioId){setEncomendas([]);setTestes([]);setSolicitacoes([]);setDenuncias([]);setLoading(false);return;}
    setLoading(true);
    const prontos={encomendas:false,ocr:false,solicitacoes:false,denuncias:false};
    const concluir=()=>{if(Object.values(prontos).every(Boolean))setLoading(false);};

    const unsubEncomendas=onSnapshot(query(collection(db,'encomendas'),where('condominioId','==',perfil.condominioId)),snap=>{
      setEncomendas(snap.docs.map(d=>({id:d.id,...d.data()})) as any[]);
      prontos.encomendas=true;concluir();
    },()=>{prontos.encomendas=true;concluir();});

    const unsubOCR=onSnapshot(query(collection(db,'ocrTestes'),where('condominioId','==',perfil.condominioId)),snap=>{
      setTestes(snap.docs.map(d=>({id:d.id,...d.data()})) as any[]);
      prontos.ocr=true;concluir();
    },()=>{prontos.ocr=true;concluir();});

    const unsubSolicitacoes=onSnapshot(query(collection(db,'solicitacoesCondominio'),where('condominioId','==',perfil.condominioId)),snap=>{
      setSolicitacoes(snap.docs.map(d=>({id:d.id,...d.data()})) as any[]);
      prontos.solicitacoes=true;concluir();
    },()=>{prontos.solicitacoes=true;concluir();});

    const unsubDenuncias=onSnapshot(query(collection(db,'muralDenuncias'),where('condominioId','==',perfil.condominioId)),snap=>{
      setDenuncias(snap.docs.map(d=>({id:d.id,...d.data()})) as any[]);
      prontos.denuncias=true;concluir();
    },()=>{prontos.denuncias=true;concluir();});

    return()=>{unsubEncomendas();unsubOCR();unsubSolicitacoes();unsubDenuncias();};
  },[perfil?.condominioId]);

  const resumo=useMemo(()=>{
    const hoje=inicioDoDia();
    const inicio=hoje-(periodo-1)*DIA;
    const agora=Date.now();

    const recebidasHoje=encomendas.filter(e=>timestampMs(e.recebidaEm)>=hoje).length;
    const recebidasPeriodo=encomendas.filter(e=>timestampMs(e.recebidaEm)>=inicio).length;
    const pendentes=encomendas.filter(e=>e.status==='pendente');
    const retiradasPeriodo=encomendas.filter(e=>timestampMs(e.retiradaEm)>=inicio);
    const retiradasHoje=encomendas.filter(e=>timestampMs(e.retiradaEm)>=hoje).length;
    const atrasadas=pendentes.filter(e=>{
      const recebida=timestampMs(e.recebidaEm);
      return recebida>0&&agora-recebida>=3*DIA;
    });

    const pares=retiradasPeriodo.filter(e=>timestampMs(e.recebidaEm)>0&&timestampMs(e.retiradaEm)>0);
    const mediaHoras=pares.length?pares.reduce((s,e)=>s+(timestampMs(e.retiradaEm)-timestampMs(e.recebidaEm))/3600000,0)/pares.length:0;

    const ocrPeriodo=testes.filter(t=>timestampMs(t.criadoEm)>=inicio);
    const acertoOCR=ocrPeriodo.length?ocrPeriodo.filter(t=>t.acertoTop1).length/ocrPeriodo.length*100:0;

    const atividade=Array.from({length:7},(_,index)=>{
      const dia=hoje-index*DIA;
      const proximo=dia+DIA;
      return {
        dia,
        recebidas:encomendas.filter(e=>{const t=timestampMs(e.recebidaEm);return t>=dia&&t<proximo;}).length,
        retiradas:encomendas.filter(e=>{const t=timestampMs(e.retiradaEm);return t>=dia&&t<proximo;}).length,
      };
    });

    const antigas=[...atrasadas].sort((a,b)=>timestampMs(a.recebidaEm)-timestampMs(b.recebidaEm)).slice(0,5).map(e=>({
      ...e,
      dias:Math.max(3,Math.floor((agora-timestampMs(e.recebidaEm))/DIA)),
    }));

    return{
      inicio,
      recebidasHoje,
      recebidasPeriodo,
      pendentes:pendentes.length,
      retiradasPeriodo:retiradasPeriodo.length,
      retiradasHoje,
      atrasadas:atrasadas.length,
      solicitacoesPendentes:solicitacoes.filter(s=>s.status==='pendente').length,
      denunciasPendentes:denuncias.filter(d=>(d.status||'pendente')==='pendente').length,
      mediaHoras,
      atividade,
      antigas,
      ocrLeituras:ocrPeriodo.length,
      acertoOCR,
    };
  },[encomendas,testes,solicitacoes,denuncias,periodo]);

  const encomendasPeriodo=useMemo(()=>encomendas
    .filter(e=>timestampMs(e.recebidaEm)>=resumo.inicio||timestampMs(e.retiradaEm)>=resumo.inicio)
    .sort((a,b)=>timestampMs(b.recebidaEm)-timestampMs(a.recebidaEm)),[encomendas,resumo.inicio]);

  function abrirEncomendas(filtroInicial:string){
    navigation.navigate('Home',{screen:'Encomendas',params:{filtroInicial}});
  }

  function montarCSV(){
    const linhas:any[][]=[
      ['RELATÓRIO OPERACIONAL CEGONHA'],
      ['Condomínio',perfil?.condominioNome||'Condomínio'],
      ['Período analisado',`${periodo} dias`],
      ['Gerado em',new Date().toLocaleString('pt-BR')],
      [],
      ['RESUMO'],
      ['Recebidas no período',resumo.recebidasPeriodo],
      ['Pendentes agora',resumo.pendentes],
      ['Retiradas no período',resumo.retiradasPeriodo],
      ['Retiradas hoje',resumo.retiradasHoje],
      ['Aguardando há 3 dias ou mais',resumo.atrasadas],
      ['Tempo médio até retirada',resumo.mediaHoras?`${resumo.mediaHoras.toFixed(1)} h`:'Sem dados'],
      ['Solicitações de entrada pendentes',resumo.solicitacoesPendentes],
      ['Denúncias pendentes',resumo.denunciasPendentes],
      ['Leituras OCR avaliadas',resumo.ocrLeituras],
      ['Acerto OCR do primeiro candidato',resumo.ocrLeituras?`${resumo.acertoOCR.toFixed(1)}%`:'Sem dados'],
      [],
      ['ENCOMENDAS DO PERÍODO'],
      ['Código','Morador','Bloco','Apartamento','Status','Recebida em','Retirada em','Portaria','Entregue a','Origem'],
      ...encomendasPeriodo.map(e=>[
        e.codigoReferencia||e.id,
        e.moradorNome||'',
        e.bloco||'',
        e.apartamento||'',
        statusLegivel(e.status),
        dataHora(timestampMs(e.recebidaEm)),
        dataHora(timestampMs(e.retiradaEm)),
        e.porteiroNome||'',
        e.retiradaRecebedorNome||'',
        origemLegivel(e.origem),
      ]),
    ];
    return '\uFEFF'+linhas.map(linha=>linha.map(csvCelula).join(';')).join('\n');
  }

  function montarHtmlRelatorio(){
    const geradoEm=new Date().toLocaleString('pt-BR');
    const linhas=encomendasPeriodo.length?encomendasPeriodo.map(e=>`<tr>
      <td>${escaparHtml(e.codigoReferencia||e.id)}</td>
      <td><strong>${escaparHtml(e.moradorNome||'Morador')}</strong></td>
      <td>${escaparHtml(e.bloco||'—')}</td>
      <td>${escaparHtml(e.apartamento||'—')}</td>
      <td><span class="status ${e.status==='retirada'?'ok':'wait'}">${statusLegivel(e.status)}</span></td>
      <td>${escaparHtml(dataHora(timestampMs(e.recebidaEm))||'—')}</td>
      <td>${escaparHtml(dataHora(timestampMs(e.retiradaEm))||'—')}</td>
      <td>${escaparHtml(e.porteiroNome||'—')}</td>
      <td>${escaparHtml(e.retiradaRecebedorNome||'—')}</td>
      <td>${escaparHtml(origemLegivel(e.origem))}</td>
    </tr>`).join(''):'<tr><td colspan="10" class="empty">Nenhuma movimentação encontrada no período.</td></tr>';

    const atividade=resumo.atividade.map(item=>`<tr><td>${escaparHtml(dataCurta(item.dia))}</td><td>${item.recebidas}</td><td>${item.retiradas}</td></tr>`).join('');
    const pendencias=resumo.antigas.length?resumo.antigas.map(item=>`<li><strong>${escaparHtml(item.moradorNome||'Morador')}</strong> · Bloco ${escaparHtml(item.bloco||'—')} · Ap. ${escaparHtml(item.apartamento||'—')} · ${item.dias} dias</li>`).join(''):'<li>Nenhuma encomenda aguarda retirada há 3 dias ou mais.</li>';

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      @page{size:A4 landscape;margin:13mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#252126;font-size:10px;line-height:1.4;margin:0}.header{border-bottom:3px solid #5b3c4a;padding-bottom:12px;margin-bottom:14px}.brand{font-size:11px;letter-spacing:2px;color:#5b3c4a;font-weight:700}.title{font-size:27px;margin:3px 0 2px}.meta{color:#6d6469;font-size:10px}.section{font-size:15px;margin:17px 0 8px;color:#342730}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.metric{border:1px solid #d8d0d4;border-radius:8px;padding:10px;background:#faf8f9}.metric .number{font-size:23px;font-weight:700;color:#5b3c4a}.metric .label{color:#6d6469;margin-top:2px}.attention{border-left:4px solid #a26629;background:#fff9f2;padding:9px 11px;margin-top:10px}.two{display:grid;grid-template-columns:1fr 1fr;gap:12px}table{width:100%;border-collapse:collapse;margin-top:6px;page-break-inside:auto}thead{display:table-header-group}tr{page-break-inside:avoid}th{background:#5b3c4a;color:white;text-align:left;padding:6px 5px;font-size:8px}td{border-bottom:1px solid #e6e0e3;padding:6px 5px;vertical-align:top;font-size:8px}.status{padding:2px 5px;border-radius:8px;font-weight:700;white-space:nowrap}.ok{background:#e3f2e8;color:#245d35}.wait{background:#fff0dc;color:#784000}.small th,.small td{font-size:9px}.small th{background:#ece6e9;color:#342730}.list{margin:5px 0;padding-left:18px}.list li{margin:4px 0}.empty{text-align:center;color:#777;padding:16px}.footer{margin-top:14px;border-top:1px solid #d8d0d4;padding-top:8px;color:#766d72;font-size:8px}.page-break{page-break-before:always}
    </style></head><body>
      <div class="header"><div class="brand">CEGONHA · PORTARIA</div><div class="title">Relatório operacional</div><div class="meta"><strong>${escaparHtml(perfil?.condominioNome||'Condomínio')}</strong> · Período: últimos ${periodo} dias · Gerado em ${escaparHtml(geradoEm)}</div></div>
      <div class="section">Resumo do período</div><div class="grid">
        <div class="metric"><div class="number">${resumo.recebidasPeriodo}</div><div class="label">Encomendas recebidas</div></div>
        <div class="metric"><div class="number">${resumo.retiradasPeriodo}</div><div class="label">Retiradas registradas</div></div>
        <div class="metric"><div class="number">${resumo.pendentes}</div><div class="label">Pendentes agora</div></div>
        <div class="metric"><div class="number">${resumo.mediaHoras?`${resumo.mediaHoras.toFixed(1)} h`:'—'}</div><div class="label">Tempo médio até retirada</div></div>
      </div>
      <div class="attention"><strong>Atenção da Portaria:</strong> ${resumo.atrasadas} encomenda(s) há 3 dias ou mais · ${resumo.solicitacoesPendentes} solicitação(ões) de entrada pendente(s) · ${resumo.denunciasPendentes} denúncia(s) pendente(s) · ${resumo.retiradasHoje} retirada(s) hoje.</div>
      <div class="two">
        <div><div class="section">Movimento dos últimos 7 dias</div><table class="small"><thead><tr><th>Data</th><th>Recebidas</th><th>Retiradas</th></tr></thead><tbody>${atividade}</tbody></table></div>
        <div><div class="section">Pendências mais antigas</div><ul class="list">${pendencias}</ul><div class="section">OCR</div><div class="meta">${resumo.ocrLeituras} leitura(s) avaliada(s) · ${resumo.ocrLeituras?`${resumo.acertoOCR.toFixed(1)}% de acerto do primeiro candidato`:'sem amostra no período'}.</div></div>
      </div>
      <div class="section">Encomendas e retiradas do período</div>
      <table><thead><tr><th>Código</th><th>Morador</th><th>Bl.</th><th>Ap.</th><th>Status</th><th>Recebida em</th><th>Retirada em</th><th>Portaria</th><th>Entregue a</th><th>Origem</th></tr></thead><tbody>${linhas}</tbody></table>
      <div class="footer">Relatório gerado pelo Cegonha com os registros disponíveis no condomínio no momento da exportação. Horários apresentados no fuso do aparelho.</div>
    </body></html>`;
  }

  async function exportarPDF(){
    if(exportando)return;
    try{
      setExportando(true);
      const {uri}=await Print.printToFileAsync({html:montarHtmlRelatorio()});
      if(await Sharing.isAvailableAsync()){
        await Sharing.shareAsync(uri,{mimeType:'application/pdf',dialogTitle:`Salvar ou compartilhar relatório Cegonha · ${periodo} dias`,UTI:'com.adobe.pdf'});
      }else{
        const csv=montarCSV();
        await Clipboard.setStringAsync(csv);
        await Share.share({title:`Relatório Cegonha · ${periodo} dias`,message:csv});
        Alert.alert('PDF criado','O compartilhamento de arquivos não está disponível neste aparelho. O relatório em CSV foi copiado e aberto para compartilhamento.');
      }
    }catch(e:any){Alert.alert('Baixar relatório',e?.message||'Não foi possível preparar o PDF.');}
    finally{setExportando(false);}
  }

  return <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
    <Text style={styles.eyebrow}>RELATÓRIOS</Text>
    <Text style={styles.title}>Resumo operacional</Text>
    <Text style={styles.subtitle}>Acompanhe o que exige atenção agora e gere um relatório organizado para salvar ou compartilhar.</Text>

    <View style={styles.toolbar}>
      <View style={styles.filters}>
        {PERIODOS.map(dias=><TouchableOpacity key={dias} style={[styles.filter,periodo===dias&&styles.filterActive]} onPress={()=>setPeriodo(dias)}><Text style={[styles.filterText,periodo===dias&&styles.filterTextActive]}>{dias} dias</Text></TouchableOpacity>)}
      </View>
      <TouchableOpacity style={styles.exportButton} onPress={exportarPDF} disabled={exportando}><Ionicons name="document-text-outline" size={18} color="#fff"/><Text style={styles.exportText}>{exportando?'Gerando PDF...':'Salvar PDF'}</Text></TouchableOpacity>
    </View>

    {loading?<LoadingCards count={3}/>:<>
      <Text style={styles.sectionFirst}>Atenção da portaria</Text>
      <View style={styles.attentionGrid}>
        <TouchableOpacity style={styles.attentionCard} onPress={()=>abrirEncomendas('atrasadas')}><Ionicons name="alert-circle-outline" size={21} color={resumo.atrasadas?colors.warning:colors.muted}/><Text style={styles.attentionNumber}>{resumo.atrasadas}</Text><Text style={styles.attentionLabel}>encomendas há +3 dias</Text><Text style={styles.openHint}>Abrir pendências</Text></TouchableOpacity>
        <TouchableOpacity style={styles.attentionCard} onPress={()=>navigation.navigate('SolicitacoesCondominio')}><Ionicons name="person-add-outline" size={21} color={colors.porter}/><Text style={styles.attentionNumber}>{resumo.solicitacoesPendentes}</Text><Text style={styles.attentionLabel}>solicitações de entrada</Text><Text style={styles.openHint}>Revisar</Text></TouchableOpacity>
        <TouchableOpacity style={styles.attentionCard} onPress={()=>navigation.navigate('Denuncias')}><Ionicons name="flag-outline" size={21} color={resumo.denunciasPendentes?colors.danger:colors.muted}/><Text style={styles.attentionNumber}>{resumo.denunciasPendentes}</Text><Text style={styles.attentionLabel}>denúncias pendentes</Text><Text style={styles.openHint}>Abrir central</Text></TouchableOpacity>
        <TouchableOpacity style={styles.attentionCard} onPress={()=>abrirEncomendas('retiradasHoje')}><Ionicons name="checkmark-circle-outline" size={21} color={colors.success}/><Text style={styles.attentionNumber}>{resumo.retiradasHoje}</Text><Text style={styles.attentionLabel}>retiradas hoje</Text><Text style={styles.openHint}>Ver retiradas</Text></TouchableOpacity>
      </View>

      <Text style={styles.section}>Indicadores</Text>
      <View style={styles.grid}>
        <View style={styles.card}><Ionicons name="today-outline" size={20} color={colors.info}/><Text style={styles.number}>{resumo.recebidasHoje}</Text><Text style={styles.label}>Recebidas hoje</Text></View>
        <View style={styles.card}><Ionicons name="cube-outline" size={20} color={colors.porter}/><Text style={styles.number}>{resumo.pendentes}</Text><Text style={styles.label}>Pendentes agora</Text></View>
        <View style={styles.card}><Ionicons name="checkmark-circle-outline" size={20} color={colors.success}/><Text style={styles.number}>{resumo.retiradasPeriodo}</Text><Text style={styles.label}>Retiradas em {periodo} dias</Text></View>
        <View style={styles.card}><Ionicons name="alert-circle-outline" size={20} color={resumo.atrasadas?colors.warning:colors.muted}/><Text style={[styles.number,resumo.atrasadas>0&&{color:colors.warning}]}>{resumo.atrasadas}</Text><Text style={styles.label}>Há +3 dias</Text></View>
      </View>

      <View style={styles.summary}>
        <View style={{flex:1}}><Text style={styles.summaryValue}>{resumo.recebidasPeriodo}</Text><Text style={styles.summaryLabel}>recebidas no período</Text></View>
        <View style={styles.verticalLine}/>
        <View style={{flex:1}}><Text style={styles.summaryValue}>{resumo.mediaHoras?`${resumo.mediaHoras.toFixed(1)} h`:'—'}</Text><Text style={styles.summaryLabel}>tempo médio até retirada</Text></View>
      </View>

      <Text style={styles.section}>Movimento dos últimos 7 dias</Text>
      <View style={styles.activityBox}>
        {resumo.atividade.map((item,index)=><View key={item.dia} style={[styles.activityRow,index===resumo.atividade.length-1&&styles.activityRowLast]}>
          <Text style={styles.day}>{dataCurta(item.dia)}</Text>
          <View style={styles.activityMetric}><Ionicons name="arrow-down-circle-outline" size={16} color={colors.info}/><Text style={styles.activityText}>{item.recebidas} recebidas</Text></View>
          <View style={styles.activityMetric}><Ionicons name="checkmark-circle-outline" size={16} color={colors.success}/><Text style={styles.activityText}>{item.retiradas} retiradas</Text></View>
        </View>)}
      </View>

      <Text style={styles.section}>Pendências mais antigas</Text>
      {resumo.antigas.length?<View>{resumo.antigas.map(item=><TouchableOpacity key={item.id} style={styles.pendingRow} onPress={()=>navigation.navigate('Detalhes',{encomenda:item})}>
        <View style={{flex:1}}><Text style={styles.pendingName}>{item.moradorNome||'Morador'}</Text><Text style={styles.pendingMeta}>Bloco {item.bloco||'-'} · Ap. {item.apartamento||'-'} · {item.codigoReferencia?`#${item.codigoReferencia}`:'sem código'}</Text></View>
        <View style={styles.daysBadge}><Text style={styles.daysText}>{item.dias} dias</Text></View>
      </TouchableOpacity>)}</View>:<EmptyState icon="checkmark-done-outline" title="Sem atrasos" text="Não há encomendas aguardando retirada há mais de 3 dias."/>}

      <Text style={styles.section}>OCR no período</Text>
      <View style={styles.ocrBox}>
        <View style={{flex:1}}><Text style={styles.ocrValue}>{resumo.ocrLeituras}</Text><Text style={styles.label}>leituras avaliadas</Text></View>
        <View style={styles.verticalLine}/>
        <View style={{flex:1}}><Text style={styles.ocrValue}>{resumo.ocrLeituras?`${resumo.acertoOCR.toFixed(1)}%`:'—'}</Text><Text style={styles.label}>acerto do 1º candidato</Text></View>
      </View>
      <TouchableOpacity style={styles.auditLink} onPress={()=>navigation.navigate('AtividadesPortaria')}><View style={styles.auditLeft}><Ionicons name="receipt-outline" size={20} color={colors.porter}/><View><Text style={styles.auditTitle}>Atividades da Portaria</Text><Text style={styles.auditHint}>Consulte registros de chegada, retirada, vínculos e moderação</Text></View></View><Ionicons name="chevron-forward" size={18} color={colors.muted}/></TouchableOpacity>
      <Text style={styles.note}>Ao tocar em “Salvar PDF”, o Cegonha gera um documento A4 com resumo, pendências, indicadores e a tabela das encomendas do período. Depois, escolha no menu do aparelho onde salvar ou compartilhar.</Text>
    </>}
  </ScrollView>;
}

function makeStyles(colors:ThemeColors){return StyleSheet.create({
  container:{padding:22,paddingBottom:120,backgroundColor:colors.background},eyebrow:{fontSize:12,fontWeight:'700',letterSpacing:1.8,color:colors.porter},title:{fontSize:36,fontWeight:'700',marginTop:3},subtitle:{fontSize:16,lineHeight:22,color:colors.muted,marginTop:4,marginBottom:13},toolbar:{gap:9,marginBottom:5},filters:{flexDirection:'row',gap:7},filter:{paddingHorizontal:14,paddingVertical:8,borderRadius:radius.pill,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},filterActive:{backgroundColor:colors.porter,borderColor:colors.porter},filterText:{fontSize:13,fontWeight:'700'},filterTextActive:{color:'#fff'},exportButton:{alignSelf:'flex-start',minHeight:44,paddingHorizontal:15,borderRadius:radius.pill,backgroundColor:colors.porter,flexDirection:'row',alignItems:'center',gap:7},exportText:{fontSize:13,fontWeight:'700',color:'#fff'},sectionFirst:{fontSize:22,fontWeight:'700',marginTop:15,marginBottom:9},attentionGrid:{flexDirection:'row',flexWrap:'wrap',gap:9},attentionCard:{width:'48.5%',minHeight:128,backgroundColor:colors.surface,borderRadius:radius.medium,padding:14,borderWidth:1,borderColor:colors.border},attentionNumber:{fontSize:29,fontWeight:'700',color:colors.porter,marginTop:5},attentionLabel:{fontSize:13,color:colors.muted,lineHeight:17},openHint:{fontSize:11,fontWeight:'700',color:colors.porter,marginTop:7},grid:{flexDirection:'row',flexWrap:'wrap',gap:9},card:{width:'48.5%',backgroundColor:colors.surface,borderRadius:radius.medium,padding:15,borderWidth:1,borderColor:colors.border},number:{fontSize:30,fontWeight:'700',color:colors.porter,marginTop:5},label:{fontSize:13,color:colors.muted,marginTop:1},summary:{flexDirection:'row',alignItems:'center',backgroundColor:colors.surfaceSoft,borderRadius:radius.medium,padding:15,marginTop:10,borderWidth:1,borderColor:colors.border},summaryValue:{fontSize:23,fontWeight:'700',color:colors.porter},summaryLabel:{fontSize:12,color:colors.muted,marginTop:1},verticalLine:{width:1,height:40,backgroundColor:colors.border,marginHorizontal:16},section:{fontSize:22,fontWeight:'700',marginTop:20,marginBottom:9},activityBox:{backgroundColor:colors.surface,borderRadius:radius.medium,borderWidth:1,borderColor:colors.border,paddingHorizontal:13},activityRow:{minHeight:48,flexDirection:'row',alignItems:'center',borderBottomWidth:1,borderBottomColor:colors.border,gap:10},activityRowLast:{borderBottomWidth:0},day:{width:52,fontSize:13,fontWeight:'700',color:colors.porter},activityMetric:{flex:1,flexDirection:'row',alignItems:'center',gap:5},activityText:{fontSize:12,color:colors.muted},pendingRow:{minHeight:58,backgroundColor:colors.surface,borderRadius:radius.medium,borderWidth:1,borderColor:colors.border,padding:12,marginBottom:7,flexDirection:'row',alignItems:'center',gap:10},pendingName:{fontSize:16,fontWeight:'700'},pendingMeta:{fontSize:12,color:colors.muted,marginTop:2},daysBadge:{paddingHorizontal:10,paddingVertical:6,borderRadius:radius.pill,backgroundColor:colors.surfaceSoft},daysText:{fontSize:12,fontWeight:'700',color:colors.warning},ocrBox:{flexDirection:'row',alignItems:'center',backgroundColor:colors.surface,borderRadius:radius.medium,padding:16,borderWidth:1,borderColor:colors.border},ocrValue:{fontSize:26,fontWeight:'700',color:colors.porter},auditLink:{minHeight:64,backgroundColor:colors.porterSoft,borderRadius:radius.medium,borderWidth:1,borderColor:colors.border,padding:13,marginTop:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},auditLeft:{flexDirection:'row',alignItems:'center',gap:10,flex:1},auditTitle:{fontSize:16,fontWeight:'700'},auditHint:{fontSize:12,color:colors.muted,marginTop:2},note:{fontSize:13,lineHeight:19,color:colors.muted,marginTop:12}
});}
