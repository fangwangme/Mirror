import React, { useState, useEffect, useRef } from 'react';
import { Select, DatePicker, Button, Space, message } from 'antd';
import moment from 'moment-timezone'; // Use moment-timezone
import { createChart } from 'lightweight-charts';
import { ENDPOINTS } from '../config/api';

const StockChart = () => {
  const [symbol, setSymbol] = useState('SPY');
  const [date, setDate] = useState(null); // Start with null
  // Removed availableDates state
  const [currentBar, setCurrentBar] = useState(null);
  const [interval, setInterval] = useState("2m"); 
  const chartContainerRef = useRef();
  const chartRef = useRef();
  const legendRef = useRef();

  const isMarketHours = (timestamp) => {
    const date = new Date(timestamp);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const time = hours * 60 + minutes;  // Convert to minutes since midnight
    
    return time >= 9 * 60 + 30 && time < 16 * 60;  // Between 9:30 and 16:00
  };

  const handleIntervalChange = (value) => {
    setInterval(value);
  };

  const aggregateData = (data, minutesInterval) => {
    const groupedData = {};
    
    data.forEach(item => {
      // Parse using New York timezone
      const timestamp = moment.tz(item.tradetime, "America/New_York");
      const minutes = timestamp.minutes();
      timestamp.minutes(Math.floor(minutes / minutesInterval) * minutesInterval);
      timestamp.seconds(0);
      const timeKey = timestamp.unix();

      if (!groupedData[timeKey]) {
        groupedData[timeKey] = {
          time: timeKey,
          open: parseFloat(item.open),
          high: parseFloat(item.high),
          low: parseFloat(item.low),
          close: parseFloat(item.close),
          volume: parseFloat(item.volume)
        };
      } else {
        groupedData[timeKey].high = Math.max(groupedData[timeKey].high, parseFloat(item.high));
        groupedData[timeKey].low = Math.min(groupedData[timeKey].low, parseFloat(item.low));
        groupedData[timeKey].close = parseFloat(item.close);
        groupedData[timeKey].volume += parseFloat(item.volume);
      }
    });

    return Object.values(groupedData).sort((a, b) => a.time - b.time);
  };

  const fetchStockData = async () => {
    try {
      if (!date) {
        message.warning('Please select a date');
        return;
      }

      const formattedDate = date.format('YYYY-MM-DD');
      console.log('Fetching data for:', formattedDate);

      const response = await fetch(`/api/stock-data?symbol=${symbol}&date=${formattedDate}`);
      const data = await response.json();
      console.log('Received data:', data); // Debug log

      if (!data || data.error || !Array.isArray(data) || data.length === 0) {
        message.warning('No data available for selected date');
        return;
      }

      if (chartRef.current && data.length > 0) {
        const { candlestickSeries, volumeSeries, chart } = chartRef.current;
        const minutesInterval = parseInt(interval.replace('m',''));
        const aggregatedData = aggregateData(data, minutesInterval);

        // Clear and set data
        candlestickSeries.setData([]);
        volumeSeries.setData([]);
        
        candlestickSeries.setData(aggregatedData);
        volumeSeries.setData(aggregatedData.map(item => ({
          time: item.time,
          value: item.volume,
          color: item.close >= item.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)'
        })));

        // Set visible range using New York time
        const startTime = moment.tz(`${formattedDate} 09:30`, 'YYYY-MM-DD HH:mm', 'America/New_York').unix();
        const endTime = moment.tz(`${formattedDate} 16:00`, 'YYYY-MM-DD HH:mm', 'America/New_York').unix();
        
        chart.timeScale().applyOptions({
          rightOffset: 12,
          barSpacing: 12, // Increase spacing between bars
        });

        chart.timeScale().setVisibleRange({
          from: startTime,
          to: endTime,
        });

        // Fit content to view
        setTimeout(() => {
          chart.timeScale().fitContent();
        }, 0);

        message.success(`Loaded ${data.length} data points`);
      }
    } catch (error) {
      console.error('Error fetching stock data:', error);
      message.error('Failed to fetch stock data');
    }
  };

  // Update time formatter to use New York time
  const formatTime = (timestamp) => {
    return moment.tz(timestamp * 1000, "America/New_York").format("HH:mm");
  };

  // Replace the renderLegend implementation with the following:
  const renderLegend = (bar) => {
    if (!bar) return '';
    const minutesInterval = parseInt(interval.replace('m',''));
    // Convert bar.time (Unix seconds) to NY time and round to the nearest 2‐minute interval
    const nyTime = moment.tz(bar.time * 1000, "America/New_York");
    const minutes = nyTime.minutes();
    const roundedMinutes = Math.floor(minutes / minutesInterval) * minutesInterval;
    nyTime.minutes(roundedMinutes).seconds(0);
    
    const timeStr = nyTime.format("HH:mm");
    const nextTime = moment(nyTime).add(minutesInterval, "minutes").format("HH:mm");
    
    return `
      <div style="padding: 12px; background: white; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; line-height: 1.5;">
        <div>Time: ${timeStr} - ${nextTime}</div>
        <div style="color: ${bar.close >= bar.open ? '#26a69a' : '#ef5350'}">
          Open: ${bar.open.toFixed(2)}
          High: ${bar.high.toFixed(2)}
          Low: ${bar.low.toFixed(2)}
          Close: ${bar.close.toFixed(2)}
        </div>
        <div>Volume: ${bar.volume.toLocaleString()}</div>
      </div>
    `;
  };

  // Add date change handler
  const handleDateChange = (newDate) => {
    setDate(newDate);
  };

  const handleSymbolChange = (newSymbol) => {
    setSymbol(newSymbol);
    // Do not auto-update date on symbol change
  };

  useEffect(() => {
    if (chartContainerRef.current) {
      // Create legend container
      legendRef.current = document.createElement('div');
      legendRef.current.style.position = 'absolute';
      legendRef.current.style.left = '12px';
      legendRef.current.style.top = '12px';
      legendRef.current.style.zIndex = '2';
      chartContainerRef.current.appendChild(legendRef.current);

      const chart = createChart(chartContainerRef.current, {
        height: 500,
        layout: {
          backgroundColor: '#ffffff',
          textColor: '#333',
        },
        grid: {
          vertLines: { color: '#f0f0f0' },
          horzLines: { color: '#f0f0f0' },
        },
        crosshair: {
          mode: 'normal',
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
          rightOffset: 12,
          barSpacing: 12,  // Default bar spacing
          minBarSpacing: 2,  // Minimum bar spacing
          tickMarkFormatter: (time) => formatTime(time),
          borderColor: '#D1D4DC',
          fixLeftEdge: true,
          fixRightEdge: true,
        },
        localization: {
          timeFormatter: (timestamp) =>
            moment.tz(timestamp * 1000, "America/New_York").format("HH:mm")
        }
      });

      const candlestickSeries = chart.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
      });

      const volumeSeries = chart.addHistogramSeries({
        color: '#26a69a',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: 'volume',
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
      });

      chart.priceScale('volume').applyOptions({
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
      });

      // Add crosshair move handler
      chart.subscribeCrosshairMove((param) => {
        if (param.time && param.point) {
          const currentData = param.seriesData.get(candlestickSeries);
          if (currentData) {
            const volumeData = param.seriesData.get(volumeSeries);
            setCurrentBar({
              ...currentData,
              time: param.time,
              volume: volumeData?.value || 0
            });
          }
        } else {
          setCurrentBar(null);
        }
      });

      // Adjust chart size when window resizes
      const handleResize = () => {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth
        });
      };

      window.addEventListener('resize', handleResize);
      handleResize();

      chartRef.current = {
        chart,
        candlestickSeries,
        volumeSeries,
      };

      return () => {
        window.removeEventListener('resize', handleResize);
        chart.remove();
        if (legendRef.current && legendRef.current.parentNode) {
          legendRef.current.parentNode.removeChild(legendRef.current);
        }
      };
    }
  }, []);

  const handleSearch = async () => {
    if (!symbol || !date) {
      message.error('Please select both symbol and date');
      return;
    }
    await fetchStockData();
  };

  // Update legend when current bar changes
  useEffect(() => {
    if (legendRef.current) {
      legendRef.current.innerHTML = renderLegend(currentBar);
    }
  }, [currentBar]);

  return (
    <div className="stock-chart">
      <h2>Stock Price Chart</h2>
      <Space className="controls" style={{ marginBottom: '20px' }}>
        <Select
          value={symbol}
          onChange={handleSymbolChange}
          style={{ width: 120 }}
        >
          <Select.Option value="SPY">SPY</Select.Option>
          <Select.Option value="QQQ">QQQ</Select.Option>
        </Select>
        
        <DatePicker
          value={date}
          onChange={handleDateChange}
          // Disable dates in the future
          disabledDate={current => current && current > moment().endOf('day')}
          allowClear={false}
          style={{ width: 120 }}
        />

        <Select
          value={interval}
          onChange={handleIntervalChange}
          style={{ width: 120 }}
        >
          <Select.Option value="1m">1m</Select.Option>
          <Select.Option value="2m">2m</Select.Option>
          <Select.Option value="5m">5m</Select.Option>
          <Select.Option value="10m">10m</Select.Option>
        </Select>

        <Button 
          type="primary" 
          onClick={handleSearch}
          disabled={!date}
        >
          Search
        </Button>
      </Space>

      <div 
        ref={chartContainerRef}
        style={{ 
          width: '100%',
          height: '600px',
          border: '1px solid #ddd',
          borderRadius: '4px',
          position: 'relative'
        }}
      />
    </div>
  );
};

export default StockChart;
