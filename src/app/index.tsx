import AsyncStorage from '@react-native-async-storage/async-storage';
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

// --- Interfaces ---
interface PlayerState {
  name: string;
  job: string;
  title: string;
  level: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  fatigue: number;
  maxFatigue: number;
  xp: number;
  maxXp: number;
}

const STORAGE_KEY = '@hunter_homepage_data';

const DEFAULT_PLAYER_STATE: PlayerState = {
  name: 'Sung Jin-Woo',
  job: 'Shadow Monarch',
  title: 'E-Rank Hunter',
  level: 1,
  hp: 100,
  maxHp: 100,
  mp: 100,
  maxMp: 100,
  fatigue: 0,
  maxFatigue: 100,
  xp: 0,
  maxXp: 100,
};

export default function SoloLevelingHUD(): React.JSX.Element {
  const [player, setPlayer] = useState<PlayerState>(DEFAULT_PLAYER_STATE);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  // Load state from AsyncStorage on mount
  useEffect(() => {
    const loadPlayerData = async (): Promise<void> => {
      try {
        const savedData = await AsyncStorage.getItem(STORAGE_KEY);
        if (savedData !== null) {
          setPlayer(JSON.parse(savedData));
        }
      } catch (error) {
        console.error('Failed to load player data:', error);
      } finally {
        setIsInitialized(true);
      }
    };

    loadPlayerData();
  }, []);

  // Automatically save state to AsyncStorage whenever 'player' updates
  useEffect(() => {
    if (!isInitialized) return;

    const savePlayerData = async (): Promise<void> => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(player));
      } catch (error) {
        console.error('Failed to save player data:', error);
      }
    };

    savePlayerData();
  }, [player, isInitialized]);

  // System Function: Add XP and handle Level Up logic
  const addXp = (amount: number): void => {
    setPlayer((prev) => {
      let currentXp = prev.xp + amount;
      let currentLevel = prev.level;
      let currentMaxHp = prev.maxHp;
      let currentMaxMp = prev.maxMp;
      let currentMaxXp = prev.maxXp;

      // Check level up threshold
      while (currentXp >= currentMaxXp) {
        currentXp -= currentMaxXp;
        currentLevel += 1;
        currentMaxHp = Math.round(currentMaxHp * 1.15);
        currentMaxMp = Math.round(currentMaxMp * 1.15);
        currentMaxXp = Math.round(currentMaxXp * 1.2);
      }

      // If level up occurred, apply full heal and reset fatigue
      const leveledUp = currentLevel > prev.level;

      return {
        ...prev,
        xp: currentXp,
        level: currentLevel,
        maxHp: currentMaxHp,
        maxMp: currentMaxMp,
        maxXp: currentMaxXp,
        hp: leveledUp ? currentMaxHp : prev.hp,
        mp: leveledUp ? currentMaxMp : prev.mp,
        fatigue: leveledUp ? 0 : prev.fatigue,
      };
    });
  };

  // System Function: Take Damage
  const takeDamage = (amount: number): void => {
    setPlayer((prev) => ({
      ...prev,
      hp: Math.max(0, prev.hp - amount),
    }));
  };

  // Utility to determine fatigue text color dynamically
  const getFatigueColor = (fatigue: number): string => {
    if (fatigue < 50) return '#4ade80'; // Green
    if (fatigue < 80) return '#fbbf24'; // Orange
    return '#ef4444'; // Red
  };

  // Calculate percentage width for progress bars safely
  const hpPercentage = Math.min(100, Math.max(0, (player.hp / player.maxHp) * 100));
  const mpPercentage = Math.min(100, Math.max(0, (player.mp / player.maxMp) * 100));
  const xpPercentage = Math.min(100, Math.max(0, (player.xp / player.maxXp) * 100));

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0d0d0d" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* HUD Box Border */}
        <View style={styles.hudContainer}>
          
          {/* Section 1: Profile Header Stack */}
          <View style={styles.section}>
            <Text style={styles.name}>{player.name}</Text>
            <Text style={styles.job}>JOB: {player.job}</Text>
            <Text style={styles.title}>TITLE: {player.title}</Text>
            <Text style={styles.level}>LEVEL: {player.level}</Text>
          </View>

          {/* Section 2: HP Gauge */}
          <View style={styles.section}>
            <View style={styles.gaugeHeader}>
              <Text style={styles.gaugeLabel}>HP</Text>
              <Text style={styles.gaugeValue}>
                {player.hp} / {player.maxHp}
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${hpPercentage}%`, backgroundColor: '#ff3333' },
                ]}
              />
            </View>
          </View>

          {/* Section 3: MP Gauge */}
          <View style={styles.section}>
            <View style={styles.gaugeHeader}>
              <Text style={styles.gaugeLabel}>MP</Text>
              <Text style={styles.gaugeValue}>
                {player.mp} / {player.maxMp}
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${mpPercentage}%`, backgroundColor: '#3366ff' },
                ]}
              />
            </View>
          </View>

          {/* XP Gauge (Complementary HUD Metric) */}
          <View style={styles.section}>
            <View style={styles.gaugeHeader}>
              <Text style={styles.gaugeLabel}>EXP</Text>
              <Text style={styles.gaugeValue}>
                {player.xp} / {player.maxXp}
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${xpPercentage}%`, backgroundColor: '#ffd700' },
                ]}
              />
            </View>
          </View>

          {/* Section 4: Fatigue Status */}
          <View style={styles.section}>
            <Text
              style={[
                styles.fatigueText,
                { color: getFatigueColor(player.fatigue) },
              ]}
            >
              Fatigue: {player.fatigue} / {player.maxFatigue}
            </Text>
          </View>

        </View>

        {/* Section 5: Testing Buttons */}
        <View style={styles.buttonContainer}>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.btnQuest,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => addXp(50)}
          >
            <Text style={styles.buttonText}>Simulate Quest (+50 XP)</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.btnDamage,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => takeDamage(20)}
          >
            <Text style={styles.buttonText}>Take Damage (-20 HP)</Text>
          </Pressable>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// --- Dark RPG Theme Stylesheet ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
  scrollContent: {
    padding: 20,
    justifyContent: 'space-between',
    minHeight: '100%',
  },
  hudContainer: {
    borderWidth: 1.5,
    borderColor: '#00e5ff',
    borderRadius: 8,
    padding: 20,
    backgroundColor: '#121212',
    shadowColor: '#00e5ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
    marginTop: 80
  },
  section: {
    marginBottom: 20,
  }, 
  name: {
    fontSize: 28,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 1,
  },
  job: {
    fontSize: 16,
    fontWeight: '700',
    color: '#00e5ff',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 14,
    color: '#888888',
    marginTop: 2,
  },
  level: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffd700',
    marginTop: 6,
  },
  gaugeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  gaugeLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  gaugeValue: {
    fontSize: 13,
    color: '#aaaaaa',
    fontWeight: '600',
  },
  progressTrack: {
    height: 14,
    backgroundColor: '#222222',
    borderRadius: 7,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 7,
  },
  fatigueText: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'right',
  },
  buttonContainer: {
    marginTop: 10,
    gap: 12,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.75,
  },
  btnQuest: {
    backgroundColor: '#00e5ff',
  },
  btnDamage: {
    backgroundColor: '#ff3333',
  },
  buttonText: {
    color: '#0d0d0d',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});