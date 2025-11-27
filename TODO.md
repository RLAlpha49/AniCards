# TODO List

- Add more params to the card.svg url
  - The card at minimum should always have 2 params ((userId or userName) and cardType). The rest of the params are optional and if not provided should fallback to the saved options in the database. If no saved options exist then the default values should be used.
  - Params to include:
    - userId or userName
    - cardType
    - variant
    - colorPreset
    - borderColor
    - borderRadius
  - When cards are generated and the url's are made all params should be included in the url even if they are default values so that it does not need to connect to the database to get the saved options unless a param is needed.
  - If a user generates cards with a custom color preset the param should set the colorPreset to "custom" and force load the custom colors from the database.
