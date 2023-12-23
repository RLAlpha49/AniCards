from markupsafe import Markup

def generate_svgs(data, keys):
    svg_keys = keys.split(',')
    svgs = {}
    y = 0

    for key in svg_keys:
        svg = generate_svg(key, data.get(key), y)
        svgs[key] = svg
        y += 100  # Increase y by the height of each SVG

    return svgs

def generate_svg(title, value, y):
    if value is None:
        return generate_button(title, y)
    else:
        return Markup(f'''
            <svg xmlns="http://www.w3.org/2000/svg">
                <g transform="translate(0, {y})">
                    <text x="0" y="50" font-size="35">{title}: {value}</text>
                </g>
            </svg>
        ''')

def generate_button(name, y):
    return Markup(f'''
        <g transform="translate(0, {y})" onclick="fetchData('{name}', 'username')" style="cursor: pointer;">
            <rect x="0" y="0" width="500" height="100" style="fill:blue;stroke:black;stroke-width:1;fill-opacity:0.1;stroke-opacity:0.9" />
            <text x="250" y="50" text-anchor="middle" font-size="35">Retry</text>
        </g>
    ''')

def fetch_data(name, username):
    # This function needs to be implemented in Python
    pass

def generate_anime_count_svg(data):
    return generate_svg('Watched anime count', data.get('animeCount'), 50)

def generate_episodes_watched_svg(data):
    return generate_svg('Total episodes watched', data.get('episodesWatched'), 550)

def generate_hours_watched_svg(data):
    return generate_svg('Total hours watched', data.get('hoursWatched'), 650)

def generate_manga_count_svg(data):
    return generate_svg('Total manga read', data.get('mangaCount'), 350)

def generate_chapters_read_svg(data):
    return generate_svg('Total chapters read', data.get('chaptersRead'), 450)

def generate_total_followers_svg(data):
    return generate_svg('Total followers', data.get('totalFollowers'), 150)

def generate_total_following_svg(data):
    return generate_svg('Total following', data.get('totalFollowing'), 250)