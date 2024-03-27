# pylint: disable=C0103, W0718
"""
This module is used to generate SVG html.
"""

import math
import os

from markupsafe import Markup  # pylint: disable=E0401
from src.Program.Utils.logger import log_message  # pylint: disable=E0401


def generate_svg(title, value, username, colors, card_type="Default"):
    """
    Generates an SVG based on the provided title, value, y, username, colors, and card_type.
    Parameters:
    title (str): The title of the SVG.
    value (str): The value to be displayed in the SVG.
    y (int): The y-coordinate for the SVG.
    username (str): The username to be displayed in the SVG.
    colors (str): The colors to be used in the SVG.
    card_type (str, optional): The type of the card. Defaults to "Default".
    Returns:
    str: The generated SVG.
    """
    try:
        log_message(f"Started generating svg for {title}", "debug")

        if value is None:
            return None

        title_to_function = {
            "animeStats": generate_animeStats_svg,
            "mangaStats": generate_mangaStats_svg,
            "socialStats": generate_socialStats_svg,
            "animeGenres": lambda v, u, c, t: generate_extraAnimeStats_svg(
                v, u, "genre", c, t
            ),
            "animeTags": lambda v, u, c, t: generate_extraAnimeStats_svg(
                v, u, "tag", c, t
            ),
            "animeVoiceActors": lambda v, u, c, t: generate_extraAnimeStats_svg(
                v, u, "voiceActor", c, t
            ),
            "animeStudios": lambda v, u, c, t: generate_extraAnimeStats_svg(
                v, u, "studio", c, t
            ),
            "animeStaff": lambda v, u, c, t: generate_extraAnimeStats_svg(
                v, u, "staff", c, t
            ),
            "mangaGenres": lambda v, u, c, t: generate_extraMangaStats_svg(
                v, u, "genre", c, t
            ),
            "mangaTags": lambda v, u, c, t: generate_extraMangaStats_svg(
                v, u, "tag", c, t
            ),
            "mangaStaff": lambda v, u, c, t: generate_extraMangaStats_svg(
                v, u, "staff", c, t
            ),
        }

        function_to_execute = title_to_function.get(title)

        if function_to_execute is not None:
            result = function_to_execute(value, username, colors, card_type)
        else:
            log_message("Invalid title, generating placeholder svg", "debug")
            result = Markup(
                f"""
                <svg xmlns="http://www.w3.org/2000/svg">
                    <g transform="translate(0, 0)">
                        <text x="0" y="50" font-size="35">{title}: {value}</text>
                    </g>
                </svg>
            """
            )

        log_message(f"SVG generated successfully for {title}", "info")
        return result

    except Exception as e:
        log_message(f"Error occurred generating svg for {title}: {e}", "error")
        raise e


def generate_button(name, y):
    """
    Generates an SVG button with the provided name and y-coordinate.
    Parameters:
    name (str): The name to be displayed on the button.
    y (int): The y-coordinate for the button.
    Returns:
    Markup: The generated SVG button.
    """
    try:
        log_message(f"Started generating button for {name}", "debug")

        # pylint: disable=C0301
        button_markup = Markup(
            f"""
            <svg xmlns="http://www.w3.org/2000/svg">
                <g transform="translate(0, {y})" onclick="fetchData('{name}', 'username')" style="cursor: pointer;">
                    <rect x="0" y="0" width="500" height="100"
                          style="fill:blue;stroke:black;stroke-width:1;fill-opacity:0.1;stroke-opacity:0.9" />
                    <text x="250" y="50" text-anchor="middle" font-size="35">Retry</text>
                </g>
            </svg>
            """
        )
        # pylint: enable=C0301

        log_message(f"Button markup generated successfully for {name}", "info")

        return button_markup

    except Exception as e:
        log_message(f"Error occurred generating button for {name}: {e}", "error")
        raise e


# def fetch_data(name, username):  # pylint: disable=W0613, C0116
#     # This function needs to be implemented
#     pass


