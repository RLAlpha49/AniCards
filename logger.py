import logging
import inspect
import os

def log_message(message, level='info'):
    # Get the caller information
    caller = inspect.stack()[1]
    function_name = caller[3]
    line_number = caller[2]
    script_dir = os.path.dirname(os.path.abspath(__file__))
    file_name = os.path.relpath(caller[1], start=script_dir)  

    # Create a logger
    logger = logging.getLogger('Main_Logger')
    logger.setLevel(logging.DEBUG)
    
    # Comment if you want logs to appear in the terminal where the flask application is running
    logger.propagate = False  # Don't propagate to the root logger

    # Create logs directory if it doesn't exist
    if not os.path.exists('logs'):
        os.makedirs('logs')

    # Create file handlers
    log_handler = logging.FileHandler(os.path.join('logs', 'log.log'))
    debug_handler = logging.FileHandler(os.path.join('logs', 'debug.log'))

    # Set levels for handlers
    log_handler.setLevel(logging.INFO)
    debug_handler.setLevel(logging.DEBUG)

    # Create a logging format
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    log_handler.setFormatter(formatter)
    debug_handler.setFormatter(formatter)

    # Add the handlers to the logger
    if not logger.hasHandlers():
        logger.addHandler(log_handler)
        logger.addHandler(debug_handler)

    # Log the message
    message = f'File: {file_name}, Function: {function_name}, Line: {line_number}, Message: {message}'
    if level.lower() == 'error':
        logger.error(message)
    elif level.lower() == 'debug':
        logger.debug(message)
    elif level.lower() == 'warning':
        logger.warning(message)
    else:
        logger.info(message)