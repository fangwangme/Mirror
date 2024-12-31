#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Author :  @fangwangme
Time   :  2024-12-25
Desc   :  
"""

import hashlib
import sys
import pathlib

sys.path.append("{}/../".format(pathlib.Path(__file__).parent))
from common.logger import logger
from common import tools, db_mongo
import yfinance as yf


# get spy history data with interval as 1m of past month
def get_spy_data():
    spy = yf.Ticker("SPY")
    data = spy.history(period="5d", interval="1m")

    # Convert datetime index to string in a way that preserves timezone info
    data.index = data.index.strftime("%Y-%m-%d %H:%M:%S%z")

    # Convert to dict while preserving the date string as index
    data_dict = data.reset_index().to_dict("records")

    # build _id with symbol and date
    for record in data_dict:
        unique_id = "{}_{}".format("SPY", record["Datetime"])
        # hash the unique_id
        record["trade_date"] = record["Datetime"].split(" ")[0]
        record["_id"] = hashlib.md5(unique_id.encode()).hexdigest()

    # Print first few records to verify
    print("First few records:", data_dict[:2])

    col_name = "spy_1m"
    ret = db_mongo.insert_docs(doc_list=data_dict, col_name=col_name)
    logger.info(f"Inserted {ret}/{len(data_dict)} records into {col_name}")
    return data_dict


# test download data of SPY
def test_download_data():
    spy = yf.Ticker("SPY")
    # download 1m data of past 1 year
    # data = spy.history(period="1y", interval="1d")

    # print(spy.option_chain("2024-12-30"))

    print(dir(spy.history))
    # print(data.head())
    # export data to csv file
    # data.to_csv("SPY.csv")


if __name__ == "__main__":
    # test_download_data()

    get_spy_data()
