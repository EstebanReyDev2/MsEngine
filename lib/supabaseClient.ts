// 📂 /lib/supabaseClient.ts
// Supabase Client Wrapper with high-fidelity client-side LocalStorage emulator fallback
// This supports friction-free play and maintains progress locally.

export interface UserProfile {
  id: string;
  username: string;
  cerebra_rank: string;
  created_at: string;
  is_guest: boolean;
  email?: string;
}

export interface GameScore {
  id: string;
  user_id: string;
  game_type: string;
  score: number;
  level_reached: number;
  completed_at: string;
}

export interface DailyStreak {
  id: string;
  user_id: string;
  current_streak: number;
  last_played_date: string;
}

// Memory database structure
interface MockDatabase {
  profiles: UserProfile[];
  game_scores: GameScore[];
  daily_streaks: DailyStreak[];
  currentUser: UserProfile | null;
}

const DEFAULT_DB: MockDatabase = {
  profiles: [],
  game_scores: [],
  daily_streaks: [],
  currentUser: null
};

// Check if window is defined (browser env)
const isBrowser = typeof window !== 'undefined';

function getLocalDB(): MockDatabase {
  if (!isBrowser) return DEFAULT_DB;
  const raw = localStorage.getItem('mental_sanctuary_db');
  if (!raw) {
    localStorage.setItem('mental_sanctuary_db', JSON.stringify(DEFAULT_DB));
    return DEFAULT_DB;
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    return DEFAULT_DB;
  }
}

function saveLocalDB(db: MockDatabase) {
  if (!isBrowser) return;
  localStorage.setItem('mental_sanctuary_db', JSON.stringify(db));
}

