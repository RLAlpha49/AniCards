# Used to run server through waitress
import subprocess
import os
import glob

def run_server():
    return subprocess.Popen(['waitress-serve', '--port=5000', '--threads=4', 'main:app'])

def restart_server(server_process):
    server_process.terminate()
    server_process.wait()
    os.system('git pull')
    return run_server()

def open_newest_file(file_type):
    files = glob.glob(f'{file_type}_*.log')
    newest_file = max(files, key=os.path.getctime)
    os.startfile(newest_file)

server_process = run_server()

while True:
    command = input()
    if command == 'restart':
        server_process = restart_server(server_process)
    elif command.startswith('open '):
        file_type = command.split(' ')[1]
        open_newest_file(file_type)