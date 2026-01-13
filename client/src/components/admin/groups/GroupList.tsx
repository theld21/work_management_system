'use client';

import React, { useState, useEffect } from 'react';
import api from '@/utils/api';
import { CreateGroupModal } from '@/components/admin/groups/CreateGroupModal';
import { GroupDetailModal } from '@/components/admin/groups/GroupDetailModal';

interface Group {
  _id: string;
  name: string;
  description?: string;
  manager?: {
    _id: string;
    firstName: string;
    lastName: string;
    username: string;
  };
  parentGroup?: {
    _id: string;
    name: string;
  };
  members: Array<{
    _id: string;
    firstName: string;
    lastName: string;
    username: string;
  }>;
  childGroups: string[];
  isActive: boolean;
  createdAt: string;
}

export const GroupList: React.FC = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchGroups = async (page = currentPage, limit = pageSize, search = searchQuery) => {
    try {
      const response = await api.get(`/groups?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&sort=${sortField}&direction=${sortDirection}`);
      const data = response.data;

      if (data && typeof data === 'object' && 'groups' in data && 'pagination' in data) {
        setGroups(data.groups);
        setTotalItems(data.pagination.total);
        setTotalPages(data.pagination.totalPages);
        setCurrentPage(data.pagination.page);
      } else {
        console.error('Unexpected response format:', data);
        setError('Unexpected response format from server');
      }
      setError(null);
    } catch (err) {
      console.error('Error fetching groups:', err);
      setError('Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, [sortField, sortDirection]);

  // Handle search input change with debounce
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearchQuery(value);

    // Debounce search
    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
      fetchGroups(1, pageSize, value);
    }, 500);

    return () => clearTimeout(timeoutId);
  };

  // Handle sort
  const handleSort = (field: string) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this group? This action cannot be undone.')) {
      return;
    }

    try {
      await api.delete(`/groups/${id}`);
      setSuccessMessage('Group deleted successfully');
      fetchGroups(currentPage, pageSize, searchQuery);

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (err) {
      console.error('Error deleting group:', err);
      setError('Failed to delete group');
    }
  };

  const handleGroupUpdate = () => {
    // Refresh the groups list when a group is updated
    fetchGroups(currentPage, pageSize, searchQuery);

    // Also refresh the selected group if it's open
    if (selectedGroup) {
      // Find the updated group in the new list and update the selected group
      setTimeout(async () => {
        try {
          const response = await api.get(`/groups/${selectedGroup._id}`);
          setSelectedGroup(response.data);
        } catch (err) {
          console.error('Error refreshing selected group:', err);
        }
      }, 100);
    }
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive
      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
  };

  if (loading) {
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
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Bộ phận</h2>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2 bg-brand-500 text-white rounded-md hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-700"
            >
              Tạo bộ phận
            </button>
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 bg-green-100 border-b border-green-200 dark:bg-green-900/30 dark:border-green-800">
          <p className="text-green-700 dark:text-green-400">{successMessage}</p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-100 border-b border-red-200 dark:bg-red-900/30 dark:border-red-800">
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-2">
                  Tên
                  {sortField === 'name' && (
                    <svg className={`w-4 h-4 ${sortDirection === 'desc' ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Quản lý
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Thành viên
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Bộ phận cha
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Trạng thái
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('createdAt')}
              >
                <div className="flex items-center gap-2">
                  Ngày tạo
                  {sortField === 'createdAt' && (
                    <svg className={`w-4 h-4 ${sortDirection === 'desc' ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </div>
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Hành động
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {groups.map((group) => (
              <tr key={group._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-300">
                  {group.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                  {group.manager ? `${group.manager.firstName} ${group.manager.lastName}` : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                  {group.members.length}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                  {group.parentGroup?.name || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(group.isActive)}`}>
                    {group.isActive ? 'Hoạt động' : 'Không hoạt động'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                  {new Date(group.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => setSelectedGroup(group)}
                    className="text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300 mr-4"
                  >
                    Sửa
                  </button>
                  <button
                    onClick={() => handleDelete(group._id)}
                    className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                  >
                    Xóa
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
            onChange={(event) => {
              const newSize = parseInt(event.target.value, 10);
              setPageSize(newSize);
              setCurrentPage(1); // Reset to first page
              fetchGroups(1, newSize, searchQuery);
            }}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          >
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="20">20</option>
          </select>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            của {totalItems} mục
          </span>
        </div>

        <div className="flex items-center justify-center space-x-1">
          <button
            onClick={() => {
              setCurrentPage(1);
              fetchGroups(1, pageSize, searchQuery);
            }}
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
            onClick={() => {
              if (currentPage > 1) {
                setCurrentPage(currentPage - 1);
                fetchGroups(currentPage - 1, pageSize, searchQuery);
              }
            }}
            disabled={currentPage === 1}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-500 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
          >
            <span className="sr-only">Trang trước</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>

          <span className="mx-2 inline-flex text-sm font-medium text-gray-700 dark:text-gray-300">
            Trang {currentPage} của {totalPages}
          </span>

          <button
            onClick={() => {
              if (currentPage < totalPages) {
                setCurrentPage(currentPage + 1);
                fetchGroups(currentPage + 1, pageSize, searchQuery);
              }
            }}
            disabled={currentPage === totalPages}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-500 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
          >
            <span className="sr-only">Trang tiếp</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
          <button
            onClick={() => {
              setCurrentPage(totalPages);
              fetchGroups(totalPages, pageSize, searchQuery);
            }}
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

      <CreateGroupModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          fetchGroups(currentPage, pageSize, searchQuery);
          setSuccessMessage('Group created successfully');
          setTimeout(() => setSuccessMessage(null), 3000);
        }}
      />

      {selectedGroup && (
        <GroupDetailModal
          isOpen={!!selectedGroup}
          onClose={() => setSelectedGroup(null)}
          group={selectedGroup}
          onUpdate={handleGroupUpdate}
        />
      )}
    </div>
  );
}; 