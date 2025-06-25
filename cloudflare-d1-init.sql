-- D1-compatible SQL migration for Dashboard
-- Run this in the Cloudflare D1 dashboard to initialize your schema

-- User table
CREATE TABLE IF NOT EXISTS User (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    provider TEXT NOT NULL,
    providerId TEXT NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CalendarToken table
CREATE TABLE IF NOT EXISTS CalendarToken (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL UNIQUE,
    accessToken TEXT NOT NULL,
    refreshToken TEXT NOT NULL,
    expiresAt TIMESTAMP NOT NULL,
    provider TEXT NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL,
    FOREIGN KEY (userId) REFERENCES User(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Meeting table
CREATE TABLE IF NOT EXISTS Meeting (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT NOT NULL,
    googleEventId TEXT NOT NULL,
    recallBotId TEXT,
    title TEXT NOT NULL,
    startTime TIMESTAMP NOT NULL,
    endTime TIMESTAMP NOT NULL,
    status TEXT NOT NULL,
    transcript TEXT,
    notes TEXT,
    summary TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL,
    FOREIGN KEY (userId) REFERENCES User(id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS Meeting_userId_idx ON Meeting(userId);
CREATE INDEX IF NOT EXISTS Meeting_googleEventId_idx ON Meeting(googleEventId);
CREATE UNIQUE INDEX IF NOT EXISTS Meeting_googleEventId_userId_unique ON Meeting(googleEventId, userId);

-- Recording table
CREATE TABLE IF NOT EXISTS Recording (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meetingId INTEGER NOT NULL UNIQUE,
    url TEXT NOT NULL,
    duration INTEGER NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL,
    FOREIGN KEY (meetingId) REFERENCES Meeting(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ActionItem table
CREATE TABLE IF NOT EXISTS ActionItem (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meetingId INTEGER NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    assignedTo TEXT,
    dueDate TIMESTAMP,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL,
    FOREIGN KEY (meetingId) REFERENCES Meeting(id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS ActionItem_meetingId_idx ON ActionItem(meetingId);

-- Add any additional indexes or constraints as needed 