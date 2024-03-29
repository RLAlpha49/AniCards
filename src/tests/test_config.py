"""
This module is used to configure the Python path for the tests.
It adds the parent directory of 'src', the 'src' directory itself,
the 'src/main' directory, and the 'src/Program' directory to the Python path.
"""

import os
import sys

# Add the parent directory of "src" to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), "..", ".."))

# Add the "src" directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

# Add the "src/main" directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "main"))

# Add the "src/Program" directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "Program"))
