import { useState } from 'react';
import { StatusBadge } from '../../components/StatusBadge';
import { Search, Plus, Filter, AlertCircle } from 'lucide-react';

const capaData = [
  {
    id: "CAPA-2026-045",
    ncrRel: "NCR-2026-112",
    issue: "RoHS Pb failure in Component X",
    rootCause: "Supplier used unauthorized alternative material batch",
    action: "Purge stock, supplier process audit, update incoming inspection",
    dri: "Linh.Hoang",
    targetDate: "2026-09-10",
    status: "ng", // overdue
  },
  {
    id: "CAPA-2026-046",
    ncrRel: "NCR-2026-115",
    issue: "Missing VOC declaration from new supplier",
    rootCause: "New supplier onboarding process gap",
    action: "Update supplier manual, request VOC immediately",
    dri: "Nguyen.Van.A",
    targetDate: "2026-09-30",
    status: "pending",
  },
  {
    id: "CAPA-2026-030",
    ncrRel: "NCR-2026-088",
    issue: "PFAS test report expired without notice",
    rootCause: "Manual tracking failure",
    action: "Implement automated system alerts for 90/60/30 days",
    dri: "Tran.Thi.B",
    targetDate: "2026-08-15",
    status: "compliant", // closed
  }
];

export default function CAPA() {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Corrective & Preventive Actions (CAPA)</h1>
          <p className="text-sm text-gray-500 mt-1">Quản lý và theo dõi các hành động khắc phục, phòng ngừa.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 rounded-md bg-blue-800 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
            <Plus className="h-4 w-4" /> New CAPA
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search CAPA No, NCR No, or Issue..."
              className="w-full pl-9 pr-4 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="flex items-center gap-2 text-sm font-medium text-gray-700 px-3 py-2 border rounded-md hover:bg-gray-50">
            <Filter className="h-4 w-4" /> Filters
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CAPA No.</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issue Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DRI</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {capaData.map((capa) => (
                <tr key={capa.id} className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-6 py-4">
                    <div className="font-medium text-blue-700">{capa.id}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Ref: {capa.ncrRel}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 font-medium">{capa.issue}</div>
                    <div className="text-xs text-gray-500 truncate max-w-xs mt-0.5" title={capa.action}>Action: {capa.action}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{capa.dri}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={capa.status === 'ng' ? 'text-red-600 font-medium' : 'text-gray-900'}>
                      {capa.targetDate}
                    </span>
                    {capa.status === 'ng' && <AlertCircle className="inline h-4 w-4 text-red-600 ml-1" />}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={capa.status as any} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
