"""
This module is used to run, stop, restart the server and pull updates from git.
"""

# pylint: disable=W0718

import subprocess
import os
import glob
import sys


def run_server(silent=False):
    """
    Run the server using waitress.
    """
    try:
        if not silent:
            print("Starting server...")
        server_command = ["waitress-serve", "--port=5000", "--threads=4", "main:app"]
        return subprocess.Popen(server_command, stdout=subprocess.PIPE)
    except Exception as start_error:
        print(f"Error starting server: {start_error}")
        return False


def stop_server(server_process):
    """
    Stop the server.
    """
    try:
        if server_process:
            print("\nStopping server...")
            server_process.terminate()
            server_process.wait()
    except Exception as stop_error:
        print(f"Error stopping server: {stop_error}")


def restart_server(server_process, pull_silent=False):
    """
    Restart the server.
    """
    try:
        stop_server(server_process)
        if not pull_silent:
            changes_made = pull_from_git()
            if changes_made and "server.py" in str(changes_made):
                print("\nChanges detected in server.py, restarting server.py...")
                sys.exit(2)  # Exit with status code 2 to signal a restart
        return run_server(silent=True)
    except Exception as restart_error:
        print(f"Error restarting server: {restart_error}")
        return False


def open_newest_file(file_type):
    """
    Open the newest file of a given type.
    """
    try:
        files = glob.glob(f"logs/{file_type}_*.log")
        if not files:
            print(f"No {file_type} files found in logs directory.")
            return
        newest_file = max(files, key=os.path.getctime)
        os.system(f"start {newest_file}")
    except Exception as open_error:
        print(f"Error opening newest file: {open_error}")


def pull_from_git():
    """
    Pull the latest changes from git.
    """
    try:
        print("\nPulling latest changes from git...")
        changes = subprocess.check_output(["git", "pull"]).decode("utf-8")
        if "Already up to date." in changes:
            print("No changes were made.\n")
            return False
        print("Changes were made.\n")
        return True
    except Exception as pull_error:
        print(f"Error pulling from git: {pull_error}")
        return False


try:
    SERVER_PROCESS = run_server()
    while True:
        command = input()
        if command == "restart":
            SERVER_PROCESS = restart_server(SERVER_PROCESS)
        elif command == "stop":
            stop_server(SERVER_PROCESS)
            SERVER_PROCESS = None
        elif command == "start":
            if SERVER_PROCESS is None:
                SERVER_PROCESS = run_server()
            else:
                print("Server is already running.")
        elif command == "pull":
            CHANGES_MADE = pull_from_git()
            if CHANGES_MADE:
                SERVER_PROCESS = restart_server(SERVER_PROCESS, True)
        elif command.startswith("open "):
            FILE_TYPE = command.split(" ")[1]
            open_newest_file(FILE_TYPE)
except Exception as error:
    print(f"An error occurred: {error}")
