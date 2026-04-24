-- SQL Schema for KryptoAnon (Supabase)

-- 1. Create Rooms Table
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY, -- Room Hash
  name TEXT NOT NULL,
  owner_id UUID NOT NULL,
  password_hash TEXT,
  allowed_users UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Messages Table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_alias TEXT NOT NULL,
  content TEXT NOT NULL, -- Encrypted content
  type TEXT NOT NULL DEFAULT 'text', -- 'text', 'image'
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Join Requests Table
CREATE TABLE IF NOT EXISTS join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  alias TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

-- 4. Enable RLS
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE join_requests ENABLE ROW LEVEL SECURITY;

-- 5. Policies for Rooms
CREATE POLICY "Public rooms are viewable by everyone" 
ON rooms FOR SELECT USING (true);

CREATE POLICY "Owners can update their rooms" 
ON rooms FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Everyone can create rooms" 
ON rooms FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- 6. Policies for Messages
CREATE POLICY "Messages are viewable by room members" 
ON messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM rooms 
    WHERE rooms.id = messages.room_id 
    AND (auth.uid() = rooms.owner_id OR auth.uid() = ANY(rooms.allowed_users))
  )
);

CREATE POLICY "Room members can insert messages" 
ON messages FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM rooms 
    WHERE rooms.id = messages.room_id 
    AND (auth.uid() = rooms.owner_id OR auth.uid() = ANY(rooms.allowed_users))
  )
);

-- 7. Policies for Join Requests
CREATE POLICY "Users can see their own requests" 
ON join_requests FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Owners can see requests for their rooms" 
ON join_requests FOR SELECT USING (
  EXISTS (SELECT 1 FROM rooms WHERE rooms.id = join_requests.room_id AND rooms.owner_id = auth.uid())
);

CREATE POLICY "Users can insert join requests" 
ON join_requests FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can update join requests" 
ON join_requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM rooms WHERE rooms.id = join_requests.room_id AND rooms.owner_id = auth.uid())
);
