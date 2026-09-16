import { Bell, Search, Plus } from 'lucide-react';

export default function Header() {
  return (
    <header className="flex h-16 flex-shrink-0 items-center justify-between border-b bg-white px-6 shadow-sm">
      <div className="flex flex-1">
        <div className="flex w-full max-w-lg items-center">
          <div className="relative w-full">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full rounded-md border-0 py-1.5 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
              placeholder="Search Material, Supplier, Report No..."
            />
          </div>
        </div>
      </div>
      <div className="ml-4 flex items-center space-x-4">
        <button
          type="button"
          className="flex items-center gap-2 rounded-md bg-blue-800 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <Plus className="h-4 w-4" />
          Quick Add
        </button>
        <button
          type="button"
          className="relative rounded-full bg-white p-1 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            3
          </span>
          <span className="sr-only">View notifications</span>
          <Bell className="h-6 w-6" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
