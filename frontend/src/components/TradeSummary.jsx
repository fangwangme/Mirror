import React, { useState, useEffect, useRef } from 'react';
import { Select, DatePicker, Card, Table, Space, Button, message } from 'antd';
import moment from 'moment-timezone';
import { createChart } from 'lightweight-charts';
import { ENDPOINTS } from '../config/api';

const { Option } = Select;

const TradeSummary = () => {
  const [symbol, setSymbol] = useState('SPY');
  const [date, setDate] = useState(null);
  const [trades, setTrades] = useState([]);
  const [marketData, setMarketData] = useState([]);
  const [profitSummary, setProfitSummary] = useState([]);
  const [interval, setInterval] = useState("2m");
  const chartContainerRef = useRef();
  const chartRef = useRef();
  const [tradeData, setTradeData] = useState([]);
  const [totalProfit, setTotalProfit] = useState(0);
  const tooltipRef = useRef(null);  // Add this ref for tooltip

  const handleIntervalChange = (value) => {
    setInterval(value);
  };

  const fetchMarketData = async () => {
    try {
      if (!symbol || !date) return;
      const formattedDate = date.format('YYYY-MM-DD');
      const response = await fetch(`/api/stock-data?symbol=${symbol}&date=${formattedDate}`);
      const data = await response.json();
      if (data && Array.isArray(data) && data.length > 0) {
        setMarketData(data);
      }
    } catch (error) {
      console.error(error);
    }
  };

  // Update candlestick colors to be different from trade markers
  const chartColors = {
    up: '#26a69a',    // Green for up candles
    down: '#ef5350',  // Red for down candles
  };

  const aggregateData = (data, minutesInterval) => {
    const grouped = {};
    data.forEach(item => {
      const timestamp = moment.tz(item.tradetime, "America/New_York");
      const minutes = timestamp.minutes();
      timestamp.minutes(Math.floor(minutes / minutesInterval) * minutesInterval)
               .seconds(0);
      const key = timestamp.unix();

      // Log first item to verify volume data
      if (!grouped[key]) {
        grouped[key] = {
          time: key,
          open: parseFloat(item.open),
          high: parseFloat(item.high),
          low: parseFloat(item.low),
          close: parseFloat(item.close),
          volume: parseInt(item.volume || 0)  // Changed to parseInt and added fallback
        };
      } else {
        grouped[key].high = Math.max(grouped[key].high, parseFloat(item.high));
        grouped[key].low = Math.min(grouped[key].low, parseFloat(item.low));
        grouped[key].close = parseFloat(item.close);
        grouped[key].volume += parseInt(item.volume || 0);  // Changed to parseInt and added fallback
      }
    });
    return Object.values(grouped).sort((a, b) => a.time - b.time);
  };

  const calculateProfits = (trades) => {
    const profitsByName = {};
    let totalPnL = 0;

    // Sort trades by datetime for proper order
    const sortedTrades = [...trades].sort((a, b) => 
      moment(a.action_datetime).valueOf() - moment(b.action_datetime).valueOf()
    );

    sortedTrades.forEach(trade => {
      const name = trade.name;
      if (!profitsByName[name]) {
        profitsByName[name] = {
          name,
          buyValue: 0,
          sellValue: 0,
          totalFees: 0,
          trades: []
        };
      }

      const entry = profitsByName[name];
      const tradeValue = trade.action_price * trade.size; // Removed * 100
      const fee = trade.fee || 0;

      if (trade.action === 'BUY') {
        entry.buyValue += tradeValue;
        entry.totalFees += fee;
      } else if (trade.action === 'SELL') {
        entry.sellValue += tradeValue;
        entry.totalFees += fee;
      }

      entry.trades.push(trade);
    });

    // Calculate final stats for each name
    const summaries = Object.values(profitsByName).map(summary => ({
      name: summary.name,
      totalTrades: summary.trades.length,
      buyAmount: summary.buyValue,
      sellAmount: summary.sellValue,
      totalFees: summary.totalFees,
      totalPnL: summary.sellValue - summary.buyValue - summary.totalFees,
      trades: summary.trades
    }));

    setProfitSummary(summaries);
    setTotalProfit(summaries.reduce((acc, curr) => acc + curr.totalPnL, 0));
  };

  const calculateTradeProfit = (buyTrade, sellTrade) => {
    const buyFee = buyTrade.fee || 0;
    const sellFee = sellTrade.fee || 0;
    return (
      (sellTrade.action_price - buyTrade.action_price) * buyTrade.size * 100 - buyFee - sellFee
    );
  };

  const assignTradeIds = (trades) => {
    // Filter trades within market hours and sort by time
    const marketHourTrades = trades
      .filter(trade => {
        const tradeTime = moment.tz(trade.action_datetime, "America/New_York");
        const hour = tradeTime.hours();
        const minute = tradeTime.minutes();
        const timeInMinutes = hour * 60 + minute;
        return timeInMinutes >= 570 && timeInMinutes <= 960; // 9:30 (570) to 16:00 (960)
      })
      .sort((a, b) => moment(a.action_datetime).valueOf() - moment(b.action_datetime).valueOf());

    // Assign IDs
    return marketHourTrades.map((trade, index) => ({
      ...trade,
      tradeId: index + 1
    }));
  };

  const fetchData = async () => {
    try {
      if (!date || !symbol) {
        return; // Exit early without error if no date selected
      }
      const formattedDate = date.format('YYYY-MM-DD');
      
      const [marketResponse, tradesResponse] = await Promise.all([
        fetch(`${ENDPOINTS.STOCK_DATA}?symbol=${symbol}&date=${formattedDate}`),
        fetch(`${ENDPOINTS.TRADES}?symbol=${symbol}&date=${formattedDate}`)
      ]);

      const marketData = await marketResponse.json();
      const trades = await tradesResponse.json();

      if (marketData && Array.isArray(marketData)) {
        setMarketData(marketData);
      }

      if (trades && Array.isArray(trades)) {
        const tradesWithIds = assignTradeIds(trades);
        setTradeData(tradesWithIds);
        calculateProfits(tradesWithIds);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  // Fix formatTime to use NY timezone
  const formatTime = (timestamp) => {
    return moment.tz(timestamp * 1000, "America/New_York").format("HH:mm");
  };

  const renderLegend = (bar) => {
    if (!bar || typeof bar.time === 'undefined') return '';
    
    const minutesInterval = parseInt(interval.replace('m',''));
    const nyTime = moment.tz(bar.time * 1000, "America/New_York");
    
    // Find trades that occurred during this candle's time period
    const tradesInRange = tradeData.filter(trade => {
      const tradeTime = moment.tz(trade.action_datetime, "America/New_York");
      const startTime = moment(nyTime);
      const endTime = moment(nyTime).add(minutesInterval, 'minutes');
      return tradeTime.isBetween(startTime, endTime, null, '[)');
    });

    const timeStr = nyTime.format("HH:mm");
    const nextTime = moment(nyTime).add(minutesInterval, "minutes").format("HH:mm");
    const barColor = (bar.close >= bar.open) ? '#26a69a' : '#ef5350';
    
    let tooltipContent = `
      <div style="padding: 12px; background: white; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; line-height: 1.5; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="font-weight: bold; margin-bottom: 8px; border-bottom: 2px solid ${barColor}">
          Time: ${timeStr} - ${nextTime}
        </div>
        <div style="color: ${barColor}; margin-bottom: 8px;">
          <div>Open: ${Number(bar.open || 0).toFixed(2)}</div>
          <div>High: ${Number(bar.high || 0).toFixed(2)}</div>
          <div>Low: ${Number(bar.low || 0).toFixed(2)}</div>
          <div>Close: ${Number(bar.close || 0).toFixed(2)}</div>
          <div style="border-top: 1px solid #eee; margin-top: 4px; padding-top: 4px;">
            Volume: ${Number(bar.volume || 0).toLocaleString()}
          </div>
        </div>`;

    // Add trade information if there are trades in this period
    if (tradesInRange.length > 0) {
      tooltipContent += `
        <div style="margin-top: 8px; border-top: 1px solid #eee; padding-top: 8px;">
          <div style="font-weight: bold; margin-bottom: 4px;">Trades:</div>`;
      
      tradesInRange.forEach(trade => {
        const tradeTime = moment.tz(trade.action_datetime, "America/New_York").format('HH:mm:ss');
        const color = getTradeColor(trade);
        tooltipContent += `
          <div style="color: ${color}; padding: 2px 0;">
            <span style="display: inline-block; width: 8px; height: 8px; background: ${color}; border-radius: 50%; margin-right: 4px;"></span>
            #${trade.tradeId} ${trade.action} ${trade.name} 
            @ $${trade.action_price.toFixed(2)} (${tradeTime})
          </div>`;
      });
      tooltipContent += '</div>';
    }

    tooltipContent += '</div>';
    return tooltipContent;
  };

  // New colors for different trade types
  const tradeTypeColors = {
    SELL_CALL: '#FF9800',    // Orange
    BUY_CALL: '#1976D2',     // Blue
    SELL_PUT: '#607D8B',     // Blue Grey
    BUY_PUT: '#9C27B0'       // Purple
  };

  const getTradeType = (trade) => {
    const name = trade.name.toUpperCase();
    let optionType = 'CALL';  // default to CALL
    
    if (name.includes('CALL')) {
      optionType = 'CALL';
    } else if (name.includes('PUT')) {
      optionType = 'PUT';
    }
    
    return `${trade.action}_${optionType}`;
  };

  const getTradeColor = (trade) => {
    const tradeType = getTradeType(trade);
    return tradeTypeColors[tradeType] || '#999999';
  };

  useEffect(() => {
    // Create tooltip div if it doesn't exist
    if (!tooltipRef.current) {
      tooltipRef.current = document.createElement('div');
      tooltipRef.current.style.position = 'fixed'; // Changed from 'absolute' to 'fixed'
      tooltipRef.current.style.display = 'none';
      tooltipRef.current.style.zIndex = '1000';
      tooltipRef.current.style.pointerEvents = 'none'; // Make sure tooltip doesn't interfere with clicks
      document.body.appendChild(tooltipRef.current);
    }

    if (chartContainerRef.current && marketData.length > 0) {
      const minutesInterval = parseInt(interval.replace('m',''));
      const aggregated = aggregateData(marketData, minutesInterval);
      const chart = createChart(chartContainerRef.current, {
        height: 500,
        layout: {
          backgroundColor: '#ffffff',
          textColor: '#333'
        },
        grid: {
          vertLines: { color: '#f0f0f0' },
          horzLines: { color: '#f0f0f0' }
        },
        crosshair: { mode: 'normal' },
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
          rightOffset: 12,
          barSpacing: 12,
          minBarSpacing: 2,
          tickMarkFormatter: (time) =>
            moment.tz(time * 1000, "America/New_York").format("HH:mm"),
          borderColor: '#D1D4DC',
          fixLeftEdge: true,
          fixRightEdge: true,
        },
        localization: {
          timeFormatter: (timestamp) =>
            moment.tz(timestamp * 1000, "America/New_York").format("HH:mm")
        },
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
        },
        handleScale: {
          axisPressedMouseMove: true,
          mouseWheel: true,
          pinch: true,
        },
      });

      const candlestickSeries = chart.addCandlestickSeries({
        upColor: chartColors.up,
        downColor: chartColors.down,
        borderVisible: false,
        wickUpColor: chartColors.up,
        wickDownColor: chartColors.down
      });

      // Remove volume series code
      candlestickSeries.setData(aggregated);
      chart.timeScale().fitContent();

      // Update markers for trades with new colors and bigger size
      if (tradeData.length > 0) {
        const markers = [];
        const minutesInterval = parseInt(interval.replace('m', ''));

        tradeData.forEach(trade => {
          const tradeTime = moment.tz(trade.action_datetime, "America/New_York");
          const minutes = tradeTime.minutes();
          const roundedMinutes = Math.floor(minutes / minutesInterval) * minutesInterval;
          const alignedTime = moment(tradeTime).minutes(roundedMinutes).seconds(0);
          const timestamp = alignedTime.unix();
          
          const tradeType = getTradeType(trade);
          const color = tradeTypeColors[tradeType];

          // Create price line with correct color
          candlestickSeries.createPriceLine({
            price: trade.action_price,
            color: color,
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: `#${trade.tradeId} ${trade.name} ${trade.action}`,
            time: timestamp,
          });

          markers.push({
            time: timestamp,
            position: trade.action === 'BUY' ? 'belowBar' : 'aboveBar',
            color: color,
            shape: trade.action === 'BUY' ? 'arrowUp' : 'arrowDown',
            text: `#${trade.tradeId}`,
            size: 3,
            borderColor: color,
            backgroundColor: color,
            textColor: '#ffffff',
          });
        });

        candlestickSeries.setMarkers(markers);
      }

      // Set up tooltip handling
      chart.subscribeCrosshairMove(param => {
        if (!param.point || !param.time || param.point.x < 0 || param.point.y < 0) {
          tooltipRef.current.style.display = 'none';
          return;
        }

        const data = param.seriesData.get(candlestickSeries);
        if (data) {
          const tooltip = renderLegend(data);
          if (tooltip) {
            tooltipRef.current.innerHTML = tooltip;
            tooltipRef.current.style.display = 'block';
            
            // Adjust tooltip position to prevent it from going off-screen
            const container = chartContainerRef.current.getBoundingClientRect();
            const tooltipWidth = tooltipRef.current.offsetWidth;
            const tooltipHeight = tooltipRef.current.offsetHeight;
            
            let left = param.point.x + container.left + 15;
            let top = param.point.y + container.top - 10;

            // Adjust if tooltip would go off the right side
            if (left + tooltipWidth > window.innerWidth) {
              left = param.point.x + container.left - tooltipWidth - 15;
            }

            // Adjust if tooltip would go off the bottom
            if (top + tooltipHeight > window.innerHeight) {
              top = window.innerHeight - tooltipHeight - 10;
            }

            tooltipRef.current.style.left = `${left}px`;
            tooltipRef.current.style.top = `${top}px`;
          }
        }
      });

      chartRef.current = chart;

      // Clean up tooltip on unmount
      return () => {
        chart.remove();
        if (tooltipRef.current && tooltipRef.current.parentNode) {
          tooltipRef.current.parentNode.removeChild(tooltipRef.current);
          tooltipRef.current = null;
        }
      };
    }
  }, [marketData, interval, tradeData]);

  const tradeColumns = [
    { 
      title: 'ID', 
      dataIndex: 'tradeId',
      sorter: (a, b) => a.tradeId - b.tradeId,
    },
    { 
      title: 'Symbol', 
      dataIndex: 'symbol',
      sorter: (a, b) => a.symbol.localeCompare(b.symbol),
    },
    { 
      title: 'Name', 
      dataIndex: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    { 
      title: 'Action', 
      dataIndex: 'action',
      sorter: (a, b) => a.action.localeCompare(b.action),
    },
    { 
      title: 'Action Time', 
      dataIndex: 'action_datetime',
      sorter: (a, b) => moment(a.action_datetime).unix() - moment(b.action_datetime).unix(),
      render: (text) => moment(text).format('YYYY-MM-DD HH:mm:ss')
    },
    { 
      title: 'Price', 
      dataIndex: 'action_price',
      sorter: (a, b) => a.action_price - b.action_price,
      render: (value) => value.toFixed(2),
    },
    { 
      title: 'Stop Loss', 
      dataIndex: 'stop_loss',
      sorter: (a, b) => (a.stop_loss || 0) - (b.stop_loss || 0),
      render: (value) => value ? value.toFixed(2) : '-'
    },
    { 
      title: 'Exit Target', 
      dataIndex: 'exit_target',
      sorter: (a, b) => (a.exit_target || 0) - (b.exit_target || 0),
      render: (value) => value ? value.toFixed(2) : '-'
    },
    { 
      title: 'Size', 
      dataIndex: 'size',
      sorter: (a, b) => a.size - b.size,
    },
    { 
      title: 'Fee', 
      dataIndex: 'fee',
      sorter: (a, b) => a.fee - b.fee,
    },
  ];

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: 'Total Trades',
      dataIndex: 'totalTrades',
      sorter: (a, b) => a.totalTrades - b.totalTrades,
    },
    {
      title: 'Buy/Sell',
      render: (_, record) => `${record.buyCount}/${record.sellCount}`,
    },
    {
      title: 'Remaining Size',
      dataIndex: 'remainingSize',
      sorter: (a, b) => a.remainingSize - b.remainingSize,
    },
    {
      title: 'Realized P/L',
      dataIndex: 'realizedPnL',
      render: (value) => (
        <span style={{ color: value >= 0 ? '#26a69a' : '#ef5350' }}>
          ${value.toFixed(2)}
        </span>
      ),
      sorter: (a, b) => a.realizedPnL - b.realizedPnL,
    },
    {
      title: 'Total Fees',
      dataIndex: 'totalFees',
      render: (value) => `$${value.toFixed(2)}`,
      sorter: (a, b) => a.totalFees - b.totalFees,
    }
  ];

  const statColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: 'Total P/L',
      dataIndex: 'totalPnL',
      key: 'totalPnL',
      render: (value) => (
        <span style={{ color: (value || 0) >= 0 ? '#26a69a' : '#ef5350', fontWeight: 'bold' }}>
          ${(value || 0).toFixed(2)}
        </span>
      ),
      sorter: (a, b) => (a.totalPnL || 0) - (b.totalPnL || 0),
    },
    {
      title: 'Trades',
      dataIndex: 'trades',
      key: 'trades',
      render: (trades) => `${(trades || []).length}`,
      sorter: (a, b) => (a.trades || []).length - (b.trades || []).length,
    },
    {
      title: 'Buy Amount',
      dataIndex: 'buyAmount',
      key: 'buyAmount',
      render: (value) => `$${(value || 0).toFixed(2)}`,
    },
    {
      title: 'Sell Amount',
      dataIndex: 'sellAmount',
      key: 'sellAmount',
      render: (value) => `$${(value || 0).toFixed(2)}`,
    },
    {
      title: 'Total Fees',
      dataIndex: 'totalFees',
      key: 'totalFees',
      render: (value) => `$${(value || 0).toFixed(2)}`,
    }
  ];

  const handleSearch = async () => {
    try {
      if (!symbol || !date) {
        message.error('Please select both symbol and date');
        return;
      }

      const formattedDate = date.format('YYYY-MM-DD');
      
      // Fetch both market data and trades
      const [marketResponse, tradesResponse] = await Promise.all([
        fetch(`${ENDPOINTS.STOCK_DATA}?symbol=${symbol}&date=${formattedDate}`),
        fetch(`${ENDPOINTS.TRADES}?symbol=${symbol}&date=${formattedDate}`)
      ]);

      const marketData = await marketResponse.json();
      const trades = await tradesResponse.json();

      if (marketData && Array.isArray(marketData)) {
        setMarketData(marketData);
      }

      if (trades && Array.isArray(trades)) {
        const tradesWithIds = assignTradeIds(trades);
        setTradeData(tradesWithIds);
        calculateProfits(tradesWithIds);
      }

      message.success('Data loaded successfully');
    } catch (error) {
      console.error('Error fetching data:', error);
      message.error('Failed to fetch data');
    }
  };

  return (
    <div className="trade-summary">
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Space>
          <Select
            value={symbol}
            onChange={setSymbol}
            style={{ width: 120 }}
          >
            <Option value="SPY">SPY</Option>
            <Option value="QQQ">QQQ</Option>
          </Select>
          
          <DatePicker
            value={date}
            onChange={setDate}
            disabledDate={current => current && current > moment().endOf('day')}
            style={{ width: 120 }}
          />

          <Select value={interval} onChange={handleIntervalChange} style={{ width: 120 }}>
            <Option value="1m">1m</Option>
            <Option value="2m">2m</Option>
            <Option value="5m">5m</Option>
            <Option value="10m">10m</Option>
          </Select>
          <Button type="primary" onClick={handleSearch}>Search</Button>
        </Space>

        <div 
          ref={chartContainerRef}
          style={{ 
            width: '100%',
            height: '500px',
            border: '1px solid #ddd',
            borderRadius: '4px'
          }}
        />

        <Card title="Trade Statistics">
          {/* Total P/L display */}
          <div style={{ marginBottom: '20px' }}>
            <strong>Total P/L: </strong>
            <span style={{ 
              color: totalProfit >= 0 ? '#26a69a' : '#ef5350',
              fontSize: '1.2em',
              fontWeight: 'bold'
            }}>
              ${totalProfit.toFixed(2)}
            </span>
          </div>

          {/* Statistics by Name */}
          <Table
            dataSource={profitSummary}
            columns={statColumns}
            pagination={false}
            rowKey="name"
            size="small"
            style={{ marginBottom: '24px' }}
          />

          {/* Trade List */}
          <h3>Trade Details</h3>
          <Table
            dataSource={tradeData}
            columns={tradeColumns}
            pagination={{
              pageSize: 10,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} trades`,
              showQuickJumper: true,
              showSizeChanger: false
            }}
            scroll={{ x: 1300 }}
            size="small"
            rowKey="id"
          />
        </Card>
      </Space>
    </div>
  );
};

export default TradeSummary;