def generate_base_stats_html(  # pylint: disable=R0913
    html_path,
    placeholders,
    styles_path,
    css_path,
    dasharray,
    dashoffset,
    colors,
    username,
    current_milestone,
    previous_milestone,
    **values,
):
    """
    Generate HTML by replacing placeholders in a template with actual values.

    Args:
        html_path (str): The path to the HTML template.
        placeholders (list): The placeholders to replace in the HTML template.
        styles_path (str): The path to the styles.
        css_path (str): The path to the CSS file.
        dasharray (str): The 'stroke-dasharray' property for the SVG.
        dashoffset (str): The 'stroke-dashoffset' property for the SVG.
        colors (list): The colors for the SVG.
        username (str): The username.
        current_milestone (str): The current milestone.
        previous_milestone (str): The previous milestone.
        **values: The values to replace the placeholders with.

    Returns:
        str: The generated HTML.
    """
    # Read the HTML template
    with open(html_path, "r", encoding="utf-8") as file:
        html_template = file.read()

    log_message(f"HTML template read successfully for {username}", "info")

    # Escape the curly braces in the HTML template
    html_template = html_template.replace("{", "{{").replace("}", "}}")

    # Unescape the placeholders that you want to replace
    for placeholder in placeholders:
        html_template = html_template.replace(
            "{{" + placeholder + "}}", "{" + placeholder + "}"
        )

    # Inline the styles
    html_template = inline_styles(
        styles_path,
        css_path,
        dasharray,
        dashoffset,
        colors,
    )

    log_message(f"Styles inlined successfully for {username}", "debug")

    # Replace the placeholders in the HTML template with actual values
    html = html_template.format(
        username=username,
        current_milestone=current_milestone,
        previous_milestone=previous_milestone,
        **values,
    )

    return html


def generate_default_base_stats_html(
    html_path,
    placeholders,
    styles_path,
    dasharray,
    dashoffset,
    colors,
    username,
    current_milestone,
    previous_milestone,
    **value,
):  # pylint: disable=R0913
    """
    Generates the default base statistics HTML for a given user.

    Parameters:
    html_path (str): The path to the HTML template.
    placeholders (list): A list of placeholders to replace in the HTML template.
    styles_path (str): The path to the styles for the HTML template.
    dasharray (str): The dasharray value for the SVG.
    dashoffset (str): The dashoffset value for the SVG.
    colors (list): A list of color values to be used in the SVG.
    username (str): The username of the user.
    current_milestone (str): The current milestone of the user.
    previous_milestone (str): The previous milestone of the user.
    value (dict): Additional values to replace in the HTML template.

    Returns:
    str: The generated HTML as a string, or None if an error occurred.
    """
    css_path = os.path.join("public", "styles", "SVGs", "DefaultStatsStyles.css")

    # Call the function
    html = generate_base_stats_html(
        html_path=html_path,
        placeholders=placeholders,
        styles_path=styles_path,
        css_path=css_path,
        dasharray=dasharray,
        dashoffset=dashoffset,
        colors=colors,
        username=username,
        current_milestone=current_milestone,
        previous_milestone=previous_milestone,
        **value,
    )

    if html:
        log_message(f"HTML template generated successfully for {username}", "info")
        return html
    return None


