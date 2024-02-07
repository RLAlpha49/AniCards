"""
This module defines the database models for the application.
"""

# pylint: disable=R0903

from database import db


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


class AnimeStats(db.Model):
    """
    AnimeStats model.
    """

    __tablename__ = "animestats"
    __table_args__ = {"schema": "svg"}
    id = db.Column(db.Integer, primary_key=True)
    data = db.Column(db.Text, nullable=True)
    statcard_id = db.Column(db.Integer, db.ForeignKey("svg.users.id"))

    def __repr__(self):
        return f"<AnimeStats {self.id}>"


class SocialStats(db.Model):
    """
    SocialStats model.
    """

    __tablename__ = "socialstats"
    __table_args__ = {"schema": "svg"}
    id = db.Column(db.Integer, primary_key=True)
    data = db.Column(db.Text, nullable=True)
    statcard_id = db.Column(db.Integer, db.ForeignKey("svg.users.id"))

    def __repr__(self):
        return f"<SocialStats {self.id}>"


class MangaStats(db.Model):
    """
    MangaStats model.
    """

    __tablename__ = "mangastats"
    __table_args__ = {"schema": "svg"}
    id = db.Column(db.Integer, primary_key=True)
    data = db.Column(db.Text, nullable=True)
    statcard_id = db.Column(db.Integer, db.ForeignKey("svg.users.id"))

    def __repr__(self):
        return f"<MangaStats {self.id}>"


class AnimeGenres(db.Model):
    """
    AnimeGenres model.
    """

    __tablename__ = "animegenres"
    __table_args__ = {"schema": "svg"}
    id = db.Column(db.Integer, primary_key=True)
    data = db.Column(db.Text, nullable=True)
    statcard_id = db.Column(db.Integer, db.ForeignKey("svg.users.id"))

    def __repr__(self):
        return f"<AnimeGenres {self.id}>"


class AnimeTags(db.Model):
    """
    AnimeTags model.
    """

    __tablename__ = "animetags"
    __table_args__ = {"schema": "svg"}
    id = db.Column(db.Integer, primary_key=True)
    data = db.Column(db.Text, nullable=True)
    statcard_id = db.Column(db.Integer, db.ForeignKey("svg.users.id"))

    def __repr__(self):
        return f"<AnimeTags {self.id}>"


class AnimeVoiceActors(db.Model):
    """
    AnimeVoiceActors model.
    """

    __tablename__ = "animevoiceactors"
    __table_args__ = {"schema": "svg"}
    id = db.Column(db.Integer, primary_key=True)
    data = db.Column(db.Text, nullable=True)
    statcard_id = db.Column(db.Integer, db.ForeignKey("svg.users.id"))

    def __repr__(self):
        return f"<AnimeVoiceActors {self.id}>"


class AnimeStudios(db.Model):
    """
    AnimeStudios model.
    """

    __tablename__ = "animestudios"
    __table_args__ = {"schema": "svg"}
    id = db.Column(db.Integer, primary_key=True)
    data = db.Column(db.Text, nullable=True)
    statcard_id = db.Column(db.Integer, db.ForeignKey("svg.users.id"))

    def __repr__(self):
        return f"<AnimeStudios {self.id}>"


class AnimeStaff(db.Model):
    """
    AnimeStaff model.
    """

    __tablename__ = "animestaff"
    __table_args__ = {"schema": "svg"}
    id = db.Column(db.Integer, primary_key=True)
    data = db.Column(db.Text, nullable=True)
    statcard_id = db.Column(db.Integer, db.ForeignKey("svg.users.id"))

    def __repr__(self):
        return f"<AnimeStaff {self.id}>"


class MangaGenres(db.Model):
    """
    MangaGenres model.
    """

    __tablename__ = "mangagenres"
    __table_args__ = {"schema": "svg"}
    id = db.Column(db.Integer, primary_key=True)
    data = db.Column(db.Text, nullable=True)
    statcard_id = db.Column(db.Integer, db.ForeignKey("svg.users.id"))

    def __repr__(self):
        return f"<MangaGenres {self.id}>"


class MangaTags(db.Model):
    """
    MangaTags model.
    """

    __tablename__ = "mangatags"
    __table_args__ = {"schema": "svg"}
    id = db.Column(db.Integer, primary_key=True)
    data = db.Column(db.Text, nullable=True)
    statcard_id = db.Column(db.Integer, db.ForeignKey("svg.users.id"))

    def __repr__(self):
        return f"<MangaTags {self.id}>"


class MangaStaff(db.Model):
    """
    MangaStaff model.
    """

    __tablename__ = "mangastaff"
    __table_args__ = {"schema": "svg"}
    id = db.Column(db.Integer, primary_key=True)
    data = db.Column(db.Text, nullable=True)
    statcard_id = db.Column(db.Integer, db.ForeignKey("svg.users.id"))

    def __repr__(self):
        return f"<MangaStaff {self.id}>"
