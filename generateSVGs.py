from markupsafe import Markup
import math
import os
from logger import log_message

def generate_svg(title, value, y, username, colors, type='Default'):
    try:
        log_message(f'Started generating svg for {title}', 'debug')

        if value is None:
            return None
        else:
            if title == 'animeStats':
                return generate_animeStats_svg(value, username, colors, type)
            elif title == 'mangaStats':
                return generate_mangaStats_svg(value, username, colors, type)
            elif title == 'socialStats':
                return generate_socialStats_svg(value, username, colors, type)
            elif title == 'animeGenres':
                return generate_extraAnimeStats_svg(value, username, 'genre', colors, type)
            elif title == 'animeTags':
                return generate_extraAnimeStats_svg(value, username, 'tag', colors, type)
            elif title == 'animeVoiceActors':
                return generate_extraAnimeStats_svg(value, username, 'voiceActor', colors, type)
            elif title == 'animeStudios':
                return generate_extraAnimeStats_svg(value, username, 'studio', colors, type)
            elif title == 'animeStaff':
                return generate_extraAnimeStats_svg(value, username, 'staff', colors, type)
            elif title == 'mangaGenres':
                return generate_extraMangaStats_svg(value, username, 'genre', colors, type)
            elif title == 'mangaTags':
                return generate_extraMangaStats_svg(value, username, 'tag', colors, type)
            elif title == 'mangaStaff':
                return generate_extraMangaStats_svg(value, username, 'staff', colors, type)
            else:
                log_message('Invalid title, generating placeholder svg', 'debug')
                result = Markup(f'''
                    <svg xmlns="http://www.w3.org/2000/svg">
                        <g transform="translate(0, {y})">
                            <text x="0" y="50" font-size="35">{title}: {value}</text>
                        </g>
                    </svg>
                ''')

        log_message(f'SVG generated successfully for {title}', 'info')
        return result

    except Exception as e:
        log_message(f'Error occurred generating svg for {title}: {e}', 'error')

def generate_button(name, y):
    try:
        log_message(f'Started generating button for {name}', 'debug')

        button_markup = Markup(f'''
            <svg xmlns="http://www.w3.org/2000/svg">
                <g transform="translate(0, {y})" onclick="fetchData('{name}', 'username')" style="cursor: pointer;">
                    <rect x="0" y="0" width="500" height="100" style="fill:blue;stroke:black;stroke-width:1;fill-opacity:0.1;stroke-opacity:0.9" />
                    <text x="250" y="50" text-anchor="middle" font-size="35">Retry</text>
                </g>
            </svg>
        ''')

        log_message(f'Button markup generated successfully for {name}', 'info')

        return button_markup

    except Exception as e:
        log_message(f'Error occurred generating button for {name}: {e}', 'error')

def fetch_data(name, username):
    # This function needs to be implemented in Python
    pass

def inline_styles(svg_file, css_file, dasharray, dashoffset, colors):
    try:
        log_message('Started inlining styles into svg', 'debug')

        with open(css_file, 'r') as f:
            styles = f.read()
            styles = styles.replace('{', '{{').replace('}', '}}')
            styles = styles.replace('{{dasharray}}', str(dasharray)).replace('{{dashoffset}}', str(dashoffset))
            styles = styles.replace('{{title_color}}', colors[0])
            styles = styles.replace('{{background_color}}', colors[2])
            styles = styles.replace('{{text_color}}', colors[3])
            styles = styles.replace('{{circle_color}}', colors[1])

        log_message('Styles read and replaced successfully', 'info')

        with open(svg_file, 'r') as f:
            svg = f.read()

        log_message('SVG file read successfully', 'info')

        # Insert the styles into the SVG file inside a <style> tag
        svg = svg.replace('<defs>', f'<defs><style>{styles}</style>', 1)

        log_message('Styles inlined into SVG successfully', 'info')

        return svg

    except Exception as e:
        log_message(f'Error occurred inlining styles into SVG: {e}', 'error')

