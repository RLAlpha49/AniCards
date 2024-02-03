import subprocess
import sys
import os

def run_server():
    return subprocess.Popen(['waitress-serve', '--port=5000', '--threads=4', 'main:app'])

def restart_server(server_process):
    server_process.terminate()
    server_process.wait()
    os.system('git pull')
    return run_server()

server_process = run_server()

while True:
    command = input()
    if command == 'restart':
        server_process = restart_server(server_process)