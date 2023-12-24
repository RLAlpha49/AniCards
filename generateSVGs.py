from markupsafe import Markup
import math
import os
import re

def generate_svg(title, value, y, username):
    if value is None:
        return generate_button(title, y)
    else:
        if title == 'animeStats':
            return generate_animeStats_svg(value, username)
        elif title == 'mangaStats':
            return generate_mangaStats_svg(value, username)
        elif title == 'socialStats':
            return generate_socialStats_svg(value, username)
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

def inline_styles(svg_file, css_file, dasharray, dashoffset):
    with open(css_file, 'r') as f:
        styles = f.read()
        styles = styles.replace('{', '{{').replace('}', '}}')
        styles = styles.replace('{{dasharray}}', str(dasharray)).replace('{{dashoffset}}', str(dashoffset))

    with open(svg_file, 'r') as f:
        svg = f.read()

    # Insert the styles into the SVG file inside a <style> tag
    svg = svg.replace('<defs>', f'<defs><style>{styles}</style>', 1)

    return svg

def generate_animeStats_svg(value, username):
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

    # Read the HTML template
    with open('Pages/templates/SVGs/animeStatsSVG.html', 'r') as file:
        html_template = file.read()

    # Escape the curly braces in the HTML template
    html_template = html_template.replace('{', '{{').replace('}', '}}')

    # Unescape the placeholders that you want to replace
    placeholders = ['username', 'count', 'episodesWatched', 'minutesWatched', 'meanScore', 'standardDeviation', 'current_milestone']
    for placeholder in placeholders:
        html_template = html_template.replace('{{' + placeholder + '}}', '{' + placeholder + '}')

    # Inline the styles
    html_template = inline_styles(
        os.path.join('Pages', 'templates', 'SVGs', 'animeStatsSVG.html'),
        os.path.join('public', 'styles', 'SVGs', 'AnimeStatsStyles.css'),
        dasharray,
        dashoffset
    )

    # Replace the placeholders in the HTML template with actual values
    html = html_template.format(
        username=username,
        current_milestone=current_milestone,
        previous_milestone=previous_milestone,
        **value
    )

    return Markup(html)

def generate_mangaStats_svg(value, username):
    return Markup(f'''
            <svg xmlns="http://www.w3.org/2000/svg">
                <g transform="translate(0, 0)">
                    <text x="0" y="50" font-size="35">Manga Stats: {value}</text>
                </g>
            </svg>
        ''')

def generate_socialStats_svg(value, username):
    return Markup(f'''
            <svg xmlns="http://www.w3.org/2000/svg">
                <g transform="translate(0, 0)">
                    <text x="0" y="50" font-size="35">Social Stats: {value}</text>
                </g>
            </svg>
        ''')