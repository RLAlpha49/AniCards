# wrapper.py
import subprocess
import time

while True:
    try:
        process = subprocess.Popen(['python', 'server.py'])
        process.wait()

        # Check if server.py has exited with a special status code
        if process.returncode != 2:
            break
    except Exception as e:
        print(f"An error occurred: {e}")
        input("Press Enter to restart the server...")

    time.sleep(1)