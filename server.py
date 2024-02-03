# Used to run server through waitress
import subprocess
import os
import glob
import sys

def run_server():
    return subprocess.Popen(['waitress-serve', '--port=5000', '--threads=4', 'main:app'], stdout=subprocess.PIPE)

def stop_server(server_process):
    if server_process:
        server_process.terminate()
        server_process.wait()

def restart_server(server_process):
    stop_server(server_process)
    changes = pull_from_git()
    if 'server.py' in changes:
        os.execv(__file__, sys.argv)
    return run_server()

def open_newest_file(file_type):
    files = glob.glob(f'logs/{file_type}_*.log')
    if not files:
        print(f"No {file_type} files found in logs directory.")
        return
    newest_file = max(files, key=os.path.getctime)
    os.startfile(newest_file)

def pull_from_git():
    changes = subprocess.check_output(['git', 'pull']).decode('utf-8')
    return changes

server_process = run_server()

while True:
    command = input()
    if command == 'restart':
        server_process = restart_server(server_process)
    elif command == 'stop':
        stop_server(server_process)
        server_process = None
    elif command == 'start':
        if server_process is None:
            server_process = run_server()
        else:
            print("Server is already running.")
    elif command.startswith('open '):
        file_type = command.split(' ')[1]
        open_newest_file(file_type)