import React, { useState, useEffect } from 'react';
import { Form, Input, Button, DatePicker, Select, InputNumber, Space, Table, message } from 'antd';
import moment from 'moment-timezone';  // Use moment-timezone
import { ENDPOINTS } from '../config/api';

const { TextArea } = Input;
const { Option } = Select;

const TradeEntry = () => {
  const [form] = Form.useForm();
  const [trades, setTrades] = useState([]);
  const [editingTrade, setEditingTrade] = useState(null);

  useEffect(() => {
    fetchTrades();
  }, []);

  const fetchTrades = async () => {
    try {
      const response = await fetch(ENDPOINTS.TRADES);
      const data = await response.json();
      setTrades(data);
    } catch (error) {
      message.error('Failed to fetch trades');
    }
  };

  const onFinish = async (values) => {
    const nyTime = values.actionDate.clone()
      .tz('America/New_York')
      .hour(values.actionTime.hour())
      .minute(values.actionTime.minute());

    const tradeData = {
      ...values,
      action_datetime: nyTime.format('YYYY-MM-DD HH:mm:ss'),
      fee: values.fee || 0
    };

    try {
      const url = editingTrade 
        ? `${ENDPOINTS.TRADES}?id=${editingTrade.id}`
        : ENDPOINTS.TRADES;
      
      const method = editingTrade ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tradeData)
      });

      if (response.ok) {
        message.success(`Trade ${editingTrade ? 'updated' : 'saved'} successfully`);
        form.resetFields();
        setEditingTrade(null);
        fetchTrades();
      } else {
        throw new Error('Failed to save trade');
      }
    } catch (error) {
      message.error(error.message);
    }
  };

  const columns = [
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
      title: 'Action Time (NY)', 
      dataIndex: 'action_datetime',
      sorter: (a, b) => moment.tz(a.action_datetime, "America/New_York").unix() - 
                        moment.tz(b.action_datetime, "America/New_York").unix(),
      render: (text) => moment.tz(text, "America/New_York").format('YYYY-MM-DD HH:mm')
    },
    { 
      title: 'Price', 
      dataIndex: 'action_price',
      sorter: (a, b) => a.action_price - b.action_price,
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
    {
      title: 'Action',
      key: 'action',
      fixed: 'right',
      width: 100,
      render: (_, record) => (
        <Button onClick={() => {
          setEditingTrade(record);
          form.setFieldsValue({
            ...record,
            actionDate: moment(record.action_datetime),
            actionTime: moment(record.action_datetime),
          });
        }}>
          Edit
        </Button>
      ),
    },
  ];

  // Add fee field to existing form items
  const formItems = (
    <>
      <Space size="large" style={{ display: 'flex', marginBottom: '24px' }}>
        <Form.Item
          name="symbol"
          label="Symbol"
          rules={[{ required: true, message: 'Please enter symbol' }]}
        >
          <Select style={{ width: 120 }}>
            <Option value="SPY">SPY</Option>
            <Option value="QQQ">QQQ</Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="name"
          label="Name"
          rules={[{ required: true, message: 'Please enter trade name' }]}
        >
          <Input placeholder="e.g., SPY 400 Call 7/21" style={{ width: 200 }} />
        </Form.Item>
      </Space>

      <Space size="large" style={{ display: 'flex', marginBottom: '24px' }}>
        <Form.Item
          name="action"
          label="Action"
          rules={[{ required: true, message: 'Please select action' }]}
        >
          <Select style={{ width: 120 }}>
            <Option value="BUY">Buy</Option>
            <Option value="SELL">Sell</Option>
            <Option value="BTO">Buy to Open</Option>
            <Option value="STC">Sell to Close</Option>
            <Option value="STO">Sell to Open</Option>
            <Option value="BTC">Buy to Close</Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="actionDate"
          label="Action Date"
          rules={[{ required: true }]}
        >
          <DatePicker />
        </Form.Item>

        <Form.Item
          name="actionTime"
          label="Action Time"
          rules={[{ required: true }]}
        >
          <DatePicker.TimePicker format="HH:mm" minuteStep={1} />
        </Form.Item>

        <Form.Item
          name="action_price"
          label="Action Price"
          rules={[{ required: true }]}
        >
          <InputNumber
            step={0.01}
            precision={2}
            style={{ width: 120 }}
          />
        </Form.Item>

        <Form.Item
          name="size"
          label="Size"
          rules={[{ required: true }]}
        >
          <InputNumber min={1} />
        </Form.Item>

        <Form.Item
          name="fee"
          label="Fee"
          rules={[{ required: false }]}
        >
          <InputNumber
            step={0.01}
            precision={2}
            style={{ width: 120 }}
          />
        </Form.Item>
      </Space>

      <Form.Item
        name="reason"
        label="Reason for Entry"
        rules={[{ required: true, message: 'Please provide entry reason' }]}
      >
        <TextArea
          rows={3}
          placeholder="Describe your reason for entering this trade..."
          style={{ width: '100%' }}
        />
      </Form.Item>

      <Form.Item
        name="mental_state"
        label="Mental State"
        rules={[{ required: true, message: 'Please describe your mental state' }]}
      >
        <TextArea
          rows={2}
          placeholder="Describe your mental state during this trade..."
          style={{ width: '100%' }}
        />
      </Form.Item>

      <Form.Item
        name="description"
        label="Trade Description"
      >
        <TextArea
          rows={4}
          placeholder="Detailed description of trade setup and execution..."
        />
      </Form.Item>

      <Form.Item>
        <Button type="primary" htmlType="submit" size="large">
          Save Trade
        </Button>
      </Form.Item>
    </>
  );

  return (
    <div className="trade-entry">
      <h2>{editingTrade ? 'Edit Trade' : 'Enter Trade Details'}</h2>
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        initialValues={{
          actionDate: moment(),
          actionTime: moment(),
          size: 1,
          fee: 0
        }}
      >
        {formItems}
      </Form>

      <div style={{ marginTop: '40px' }}>
        <h3>Recent Trades</h3>
        <Table
          columns={columns}
          dataSource={trades}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} trades`,
            showQuickJumper: true,
            showSizeChanger: false
          }}
          scroll={{ x: 1300 }}
          size="small"
        />
      </div>
    </div>
  );
};

export default TradeEntry;
