import { useState, useRef, useCallback, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Keyboard, Pressable } from 'react-native';
import {
  useTheme,
  Button,
  Text,
  SegmentedButtons,
  TextInput,
  Surface,
  Divider,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import backend from '../api/backend';
import { api, poster as posterUrl } from '../api/yummy';
import { useAuth } from '../context/AuthContext';
import { LoadingState, ErrorState, EmptyState } from '../components/States';
import { SCREEN_WIDTH } from '../utils/layout';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Quiz'>;
type Mode = 'anime' | 'emoji';

interface QuizOption {
  animeId: number;
  animeTitle: string;
  year?: number | string;
  animeUrl?: string;
  correct?: boolean;
}

interface QuizQuestion {
  animeId: number;
  animeTitle: string;
  animeUrl?: string;
  imageUrl?: string;
  emoji?: string;
  options?: QuizOption[];
  error?: string;
}

type Phase = 'idle' | 'loading' | 'playing' | 'reveal' | 'over';

const MODE_LABELS: Record<Mode, string> = {
  anime: 'Угадай аниме',
  emoji: 'Эмодзи',
};

function normalize(s?: string | null): string {
  return (s || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]/g, '');
}

export default function QuizScreen(_props: Props) {
  const theme = useTheme();
  const { user, openAuthModal } = useAuth();

  const [mode, setMode] = useState<Mode>('emoji');
  const [phase, setPhase] = useState<Phase>('idle');
  const [question, setQuestion] = useState<QuizQuestion | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);
  const [totalPlayed, setTotalPlayed] = useState(0);
  const [wrongsInRow, setWrongsInRow] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [resultMsg, setResultMsg] = useState('');
  const [wasCorrect, setWasCorrect] = useState(false);

  // Frames-mode search state.
  const [searchText, setSearchText] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const excludeRef = useRef<number[]>([]);

  const fetchQuestion = useCallback(
    async (m: Mode, exclude: number[]) => {
      setPhase('loading');
      setErrorMsg('');
      setQuestion(null);
      setAnswered(false);
      setSelectedId(null);
      setResultMsg('');
      setWasCorrect(false);
      setSearchText('');
      setResults([]);
      try {
        const q: QuizQuestion =
          m === 'anime'
            ? await backend.quizQuestion(exclude)
            : await backend.quizEmoji(exclude, 'easy');
        if (q.error) {
          setErrorMsg(q.error);
          setPhase('idle');
          return;
        }
        setQuestion(q);
        if (q.animeId) excludeRef.current.push(q.animeId);
        setPhase('playing');
      } catch (e: any) {
        setErrorMsg(e?.message || 'Ошибка загрузки');
        setPhase('idle');
      }
    },
    [],
  );

  const startGame = useCallback(() => {
    excludeRef.current = [];
    setScore(0);
    setRound(0);
    setTotalPlayed(0);
    setWrongsInRow(0);
    setResultMsg('');
    fetchQuestion(mode, []);
  }, [mode, fetchQuestion]);

  // Restart whenever the mode changes (back to start screen).
  useEffect(() => {
    setPhase('idle');
    setQuestion(null);
    setResultMsg('');
    setErrorMsg('');
    setScore(0);
    setRound(0);
    setTotalPlayed(0);
    setWrongsInRow(0);
    setAnswered(false);
    setSelectedId(null);
    excludeRef.current = [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const finishAnswer = useCallback(
    (correct: boolean) => {
      if (!question) return;
      setAnswered(true);
      setWasCorrect(correct);
      if (correct) {
        setScore((s) => s + 1);
        setWrongsInRow(0);
        setResultMsg(`Правильно! ${question.animeTitle}`);
      } else {
        setWrongsInRow((w) => w + 1);
        setResultMsg(`Неверно. Правильный ответ: ${question.animeTitle}`);
      }
      setTotalPlayed((t) => t + 1);
      setRound((r) => r + 1);
      setPhase('reveal');
      Keyboard.dismiss();
    },
    [question],
  );

  const chooseOption = (opt: QuizOption) => {
    if (answered || !question) return;
    setSelectedId(opt.animeId);
    const correct =
      opt.correct === true || opt.animeId === question.animeId;
    finishAnswer(correct);
  };

  const runSearch = async () => {
    const q = searchText.trim();
    if (q.length < 2) return;
    setSearching(true);
    try {
      const res = await api.search(q, { limit: 8 });
      setResults(Array.isArray(res) ? res : []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const chooseSearchResult = (anime: any) => {
    if (answered || !question) return;
    const aid = anime.anime_id ?? anime.animeId;
    setSelectedId(aid ?? null);
    const idMatch = aid === question.animeId;
    const titleMatch =
      normalize(anime.title || anime.animeTitle) === normalize(question.animeTitle);
    finishAnswer(idMatch || titleMatch);
  };

  const nextRound = () => {
    if (wrongsInRow >= 3) {
      setResultMsg('3 ошибки подряд — игра окончена.');
      setPhase('over');
      return;
    }
    fetchQuestion(mode, excludeRef.current);
  };

  const c = theme.colors;

  // ---- Auth gate ----
  if (!user) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: c.background }]}>
        <View style={styles.flex}>
          <EmptyState
            icon="account-lock-outline"
            message="Войдите в аккаунт, чтобы играть в квиз."
            action={openAuthModal}
            actionLabel="Войти"
          />
        </View>
      </SafeAreaView>
    );
  }

  const accentFor = (opt: QuizOption): string | undefined => {
    if (!answered) return undefined;
    const isCorrect = opt.correct === true || opt.animeId === question?.animeId;
    if (isCorrect) return '#2E7D32'; // green
    if (opt.animeId === selectedId) return c.error; // red — chosen wrong
    return undefined;
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: c.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Mode toggle */}
        <SegmentedButtons
          value={mode}
          onValueChange={(v) => setMode(v as Mode)}
          buttons={[
            { value: 'anime', label: MODE_LABELS.anime, icon: 'movie-open' },
            { value: 'emoji', label: MODE_LABELS.emoji, icon: 'emoticon-happy' },
          ]}
          style={styles.segmented}
        />

        {/* Score bar */}
        <View style={[styles.scoreBar, { backgroundColor: c.surfaceContainer }]}>
          <View style={styles.scoreItem}>
            <MaterialCommunityIcons name="star" size={16} color={c.primary} />
            <Text variant="labelLarge" style={{ color: c.onSurface }}>
              {score}
            </Text>
          </View>
          <View style={styles.scoreItem}>
            <MaterialCommunityIcons name="flag-checkered" size={16} color={c.onSurfaceVariant} />
            <Text variant="labelLarge" style={{ color: c.onSurface }}>
              {round}
            </Text>
          </View>
          <View style={styles.scoreItem}>
            <MaterialCommunityIcons name="target" size={16} color={c.onSurfaceVariant} />
            <Text variant="labelLarge" style={{ color: c.onSurfaceVariant }}>
              {score}/{totalPlayed || 0}
            </Text>
          </View>
        </View>

        {phase === 'idle' && (
          <View style={styles.centerBlock}>
            {errorMsg ? (
              <Text style={[styles.idleMsg, { color: c.error }]}>{errorMsg}</Text>
            ) : (
              <Text style={[styles.idleMsg, { color: c.onSurfaceVariant }]}>
                {mode === 'emoji'
                  ? 'Угадайте аниме по эмодзи-описанию сюжета. Выберите правильный вариант из списка.'
                  : 'Угадайте аниме по случайному кадру из серии. Введите название и выберите из поиска.'}
              </Text>
            )}
            <Button mode="contained" icon="play" onPress={startGame} style={styles.startBtn}>
              Начать
            </Button>
          </View>
        )}

        {phase === 'loading' && (
          <View style={styles.centerBlock}>
            <LoadingState
              label={mode === 'emoji' ? 'Генерация эмодзи…' : 'Загрузка кадра…'}
            />
          </View>
        )}

        {(phase === 'playing' || phase === 'reveal') && question && (
          <View>
            {/* Question */}
            {mode === 'emoji' ? (
              <Surface
                style={[styles.emojiBox, { backgroundColor: c.surfaceContainer }]}
                elevation={0}
              >
                <Text style={styles.emojiText}>{question.emoji}</Text>
              </Surface>
            ) : (
              <View
                style={[styles.frameBox, { backgroundColor: c.surfaceContainer }]}
              >
                {question.imageUrl ? (
                  <Image
                    source={question.imageUrl}
                    style={styles.frameImage}
                    contentFit="cover"
                    transition={150}
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <Text style={{ color: c.onSurfaceVariant, padding: 40, textAlign: 'center' }}>
                    Нет изображения
                  </Text>
                )}
              </View>
            )}

            {/* Emoji mode: option buttons */}
            {mode === 'emoji' && question.options && (
              <View style={styles.options}>
                {question.options.map((opt) => {
                  const tint = accentFor(opt);
                  return (
                    <Button
                      key={String(opt.animeId)}
                      mode={tint ? 'contained' : 'outlined'}
                      buttonColor={tint}
                      textColor={tint ? '#FFFFFF' : c.onSurface}
                      style={styles.optionBtn}
                      labelStyle={styles.optionLabel}
                      disabled={answered}
                      onPress={() => chooseOption(opt)}
                    >
                      {opt.animeTitle}
                      {opt.year ? `  · ${opt.year}` : ''}
                    </Button>
                  );
                })}
              </View>
            )}

            {/* Anime mode: search */}
            {mode === 'anime' && (
              <View style={styles.searchBlock}>
                <View style={styles.searchRow}>
                  <TextInput
                    value={searchText}
                    onChangeText={setSearchText}
                    placeholder="Название аниме…"
                    mode="outlined"
                    dense
                    style={styles.searchInput}
                    onSubmitEditing={runSearch}
                    returnKeyType="search"
                    disabled={answered}
                  />
                  <Button
                    mode="contained"
                    onPress={runSearch}
                    loading={searching}
                    disabled={searching || searchText.trim().length < 2 || answered}
                    style={styles.searchBtn}
                  >
                    Найти
                  </Button>
                </View>

                {results.length > 0 && (
                  <View
                    style={[styles.results, { backgroundColor: c.surfaceContainer }]}
                  >
                    {results.map((a, idx) => {
                      const aid = a.anime_id ?? a.animeId;
                      const tint =
                        answered && aid === selectedId
                          ? aid === question.animeId
                            ? '#2E7D32'
                            : c.error
                          : answered && aid === question.animeId
                          ? '#2E7D32'
                          : undefined;
                      const img = posterUrl(a, 'small');
                      return (
                        <Pressable
                          key={String(aid ?? idx)}
                          onPress={() => chooseSearchResult(a)}
                          disabled={answered}
                          style={[
                            styles.resultRow,
                            tint ? { backgroundColor: tint } : undefined,
                          ]}
                        >
                          {img ? (
                            <Image
                              source={img}
                              style={styles.resultPoster}
                              contentFit="cover"
                              cachePolicy="memory-disk"
                            />
                          ) : (
                            <View
                              style={[
                                styles.resultPoster,
                                { backgroundColor: c.surfaceContainerHigh },
                              ]}
                            />
                          )}
                          <View style={styles.resultInfo}>
                            <Text
                              variant="bodyMedium"
                              style={{
                                color: tint ? '#FFFFFF' : c.onSurface,
                              }}
                              numberOfLines={2}
                            >
                              {a.title || a.animeTitle}
                            </Text>
                            {a.year ? (
                              <Text
                                variant="labelSmall"
                                style={{
                                  color: tint ? '#FFFFFFCC' : c.onSurfaceVariant,
                                }}
                              >
                                {a.year}
                              </Text>
                            ) : null}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* Reveal panel */}
            {phase === 'reveal' && (
              <Surface
                style={[styles.reveal, { backgroundColor: c.surfaceContainerHigh }]}
                elevation={0}
              >
                <Text style={styles.revealEmoji}>{wasCorrect ? '🎉' : '😔'}</Text>
                <Text
                  variant="titleMedium"
                  style={{
                    color: wasCorrect ? '#2E7D32' : c.error,
                    textAlign: 'center',
                    marginBottom: 8,
                  }}
                >
                  {resultMsg}
                </Text>
                {mode === 'emoji' && question.emoji ? (
                  <Text style={styles.revealEmojiSmall}>{question.emoji}</Text>
                ) : null}
                <Button
                  mode="contained"
                  icon="arrow-right"
                  onPress={nextRound}
                  style={{ marginTop: 8, alignSelf: 'stretch' }}
                  contentStyle={{ flexDirection: 'row-reverse' }}
                >
                  Далее
                </Button>
              </Surface>
            )}
          </View>
        )}

        {phase === 'over' && (
          <View style={styles.centerBlock}>
            <Text style={styles.overEmoji}>🏁</Text>
            <Text variant="titleLarge" style={{ color: c.onSurface, marginBottom: 6 }}>
              Игра окончена
            </Text>
            <Text style={[styles.idleMsg, { color: c.onSurfaceVariant, marginBottom: 4 }]}>
              {resultMsg}
            </Text>
            <Text style={[styles.idleMsg, { color: c.onSurfaceVariant }]}>
              Итоговый счёт: {score} из {totalPlayed}
            </Text>
            <Button mode="contained" icon="refresh" onPress={startGame} style={styles.startBtn}>
              Играть снова
            </Button>
          </View>
        )}

        {errorMsg && phase !== 'idle' && phase !== 'over' && (
          <ErrorState message={errorMsg} onRetry={() => fetchQuestion(mode, excludeRef.current)} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: 12,
  },
  segmented: {
    marginBottom: 12,
  },
  scoreBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderRadius: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  scoreItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  centerBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  idleMsg: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  startBtn: {
    minWidth: 180,
  },
  emojiBox: {
    borderRadius: 18,
    paddingVertical: 36,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  emojiText: {
    fontSize: 40,
    textAlign: 'center',
    letterSpacing: 3,
    lineHeight: 56,
  },
  frameBox: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 20,
    minHeight: 200,
  },
  frameImage: {
    width: '100%',
    height: Math.round((SCREEN_WIDTH - 24) * 9 / 16),
  },
  options: {
    gap: 8,
  },
  optionBtn: {
    justifyContent: 'flex-start',
    borderRadius: 14,
  },
  optionLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
  searchBlock: {
    marginBottom: 16,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  searchBtn: {
    borderRadius: 14,
  },
  results: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 10,
  },
  resultPoster: {
    width: 44,
    height: 62,
    borderRadius: 6,
  },
  resultInfo: {
    flex: 1,
  },
  reveal: {
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    marginTop: 8,
  },
  revealEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  revealEmojiSmall: {
    fontSize: 28,
    letterSpacing: 2,
    marginBottom: 12,
    textAlign: 'center',
  },
  overEmoji: {
    fontSize: 44,
    marginBottom: 8,
  },
});
