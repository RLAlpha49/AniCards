# TODO List

- When typing a position percentage, after typing once it unfocuses the input field and seems to focus the dialog instead. Also remove the buttons to increment/decrement as they are not needed.
- Do not show the show more button if there is no more color presets to show.
- When saving the cards in the database it should only overwrite the specific card instead of the whole array of cards.
- When generating cards it should go to the user page how you go to the user page when searching a user and not add the parameters of the cards to the URL. If possible, see if you can force a full refresh so the new card state is loaded from scratch to show the updated cards.
- Remove comments and sort color presets in constants.ts
- When navigating to a different page. anicards-savedColorConfig is reset to default.
- Determine if any local storage values can be removed if they are no longer needed.
- Remove the sidebar behavior in the settings. It should determine default sidebar behavior and update it whenever the sidebar is expanded/collapsed.
- Border color in settings has the button to change to gradient which should not be there.