def generate_animeStats_svg(value, username, colors, type):
    try:
        log_message(f'Started generating anime stats svg for {username}', 'debug')

        if type == 'Default':
            # Initialize milestones list with the first three milestones
            milestones = [100, 300, 500]

            # Determine the maximum milestone based on the number of episodes watched
            max_milestone = ((value['episodesWatched'] // 1000) + 1) * 1000

            # Generate the rest of the milestones
            for i in range(1000, max_milestone + 1, 1000):
                milestones.append(i)

            # Determine the previous milestone based on the number of episodes watched
            previous_milestone = max(milestone for milestone in milestones if milestone < value['episodesWatched'])

            # Determine the current milestone based on the number of episodes watched
            current_milestone = min(milestone for milestone in milestones if milestone > value['episodesWatched'])

            percentage = ((value['episodesWatched'] - previous_milestone) / (current_milestone - previous_milestone)) * 100
            circle_circumference = 2 * math.pi * 40
            dasharray = circle_circumference
            dashoffset = circle_circumference * (1 - (percentage / 100))

            log_message(f'Milestones calculated successfully for {username}', 'info')

            # Read the HTML template
            with open('Pages/SVGs/animeStatsSVG.html', 'r') as file:
                html_template = file.read()

            # Escape the curly braces in the HTML template
            html_template = html_template.replace('{', '{{').replace('}', '}}')

            # Unescape the placeholders that you want to replace
            placeholders = ['username', 'count', 'episodesWatched', 'minutesWatched', 'meanScore', 'standardDeviation', 'current_milestone']
            for placeholder in placeholders:
                html_template = html_template.replace('{{' + placeholder + '}}', '{' + placeholder + '}')

            # Inline the styles
            html_template = inline_styles(
                os.path.join('Pages', 'SVGs', 'animeStatsSVG.html'),
                os.path.join('public', 'styles', 'SVGs', 'DefaultStatsStyles.css'),
                dasharray,
                dashoffset,
                colors
            )

            log_message(f'Styles inlined successfully for {username}', 'info')

            # Replace the placeholders in the HTML template with actual values
            html = html_template.format(
                username=username,
                current_milestone=current_milestone,
                previous_milestone=previous_milestone,
                **value
            )

            log_message(f'HTML template generated successfully for {username}', 'info')

            return Markup(html)

    except Exception as e:
        log_message(f'Error occurred generating anime stats svg for {username}: {e}', 'error')

def calculate_font_size(text, initial_font_size, max_width):
    try:
        log_message(f'Started calculating font size for text: {text}', 'debug')

        scaling_factor = 0.6  # Adjust this value based on your specific font
        estimated_text_width = len(text) * initial_font_size * scaling_factor

        while estimated_text_width > max_width:
            initial_font_size -= 1
            estimated_text_width = len(text) * initial_font_size * scaling_factor

        log_message(f'Font size calculated successfully for text: {text}', 'info')

        return initial_font_size

    except Exception as e:
        log_message(f'Error occurred calculating font size for text: {text}: {e}', 'error')


def generate_extraAnimeStats_svg(value, username, key, colors, type):
    try:
        log_message(f'started generating extra anime svg for {username}', 'debug')

        if type == 'Default':
            # Read the HTML template
            with open('Pages/SVGs/animeStatsSVG.html', 'r') as file:
                html_template = file.read()

            log_message(f'HTML template read successfully for {username}', 'info')

            # Escape the curly braces in the HTML template
            html_template = html_template.replace('{', '{{').replace('}', '}}')

            # Unescape the placeholders that you want to replace
            placeholders = ['username', 'count', 'data1', 'data2', 'data3', 'data4', 'data5', 'headerStyle']
            for placeholder in placeholders:
                html_template = html_template.replace('{{' + placeholder + '}}', '{' + placeholder + '}')

            log_message(f'Placeholders replaced successfully for {username}', 'info')

            # Inline the styles
            html_template = inline_styles(
                os.path.join('Pages', 'SVGs', 'extraAnime&MangaStatsSVG.html'),
                os.path.join('public', 'styles', 'SVGs', 'DefaultStatsStyles.css'),
                0,  # dasharray is not used in this SVG
                0,   # dashoffset is not used in this SVG
                colors
            )

            log_message(f'Styles inlined successfully for {username}', 'info')

            # Calculate the font size
            text = f"{username}'s Top Manga {key.capitalize()}s"
            initial_font_size = 18
            max_width = 320
            font_size = calculate_font_size(text, initial_font_size, max_width)

            log_message(f'Font size calculated successfully for {username}', 'info')

            # Generate the CSS rules for the header class
            header_style = f"font-weight: 600; font-family: 'Segoe UI', Ubuntu, Sans-Serif; fill: #fe428e; animation: fadeInAnimation 0.8s ease-in-out forwards; font-size: {font_size}px;"
            
            # Replace the placeholders in the HTML template with actual values
            html = html_template.format(
                username=username,
                type="Voice Actor" if key == 'voiceActor' else key.capitalize(),
                format='Anime',
                key1=value[0][key],
                data1=value[0]['count'],
                key2=value[1][key],
                data2=value[1]['count'],
                key3=value[2][key],
                data3=value[2]['count'],
                key4=value[3][key],
                data4=value[3]['count'],
                key5=value[4][key],
                data5=value[4]['count'],
                headerStyle=header_style
            )

            log_message(f'HTML template generated successfully for {username}', 'info')

            return Markup(html)

    except Exception as e:
        log_message(f'Error occurred generated extra anime stats svg for {username}: {e}', 'error')

def generate_mangaStats_svg(value, username, colors, type):
    try:
        log_message(f'Started generating manga stats svg for {username}', 'debug')

        if type == 'Default':
            # Initialize milestones list with the first three milestones
            milestones = [100, 300, 500]

            # Determine the maximum milestone based on the number of episodes watched
            max_milestone = ((value['chaptersRead'] // 1000) + 1) * 1000

            # Generate the rest of the milestones
            for i in range(1000, max_milestone + 1, 1000):
                milestones.append(i)

            # Determine the previous milestone based on the number of episodes watched
            previous_milestone = max(milestone for milestone in milestones if milestone < value['chaptersRead'])

            # Determine the current milestone based on the number of episodes watched
            current_milestone = min(milestone for milestone in milestones if milestone > value['chaptersRead'])

            percentage = ((value['chaptersRead'] - previous_milestone) / (current_milestone - previous_milestone)) * 100
            circle_circumference = 2 * math.pi * 40
            dasharray = circle_circumference
            dashoffset = circle_circumference * (1 - (percentage / 100))

            log_message(f'Milestones calculated successfully for {username}', 'info')

            # Read the HTML template
            with open('Pages/SVGs/mangaStatsSVG.html', 'r') as file:
                html_template = file.read()

            log_message(f'HTML template read successfully for {username}', 'info')

            # Escape the curly braces in the HTML template
            html_template = html_template.replace('{', '{{').replace('}', '}}')

            # Unescape the placeholders that you want to replace
            placeholders = ['username', 'count', 'chaptersRead', 'volumesRead', 'meanScore', 'standardDeviation', 'current_milestone']
            for placeholder in placeholders:
                html_template = html_template.replace('{{' + placeholder + '}}', '{' + placeholder + '}')

            log_message(f'Placeholders replaced successfully for {username}', 'info')

            # Inline the styles
            html_template = inline_styles(
                os.path.join('Pages', 'SVGs', 'mangaStatsSVG.html'),
                os.path.join('public', 'styles', 'SVGs', 'DefaultStatsStyles.css'),
                dasharray,
                dashoffset,
                colors
            )

            log_message(f'Styles inlined successfully for {username}', 'info')

            # Replace the placeholders in the HTML template with actual values
            html = html_template.format(
                username=username,
                current_milestone=current_milestone,
                previous_milestone=previous_milestone,
                **value
            )

            log_message(f'HTML template generated successfully for {username}', 'info')

            return Markup(html)

    except Exception as e:
        log_message(f'Error occurred generating manga stats svg for {username}: {e}', 'error')

def generate_extraMangaStats_svg(value, username, key, colors, type):
    try:
        log_message(f'Started generating extra manga stats svg for {username}', 'debug')

        if type == 'Default':
            # Read the HTML template
            with open('Pages/SVGs/mangaStatsSVG.html', 'r') as file:
                html_template = file.read()

            log_message(f'HTML template read successfully for {username}', 'info')

            # Escape the curly braces in the HTML template
            html_template = html_template.replace('{', '{{').replace('}', '}}')

            # Unescape the placeholders that you want to replace
            placeholders = ['username', 'count', 'data1', 'data2', 'data3', 'data4', 'data5', 'headerStyle']
            for placeholder in placeholders:
                html_template = html_template.replace('{{' + placeholder + '}}', '{' + placeholder + '}')

            log_message(f'Placeholders replaced successfully for {username}', 'info')

            # Inline the styles
            html_template = inline_styles(
                os.path.join('Pages', 'SVGs', 'extraAnime&MangaStatsSVG.html'),
                os.path.join('public', 'styles', 'SVGs', 'DefaultStatsStyles.css'),
                0,  # dasharray is not used in this SVG
                0,   # dashoffset is not used in this SVG
                colors
            )

            log_message(f'Styles inlined successfully for {username}', 'info')

            # Calculate the font size
            text = f"{username}'s Top Manga {key.capitalize()}s"
            initial_font_size = 18
            max_width = 320
            font_size = calculate_font_size(text, initial_font_size, max_width)

            log_message(f'Font size calculated successfully for {username}', 'info')

            # Generate the CSS rules for the header class
            header_style = f"font-weight: 600; font-family: 'Segoe UI', Ubuntu, Sans-Serif; fill: #fe428e; animation: fadeInAnimation 0.8s ease-in-out forwards; font-size: {font_size}px;"

            # Replace the placeholders in the HTML template with actual values
            html = html_template.format(
                username=username,
                type='Voice Actor' if key == 'voiceActor' else key.capitalize(),
                format='Manga',
                key1=value[0][key],
                data1=value[0]['count'],
                key2=value[1][key],
                data2=value[1]['count'],
                key3=value[2][key],
                data3=value[2]['count'],
                key4=value[3][key],
                data4=value[3]['count'],
                key5=value[4][key],
                data5=value[4]['count'],
                headerStyle=header_style
            )

            log_message(f'HTML template generated successfully for {username}', 'info')

            return Markup(html)

    except Exception as e:
        log_message(f'Error occurred generating extra manga stats svg for {username}: {e}', 'error')

def generate_socialStats_svg(value, username, colors, type):
    try:
        log_message(f'Started generating social stats svg for {username}', 'debug')

        if type == 'Default':
            # Read the HTML template
            with open('Pages/SVGs/socialStatsSVG.html', 'r') as file:
                html_template = file.read()

            log_message(f'HTML template read successfully for {username}', 'info')

            # Escape the curly braces in the HTML template
            html_template = html_template.replace('{', '{{').replace('}', '}}')

            # Unescape the placeholders that you want to replace
            placeholders = ['username', 'totalFollowers', 'totalFollowing', 'totalActivity']
            for placeholder in placeholders:
                html_template = html_template.replace('{{' + placeholder + '}}', '{' + placeholder + '}')

            log_message(f'Placeholders replaced successfully for {username}', 'info')

            # Inline the styles
            html_template = inline_styles(
                os.path.join('Pages', 'SVGs', 'socialStatsSVG.html'),
                os.path.join('public', 'styles', 'SVGs', 'DefaultStatsStyles.css'),
                0,  # dasharray is not used in this SVG
                0,   # dashoffset is not used in this SVG
                colors
            )

            log_message(f'Styles inlined successfully for {username}', 'info')

            # Replace the placeholders in the HTML template with actual values
            html = html_template.format(
                username=username,
                **value
            )

            log_message(f'HTML template generated successfully for {username}', 'info')

            return Markup(html)

    except Exception as e:
        log_message(f'Error occurred generating social stats svg for {username}: {e}', 'error')