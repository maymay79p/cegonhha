import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DefaultTheme as NavigationDefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { EBGaramond_400Regular, EBGaramond_500Medium, EBGaramond_600SemiBold, EBGaramond_700Bold } from '@expo-google-fonts/eb-garamond';

import Login from './Screens/Login';
import Register from './Screens/Register';
import RecuperaSenha from './Screens/RecuperaSenha';
import OCR from './Screens/OCR';
import OCRHistorico from './Screens/OCRHistorico';
import EncomendaForm from './Screens/EncomendaForm';
import Detalhes from './Screens/Detalhes';
import Notificacoes from './Screens/Notificacoes';
import Relatorios from './Screens/Relatorios';
import Perfil from './Screens/Perfil';
import Previsoes from './Screens/Previsoes';
import MoradorHome from './Screens/MoradorHome';
import MoradorEncomendas from './Screens/MoradorEncomendas';
import PorteiroHome from './Screens/PorteiroHome';
import PorteiroEncomendas from './Screens/PorteiroEncomendas';
import SolicitacoesCondominio from './Screens/SolicitacoesCondominio';
import Privacidade from './Screens/Privacidade';
import Onboarding from './Screens/Onboarding';
import Mural from './Screens/Mural';
import Condominio from './Screens/Condominio';
import CodigoCondominio from './Screens/CodigoCondominio';
import { RootStackParamList } from './types';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AppText } from './components/AppText';
import { fonts, shadow, ThemeColors } from './theme';

const Stack = createNativeStackNavigator<RootStackParamList>();
const MoradorTab = createBottomTabNavigator();
const PorteiroTab = createBottomTabNavigator();
const ONBOARDING_KEY = '@cegonha/onboarding:v2';

const moradorIcons: Record<string, { on: string; off: string }> = {
  Inicio: { on: 'home', off: 'home-outline' },
  MinhasEncomendas: { on: 'cube', off: 'cube-outline' },
  Mural: { on: 'chatbubbles', off: 'chatbubbles-outline' },
  Previsoes: { on: 'time', off: 'time-outline' },
  Notificacoes: { on: 'notifications', off: 'notifications-outline' },
  Perfil: { on: 'person', off: 'person-outline' },
};

const porteiroIcons: Record<string, { on: string; off: string }> = {
  Painel: { on: 'grid', off: 'grid-outline' },
  Encomendas: { on: 'cube', off: 'cube-outline' },
  OCR: { on: 'scan', off: 'scan-outline' },
  Mural: { on: 'chatbubbles', off: 'chatbubbles-outline' },
  Perfil: { on: 'person', off: 'person-outline' },
};

function FloatingTabIcon({ routeName, focused, color, porter = false }: any) {
  const { colors } = useTheme();
  const mapa = porter ? porteiroIcons : moradorIcons;
  const item = mapa[routeName] || { on: 'ellipse', off: 'ellipse-outline' };
  return (
    <View style={[
      styles.iconWrap,
      focused && { backgroundColor: porter ? colors.porterSoft : colors.accentSoft },
    ]}>
      <Ionicons name={(focused ? item.on : item.off) as any} size={21} color={color} />
    </View>
  );
}

function tabBarStyle(bottom: number, colors: ThemeColors) {
  return {
    position: 'absolute' as const,
    left: 10,
    right: 10,
    bottom: Math.max(bottom, 8) + 8,
    height: 70,
    paddingTop: 7,
    paddingBottom: 7,
    backgroundColor: colors.surface,
    borderTopWidth: 0,
    borderRadius: 28,
    ...shadow,
  };
}

function MoradorTabs() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <MoradorTab.Navigator id="MoradorTabs" screenOptions={({ route }) => ({
      headerShown: false,
      sceneStyle: { backgroundColor: colors.background },
      tabBarIcon: ({ focused, color }) => <FloatingTabIcon routeName={route.name} focused={focused} color={color} />,
      tabBarActiveTintColor: colors.accent,
      tabBarInactiveTintColor: colors.muted,
      tabBarStyle: tabBarStyle(insets.bottom, colors),
      tabBarLabelStyle: { fontFamily: fonts.semiBold, fontSize: 10, marginTop: -2 },
      tabBarItemStyle: { borderRadius: 24 },
    })}>
      <MoradorTab.Screen name="Inicio" component={MoradorHome} options={{ title: 'Início' }} />
      <MoradorTab.Screen name="MinhasEncomendas" component={MoradorEncomendas} options={{ title: 'Entregas' }} />
      <MoradorTab.Screen name="Mural" component={Mural} options={{ title: 'Mural' }} />
      <MoradorTab.Screen name="Previsoes" component={Previsoes} options={{ title: 'Esperadas' }} />
      <MoradorTab.Screen name="Notificacoes" component={Notificacoes} options={{ title: 'Avisos' }} />
      <MoradorTab.Screen name="Perfil" component={Perfil} options={{ title: 'Perfil' }} />
    </MoradorTab.Navigator>
  );
}

