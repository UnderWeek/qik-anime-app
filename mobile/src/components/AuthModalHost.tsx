import { useState } from 'react';
import { Modal, Portal, Text, Button, TextInput, useTheme, SegmentedButtons, IconButton } from 'react-native-paper';
import { StyleSheet, View, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function AuthModalHost() {
  const { isAuthModalOpen, closeAuthModal, login, register, addToast } = useAuth();
  const theme = useTheme();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setEmail('');
    setUsername('');
    setPassword('');
    setError('');
  };

  const submit = async () => {
    setError('');
    if (!email.trim() || !password.trim() || (mode === 'register' && !username.trim())) {
      setError('Заполните все поля');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
        addToast('С возвращением!', 'success');
      } else {
        await register(email.trim(), username.trim(), password);
        addToast('Аккаунт создан', 'success');
      }
      reset();
      closeAuthModal();
    } catch (e: any) {
      setError(e.message || 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Portal>
      <Modal
        visible={isAuthModalOpen}
        onDismiss={closeAuthModal}
        contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <Text variant="headlineSmall" style={{ color: theme.colors.onSurface, fontWeight: '700' }}>
                {mode === 'login' ? 'Вход' : 'Регистрация'}
              </Text>
              <IconButton icon="close" onPress={closeAuthModal} />
            </View>

            <SegmentedButtons
              value={mode}
              onValueChange={(v) => setMode(v as 'login' | 'register')}
              buttons={[
                { value: 'login', label: 'Вход' },
                { value: 'register', label: 'Регистрация' },
              ]}
              style={{ marginBottom: 16 }}
            />

            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              style={{ marginBottom: 12 }}
            />
            {mode === 'register' && (
              <TextInput
                label="Имя пользователя"
                value={username}
                onChangeText={setUsername}
                mode="outlined"
                autoCapitalize="none"
                style={{ marginBottom: 12 }}
              />
            )}
            <TextInput
              label="Пароль"
              value={password}
              onChangeText={setPassword}
              mode="outlined"
              secureTextEntry
              style={{ marginBottom: 8 }}
            />

            {error ? (
              <Text style={{ color: theme.colors.error, marginBottom: 8 }}>{error}</Text>
            ) : null}

            <Button mode="contained" onPress={submit} loading={busy} disabled={busy} style={styles.btn}>
              {mode === 'login' ? 'Войти' : 'Создать аккаунт'}
            </Button>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    margin: 20,
    borderRadius: 20,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  btn: {
    marginTop: 8,
    paddingVertical: 6,
  },
});
