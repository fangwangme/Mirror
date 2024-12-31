#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Author :  @fangwangme
Time   :  2022-10-19
Desc   :  
"""

import sys
import pathlib
from urllib.parse import quote_plus

sys.path.append("{}/../".format(pathlib.Path(__file__).parent))
from common.logger import logger
from common.tools import get_config_by_key

import pymongo
from pymongo.errors import BulkWriteError


# step1: get mongo name
MONGO_NAME = "MONGODB"

DB_HOST = get_config_by_key(MONGO_NAME, "MONGO_HOST")
DB_PORT = get_config_by_key(MONGO_NAME, "MONGO_PORT")
DB_USER = get_config_by_key(MONGO_NAME, "MONGO_USER")
DB_PASSWORD = get_config_by_key(MONGO_NAME, "MONGO_PWD")
DB_NAME = get_config_by_key(MONGO_NAME, "DB_NAME")


def get_client():
    if DB_USER and DB_PASSWORD:
        return pymongo.MongoClient(
            f"mongodb://{DB_USER}:{quote_plus(DB_PASSWORD)}@{DB_HOST}:{DB_PORT}"
        )
    else:
        return pymongo.MongoClient(f"mongodb://{DB_HOST}:{DB_PORT}")


def get_db():
    return get_client()[DB_NAME]


def insert_docs(doc_list, col_name="test", db_name=DB_NAME):
    ret = -1
    try:
        curr_client = get_client()
        curr_db = curr_client[db_name]

        result = curr_db[col_name].insert_many(doc_list, ordered=False)
        ret = len(result.inserted_ids)
    except BulkWriteError as bwe:
        ret = len(doc_list) - len(bwe.details["writeErrors"])
        logger.error(
            f"Duplicate key error occurred. {ret} documents were successfully inserted."
        )
    except Exception as e:
        logger.error(f"Failed to insert documents into mongodb due to {e}")
    finally:
        curr_client.close()

    return ret


def insert_doc(doc_data, col_name="test", db_name=DB_NAME):
    ret = 0
    try:
        curr_client = get_client()
        curr_db = curr_client[db_name]
        # set ordered to False to ignore the duplicate key error

        result = curr_db[col_name].insert_one(doc_data)
        ret = result.inserted_id
    except Exception as e:
        logger.error("Failed to insert documents into mongodb due to {}".format(str(e)))
    finally:
        curr_client.close()

    return ret


def query_data(col_name="test", limit=10, offset=0, db_name=DB_NAME):
    data_list = list()
    try:
        curr_client = get_client()
        curr_db = curr_client[db_name]
        if limit > 0:
            result = curr_db[col_name].find().skip(offset).limit(limit)
        else:
            result = curr_db[col_name].find()

        for each in result:
            data_list.append(each)
    except Exception as e:
        logger.info("Failed to get data from mongodb due to {}".format(e))
    finally:
        curr_client.close()

    return data_list


def query_by_condition(
    condition, col_name="test", db_name=DB_NAME, limit=0, offset=0, projection=None
):
    data_list = list()
    try:
        curr_client = get_client()
        curr_db = curr_client[db_name]

        if limit > 0:
            result = (
                curr_db[col_name]
                .find(condition, projection=projection)
                .skip(offset)
                .limit(limit)
            )
        else:
            result = curr_db[col_name].find(condition, projection=projection)
        for each in result:
            data_list.append(each)
    except Exception as e:
        logger.info("Failed to get data from mongodb due to {}".format(e))
    finally:
        curr_client.close()

    return data_list


def query_by_condition_random(
    condition, col_name="test", db_name=DB_NAME, limit=0, offset=0, projection=None
):
    data_list = list()
    try:
        curr_client = get_client()
        curr_db = curr_client[db_name]

        pipeline = [
            {"$match": condition},
            {
                "$sample": {
                    "size": (
                        limit
                        if limit > 0
                        else curr_db[col_name].count_documents(condition)
                    )
                }
            },
        ]

        if projection:
            pipeline.insert(1, {"$project": projection})

        result = curr_db[col_name].aggregate(pipeline)

        for each in result:
            data_list.append(each)
    except Exception as e:
        logger.info("Failed to get data from mongodb due to {}".format(e))
    finally:
        curr_client.close()

    return data_list


# count the documemnts by condition
def count_by_condition(query_condition, col_name="test"):
    try:
        curr_client = get_client()
        curr_db = curr_client[DB_NAME]
        count = curr_db[col_name].count_documents(query_condition)
        return count
    except Exception as e:
        logger.error("Failed to count documents due to {}".format(e))
    finally:
        curr_client.close()


# update the document with condition
def update_by_condition(query_condition, new_values, col_name="test", db_name=DB_NAME):
    try:
        curr_client = get_client()
        curr_db = curr_client[db_name]
        result = curr_db[col_name].update_many(query_condition, new_values)
        return result.modified_count
    except Exception as e:
        logger.info("Failed to update data from mongodb due to {}".format(e))
    finally:
        curr_client.close()


if __name__ == "__main__":
    # query_data()
    insert_docs([{"name": "test"}], col_name="test")
