import os
import pathlib
import sqlite3
from datetime import datetime
import pandas as pd
import sys

sys.path.append("{}/../".format(pathlib.Path(__file__).parent))
from common.logger import logger
from datetime import datetime


DATABASE_NAME = "market_data"


# get the connection of database
def get_db(db_name=""):
    # create fold if not exist
    data_path = f"{pathlib.Path(__file__).parent}/../../data/"

    pathlib.Path(data_path).mkdir(parents=True, exist_ok=True)

    if not db_name:
        return sqlite3.connect(os.path.join(data_path, "{}.db".format(DATABASE_NAME)))
    else:
        return sqlite3.connect(os.path.join(data_path, "{}.db".format(db_name)))


def execute_sql(sql, args=None, db_name=""):
    try:
        con = get_db(db_name)
        cur = con.cursor()
        if args:
            cur.execute(sql, args)
        else:
            cur.execute(sql)
        ret = cur.rowcount
        con.commit()
    except sqlite3.Error as e:
        logger.error("Failed to execute sql due to {}".format(str(e)), exc_info=True)
        return -1
    finally:
        cur.close()
        con.close()

    return ret


def execute_sqls(sql, args=None, db_name=""):
    try:
        con = get_db(db_name)
        cur = con.cursor()
        cur.executemany(sql, args)
        ret = cur.rowcount
        con.commit()
    except sqlite3.Error as e:
        logger.error(
            "Failed to execute sql {} due to {}".format(sql, str(e)), exc_info=True
        )
        return -1
    finally:
        cur.close()
        con.close()

    return ret


def query_by_sql(sql, args=None, db_name=""):
    result = []
    try:
        con = get_db(db_name)
        cur = con.cursor()
        if args:
            rs = cur.execute(sql, args)
        else:
            rs = cur.execute(sql)
        for row in rs:
            result.append(row)
    except sqlite3.Error as e:
        logger.error("Failed to query data due to {}".format(str(e)))
        return None
    finally:
        cur.close()
        con.close()

    return result


# create market_data table
def init_db():
    conn = get_db()
    cur = conn.cursor()

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS market_data (
            symbol TEXT NOT NULL,
            tradetime DATETIME NOT NULL,
            tradeday TEXT NOT NULL,
            open REAL,
            high REAL,
            low REAL,
            close REAL,
            volume INTEGER,
            PRIMARY KEY (symbol, tradetime)
        )
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS trades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT NOT NULL,
            name TEXT NOT NULL,
            action TEXT NOT NULL,
            action_datetime DATETIME NOT NULL,
            action_price REAL NOT NULL,
            size INTEGER NOT NULL,
            fee REAL NOT NULL DEFAULT 0,
            stop_loss REAL,
            exit_target REAL,
            reason TEXT NOT NULL,
            mental_state TEXT NOT NULL,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(name, action_datetime)
        )
    """
    )

    conn.commit()
    conn.close()


def insert_market_data(symbol: str, df: pd.DataFrame):
    conn = get_db()

    # Reset index to make datetime a column
    df = df.reset_index()

    # Add symbol column
    df["Symbol"] = symbol

    # Reorder columns to match table schema
    df = df[
        ["Symbol", "Trade Time", "Trade Day", "Open", "High", "Low", "Close", "Volume"]
    ]

    # Rename columns to match table schema
    df.columns = [
        "symbol",
        "tradetime",
        "tradeday",
        "open",
        "high",
        "low",
        "close",
        "volume",
    ]

    # convert to list of tuples
    data = [tuple(x) for x in df.to_numpy()]

    sql = """
        INSERT OR IGNORE INTO market_data (symbol, tradetime, tradeday, open, high, low, close, volume)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """
    return execute_sqls(sql, data)


def insert_trade(trade_data):
    sql = """
        INSERT INTO trades (
            symbol, name, action, action_datetime, action_price, 
            size, fee, stop_loss, exit_target, reason, 
            mental_state, description
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """
    args = (
        trade_data["symbol"],
        trade_data["name"],
        trade_data["action"],
        trade_data["actionDateTime"],
        trade_data["actionPrice"],
        trade_data["size"],
        trade_data.get("fee", 0),
        trade_data.get("stopLoss", 0),
        trade_data.get("exitTarget", 0),
        trade_data["reason"],
        trade_data["mentalState"],
        trade_data.get("description", ""),
    )
    return execute_sql(sql, args)


def update_trade(trade_id, trade_data):
    sql = """
        UPDATE trades SET
            symbol = ?, name = ?, action = ?, action_datetime = ?, 
            action_price = ?, size = ?, fee = ?, stop_loss = ?,
            exit_target = ?, reason = ?, mental_state = ?, 
            description = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    """
    args = (
        trade_data["symbol"],
        trade_data["name"],
        trade_data["action"],
        trade_data["actionDateTime"],
        trade_data["actionPrice"],
        trade_data["size"],
        trade_data.get("fee", 0),
        trade_data.get("stopLoss", 0),
        trade_data.get("exitTarget", 0),
        trade_data["reason"],
        trade_data["mentalState"],
        trade_data.get("description", ""),
        trade_id,
    )
    return execute_sql(sql, args)


def get_trades(symbol=None, trade_date=None):
    try:
        conn = get_db()

        if not symbol and not trade_date:
            # Return last day trades if no parameters
            sql = """
                SELECT * FROM trades 
                WHERE date(action_datetime) = date('now', '-1 day')
                ORDER BY action_datetime DESC
            """
            df = pd.read_sql_query(sql, conn)
        elif symbol and symbol.lower() != "all" and not trade_date:
            # Return last day trades for specific symbol
            sql = """
                SELECT * FROM trades 
                WHERE symbol = ? 
                AND date(action_datetime) = date('now', '-1 day')
                ORDER BY action_datetime DESC
            """
            df = pd.read_sql_query(sql, conn, params=(symbol,))
        elif not symbol and trade_date:
            # Return trades for specific date
            sql = """
                SELECT * FROM trades 
                WHERE date(action_datetime) = ?
                ORDER BY action_datetime DESC
            """
            df = pd.read_sql_query(sql, conn, params=(trade_date,))
        else:
            # Return trades for specific symbol and date
            sql = """
                SELECT * FROM trades 
                WHERE symbol = ? 
                AND date(action_datetime) = ?
                ORDER BY action_datetime DESC
            """
            df = pd.read_sql_query(sql, conn, params=(symbol, trade_date))

        return df.to_dict("records")
    finally:
        conn.close()


def get_stock_data(symbol, date):
    try:
        conn = get_db()

        sql = """
            SELECT 
                symbol,
                datetime(tradetime, 'localtime') as tradetime,
                tradeday,
                open, high, low, close, volume 
            FROM market_data 
            WHERE symbol = ? AND tradeday = ?
        """

        df = pd.read_sql_query(sql, conn, params=(symbol, date))
        return df.to_dict("records")
    finally:
        conn.close()


if __name__ == "__main__":
    init_db()
