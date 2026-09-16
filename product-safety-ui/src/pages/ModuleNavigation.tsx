import { Link } from 'react-router-dom';
import { ArrowRight, Construction } from 'lucide-react';

type MenuItem = { name: string; href: string };

export default function ModuleNavigation({ name, children = [] }: { name: string; children?: MenuItem[] }) {
  return <section className="space-y-6">
    <h1 className="text-2xl font-bold text-gray-900">{name}</h1>
    {children.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {children.map(item => <Link key={item.href} to={item.href} className="flex items-center justify-between gap-4 rounded-xl border bg-white p-6 font-semibold text-blue-900 shadow-sm hover:border-blue-600">{item.name}<ArrowRight size={18} className="shrink-0" /></Link>)}
    </div> : <div className="rounded-xl border bg-white p-8 text-gray-600">
      <Construction className="mb-4 text-amber-600" size={28} />
      <h2 className="mb-2 text-lg font-semibold text-gray-900">Chưa triển khai màn hình này</h2>
      <p>Mục này đã có trong cấu trúc menu theo yêu cầu. Giao diện nghiệp vụ và kết nối dữ liệu chưa được xây dựng.</p>
    </div>}
  </section>;
}