def generate_extra_stats_html(
    value, username, key, colors, svg_type, stats_type
):  # pylint: disable=R0913
    """
    Generates an SVG representation of extra statistics for a given user.
    Parameters:
    value (list): A list of dictionaries containing the extra statistics for the user.
    username (str): The username of the user.
    key (str): The key to be used in the statistics.
    colors (list): A list of color values to be used in the SVG.
    svg_type (str): The type of SVG to generate.
    stats_type (str): The type of statistics to generate ("Anime" or "Manga").
    Returns:
    Markup: The generated SVG as a Markup object, or None if an error occurred.
    """
    try:
        log_message(
            f"Started generating extra {stats_type.lower()} stats svg for {username}",
            "debug",
        )

        if svg_type == "Default":
            # Read the HTML template
            with open(
                f"Pages/SVGs/{stats_type.lower()}StatsSVG.html", "r", encoding="utf-8"
            ) as file:
                html_template = file.read()

            log_message(f"HTML template read successfully for {username}", "info")

            # Escape the curly braces in the HTML template
            html_template = html_template.replace("{", "{{").replace("}", "}}")

            # Unescape the placeholders that you want to replace
            placeholders = [
                "username",
                "count",
                "data1",
                "data2",
                "data3",
                "data4",
                "data5",
                "headerStyle",
            ]
            for placeholder in placeholders:
                html_template = html_template.replace(
                    "{{" + placeholder + "}}", "{" + placeholder + "}"
                )

            log_message(f"Placeholders replaced successfully for {username}", "debug")

            # Inline the styles and calculate the font size
            html_template, font_size = inline_styles_and_calculate_font_size(
                username, colors, key
            )

            # Generate the CSS rules for the header class
            header_style = f"""font-weight: 600;
                        font-family: 'Segoe UI', Ubuntu, Sans-Serif;
                        fill: #fe428e;
                        animation: fadeInAnimation 0.8s ease-in-out forwards;
                        font-size: {font_size}px;"""

            # Replace the placeholders in the HTML template with actual values
            html = html_template.format(
                username=username,
                type=(
                    "Voice Actors"
                    if key == "voiceActor"
                    else (
                        key.capitalize()
                        if key.capitalize() == "Staff"
                        else key.capitalize() + "s"
                    )
                ),
                format=stats_type,
                key1=value[0][key],
                data1=value[0]["count"],
                key2=value[1][key],
                data2=value[1]["count"],
                key3=value[2][key],
                data3=value[2]["count"],
                key4=value[3][key],
                data4=value[3]["count"],
                key5=value[4][key],
                data5=value[4]["count"],
                headerStyle=header_style,
            )

            log_message(f"HTML template generated successfully for {username}", "info")

            return Markup(html)
        return None
    except Exception as e:
        log_message(
            f"Error occurred generating extra {stats_type.lower()} stats svg for {username}: {e}",
            "error",
        )
        raise e


def inline_styles(svg_file, css_file, dasharray, dashoffset, colors):
    """
    Inlines styles into an SVG file from a CSS file.
    Parameters:
    svg_file (str): The path to the SVG file.
    css_file (str): The path to the CSS file.
    dasharray (int): The dasharray value to be used in the styles.
    dashoffset (int): The dashoffset value to be used in the styles.
    colors (list): A list of color values to be used in the styles.
    Returns:
    str: The SVG file with inlined styles, or None if an error occurred.
    """
    try:
        log_message("Started inlining styles into svg", "debug")

        with open(css_file, "r", encoding="utf-8") as f:
            styles = f.read()
            styles = styles.replace("{", "{{").replace("}", "}}")
            styles = styles.replace("{{dasharray}}", str(dasharray)).replace(
                "{{dashoffset}}", str(dashoffset)
            )
            styles = styles.replace("{{title_color}}", colors[0])
            styles = styles.replace("{{background_color}}", colors[1])
            styles = styles.replace("{{text_color}}", colors[2])
            styles = styles.replace("{{circle_color}}", colors[3])

        log_message("Styles read and replaced successfully", "debug")

        with open(svg_file, "r", encoding="utf-8") as f:
            svg = f.read()

        log_message("SVG file read successfully", "debug")

        # Insert the styles into the SVG file inside a <style> tag
        svg = svg.replace("<defs>", f"<defs><style>{styles}</style>", 1)

        log_message("Styles inlined into SVG successfully", "debug")

        return svg

    except Exception as e:
        log_message(f"Error occurred inlining styles into SVG: {e}", "error")
        raise e


