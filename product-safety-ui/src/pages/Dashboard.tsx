import { kpiData, ctsData } from '../mockData';
import { 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  AlertTriangle,
  FileText
} from 'lucide-react';
import { cn } from '../lib/utils';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

const chartData = [
  { name: 'Jan', compliance: 85 },
  { name: 'Feb', compliance: 88 },
  { name: 'Mar', compliance: 87 },
  { name: 'Apr', compliance: 90 },
  { name: 'May', compliance: 89 },
  { name: 'Jun', compliance: 92 },
];

function StatusIcon({ status }: { status: string }) {
  if (status === 'compliant') return <CheckCircle2 className="h-5 w-5 text-compliant" />;
  if (status === 'warning') return <AlertTriangle className="h-5 w-5 text-warning" />;
  return <AlertCircle className="h-5 w-5 text-ng" />;
}

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Dashboard</h1>
        <div className="text-sm text-gray-500">Last updated: Today, 09:41 AM</div>
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">Overall Compliance</p>
            <TrendingUp className="h-4 w-4 text-compliant" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-3xl font-bold text-gray-900">{kpiData.complianceRate}%</p>
            <span className="text-sm font-medium text-compliant">+2.1%</span>
          </div>
        </div>
        
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">Active Materials</p>
            <FileText className="h-4 w-4 text-gray-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-3xl font-bold text-gray-900">{kpiData.totalMaterials}</p>
          </div>
          <div className="mt-1 text-sm text-gray-500">
            <span className="text-compliant font-medium">{kpiData.compliantMaterials} Compliant</span> · {kpiData.pendingMaterials} Pending
          </div>
        </div>

        <div className="rounded-xl border border-red-100 bg-red-50/30 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">Critical Issues</p>
            <AlertCircle className="h-4 w-4 text-ng" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-3xl font-bold text-ng">{kpiData.ngMaterials + kpiData.expiredMaterials}</p>
            <span className="text-sm font-medium text-gray-600">Items</span>
          </div>
          <div className="mt-1 text-sm text-gray-500">
            {kpiData.ngMaterials} NG · {kpiData.expiredMaterials} Expired
          </div>
        </div>

        <div className="rounded-xl border border-amber-100 bg-amber-50/30 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">Open Actions</p>
            <Clock className="h-4 w-4 text-warning" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-3xl font-bold text-warning">{kpiData.openNCR + kpiData.overdueCAPA}</p>
            <span className="text-sm font-medium text-gray-600">Tasks</span>
          </div>
          <div className="mt-1 text-sm text-gray-500">
            {kpiData.openNCR} Open NCR · <span className="text-ng font-medium">{kpiData.overdueCAPA} Overdue CAPA</span>
          </div>
        </div>
      </div>

      {/* 3 Large Cards for CTS */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {ctsData.map((cts) => (
          <div key={cts.id} className="flex flex-col rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className={cn(
              "px-6 py-4 border-b",
              cts.status === 'compliant' ? "bg-green-50/50" : 
              cts.status === 'warning' ? "bg-amber-50/50" : "bg-red-50/50"
            )}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">{cts.id}</h3>
                <StatusIcon status={cts.status} />
              </div>
              <p className="mt-1 text-sm text-gray-600 font-medium">{cts.name}</p>
            </div>
            <div className="p-6 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-500">Completion</span>
                  <span className="text-sm font-bold text-gray-900">{cts.completion}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className={cn(
                      "h-2.5 rounded-full",
                      cts.status === 'compliant' ? "bg-compliant" : 
                      cts.status === 'warning' ? "bg-warning" : "bg-ng"
                    )}
                    style={{ width: `${cts.completion}%` }}
                  ></div>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-4 border-t pt-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Open Issues</p>
                  <p className={cn("text-xl font-bold mt-1", cts.openIssues > 0 ? (cts.status === 'ng' ? 'text-ng' : 'text-warning') : 'text-gray-900')}>
                    {cts.openIssues}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Last Update</p>
                  <p className="text-sm font-medium text-gray-900 mt-2">{cts.lastUpdate}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts and Lists */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Compliance Trend</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280' }} />
                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#6b7280' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  itemStyle={{ color: '#111827', fontWeight: 600 }}
                />
                <Line type="monotone" dataKey="compliance" stroke="#1d4ed8" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold text-gray-900">Action Items</h3>
          </div>
          <div className="p-0 overflow-y-auto flex-1">
            <ul className="divide-y divide-gray-200">
              <li className="p-4 hover:bg-gray-50 flex items-start gap-3">
                <div className="bg-red-100 p-2 rounded-lg mt-0.5"><AlertCircle className="h-4 w-4 text-red-600"/></div>
                <div>
                  <p className="text-sm font-medium text-gray-900">CAPA-2026-045 is overdue</p>
                  <p className="text-xs text-gray-500 mt-1">Due: 2026-09-10 · Assigned to: You</p>
                </div>
              </li>
              <li className="p-4 hover:bg-gray-50 flex items-start gap-3">
                <div className="bg-amber-100 p-2 rounded-lg mt-0.5"><Clock className="h-4 w-4 text-amber-600"/></div>
                <div>
                  <p className="text-sm font-medium text-gray-900">3 Test Reports expiring in 30 days</p>
                  <p className="text-xs text-gray-500 mt-1">Action required for renewal</p>
                </div>
              </li>
              <li className="p-4 hover:bg-gray-50 flex items-start gap-3">
                <div className="bg-amber-100 p-2 rounded-lg mt-0.5"><Clock className="h-4 w-4 text-amber-600"/></div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Training "RoHS 3.0" due soon</p>
                  <p className="text-xs text-gray-500 mt-1">Due: 2026-09-30</p>
                </div>
              </li>
            </ul>
          </div>
          <div className="p-4 border-t bg-gray-50 text-center">
            <button className="text-sm font-medium text-blue-700 hover:text-blue-800">View All Actions &rarr;</button>
          </div>
        </div>
      </div>
    </div>
  );
}
