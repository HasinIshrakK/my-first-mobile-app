import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

// --- Types & Interfaces ---
interface QuestItem {
  id: string;
  title: string;
  baseTarget: number; // Base requirement for week 1 / level 1
  currentCount: number;
  completed: boolean;
  unit: string;
  incrementStep: number;
}

interface PlayerState {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  fatigue: number;
  maxFatigue: number;
  xp: number;
  maxXp: number;
  level: number;
  streakDays: number;
}

interface QuestDataState {
  lastResetTimestamp: number; // Unix timestamp
  weekNumber: number;
  quests: QuestItem[];
  lastHpMpRegenTimestamp: number;
}

const PLAYER_STORAGE_KEY = '@hunter_homepage_data';
const QUEST_STORAGE_KEY = '@hunter_quests_data';

export default function DailyQuestsScreen(): React.JSX.Element {
  const router = useRouter();

  const [player, setPlayer] = useState<PlayerState>({
    hp: 100,
    maxHp: 100,
    mp: 100,
    maxMp: 100,
    fatigue: 0,
    maxFatigue: 100,
    xp: 0,
    maxXp: 100,
    level: 1,
    streakDays: 0,
  });

  const [questData, setQuestData] = useState<QuestDataState>({
    lastResetTimestamp: Date.now(),
    weekNumber: 1,
    quests: [],
    lastHpMpRegenTimestamp: Date.now(),
  });

  const [timeLeft, setTimeLeft] = useState<string>('00:00:00');
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  // Check if today is Friday
  const isFriday = new Date().getDay() === 5;

  // Calculate dynamic quest targets based on Level and Week
  const calculateTarget = (base: number, isDistance: boolean): number => {
    if (isFriday) return 0; // Rest Day on Friday

    const weeklyIncrease = isDistance ? 100 : 1;
    const levelMultiplier = player.level;

    // Base + (Week - 1) * weeklyIncrease + Level Scaling
    return (base + (questData.weekNumber - 1) * weeklyIncrease) * levelMultiplier;
  };

  // 1. Initial State Load
  useEffect(() => {
    const loadAllData = async () => {
      try {
        const savedPlayer = await AsyncStorage.getItem(PLAYER_STORAGE_KEY);
        if (savedPlayer) setPlayer(JSON.parse(savedPlayer));

        const savedQuests = await AsyncStorage.getItem(QUEST_STORAGE_KEY);
        if (savedQuests) {
          setQuestData(JSON.parse(savedQuests));
        } else {
          // Initialize Default Quests
          initializeDefaultQuests(1, player.level);
        }
      } catch (error) {
        console.error('Failed to load storage data:', error);
      } finally {
        setIsInitialized(true);
      }
    };

    loadAllData();
  }, []);

  // Initialize Default Base Quests
  const initializeDefaultQuests = (week: number, level: number) => {
    const baseQuests: QuestItem[] = [
      { id: '1', title: 'Push-ups', baseTarget: 10, currentCount: 0, completed: false, unit: 'reps', incrementStep: 1 },
      { id: '2', title: 'Sit-ups', baseTarget: 10, currentCount: 0, completed: false, unit: 'reps', incrementStep: 1 },
      { id: '3', title: 'Squats', baseTarget: 10, currentCount: 0, completed: false, unit: 'reps', incrementStep: 1 },
      { id: '4', title: 'Running', baseTarget: 500, currentCount: 0, completed: false, unit: 'm', incrementStep: 100 },
    ];

    setQuestData((prev) => ({
      ...prev,
      weekNumber: week,
      quests: baseQuests,
      lastResetTimestamp: Date.now(),
    }));
  };

  // 2. Persist Player & Quests State
  useEffect(() => {
    if (!isInitialized) return;
    AsyncStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(player));
  }, [player, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    AsyncStorage.setItem(QUEST_STORAGE_KEY, JSON.stringify(questData));
  }, [questData, isInitialized]);

  // 3. Passive 12-Hour Regeneration (HP Recovery & Fatigue Decay)
  useEffect(() => {
    const regenInterval = setInterval(() => {
      const now = Date.now();
      const elapsedMs = now - questData.lastHpMpRegenTimestamp;
      const twelveHoursMs = 12 * 60 * 60 * 1000;

      if (elapsedMs >= 1000) {
        const fraction = elapsedMs / twelveHoursMs;

        setPlayer((prev) => ({
          ...prev,
          hp: Math.min(prev.maxHp, prev.hp + prev.maxHp * fraction),
          fatigue: Math.max(0, prev.fatigue - prev.maxFatigue * fraction),
        }));

        setQuestData((prev) => ({ ...prev, lastHpMpRegenTimestamp: now }));
      }
    }, 10000); // Ticks every 10 seconds

    return () => clearInterval(regenInterval);
  }, [questData.lastHpMpRegenTimestamp]);

  // 4. Timer & Midnight Reset / Penalty Redirect
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const diff = endOfDay.getTime() - now.getTime();

      if (diff <= 0) {
        evaluateMidnightReset();
      } else {
        const hours = String(Math.floor((diff / (1000 * 60 * 60)) % 24)).padStart(2, '0');
        const minutes = String(Math.floor((diff / 1000 / 60) % 60)).padStart(2, '0');
        const seconds = String(Math.floor((diff / 1000) % 60)).padStart(2, '0');
        setTimeLeft(`${hours}:${minutes}:${seconds}`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [questData, player]);

  // Check completion at Midnight
  const evaluateMidnightReset = () => {
    if (isFriday) return; // Skip penalty logic on rest day

    const allCompleted = questData.quests.every((q) => {
      const target = calculateTarget(q.baseTarget, q.unit === 'm');
      return q.currentCount >= target;
    });

    if (!allCompleted) {
      // Missed Quests -> MP -20, Reset Streak, Redirect to Penalty Page
      setPlayer((prev) => ({
        ...prev,
        mp: Math.max(0, prev.mp - 20),
        streakDays: 0,
      }));

      // Redirect to penalty screen
      router.replace('/penalty');
    } else {
      // Completed -> Streak + 1, MP + 5
      const newStreak = player.streakDays + 1;
      setPlayer((prev) => ({
        ...prev,
        streakDays: newStreak,
        mp: Math.min(prev.maxMp, prev.mp + 5),
      }));

      // Reset Quests for Next Day
      initializeDefaultQuests(questData.weekNumber, player.level);
    }
  };

  // 5. Handle Quest Increments & Scaling Math
  const handleQuestProgress = (quest: QuestItem) => {
    const target = calculateTarget(quest.baseTarget, quest.unit === 'm');
    const maxLimit = target * 2; // Up to 200% double limit

    if (quest.currentCount >= maxLimit) return;

    const step = quest.incrementStep;
    const nextCount = Math.min(maxLimit, quest.currentCount + step);
    const isOverachieving = quest.currentCount >= target;

    // Standard completion vs Extra 10% Overachieving calculation
    let xpGained = 0;
    let fatigueGained = 0;
    let hpLoss = 0;

    if (!quest.completed && nextCount >= target) {
      // Just hit base target
      xpGained = 10;
      fatigueGained = 10;
      hpLoss = 10;
    } else if (isOverachieving) {
      // Overachieving calculation (every extra 10% of target)
      const tenPercent = target * 0.1;
      const extraSteps = Math.floor(step / tenPercent) || 1;

      xpGained = 5 * extraSteps;
      fatigueGained = 5 * extraSteps;
      hpLoss = 5 * extraSteps;
    }

    // Apply stats change to Player
    setPlayer((prev) => {
      let newXp = prev.xp + xpGained;
      let newLevel = prev.level;
      let newMaxHp = prev.maxHp;
      let newMaxMp = prev.maxMp;
      let newMaxXp = prev.maxXp;

      // Handle Level Up
      while (newXp >= newMaxXp) {
        newXp -= newMaxXp;
        newLevel += 1;
        newMaxHp = Math.round(newMaxHp * 1.15);
        newMaxMp = Math.round(newMaxMp * 1.15);
        newMaxXp = Math.round(newMaxXp * 1.2);
      }

      const leveledUp = newLevel > prev.level;

      return {
        ...prev,
        xp: newXp,
        level: newLevel,
        maxHp: newMaxHp,
        maxMp: newMaxMp,
        maxXp: newMaxXp,
        hp: leveledUp ? newMaxHp : Math.max(0, prev.hp - hpLoss),
        mp: leveledUp ? newMaxMp : prev.mp,
        fatigue: leveledUp ? 0 : Math.min(prev.maxFatigue, prev.fatigue + fatigueGained),
      };
    });

    // Update Quests State
    setQuestData((prev) => ({
      ...prev,
      quests: prev.quests.map((q) =>
        q.id === quest.id
          ? {
              ...q,
              currentCount: nextCount,
              completed: nextCount >= target,
            }
          : q
      ),
    }));
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0d0d0d" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.hudContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.questType}>DAILY QUEST</Text>
            <Text style={styles.title}>
              {isFriday ? 'REST DAY - NO REPS QUEST' : 'PREPARATION TO BECOME STRONG'}
            </Text>
          </View>

          {/* Timer & Streak Status */}
          <View style={styles.statusRow}>
            <View style={styles.statusBox}>
              <Text style={styles.statusLabel}>TIME REMAINING</Text>
              <Text style={styles.timerValue}>[ {timeLeft} ]</Text>
            </View>
            <View style={styles.statusBox}>
              <Text style={styles.statusLabel}>STREAK</Text>
              <Text style={styles.streakValue}>{player.streakDays} DAYS</Text>
            </View>
          </View>

          {/* Quest List */}
          {isFriday ? (
            <View style={styles.restDayContainer}>
              <Text style={styles.restDayText}>
                Friday is a mandatory rest day. No daily quests are assigned today. HP and Fatigue will continue regenerating.
              </Text>
            </View>
          ) : (
            <View style={styles.questList}>
              {questData.quests.map((quest) => {
                const target = calculateTarget(quest.baseTarget, quest.unit === 'm');
                const maxLimit = target * 2;
                const isMaxedOut = quest.currentCount >= maxLimit;

                return (
                  <View key={quest.id} style={styles.questCard}>
                    <View style={styles.questInfo}>
                      <Text style={[styles.questTitle, quest.completed && styles.textCompleted]}>
                        {quest.completed ? '✓ ' : '• '}
                        {quest.title}
                      </Text>
                      <Text style={styles.questProgress}>
                        [{quest.currentCount} / {target} {quest.unit}]
                        {quest.currentCount > target && ` (Bonus: +${quest.currentCount - target})`}
                      </Text>
                    </View>

                    {!isMaxedOut && (
                      <Pressable
                        style={({ pressed }) => [
                          styles.btnProgress,
                          quest.completed && styles.btnBonus,
                          pressed && styles.btnPressed,
                        ]}
                        onPress={() => handleQuestProgress(quest)}
                      >
                        <Text style={styles.btnProgressText}>
                          +{quest.incrementStep} {quest.completed ? 'Bonus' : ''}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Penalty Warning Box */}
          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>⚠️ SYSTEM WARNING ⚠️</Text>
            <Text style={styles.warningText}>
              Incomplete quests at midnight will trigger an immediate Penalty Quest redirect and deduct 20 MP.
            </Text>
          </View>

        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// --- Dark Theme Stylesheet ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
  scrollContent: {
    padding: 20,
  },
  hudContainer: {
    borderWidth: 1.5,
    borderColor: '#00e5ff',
    borderRadius: 8,
    padding: 20,
    backgroundColor: '#121212',
    shadowColor: '#00e5ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    paddingBottom: 12,
  },
  questType: {
    color: '#ffd700',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
  },
  title: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 4,
    textAlign: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statusBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#333',
  },
  statusLabel: {
    color: '#888',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  timerValue: {
    color: '#ff3333',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 4,
  },
  streakValue: {
    color: '#00e5ff',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 4,
  },
  questList: {
    gap: 12,
    marginBottom: 20,
  },
  questCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#181818',
    padding: 14,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#262626',
  },
  questInfo: {
    flex: 1,
  },
  questTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  textCompleted: {
    color: '#4ade80',
  },
  questProgress: {
    color: '#00e5ff',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  btnProgress: {
    backgroundColor: '#00e5ff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  btnBonus: {
    backgroundColor: '#ffd700',
  },
  btnPressed: {
    opacity: 0.7,
  },
  btnProgressText: {
    color: '#0d0d0d',
    fontWeight: '800',
    fontSize: 12,
  },
  restDayContainer: {
    padding: 20,
    backgroundColor: '#181818',
    borderRadius: 6,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  restDayText: {
    color: '#ffd700',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '600',
  },
  warningBox: {
    backgroundColor: '#1c1010',
    borderColor: '#ef4444',
    borderWidth: 1,
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  warningTitle: {
    color: '#ef4444',
    fontWeight: '900',
    fontSize: 12,
  },
  warningText: {
    color: '#f87171',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
});