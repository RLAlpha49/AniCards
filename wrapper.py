"""
This module continuously runs a subprocess (server.py) and restarts it if it exits with a special status code.
"""

import os
import subprocess
import time

# Get the directory of the current script
script_dir = os.path.dirname(os.path.realpath(__file__))

while True:
    try:
        # Use 'with' statement for resource-allocating operation
        with subprocess.Popen(['python', os.path.join(script_dir, 'server.py')]) as process:
            process.wait()

            # Check if server.py has exited with a special status code
            if process.returncode != 2:
                break
    except subprocess.SubprocessError as e:  # Catch a more specific exception
        print(f"An error occurred: {e}")
        input("Press Enter to restart the server...")

    time.sleep(1)