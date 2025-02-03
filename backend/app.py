from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import yfinance as yf
from datetime import datetime, timedelta
from common.db_sqlite import (
    init_db,
    insert_trade,
    update_trade,
    get_trades,
    insert_market_data,
    get_db,
)
import os
import pandas as pd
from common.logger import logger

# Configure static files directory
STATIC_FOLDER = os.path.abspath("../frontend/dist")

app = Flask(__name__, static_folder=STATIC_FOLDER)
CORS(app)

# Initialize database on startup
init_db()


# Serve frontend static files
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_static(path):
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, "index.html")


# API routes
@app.route("/api/fetch-market-data", methods=["POST"])
def fetch_market_data():
    try:
        data = request.json
        symbol = data.get("symbol")

        if not symbol:
            return jsonify({"error": "Symbol is required"}), 400

        # Download 1-minute data for the past 5 days
        ticker = yf.Ticker(symbol)
        df = ticker.history(period="5d", interval="1m")

        if df.empty:
            return jsonify({"error": f"No data available for {symbol}"}), 404
        else:
            logger.info(
                f"Successfully fetched {symbol} data for past 5 days with {len(df)} rows"
            )

        # Convert datetime index to string in a way that preserves timezone info
        df["Trade Time"] = df.index.strftime("%Y-%m-%d %H:%M:%S%z")
        df["Trade Day"] = df.index.strftime("%Y-%m-%d")

        # add trade_date column
        ret = insert_market_data(symbol, df)

        return (
            jsonify(
                {
                    "message": f"Successfully fetched {symbol} data for past 5 days",
                    "rows": ret,
                }
            ),
            200,
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/stock-data", methods=["GET"])
def get_stock_data():
    try:
        symbol = request.args.get("symbol")
        date_str = request.args.get("date")

        if not symbol or not date_str:
            return jsonify({"error": "Symbol and date are required"}), 400

        sql = """
            SELECT 
                symbol,
                tradetime,
                tradeday,
                open, high, low, close, volume 
            FROM market_data
            WHERE symbol = ? AND tradeday = ?
        """
        df = pd.read_sql_query(sql, get_db(), params=(symbol, date_str))
        data = df.to_dict("records")
        return jsonify(data)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/trades", methods=["GET", "POST", "PUT"])
def handle_trades():
    try:
        if request.method == "GET":
            trades = get_trades()
            return jsonify(trades)

        elif request.method == "POST":
            trade_data = request.json

            result = insert_trade(trade_data)
            if result > 0:
                return jsonify({"message": "Trade saved successfully"}), 200
            return jsonify({"error": "Failed to save trade"}), 400

        elif request.method == "PUT":
            trade_id = request.args.get("id")
            trade_data = request.json
            if not trade_id:
                return jsonify({"error": "Trade ID is required"}), 400

            result = update_trade(trade_id, trade_data)
            if result > 0:
                return jsonify({"message": "Trade updated successfully"}), 200
            return jsonify({"error": "Failed to update trade"}), 400

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    if not os.path.exists(STATIC_FOLDER):
        print(f"Warning: Frontend build directory not found at {STATIC_FOLDER}")
        print("Please run 'npm run build' in the frontend directory first")
    app.run(debug=True, port=5987)
