export const AndroidImportance = { MAX: 5 };

export function setNotificationHandler() {
  // No Expo Go este módulo é propositalmente inativo.
}

export async function setNotificationChannelAsync() {
  return null;
}

export async function getPermissionsAsync() {
  return { status: 'denied' };
}

export async function requestPermissionsAsync() {
  return { status: 'denied' };
}

export async function getExpoPushTokenAsync() {
  throw new Error('Push remoto não está disponível no Expo Go. Use npm run dev com uma development build.');
}
