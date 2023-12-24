from markupsafe import Markup
import math

def generate_svg(title, value, y, username):
    if value is None:
        return generate_button(title, y)
    else:
        if title == 'animeStats':
            return generate_animeStats_svg(title, value, username)
        elif title == 'mangaStats':
            return generate_mangaStats_svg(title, value, username)
        elif title == 'socialStats':
            return generate_socialStats_svg(title, value, username)
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

def generate_animeStats_svg(title, value, username):
    # Define milestones
    milestones = [100, 300, 500, 750, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 11000, 12000, 13000, 14000, 15000, 16000, 17000, 18000, 19000, 20000]

    # Determine the previous milestone based on the number of episodes watched
    previous_milestone = max(milestone for milestone in milestones if milestone < value['episodesWatched'])

    # Determine the current milestone based on the number of episodes watched
    current_milestone = min(milestone for milestone in milestones if milestone > value['episodesWatched'])

    percentage = ((value['episodesWatched'] - previous_milestone) / (current_milestone - previous_milestone)) * 100
    circle_circumference = 2 * math.pi * 40
    dasharray = circle_circumference
    dashoffset = circle_circumference * (1 - (percentage / 100))

    return Markup(f'''
        <svg xmlns="http://www.w3.org/2000/svg" width="450" height="195" viewBox="0 0 450 195" fill="none" role="img" aria-labelledby="descId">
            <title id="titleId">{username}'s Anime Stats</title>
            <desc id="descId">Count: {value['count']}, Episodes Watched: {value['episodesWatched']}, Minutes Watched: {value['minutesWatched']}, Mean Score: {value['meanScore']}, Standard Deviation: {value['standardDeviation']}</desc>
            <style xmlns="http://www.w3.org/2000/svg">
                    .header {{
                        font: 600 18px 'Segoe UI', Ubuntu, Sans-Serif;
                        fill: #fe428e;
                        animation: fadeInAnimation 0.8s ease-in-out forwards;
                    }}
                    @supports(-moz-appearance: auto) {{
                        /* Selector detects Firefox */
                        .header {{ font-size: 15.5px; }}
                    }}
                    
                .stat {{
                font: 600 14px 'Segoe UI', Ubuntu, "Helvetica Neue", Sans-Serif; fill: #a9fef7;
                }}
                @supports(-moz-appearance: auto) {{
                /* Selector detects Firefox */
                .stat {{ font-size:12px; }}
                }}
                .stagger {{
                opacity: 0;
                animation: fadeInAnimation 0.3s ease-in-out forwards;
                }}
                .rank-text {{
                font: 800 24px 'Segoe UI', Ubuntu, Sans-Serif; fill: #a9fef7;
                animation: scaleInAnimation 0.3s ease-in-out forwards;
                }}
                .rank-percentile-header {{
                font-size: 14px;
                }}
                .rank-percentile-text {{
                font-size: 16px;
                }}
                
                .not_bold {{ font-weight: 400 }}
                .bold {{ font-weight: 700 }}
                .icon {{
                fill: #f8d847;
                display: none;
                }}

                .rank-circle-rim {{
                stroke: #fe428e;
                fill: none;
                stroke-width: 6;
                opacity: 0.2;
                }}
                .rank-circle {{
                stroke: #fe428e;
                stroke-dasharray: 250;
                fill: none;
                stroke-width: 6;
                stroke-linecap: round;
                opacity: 0.8;
                transform-origin: -10px 8px;
                transform: rotate(-90deg);
                animation: rankAnimation 1s forwards ease-in-out;
                }}
                
                @keyframes rankAnimation {{
                from {{
                    stroke-dashoffset: {dasharray};
                }}
                to {{
                    stroke-dashoffset: {dashoffset};
                }}
                }}
                    
                /* Animations */
                @keyframes scaleInAnimation {{
                    from {{
                    transform: translate(0, 0) scale(0);
                    }}
                    to {{
                    transform: translate(0, 0) scale(1);
                    }}
                }}
                @keyframes fadeInAnimation {{
                    from {{
                    opacity: 0;
                    }}
                    to {{
                    opacity: 1;
                    }}
                }}
            </style>
            <rect data-testid="card-bg" x="0.5" y="0.5" rx="4.5" height="99%" stroke="#e4e2e2" width="449" fill="#141321" stroke-opacity="1"/>
            <g data-testid="card-title" transform="translate(25, 35)">
                <g transform="translate(0, 0)">
                    <text x="0" y="0" class="header" data-testid="header">{username}'s Anime Stats</text>
                </g>
            </g>
            <g data-testid="main-card-body" transform="translate(0, 55)">
                <g transform="translate(375, 37.5)">
                    <circle class="rank-circle-rim" cx="-10" cy="8" r="40"></circle>
                    svg_circle = f'<circle class="rank-circle" cx="-10" cy="8" r="40"></circle>'
                    <text x="-10" y="-50" class="milestone" text-anchor="middle" alignment-baseline="middle" fill="#a9fef7" font-size="15" style="animation: scaleInAnimation 0.5s;">
                        {current_milestone}
                    </text>
                    <text x="-10" y="10" class="episodes-watched" text-anchor="middle" alignment-baseline="middle" fill="#fe428e" font-size="15" style="animation: scaleInAnimation 0.5s;">
                        {value['episodesWatched']}
                    </text>
                    <text x="-10" y="70" class="label" text-anchor="middle" alignment-baseline="middle" fill="#a9fef7" font-size="15" style="animation: scaleInAnimation 0.5s;">
                        Episodes Watched
                    </text>
                </g>
                <svg x="0" y="0">
                    <g transform="translate(0, 0)">
                        <g class="stagger" style="animation-delay: 450ms" transform="translate(25, 0)">
                            <text class="stat bold" y="12.5">Count:</text>
                            <text class="stat bold" x="199.01" y="12.5" data-testid="count">{value['count']}</text>
                        </g>
                        <g class="stagger" style="animation-delay: 600ms" transform="translate(25, 25)">
                            <text class="stat bold" y="12.5">Episodes Watched:</text>
                            <text class="stat bold" x="199.01" y="12.5" data-testid="episodesWatched">{value['episodesWatched']}</text>
                        </g>
                        <g class="stagger" style="animation-delay: 750ms" transform="translate(25, 50)">
                            <text class="stat bold" y="12.5">Minutes Watched:</text>
                            <text class="stat bold" x="199.01" y="12.5" data-testid="minutesWatched">{value['minutesWatched']}</text>
                        </g>
                        <g class="stagger" style="animation-delay: 900ms" transform="translate(25, 75)">
                            <text class="stat bold" y="12.5">Mean Score:</text>
                            <text class="stat bold" x="199.01" y="12.5" data-testid="meanScore">{value['meanScore']}</text>
                        </g>
                        <g class="stagger" style="animation-delay: 1050ms" transform="translate(25, 100)">
                            <text class="stat bold" y="12.5">Standard Deviation:</text>
                            <text class="stat bold" x="199.01" y="12.5" data-testid="standardDeviation">{value['standardDeviation']}</text>
                        </g>
                    </g>
                </svg>
            </g>
            <script xmlns=""/>
        </svg>
    ''')

def generate_mangaStats_svg(title, value, username):
    return Markup(f'''
            <svg xmlns="http://www.w3.org/2000/svg">
                <g transform="translate(0, 0)">
                    <text x="0" y="50" font-size="35">{title}: {value}</text>
                </g>
            </svg>
        ''')

def generate_socialStats_svg(title, value, username):
    return Markup(f'''
            <svg xmlns="http://www.w3.org/2000/svg">
                <g transform="translate(0, 0)">
                    <text x="0" y="50" font-size="35">{title}: {value}</text>
                </g>
            </svg>
        ''')