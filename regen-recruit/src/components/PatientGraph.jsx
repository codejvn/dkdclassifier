import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';

const TICK = { fontFamily: 'Tahoma, Arial, sans-serif', fontSize: 10, fill: '#444444' };

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  const inRange = val >= 70 && val <= 180;
  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #808080',
      boxShadow: 'inset 1px 1px #808080, inset -1px -1px #ffffff, 2px 2px 0 rgba(0,0,0,0.3)',
      padding: '5px 10px',
      fontFamily: 'Tahoma, Arial, sans-serif',
      fontSize: 11,
    }}>
      <div style={{ color: '#444', marginBottom: 2 }}>Time: {label}</div>
      <div style={{ fontWeight: 'bold', color: inRange ? '#007700' : '#cc0000' }}>
        {val} mg/dL
      </div>
      <div style={{ fontSize: 10, color: '#808080', marginTop: 1 }}>
        {val < 70 ? '▼ Hypoglycemia' : val > 180 ? '▲ Hyperglycemia' : '✓ In range'}
      </div>
    </div>
  );
}

export default function PatientGraph({ data }) {
  return (
    <div style={{
      width: '100%',
      height: 210,
      background: '#ffffff',
      boxShadow: 'inset 1px 1px #808080, inset -1px -1px #ffffff',
      padding: '8px 4px 4px 0',
    }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 14, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="2 4" stroke="#e0e0e0" vertical={false} />
          <ReferenceLine y={180} stroke="#996600" strokeDasharray="4 3" strokeWidth={1}
            label={{ value: '180', position: 'right', fontSize: 9, fill: '#996600' }} />
          <ReferenceLine y={70}  stroke="#996600" strokeDasharray="4 3" strokeWidth={1}
            label={{ value: '70',  position: 'right', fontSize: 9, fill: '#996600' }} />
          <XAxis dataKey="time" tick={TICK} axisLine={{ stroke: '#aaa' }} tickLine={{ stroke: '#aaa' }} />
          <YAxis domain={[50, 300]} tick={TICK} axisLine={{ stroke: '#aaa' }} tickLine={{ stroke: '#aaa' }} width={34} />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#000080"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: '#000080', stroke: '#ffffff', strokeWidth: 1 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
