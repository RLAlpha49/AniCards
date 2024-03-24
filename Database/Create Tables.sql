CREATE TABLE svg.users (
    id SERIAL PRIMARY KEY,
    userId INTEGER NOT NULL UNIQUE,
    username VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE svg.statcards (
    id SERIAL PRIMARY KEY,
    keys VARCHAR(255),
    user_id INTEGER NOT NULL UNIQUE REFERENCES svg.users(userId)
);

CREATE TABLE svg.animeStats (
    id SERIAL PRIMARY KEY,
    data TEXT,
    user_id INTEGER NOT NULL REFERENCES svg.statcards(user_id)
);

CREATE TABLE svg.socialStats (
    id SERIAL PRIMARY KEY,
    data TEXT,
    user_id INTEGER NOT NULL REFERENCES svg.statcards(user_id)
);

CREATE TABLE svg.mangaStats (
    id SERIAL PRIMARY KEY,
    data TEXT,
    user_id INTEGER NOT NULL REFERENCES svg.statcards(user_id)
);

CREATE TABLE svg.animeGenres (
    id SERIAL PRIMARY KEY,
    data TEXT,
    user_id INTEGER NOT NULL REFERENCES svg.statcards(user_id)
);

CREATE TABLE svg.animeTags (
    id SERIAL PRIMARY KEY,
    data TEXT,
    user_id INTEGER NOT NULL REFERENCES svg.statcards(user_id)
);

CREATE TABLE svg.animeVoiceActors (
    id SERIAL PRIMARY KEY,
    data TEXT,
    user_id INTEGER NOT NULL REFERENCES svg.statcards(user_id)
);

CREATE TABLE svg.animeStudios (
    id SERIAL PRIMARY KEY,
    data TEXT,
    user_id INTEGER NOT NULL REFERENCES svg.statcards(user_id)
);

CREATE TABLE svg.animeStaff (
    id SERIAL PRIMARY KEY,
    data TEXT,
    user_id INTEGER NOT NULL REFERENCES svg.statcards(user_id)
);

CREATE TABLE svg.mangaGenres (
    id SERIAL PRIMARY KEY,
    data TEXT,
    user_id INTEGER NOT NULL REFERENCES svg.statcards(user_id)
);

CREATE TABLE svg.mangaTags (
    id SERIAL PRIMARY KEY,
    data TEXT,
    user_id INTEGER NOT NULL REFERENCES svg.statcards(user_id)
);

CREATE TABLE svg.mangaStaff (
    id SERIAL PRIMARY KEY,
    data TEXT,
    user_id INTEGER NOT NULL REFERENCES svg.statcards(user_id)
);
