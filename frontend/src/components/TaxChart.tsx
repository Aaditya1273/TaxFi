'use client';

import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface TaxChartProps {
  data: any[];
  type?: 'line' | 'area' | 'bar';
  dataKey: string;
  xAxisKey?: string;
  color?: string;
  height?: number;
}

export function TaxChart({ 
  data, 
  type = 'area', 
  dataKey, 
  xAxisKey = 'name',
  color = '#0ea5e9',
  height = 300 
}: TaxChartProps) {
  const gradientId = `gradient-${dataKey}-${color.replace('#', '')}`;

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={height}>
        {type === 'line' ? (
          <LineChart data={data}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis 
              dataKey={xAxisKey} 
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
            />
            <YAxis 
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '12px',
                padding: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
              itemStyle={{ color: '#111827' }}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey={dataKey} 
              stroke={color}
              strokeWidth={3}
              dot={{ fill: color, strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: color, strokeWidth: 2 }}
              style={{ filter: `drop-shadow(0 0 8px ${color})` }}
            />
          </LineChart>
        ) : type === 'area' ? (
          <AreaChart data={data}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.4}/>
                <stop offset="95%" stopColor={color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis 
              dataKey={xAxisKey} 
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
            />
            <YAxis 
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '12px',
                padding: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
              itemStyle={{ color: '#111827' }}
            />
            <Legend />
            <Area 
              type="monotone" 
              dataKey={dataKey} 
              stroke={color}
              strokeWidth={3}
              fill={`url(#${gradientId})`}
              style={{ filter: `drop-shadow(0 0 8px ${color})` }}
            />
          </AreaChart>
        ) : (
          <BarChart data={data}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.8}/>
                <stop offset="95%" stopColor={color} stopOpacity={0.4}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis 
              dataKey={xAxisKey} 
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
            />
            <YAxis 
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '12px',
                padding: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
              itemStyle={{ color: '#111827' }}
            />
            <Legend />
            <Bar 
              dataKey={dataKey} 
              fill={`url(#${gradientId})`}
              radius={[8, 8, 0, 0]}
              style={{ filter: `drop-shadow(0 0 8px ${color})` }}
            />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
