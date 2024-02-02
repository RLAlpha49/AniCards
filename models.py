from database import db

class User(db.Model):
    __tablename__ = 'users'
    __table_args__ = {'schema': 'svg'}
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), nullable=False, unique=True)
    statcards = db.relationship('StatCard', backref='user', lazy=True)

class StatCard(db.Model):
    __tablename__ = 'statcards'
    __table_args__ = {'schema': 'svg'}
    id = db.Column(db.Integer, primary_key=True)
    keys = db.Column(db.String(255), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('svg.users.id'), nullable=False)

class AnimeStats(db.Model):
    __tablename__ = 'animestats'
    __table_args__ = {'schema': 'svg'}
    id = db.Column(db.Integer, primary_key=True)
    data = db.Column(db.Text, nullable=True)
    statcard_id = db.Column(db.Integer, db.ForeignKey('svg.users.id'))

class SocialStats(db.Model):
    __tablename__ = 'socialstats'
    __table_args__ = {'schema': 'svg'}
    id = db.Column(db.Integer, primary_key=True)
    data = db.Column(db.Text, nullable=True)
    statcard_id = db.Column(db.Integer, db.ForeignKey('svg.users.id'))

class MangaStats(db.Model):
    __tablename__ = 'mangastats'
    __table_args__ = {'schema': 'svg'}
    id = db.Column(db.Integer, primary_key=True)
    data = db.Column(db.Text, nullable=True)
    statcard_id = db.Column(db.Integer, db.ForeignKey('svg.users.id'))

class AnimeGenres(db.Model):
    __tablename__ = 'animegenres'
    __table_args__ = {'schema': 'svg'}
    id = db.Column(db.Integer, primary_key=True)
    data = db.Column(db.Text, nullable=True)
    statcard_id = db.Column(db.Integer, db.ForeignKey('svg.users.id'))

class AnimeTags(db.Model):
    __tablename__ = 'animetags'
    __table_args__ = {'schema': 'svg'}
    id = db.Column(db.Integer, primary_key=True)
    data = db.Column(db.Text, nullable=True)
    statcard_id = db.Column(db.Integer, db.ForeignKey('svg.users.id'))

class AnimeVoiceActors(db.Model):
    __tablename__ = 'animevoiceactors'
    __table_args__ = {'schema': 'svg'}
    id = db.Column(db.Integer, primary_key=True)
    data = db.Column(db.Text, nullable=True)
    statcard_id = db.Column(db.Integer, db.ForeignKey('svg.users.id'))

class AnimeStudios(db.Model):
    __tablename__ = 'animestudios'
    __table_args__ = {'schema': 'svg'}
    id = db.Column(db.Integer, primary_key=True)
    data = db.Column(db.Text, nullable=True)
    statcard_id = db.Column(db.Integer, db.ForeignKey('svg.users.id'))

class AnimeStaff(db.Model):
    __tablename__ = 'animestaff'
    __table_args__ = {'schema': 'svg'}
    id = db.Column(db.Integer, primary_key=True)
    data = db.Column(db.Text, nullable=True)
    statcard_id = db.Column(db.Integer, db.ForeignKey('svg.users.id'))

class MangaGenres(db.Model):
    __tablename__ = 'mangagenres'
    __table_args__ = {'schema': 'svg'}
    id = db.Column(db.Integer, primary_key=True)
    data = db.Column(db.Text, nullable=True)
    statcard_id = db.Column(db.Integer, db.ForeignKey('svg.users.id'))

class MangaTags(db.Model):
    __tablename__ = 'mangatags'
    __table_args__ = {'schema': 'svg'}
    id = db.Column(db.Integer, primary_key=True)
    data = db.Column(db.Text, nullable=True)
    statcard_id = db.Column(db.Integer, db.ForeignKey('svg.users.id'))

class MangaStaff(db.Model):
    __tablename__ = 'mangastaff'
    __table_args__ = {'schema': 'svg'}
    id = db.Column(db.Integer, primary_key=True)
    data = db.Column(db.Text, nullable=True)
    statcard_id = db.Column(db.Integer, db.ForeignKey('svg.users.id'))