-- 🛠️ Mental Sanctuary Initial Schema Migration
-- Database: PostgreSQL (Supabase Compatible)

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    cerebra_rank TEXT DEFAULT 'Novato del Enfoque',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Public profiles are viewable by everyone" 
    ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" 
    ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
    ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);


-- Create game_scores table
CREATE TABLE IF NOT EXISTS public.game_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    game_type TEXT NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    level_reached INTEGER NOT NULL DEFAULT 1,
    completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.game_scores ENABLE ROW LEVEL SECURITY;

-- Game Scores Policies
CREATE POLICY "Scores are viewable by everyone" 
    ON public.game_scores FOR SELECT USING (true);

CREATE POLICY "Users can insert their own scores" 
    ON public.game_scores FOR INSERT WITH CHECK (auth.uid() = user_id);


-- Create daily_streaks table
CREATE TABLE IF NOT EXISTS public.daily_streaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    current_streak INTEGER NOT NULL DEFAULT 1,
    last_played_date DATE NOT NULL DEFAULT CURRENT_DATE
);

-- Enable RLS
ALTER TABLE public.daily_streaks ENABLE ROW LEVEL SECURITY;

-- Streaks Policies
CREATE POLICY "Streaks are viewable by everyone" 
    ON public.daily_streaks FOR SELECT USING (true);

CREATE POLICY "Users can insert their own streak" 
    ON public.daily_streaks FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own streak" 
    ON public.daily_streaks FOR UPDATE USING (auth.uid() = user_id);


-- 🎛️ Realtime Leaderboard View
-- Aggregates scores for each user and orders by highest rank for day-to-day competition
CREATE OR REPLACE VIEW public.leaderboard_today AS
SELECT 
    p.id as user_id,
    p.username,
    p.cerebra_rank,
    COALESCE(MAX(gs.score), 0) as high_score,
    COALESCE(MAX(gs.level_reached), 1) as max_level,
    count(gs.id) as games_played
FROM 
    public.profiles p
LEFT JOIN 
    public.game_scores gs ON p.id = gs.user_id AND gs.completed_at >= NOW() - INTERVAL '24 hours'
GROUP BY 
    p.id, p.username, p.cerebra_rank
ORDER BY 
    high_score DESC, max_level DESC;

-- Enable real-time for game_scores and leaderboard notifications
alter publication supabase_realtime add table public.game_scores;
