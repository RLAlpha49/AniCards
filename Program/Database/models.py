"""
This module defines the database models for the application.
"""

# pylint: disable=R0903

from Program.Database.database import db # pylint: disable=E0401


class Base(db.Model):
    """
    Base model.
    """

    __abstract__ = True
    __table_args__ = {"schema": "svg"}
    id = db.Column(db.Integer, primary_key=True)
    data = db.Column(db.Text, nullable=True)
    statcard_id = db.Column(db.Integer, db.ForeignKey("svg.users.id"))

    def __repr__(self):
        return f"<{self.__class__.__name__} {self.id}>"


class User(db.Model):
    """
    User model.
    """

    __tablename__ = "users"
    __table_args__ = {"schema": "svg"}
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), nullable=False, unique=True)
    statcards = db.relationship("StatCard", backref="user", lazy=True)

    def __repr__(self):
        return f"<User {self.username}>"


class StatCard(db.Model):
    """
    StatCard model.
    """

    __tablename__ = "statcards"
    __table_args__ = {"schema": "svg"}
    id = db.Column(db.Integer, primary_key=True)
    keys = db.Column(db.String(255), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("svg.users.id"), nullable=False)

    def __repr__(self):
        return f"<StatCard {self.id}>"


class AnimeStats(Base):
    """AnimeStats model."""

    __tablename__ = "animestats"


class SocialStats(Base):
    """SocialStats model."""

    __tablename__ = "socialstats"


class MangaStats(Base):
    """MangaStats model."""

    __tablename__ = "mangastats"


class AnimeGenres(Base):
    """AnimeGenres model."""

    __tablename__ = "animegenres"


class AnimeTags(Base):
    """AnimeTags model."""

    __tablename__ = "animetags"


class AnimeVoiceActors(Base):
    """AnimeVoiceActors model."""

    __tablename__ = "animevoiceactors"


class AnimeStudios(Base):
    """AnimeStudios model."""

    __tablename__ = "animestudios"


class AnimeStaff(Base):
    """AnimeStaff model."""

    __tablename__ = "animestaff"


class MangaGenres(Base):
    """MangaGenres model."""

    __tablename__ = "mangagenres"


class MangaTags(Base):
    """MangaTags model."""

    __tablename__ = "mangatags"


class MangaStaff(Base):
    """MangaStaff model."""

    __tablename__ = "mangastaff"