function PorteiroTabs() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <PorteiroTab.Navigator id="PorteiroTabs" screenOptions={({ route }) => ({
      headerShown: false,
      sceneStyle: { backgroundColor: colors.background },
      tabBarIcon: ({ focused, color }) => <FloatingTabIcon routeName={route.name} focused={focused} color={color} porter />,
      tabBarActiveTintColor: colors.porter,
      tabBarInactiveTintColor: colors.muted,
      tabBarStyle: tabBarStyle(insets.bottom, colors),
      tabBarLabelStyle: { fontFamily: fonts.semiBold, fontSize: 11, marginTop: -2 },
      tabBarItemStyle: { borderRadius: 24 },
    })}>
      <PorteiroTab.Screen name="Painel" component={PorteiroHome} options={{ title: 'Painel' }} />
      <PorteiroTab.Screen name="Encomendas" component={PorteiroEncomendas} options={{ title: 'Entregas' }} />
      <PorteiroTab.Screen name="OCR" component={OCR} options={{ title: 'Leitura' }} />
      <PorteiroTab.Screen name="Mural" component={Mural} options={{ title: 'Mural' }} />
      <PorteiroTab.Screen name="Perfil" component={Perfil} options={{ title: 'Perfil' }} />
    </PorteiroTab.Navigator>
  );
}

function AreaAutenticada() {
  const { perfil } = useAuth();
  if (!perfil) return null;
  if (perfil.tipo === 'porteiro' && perfil.mostrarCodigoCondominio) return <CodigoCondominio />;
  return perfil.tipo === 'morador' ? <MoradorTabs /> : <PorteiroTabs />;
}

function RootNavigator() {
  const { user, perfil, loading } = useAuth();
  const { colors, dark } = useTheme();
  const themedStyles = useMemo(() => makeStyles(colors), [colors]);

  if (loading) {
    return <View style={themedStyles.loading}><ActivityIndicator size="large" color={colors.accent} /><AppText style={themedStyles.loadingText}>Abrindo sua conta...</AppText></View>;
  }

  const noHeader = { headerShown: false, contentStyle: { backgroundColor: colors.background } };
  const navigationTheme = {
    ...NavigationDefaultTheme,
    dark,
    colors: {
      ...NavigationDefaultTheme.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.accent,
    },
  };

  return <NavigationContainer theme={navigationTheme}>
    {!user ? <Stack.Navigator id="PublicStack" screenOptions={noHeader}>
      <Stack.Screen name="Login" component={Login} />
      <Stack.Screen name="Register" component={Register} />
      <Stack.Screen name="RecuperaSenha" component={RecuperaSenha} />
    </Stack.Navigator> : !perfil ? <Stack.Navigator id="ProfileStack" screenOptions={noHeader}>
      <Stack.Screen name="Perfil" component={Perfil} />
      <Stack.Screen name="Privacidade" component={Privacidade} />
    </Stack.Navigator> : <Stack.Navigator id="AuthenticatedStack" screenOptions={noHeader}>
      <Stack.Screen name="Home" component={AreaAutenticada} />
      {perfil.tipo === 'porteiro' && <Stack.Screen name="OCR" component={OCR} />}
      {perfil.tipo === 'porteiro' && <Stack.Screen name="OCRHistorico" component={OCRHistorico} />}
      {perfil.tipo === 'porteiro' && <Stack.Screen name="EncomendaForm" component={EncomendaForm} />}
      <Stack.Screen name="Detalhes" component={Detalhes} />
      {perfil.tipo === 'porteiro' && <Stack.Screen name="Relatorios" component={Relatorios} />}
      <Stack.Screen name="Notificacoes" component={Notificacoes} />
      <Stack.Screen name="Perfil" component={Perfil} />
      {perfil.tipo === 'morador' && <Stack.Screen name="Previsoes" component={Previsoes} />}
      {perfil.tipo === 'porteiro' && <Stack.Screen name="SolicitacoesCondominio" component={SolicitacoesCondominio} />}
      <Stack.Screen name="Privacidade" component={Privacidade} />
      <Stack.Screen name="Mural" component={Mural} />
      <Stack.Screen name="Condominio" component={Condominio} />
      <Stack.Screen name="CodigoCondominio" component={CodigoCondominio} />
    </Stack.Navigator>}
  </NavigationContainer>;
}

function AppWithFonts() {
  const { colors } = useTheme();
  const themedStyles = useMemo(() => makeStyles(colors), [colors]);
  const [fontsLoaded] = useFonts({ EBGaramond_400Regular, EBGaramond_500Medium, EBGaramond_600SemiBold, EBGaramond_700Bold });
  const [onboarding, setOnboarding] = useState<boolean | null>(null);
  useEffect(() => { AsyncStorage.getItem(ONBOARDING_KEY).then(v => setOnboarding(v === 'ok')).catch(() => setOnboarding(false)); }, []);
  if (!fontsLoaded || onboarding === null) return <View style={themedStyles.loading}><ActivityIndicator size="large" color={colors.accent} /></View>;
  if (!onboarding) return <Onboarding onFinish={async () => { await AsyncStorage.setItem(ONBOARDING_KEY, 'ok'); setOnboarding(true); }} />;
  return <AuthProvider><RootNavigator /></AuthProvider>;
}

export default function App() {
  return <SafeAreaProvider><ThemeProvider><AppWithFonts /></ThemeProvider></SafeAreaProvider>;
}

const styles = StyleSheet.create({
  iconWrap:{width:32,height:28,borderRadius:14,alignItems:'center',justifyContent:'center'},
});

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    loading:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:colors.background},
    loadingText:{marginTop:12,color:colors.muted,fontSize:17},
  });
}
