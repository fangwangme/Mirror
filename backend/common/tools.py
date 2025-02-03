#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Author :  @fangwangme
Time   :  2023-04-27
Desc   :  
"""

import sys
import pathlib
import configparser

import urllib.parse


sys.path.append("{}/../".format(pathlib.Path(__file__).parent))
from common.logger import logger

import requests


# read config
def get_config_by_key(section_name, key_name, file_name="config"):
    config = configparser.RawConfigParser()
    config_path = "{}/../{}.ini".format(pathlib.Path(__file__).parent, file_name)
    config.read(config_path)
    return config.get(section_name, key_name)


# get retry times
def get_retry_times():
    retry_times = 3
    try:
        retry_times = int(get_config_by_key("running", "retry_times"))
    except Exception as e:
        logger.error(
            "Failed to get retry times, use default times instead", exc_info=True
        )

    return retry_times


# get workers
def get_workers():
    workers = 5
    try:
        workers = int(get_config_by_key("running", "workers"))
    except Exception as e:
        logger.error(
            "Failed to get workers, use default workers instead", exc_info=True
        )

    return workers


if __name__ == "__main__":
    send_messages_to_group("Hello World!")
