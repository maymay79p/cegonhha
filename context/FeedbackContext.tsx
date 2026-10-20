import React, { createContext, useContext, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText as Text } from '../components/AppText';
import { useTheme } from './ThemeContext';
import { useAccessibility } from './AccessibilityContext';
import { radius, shadow, ThemeColors } from '../theme';

export type FeedbackTone = 'info' | 'success' | 'warning' | 'danger';
export type FeedbackAction = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void | Promise<void>;
};

type DialogState = {
  title: string;
  message?: string;
  tone: FeedbackTone;
  actions: FeedbackAction[];
} | null;

type ToastState = {
  title?: string;
  message: string;
  tone: FeedbackTone;
  id: number;
} | null;

type FeedbackContextValue = {
  alert: (title: string, message?: string, actions?: FeedbackAction[], tone?: FeedbackTone) => void;
  notify: (message: string, options?: { title?: string; tone?: FeedbackTone; durationMs?: number }) => void;
  dismiss: () => void;
};

const FeedbackContext = createContext<FeedbackContextValue>({
  alert: () => {},
  notify: () => {},
  dismiss: () => {},
});

const ICONS: Record<FeedbackTone, keyof typeof Ionicons.glyphMap> = {
  info: 'information-circle-outline',
  success: 'checkmark-circle-outline',
  warning: 'alert-circle-outline',
  danger: 'close-circle-outline',
};

function toneColor(colors: ThemeColors, tone: FeedbackTone) {
  if (tone === 'success') return colors.success;
  if (tone === 'warning') return colors.warning;
  if (tone === 'danger') return colors.danger;
  return colors.info;
}

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const { reduceMotion, enhancedVisualFeedback, announce, vibrate } = useAccessibility();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function dismiss() {
    setDialog(null);
  }

  function alert(title: string, message = '', actions?: FeedbackAction[], tone: FeedbackTone = 'info') {
    const finais = actions?.length ? actions : [{ text: 'OK' }];
    setDialog({ title, message, tone, actions: finais });
    announce(`${title}. ${message}`.trim());
    if (tone === 'danger') vibrate('error');
    else if (tone === 'warning') vibrate('warning');
  }

  function notify(message: string, options?: { title?: string; tone?: FeedbackTone; durationMs?: number }) {
    const tone = options?.tone || 'success';
    const id = Date.now();
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, title: options?.title, tone, id });
    announce(`${options?.title || ''} ${message}`.trim());
    if (tone === 'success') vibrate('success');
    else if (tone === 'danger') vibrate('error');
    else if (tone === 'warning') vibrate('warning');
    const base = options?.durationMs ?? 2800;
    const duration = enhancedVisualFeedback ? Math.max(base, 4200) : base;
    toastTimer.current = setTimeout(() => setToast(atual => atual?.id === id ? null : atual), duration);
  }

  async function executarAcao(action: FeedbackAction) {
    setDialog(null);
    await action.onPress?.();
  }

  const value = useMemo(() => ({ alert, notify, dismiss }), [enhancedVisualFeedback, reduceMotion]);

  return <FeedbackContext.Provider value={value}>
    {children}

    {!!toast && <View pointerEvents="box-none" style={styles.toastLayer}>
      <Pressable
        accessibilityRole="alert"
        onPress={() => setToast(null)}
        style={[styles.toast, enhancedVisualFeedback && styles.toastEnhanced]}
      >
        <View style={[styles.iconBubble,{backgroundColor:`${toneColor(colors,toast.tone)}20`}]}>
          <Ionicons name={ICONS[toast.tone]} size={21} color={toneColor(colors,toast.tone)}/>
        </View>
        <View style={{flex:1}}>
          {!!toast.title && <Text style={styles.toastTitle}>{toast.title}</Text>}
          <Text style={styles.toastMessage}>{toast.message}</Text>
        </View>
        <Ionicons name="close" size={18} color={colors.muted}/>
      </Pressable>
    </View>}

    <Modal transparent visible={!!dialog} animationType={reduceMotion ? 'none' : 'fade'} onRequestClose={dismiss} statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => {
          const cancelavel = dialog?.actions?.some(a => a.style === 'cancel');
          if (cancelavel) dismiss();
        }}/>
        {!!dialog && <View style={styles.dialog} accessibilityRole="alert">
          <View style={[styles.dialogIcon,{backgroundColor:`${toneColor(colors,dialog.tone)}1F`}]}>
            <Ionicons name={ICONS[dialog.tone]} size={27} color={toneColor(colors,dialog.tone)}/>
          </View>
          <Text style={styles.dialogTitle}>{dialog.title}</Text>
          {!!dialog.message && <Text style={styles.dialogMessage}>{dialog.message}</Text>}
          <View style={styles.actions}>
            {dialog.actions.map((action,index) => {
              const destructive = action.style === 'destructive';
              const cancel = action.style === 'cancel';
              const primary = !cancel && !destructive && index === dialog.actions.length - 1;
              return <TouchableOpacity
                key={`${action.text}-${index}`}
                accessibilityRole="button"
                style={[styles.action,cancel&&styles.actionSecondary,destructive&&styles.actionDanger,primary&&styles.actionPrimary]}
                onPress={() => executarAcao(action)}
              >
                <Text style={[styles.actionText,cancel&&styles.actionSecondaryText,destructive&&styles.actionDangerText,primary&&styles.actionPrimaryText]}>{action.text}</Text>
              </TouchableOpacity>;
            })}
          </View>
        </View>}
      </View>
    </Modal>
  </FeedbackContext.Provider>;
}

export function useFeedback() {
  return useContext(FeedbackContext);
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    toastLayer:{position:'absolute',left:14,right:14,top:54,zIndex:1000,elevation:1000},
    toast:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.medium,padding:13,flexDirection:'row',alignItems:'center',gap:10,...shadow},
    toastEnhanced:{borderWidth:2},
    iconBubble:{width:38,height:38,borderRadius:19,alignItems:'center',justifyContent:'center'},
    toastTitle:{fontSize:15,fontWeight:'700',color:colors.text},
    toastMessage:{fontSize:14,lineHeight:19,color:colors.muted,marginTop:1},
    overlay:{flex:1,backgroundColor:'rgba(0,0,0,0.42)',alignItems:'center',justifyContent:'center',padding:24},
    dialog:{width:'100%',maxWidth:440,backgroundColor:colors.surface,borderRadius:radius.large,borderWidth:1,borderColor:colors.border,padding:22,...shadow},
    dialogIcon:{width:50,height:50,borderRadius:25,alignItems:'center',justifyContent:'center',marginBottom:14},
    dialogTitle:{fontSize:25,fontWeight:'700',color:colors.text},
    dialogMessage:{fontSize:16,lineHeight:22,color:colors.muted,marginTop:7},
    actions:{flexDirection:'row',justifyContent:'flex-end',gap:8,marginTop:20,flexWrap:'wrap'},
    action:{minHeight:44,paddingHorizontal:17,borderRadius:radius.pill,alignItems:'center',justifyContent:'center'},
    actionPrimary:{backgroundColor:colors.accent},
    actionSecondary:{backgroundColor:colors.surfaceSoft,borderWidth:1,borderColor:colors.border},
    actionDanger:{backgroundColor:`${colors.danger}18`,borderWidth:1,borderColor:colors.danger},
    actionText:{fontSize:15,fontWeight:'700',color:colors.text},
    actionPrimaryText:{color:'#fff'},
    actionSecondaryText:{color:colors.text},
    actionDangerText:{color:colors.danger},
  });
}
