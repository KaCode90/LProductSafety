import { ctsData } from '../../mockData';
import { StatusBadge } from '../../components/StatusBadge';
import { ShieldCheck, FileCheck } from 'lucide-react';

export default function ComplianceOverview() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Tuân thủ (Compliance Overview)</h1>
          <p className="text-sm text-gray-500 mt-1">Manage all restricted substances and environmental requirements.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {ctsData.map((cts) => (
          <div key={cts.id} className="bg-white rounded-xl shadow-sm border p-6 hover:border-blue-500 transition-colors cursor-pointer">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-blue-50 rounded-lg">
                <ShieldCheck className="h-6 w-6 text-blue-700" />
              </div>
              <StatusBadge status={cts.status as any} />
            </div>
            <h3 className="text-lg font-bold text-gray-900">{cts.id}</h3>
            <p className="text-sm font-medium text-gray-600 mt-1">{cts.name}</p>
            
            <div className="mt-6 pt-4 border-t border-gray-100 flex justify-between items-center text-sm">
              <span className="text-gray-500">Open Issues</span>
              <span className="font-bold text-gray-900">{cts.openIssues}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border mt-8">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50/50">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-gray-400" /> Recent Declarations
          </h3>
          <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">View All</button>
        </div>
        <div className="p-6 text-center text-gray-500">
          Compliance declaration tracking module will be displayed here.
        </div>
      </div>
    </div>
  );
}