def calculate_milestones(value, key):
    """
    Calculate milestones, percentage, circle circumference, dasharray, and
    dashoffset based on the number of a given key.

    Parameters:
    value (dict): A dictionary containing the statistics for the user.
    key (str): The key in the dictionary to calculate milestones for.

    Returns:
    tuple: A tuple containing previous milestone, current milestone, dasharray,
    and dashoffset.
    """
    # Initialize milestones list with the first five milestones
    milestones = [100, 250, 500, 750, 1000]

    # Determine the maximum milestone based on the number of the given key
    max_milestone = ((value[key] // 1000) + 1) * 1000

    # Generate the rest of the milestones
    for i in range(1000, max_milestone + 1, 1000):
        milestones.append(i)

    # Determine the previous milestone based on the number of the given key
    previous_milestone = max(
        (milestone for milestone in milestones if milestone < value[key]), default=0
    )

    # Determine the current milestone based on the number of the given key
    current_milestone = min(
        (milestone for milestone in milestones if milestone >= value[key]), default=100
    )

    # Calculate percentage
    percentage = (
        (value[key] - previous_milestone) / (current_milestone - previous_milestone)
    ) * 100

    # Calculate circle circumference
    circle_circumference = 2 * math.pi * 40

    # Calculate dasharray
    dasharray = circle_circumference

    # Calculate dashoffset
    dashoffset = circle_circumference * (1 - (percentage / 100))

    return previous_milestone, current_milestone, dasharray, dashoffset


def generate_animeStats_svg(value, username, colors, svg_type):
    """
    Generates an SVG representation of anime statistics for a given user.
    Parameters:
    value (dict): A dictionary containing the anime statistics for the user.
    username (str): The username of the user.
    colors (list): A list of color values to be used in the SVG.
    type (str): The type of SVG to generate.
    Returns:
    Markup: The generated SVG as a Markup object, or None if an error occurred.
    """
    try:
        log_message(f"Started generating anime stats svg for {username}", "debug")

        if svg_type == "Default":
            (
                previous_milestone,
                current_milestone,
                dasharray,
                dashoffset,
            ) = calculate_milestones(value, "episodesWatched")

            log_message(f"Milestones calculated successfully for {username}", "debug")

            # Define the placeholders
            placeholders = [
                "username",
                "count",
                "episodesWatched",
                "minutesWatched",
                "meanScore",
                "standardDeviation",
                "current_milestone",
            ]

            # Define the paths
            html_path = "Pages/SVGs/animeStatsSVG.html"
            styles_path = os.path.join("Pages", "SVGs", "animeStatsSVG.html")
            html = generate_default_base_stats_html(
                html_path,
                placeholders,
                styles_path,
                dasharray,
                dashoffset,
                colors,
                username,
                current_milestone,
                previous_milestone,
                **value,
            )

            return Markup(html)
        return None
    except Exception as e:
        log_message(
            f"Error occurred generating anime stats svg for {username}: {e}", "error"
        )
        raise e


def calculate_font_size(text, initial_font_size, max_width):
    """
    Generates an SVG representation of anime statistics for a given user.
    Parameters:
    value (dict): A dictionary containing the anime statistics for the user.
    username (str): The username of the user.
    colors (list): A list of color values to be used in the SVG.
    type (str): The type of SVG to generate.
    Returns:
    Markup: The generated SVG as a Markup object, or None if an error occurred.
    """
    try:
        log_message(f"Started calculating font size for text: {text}", "debug")

        scaling_factor = 0.6  # Adjust this value based on your specific font
        estimated_text_width = len(text) * initial_font_size * scaling_factor
        while estimated_text_width > max_width:
            initial_font_size -= 1
            estimated_text_width = len(text) * initial_font_size * scaling_factor

        log_message(f"Font size calculated successfully for text: {text}", "debug")

        return initial_font_size

    except Exception as e:
        log_message(
            f"Error occurred calculating font size for text: {text}: {e}", "error"
        )
        raise e


def inline_styles_and_calculate_font_size(username, colors, key):
    """
    Inline the styles and calculate the font size for the SVG.

    Parameters:
    username (str): The username of the user.
    colors (list): A list of color values to be used in the SVG.
    key (str): The key to be used in the statistics.

    Returns:
    tuple: A tuple containing the HTML template with inlined styles and the calculated font size.
    """
    # Inline the styles
    html_template = inline_styles(
        os.path.join("Pages", "SVGs", "extraAnime&MangaStatsSVG.html"),
        os.path.join("public", "styles", "SVGs", "DefaultStatsStyles.css"),
        0,  # dasharray is not used in this SVG
        0,  # dashoffset is not used in this SVG
        colors,
    )

    log_message(f"Styles inlined successfully for {username}", "debug")

    # Calculate the font size
    text = f"{username}'s Top Manga {key.capitalize()}s"
    initial_font_size = 18
    max_width = 320
    font_size = calculate_font_size(text, initial_font_size, max_width)

    log_message(f"Font size calculated successfully for {username}", "debug")

    return html_template, font_size


def generate_extraAnimeStats_svg(value, username, key, colors, svg_type):
    """
    Generates an SVG representation of extra anime statistics for a given user.
    Parameters:
    value (list): A list of dictionaries containing the extra anime statistics for the user.
    username (str): The username of the user.
    key (str): The key to be used in the statistics.
    colors (list): A list of color values to be used in the SVG.
    type (str): The type of SVG to generate.
    Returns:
    Markup: The generated SVG as a Markup object, or None if an error occurred.
    """
    return generate_extra_stats_html(value, username, key, colors, svg_type, "Anime")


def generate_mangaStats_svg(value, username, colors, svg_type):
    """
    Generates an SVG representation of manga statistics for a given user.
    Parameters:
    value (dict): A dictionary containing the manga statistics for the user.
    username (str): The username of the user.
    colors (list): A list of color values to be used in the SVG.
    svg_type (str): The type of SVG to generate.
    Returns:
    Markup: The generated SVG as a Markup object, or None if an error occurred.
    """
    try:
        log_message(f"Started generating manga stats svg for {username}", "debug")

        if svg_type == "Default":
            (
                previous_milestone,
                current_milestone,
                dasharray,
                dashoffset,
            ) = calculate_milestones(value, "chaptersRead")

            log_message(f"Milestones calculated successfully for {username}", "debug")

            # Define the placeholders
            placeholders = [
                "username",
                "count",
                "chaptersRead",
                "volumesRead",
                "meanScore",
                "standardDeviation",
                "current_milestone",
            ]

            # Define the paths
            html_path = "Pages/SVGs/mangaStatsSVG.html"
            styles_path = os.path.join("Pages", "SVGs", "mangaStatsSVG.html")
            html = generate_default_base_stats_html(
                html_path,
                placeholders,
                styles_path,
                dasharray,
                dashoffset,
                colors,
                username,
                current_milestone,
                previous_milestone,
                **value,
            )

            return Markup(html)
        return None

    except Exception as e:
        log_message(
            f"Error occurred generating manga stats svg for {username}: {e}", "error"
        )
        raise e


def generate_extraMangaStats_svg(value, username, key, colors, svg_type):
    """
    Generates an SVG representation of extra manga statistics for a given user.
    Parameters:
    value (list): A list of dictionaries containing the extra manga statistics for the user.
    username (str): The username of the user.
    key (str): The key to be used in the statistics.
    colors (list): A list of color values to be used in the SVG.
    type (str): The type of SVG to generate.
    Returns:
    Markup: The generated SVG as a Markup object, or None if an error occurred.
    """
    return generate_extra_stats_html(value, username, key, colors, svg_type, "Manga")


def generate_socialStats_svg(value, username, colors, svg_type):
    """
    Generates an SVG representation of social statistics for a given user.
    Parameters:
    value (dict): A dictionary containing the social statistics for the user.
    username (str): The username of the user.
    colors (list): A list of color values to be used in the SVG.
    type (str): The type of SVG to generate.
    Returns:
    Markup: The generated SVG as a Markup object, or None if an error occurred.
    """
    try:
        log_message(f"Started generating social stats svg for {username}", "debug")

        if svg_type == "Default":
            # Read the HTML template
            with open("Pages/SVGs/socialStatsSVG.html", "r", encoding="utf-8") as file:
                html_template = file.read()

            log_message(f"HTML template read successfully for {username}", "info")

            # Escape the curly braces in the HTML template
            html_template = html_template.replace("{", "{{").replace("}", "}}")

            # Unescape the placeholders that you want to replace
            placeholders = [
                "username",
                "totalFollowers",
                "totalFollowing",
                "totalActivity",
            ]
            for placeholder in placeholders:
                html_template = html_template.replace(
                    "{{" + placeholder + "}}", "{" + placeholder + "}"
                )

            log_message(f"Placeholders replaced successfully for {username}", "debug")

            # Inline the styles
            html_template = inline_styles(
                os.path.join("Pages", "SVGs", "socialStatsSVG.html"),
                os.path.join("public", "styles", "SVGs", "DefaultStatsStyles.css"),
                0,  # dasharray is not used in this SVG
                0,  # dashoffset is not used in this SVG
                colors,
            )

            log_message(f"Styles inlined successfully for {username}", "debug")

            # Replace the placeholders in the HTML template with actual values
            html = html_template.format(username=username, **value)

            log_message(f"HTML template generated successfully for {username}", "info")

            return Markup(html)
        return None
    except Exception as e:
        log_message(
            f"Error occurred generating social stats svg for {username}: {e}", "error"
        )
        raise e