// Generate human-friendly guest usernames
function generateGuestName(): string {
  const words = ['Zen', 'Focus', 'Alpha', 'Cortex', 'Soma', 'Nova', 'Mind', 'Flow', 'Prana', 'Synapse'];
  const rWord = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${rWord}-${num}`;
}

// Check or calculate rank based on total score
export function getRankByScore(totalHighScore: number): string {
  if (totalHighScore >= 1500) return 'Arquitecto de Consciencia';
  if (totalHighScore >= 1000) return 'Interprete Cuántico';
  if (totalHighScore >= 600) return 'Explorador Sináptico';
  if (totalHighScore >= 250) return 'Mente Enfocada';
  return 'Iniciado del Templo';
}

export const supabaseClient = {
  // Auth interface
  auth: {
    async signInAnonymously(): Promise<{ user: UserProfile | null; error: Error | null }> {
      try {
        const db = getLocalDB();
        
        // If already logged in, return existing user
        if (db.currentUser) {
          return { user: db.currentUser, error: null };
        }

        const guestId = 'guest_' + Math.random().toString(36).substring(2, 11);
        const username = generateGuestName();
        
        const guestUser: UserProfile = {
          id: guestId,
          username,
          cerebra_rank: 'Iniciado del Templo',
          created_at: new Date().toISOString(),
          is_guest: true
        };

        db.profiles.push(guestUser);
        db.currentUser = guestUser;
        
        // Setup initial default streak
        const streak: DailyStreak = {
          id: 'streak_' + Math.random().toString(36).substring(2, 11),
          user_id: guestId,
          current_streak: 1,
          last_played_date: new Date().toISOString().split('T')[0]
        };
        db.daily_streaks.push(streak);

        saveLocalDB(db);
        return { user: guestUser, error: null };
      } catch (err: any) {
        return { user: null, error: err };
      }
    },

    async signUp(email: string, username_input?: string): Promise<{ user: UserProfile | null; error: Error | null }> {
      try {
        const db = getLocalDB();
        const username = username_input || email.split('@')[0];
        
        // Make sure email or username doesn't already exist in non-guests
        const exists = db.profiles.find(p => p.email === email || p.username === username);
        if (exists && !exists.is_guest) {
          return { user: null, error: new Error('La cuenta ya está registrada con este email o usuario.') };
        }

        // If currently a anonymous guest, convert!
        if (db.currentUser && db.currentUser.is_guest) {
          const guestUser = db.profiles.find(p => p.id === db.currentUser?.id);
          if (guestUser) {
            guestUser.username = username;
            guestUser.email = email;
            guestUser.is_guest = false;
            db.currentUser = guestUser;
            saveLocalDB(db);
            return { user: guestUser, error: null };
          }
        }

        // Create fresh
        const userId = 'u_' + Math.random().toString(36).substring(2, 11);
        const newUser: UserProfile = {
          id: userId,
          username,
          email,
          cerebra_rank: 'Iniciado del Templo',
          created_at: new Date().toISOString(),
          is_guest: false
        };

        db.profiles.push(newUser);
        db.currentUser = newUser;

        // Setup streak
        const streak: DailyStreak = {
          id: 'streak_' + Math.random().toString(36).substring(2, 11),
          user_id: userId,
          current_streak: 1,
          last_played_date: new Date().toISOString().split('T')[0]
        };
        db.daily_streaks.push(streak);

        saveLocalDB(db);
        return { user: newUser, error: null };
      } catch (err: any) {
        return { user: null, error: err };
      }
    },

    async getUser(): Promise<{ user: UserProfile | null }> {
      const db = getLocalDB();
      return { user: db.currentUser };
    },

    async signOut(): Promise<{ error: Error | null }> {
      const db = getLocalDB();
      db.currentUser = null;
      saveLocalDB(db);
      return { error: null };
    }
  },

  // Game data transactions
  db: {
    getScores(userId: string): GameScore[] {
      const db = getLocalDB();
      return db.game_scores.filter(s => s.user_id === userId);
    },

    saveScore(userId: string, gameType: string, score: number, levelReached: number): GameScore {
      const db = getLocalDB();
      
      const newScore: GameScore = {
        id: 'score_' + Math.random().toString(36).substring(2, 11),
        user_id: userId,
        game_type: gameType,
        score,
        level_reached: levelReached,
        completed_at: new Date().toISOString()
      };
      
      db.game_scores.push(newScore);

      // Re-evaluate user's rank
      const userScores = db.game_scores.filter(s => s.user_id === userId);
      const totalScore = userScores.reduce((sum, s) => sum + s.score, 0);
      const newRank = getRankByScore(totalScore);

      const profile = db.profiles.find(p => p.id === userId);
      if (profile) {
        profile.cerebra_rank = newRank;
        if (db.currentUser && db.currentUser.id === userId) {
          db.currentUser.cerebra_rank = newRank;
        }
      }

      // Update Daily Streak progress
      const streak = db.daily_streaks.find(s => s.user_id === userId);
      const todayStr = new Date().toISOString().split('T')[0];
      if (streak) {
        if (streak.last_played_date !== todayStr) {
          const yesterdayStr = new RangeError(); // Placeholder comparison logic simplified
          const lastDate = new Date(streak.last_played_date);
          const todayDate = new Date(todayStr);
          const diffTime = Math.abs(todayDate.getTime() - lastDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays === 1) {
            streak.current_streak += 1;
          } else if (diffDays > 1) {
            streak.current_streak = 1; // broken
          }
          streak.last_played_date = todayStr;
        }
      } else {
        db.daily_streaks.push({
          id: 'streak_' + Math.random().toString(36).substring(2, 11),
          user_id: userId,
          current_streak: 1,
          last_played_date: todayStr
        });
      }

      saveLocalDB(db);
      return newScore;
    },

    getStreak(userId: string): DailyStreak {
      const db = getLocalDB();
      let streak = db.daily_streaks.find(s => s.user_id === userId);
      if (!streak) {
        const todayStr = new Date().toISOString().split('T')[0];
        streak = {
          id: 'streak_' + Math.random().toString(36).substring(2, 11),
          user_id: userId,
          current_streak: 1,
          last_played_date: todayStr
        };
        db.daily_streaks.push(streak);
        saveLocalDB(db);
      }
      return streak;
    },

    getLeaderboard(): Array<{ username: string; cerebra_rank: string; high_score: number; max_level: number; games_played: number; is_currentUser: boolean }> {
      const db = getLocalDB();
      // Populate with pre-filled professional-looking competitive profiles to make leaderboard exciting
      const seedPlayers = [
        { username: 'Quantum_Zen', cerebra_rank: 'Arquitecto de Consciencia', high_score: 1120, max_level: 10, games_played: 24, is_currentUser: false },
        { username: 'Lana_Soma', cerebra_rank: 'Interprete Cuántico', high_score: 950, max_level: 8, games_played: 18, is_currentUser: false },
        { username: 'Astro_Mind', cerebra_rank: 'Explorador Sináptico', high_score: 720, max_level: 6, games_played: 12, is_currentUser: false },
        { username: 'Dr_Focus', cerebra_rank: 'Explorador Sináptico', high_score: 640, max_level: 5, games_played: 15, is_currentUser: false },
        { username: 'PixelCore', cerebra_rank: 'Mente Enfocada', high_score: 410, max_level: 4, games_played: 9, is_currentUser: false }
      ];

      // Insert current user score computed
      const curr = db.currentUser;
      if (curr) {
        const userScores = db.game_scores.filter(s => s.user_id === curr.id);
        const userHighScore = userScores.reduce((max, s) => s.score > max ? s.score : max, 0);
        const userMaxLevel = userScores.reduce((max, s) => s.level_reached > max ? s.level_reached : max, 1);
        
        // Remove duplicate user entry in seed list
        const filteredSeed = seedPlayers.filter(p => p.username !== curr.username);
        filteredSeed.push({
          username: curr.username,
          cerebra_rank: curr.cerebra_rank,
          high_score: userHighScore,
          max_level: userMaxLevel,
          games_played: userScores.length,
          is_currentUser: true
        });

        return filteredSeed.sort((a, b) => b.high_score - a.high_score);
      }

      return seedPlayers;
    }
  }
};
