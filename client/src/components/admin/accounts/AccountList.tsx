'use client';

import React, { useState, useEffect } from 'react';
import api from '@/utils/api';
import { CreateAccountModal } from './CreateAccountModal';
import { AccountDetailModal } from '@/components/admin/accounts/AccountDetailModal';

interface Account {
  _id: string;
  username: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  firstName?: string;
  lastName?: string;
  employeeId?: string;
  gender?: number;
  dateOfBirth?: string;
  phoneNumber?: string;
  position?: string;
  group?: {
    _id: string;
    name: string;
  };
}

interface Group {
  _id: string;
  name: string;
}

export const AccountList: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch groups once when component mounts
  const fetchGroups = async () => {
    setLoadingGroups(true);
    try {
      const response = await api.get('/groups?limit=100');
      setGroups(response.data.groups || []);
    } catch (err) {
      console.error('Error fetching groups:', err);
      setError('Không thể tải danh sách bộ phận');
    } finally {
      setLoadingGroups(false);
    }
  };

  const fetchAccounts = async (page = currentPage, limit = pageSize, search = searchQuery) => {
    try {
      const response = await api.get(`/admin/accounts?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`);
      const data = response.data;

      if (data && typeof data === 'object' && 'accounts' in data && 'pagination' in data) {
        setAccounts(data.accounts);
        setTotalItems(data.pagination.total);
        setTotalPages(data.pagination.totalPages);
        setCurrentPage(data.pagination.page);
      } else {
        console.error('Unexpected response format:', data);
        setError('Unexpected response format from server');
      }
      setError(null);
    } catch (err) {
      console.error('Error fetching accounts:', err);
      setError('Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Load both accounts and groups when component mounts
    const loadData = async () => {
      await Promise.all([fetchAccounts(), fetchGroups()]);
    };
    loadData();
  }, []);

  // Handle search input change
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  // Handle search on Enter key press
  const handleSearchKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      setCurrentPage(1); // Reset to first page when searching
      fetchAccounts(1, pageSize, searchQuery);
    }
  };

  // Handle page change
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
    fetchAccounts(newPage, pageSize, searchQuery);
  };

  // Handle page size change
  const handlePageSizeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newSize = parseInt(event.target.value, 10);
    setPageSize(newSize);
    setCurrentPage(1); // Reset to first page
    fetchAccounts(1, newSize, searchQuery);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'inactive':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      case 'suspended':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  if (loading || loadingGroups) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative dark:bg-red-900 dark:border-red-700 dark:text-red-300" role="alert">
        <strong className="font-bold">Lỗi: </strong>
        <span className="block sm:inline">{error}</span>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Tài khoản</h2>
          <div className="flex items-center gap-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Tìm kiếm tài khoản..."
                value={searchQuery}
                onChange={handleSearchChange}
                onKeyPress={handleSearchKeyPress}
                className="w-64 px-4 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
              <svg
                className="absolute right-3 top-2.5 h-5 w-5 text-gray-400 dark:text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2 bg-brand-500 text-white rounded-md hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-700"
            >
              Tạo tài khoản
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Mã nhân viên
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Tên
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Số điện thoại
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Chức vụ
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Bộ phận
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Trạng thái
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Hành động
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {accounts.map((account) => (
              <tr key={account._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                  {account.employeeId || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                  {account.firstName} {account.lastName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                  {account.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                  {account.phoneNumber || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                  {account.position || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                  {account.group?.name || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                  {account.role}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(account.status)}`}>
                    {account.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => setSelectedAccount(account)}
                    className="text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300 mr-4"
                  >
                    Sửa
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination UI */}
      <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 px-6 pb-6">
        <div className="flex items-center space-x-2">
          <label htmlFor="page-size" className="text-sm text-gray-500 dark:text-gray-400">
            Hiển thị:
          </label>
          <select
            id="page-size"
            value={pageSize}
            onChange={handlePageSizeChange}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          >
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="20">20</option>
          </select>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            trên {totalItems} mục
          </span>
        </div>

        <div className="flex items-center justify-center space-x-1">
          <button
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-500 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
          >
            <span className="sr-only">Trang đầu</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="11 17 6 12 11 7"></polyline>
              <polyline points="18 17 13 12 18 7"></polyline>
            </svg>
          </button>
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-500 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
          >
            <span className="sr-only">Trang trước</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>

          <span className="mx-2 inline-flex text-sm font-medium text-gray-700 dark:text-gray-300">
            Trang {currentPage} trên {totalPages}
          </span>

          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-500 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
          >
            <span className="sr-only">Trang tiếp</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
          <button
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-500 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
          >
            <span className="sr-only">Trang cuối</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="13 17 18 12 13 7"></polyline>
              <polyline points="6 17 11 12 6 7"></polyline>
            </svg>
          </button>
        </div>
      </div>

      <CreateAccountModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => fetchAccounts(currentPage, pageSize, searchQuery)}
        groups={groups}
      />

      {selectedAccount && (
        <AccountDetailModal
          isOpen={!!selectedAccount}
          onClose={() => setSelectedAccount(null)}
          account={selectedAccount}
          onUpdate={() => fetchAccounts(currentPage, pageSize, searchQuery)}
          groups={groups}
        />
      )}
    </div>
  );
}; 