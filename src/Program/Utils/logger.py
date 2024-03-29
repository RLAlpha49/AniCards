"""
This module is used for logging messages with different levels.
"""

import datetime
import glob
import inspect
import logging
import logging.handlers
import os
import sys

# Get the current timestamp
timestamp = datetime.datetime.now().strftime("%Y-%m-%d_%H_%M_%S")


def cleanup_log_files():
    """
    Cleans up log files in the 'logs' directory.

    This function deletes the oldest log files in the 'logs' directory until there
    are only 30 left for each type of log file (debug and log). The function prints
    the number of log files before and after deletion, as well as the name of each
    file that's being deleted.
    """
    # Limit the number of log files
    for pattern in ["logs/debug_*.log", "logs/log_*.log"]:
        log_type = "debug" if "debug" in pattern else "log"
        log_files = sorted(glob.glob(pattern))
        print(f"Before deletion: {len(log_files)} {log_type} files")
        while len(log_files) > 10:
            os.remove(log_files[0])
            log_files = sorted(glob.glob(pattern))
        print(f"After deletion: {len(log_files)} {log_type} files\n")


# Call the cleanup function when the server starts
if "unittest" not in sys.modules:
    cleanup_log_files()


def log_message(message, level="info"):
    """
    Logs a message with a given level.

    Parameters:
    message (str): The message to log.
    level (str): The level of the message. Default is 'info'.
    """
    if "unittest" in sys.modules:
        return

    # Get the caller information
    caller = inspect.stack()[1]
    function_name = caller[3]
    line_number = caller[2]
    script_dir = os.path.dirname(os.path.abspath(__file__))
    file_name = os.path.relpath(caller[1], start=script_dir)

    # Create a logger
    logger = logging.getLogger("Main_Logger")
    logger.setLevel(logging.DEBUG)

    # Don't propagate to the root logger
    logger.propagate = False

    # Create logs directory if it doesn't exist
    if not os.path.exists("logs"):
        os.makedirs("logs")

    # Create file handlers
    log_filename = os.path.join("logs", f"log_{timestamp}.log")
    debug_filename = os.path.join("logs", f"debug_{timestamp}.log")

    log_handler = logging.handlers.RotatingFileHandler(log_filename, backupCount=30)
    debug_handler = logging.handlers.RotatingFileHandler(debug_filename, backupCount=30)

    # Set levels for handlers
    log_handler.setLevel(logging.INFO)
    debug_handler.setLevel(logging.DEBUG)

    # Create a logging format
    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    log_handler.setFormatter(formatter)
    debug_handler.setFormatter(formatter)

    # Add the handlers to the logger
    if not logger.hasHandlers():
        logger.addHandler(log_handler)
        logger.addHandler(debug_handler)

    # Log the message
    message = (
        f"File: {file_name}, "
        f"Function: {function_name}, "
        f"Line: {line_number}, "
        f"Message: {message}"
    )
    if level.lower() == "error":
        logger.error(message)
    elif level.lower() == "debug":
        logger.debug(message)
    elif level.lower() == "warning":
        logger.warning(message)
    else:
        logger.info(message)
