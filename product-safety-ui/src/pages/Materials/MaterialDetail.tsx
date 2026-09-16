import { useParams, useNavigate } from 'react-router-dom';
import { materialsData, complianceRecords } from '../../mockData';
import { StatusBadge } from '../../components/StatusBadge';
import { ArrowLeft, Download, FileText, Upload, History, FileCheck } from 'lucide-react';

export default function MaterialDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const material = materialsData.find(m => m.id === id);

  if (!material) return <div className="space-y-4 p-6"><h1 className="text-xl font-semibold">Không tìm thấy vật liệu</h1><button className="text-blue-800 underline" onClick={() => navigate('/materials')}>Về danh mục vật liệu</button></div>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/materials')}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">{material.code}</h1>
              <StatusBadge status={material.status as any} />
            </div>
            <p className="text-sm text-gray-500 mt-1">{material.name} · {material.supplier}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
            <History className="h-4 w-4" /> Audit Log
          </button>
          <button className="flex items-center gap-2 rounded-md bg-blue-800 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
            <Upload className="h-4 w-4" /> Upload Document
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-gray-400" /> Thông tin chung
            </h3>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">Nhà cung cấp</dt>
                <dd className="mt-1 text-sm text-gray-900 font-medium">{material.supplier}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Nhà sản xuất (Manufacturer)</dt>
                <dd className="mt-1 text-sm text-gray-900">{material.manufacturer}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Loại vật liệu</dt>
                <dd className="mt-1 text-sm text-gray-900">{material.type}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Project</dt>
                <dd className="mt-1 text-sm text-gray-900">{material.project}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">DRI (Người phụ trách)</dt>
                <dd className="mt-1 text-sm text-gray-900">{material.dri}</dd>
              </div>
              <div className="pt-4 border-t">
                <dt className="text-sm font-medium text-gray-500">Ngày cập nhật cuối</dt>
                <dd className="mt-1 text-sm text-gray-900">{material.lastUpdate}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Right Column: Compliance Matrix */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="p-6 border-b bg-gray-50/50">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-blue-700" /> Hồ sơ Compliance (Compliance Matrix)
              </h3>
              <p className="text-sm text-gray-500 mt-1">Toàn bộ tình trạng tuân thủ của vật liệu trên một màn hình.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-white">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Loại hồ sơ</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Mã Chứng Nhận / Report ID</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Phòng Lab</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Trạng thái</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Ngày hết hạn</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">File</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-900 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {complianceRecords.map((record, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-sm text-gray-900">
                        {record.type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {record.reportId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {record.lab}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={record.status as any} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.expiryDate}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {record.file !== '-' ? (
                          <a href="#" className="text-blue-600 hover:underline flex items-center gap-1">
                            <FileText className="h-4 w-4" /> {record.file}
                          </a>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        {record.file !== '-' ? (
                          <button className="text-gray-500 hover:text-gray-700" title="Download">
                            <Download className="h-4 w-4 inline" />
                          </button>
                        ) : (
                          <button className="text-blue-600 hover:text-blue-800 text-xs font-medium">Upload</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Notes / Action needed */}
          {material.status !== 'compliant' && (
            <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-6">
              <h4 className="text-amber-800 font-semibold mb-2 flex items-center gap-2">
                Action Required
              </h4>
              <p className="text-sm text-amber-900">
                RoHS Test Report is expiring soon. Please contact {material.supplier} to provide the renewed test report before 2026-08-15 to avoid supply chain disruption.
              </p>
              <button className="mt-4 bg-white border border-amber-300 text-amber-800 px-4 py-2 rounded-md text-sm font-medium hover:bg-amber-100">
                Send Notification to Supplier
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
