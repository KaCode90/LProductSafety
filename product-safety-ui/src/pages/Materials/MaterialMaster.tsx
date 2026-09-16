import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { materialsData } from '../../mockData';
import { StatusBadge } from '../../components/StatusBadge';
import { Search, Filter, Download } from 'lucide-react';

export default function MaterialMaster() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredMaterials = materialsData.filter(m => 
    m.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.supplier.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Danh mục Vật liệu</h1>
          <p className="text-sm text-gray-500 mt-1">Manage material compliance status and test reports.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
            <Download className="h-4 w-4" /> Export
          </button>
          <button className="rounded-md bg-blue-800 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
            Add Material
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search by code, name, supplier..."
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Material Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type/Project</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredMaterials.map((mat) => (
                <tr 
                  key={mat.id} 
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/materials/${mat.id}`)}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-700">{mat.code}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{mat.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{mat.supplier}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div>{mat.type}</div>
                    <div className="text-xs text-gray-400">{mat.project}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={mat.status as any} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{mat.expiryDate}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button className="text-blue-600 hover:text-blue-900">View</button>
                  </td>
                </tr>
              ))}
              {filteredMaterials.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
                    No materials found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t flex items-center justify-between text-sm text-gray-500">
          <div>Showing {filteredMaterials.length} results</div>
          <div className="flex gap-1">
            <button className="px-3 py-1 border rounded-md disabled:opacity-50" disabled>Previous</button>
            <button className="px-3 py-1 border rounded-md disabled:opacity-50" disabled>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
