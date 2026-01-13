'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import api from '@/utils/api';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface Manager {
  _id: string;
  firstName: string;
  lastName: string;
  username: string;
}

interface Group {
  _id: string;
  name: string;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    managerId: '',
    parentGroupId: '',
    handleRequestType: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetchManagers();
      fetchGroups();
      // Reset form when modal opens
      setFormData({
        name: '',
        description: '',
        managerId: '',
        parentGroupId: '',
        handleRequestType: ''
      });
      setError(null);
    }
  }, [isOpen]);

  const fetchManagers = async () => {
    try {
      // Fetch all users that can be managers
      const response = await api.get('/groups/users');
      setManagers(response.data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const fetchGroups = async () => {
    try {
      const response = await api.get('/groups?limit=100');
      setGroups(response.data.groups || []);
    } catch (err) {
      console.error('Error fetching groups:', err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload: {
        name: string;
        description: string;
        managerId?: string;
        parentGroupId?: string;
        handleRequestType?: string;
      } = {
        name: formData.name,
        description: formData.description
      };

      if (formData.managerId) {
        payload.managerId = formData.managerId;
      }

      if (formData.parentGroupId) {
        payload.parentGroupId = formData.parentGroupId;
      }

      if (formData.handleRequestType) {
        payload.handleRequestType = formData.handleRequestType;
      }

      await api.post('/groups', payload);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error('Error creating group:', err);
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-xl"
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Thêm bộ phận</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
          >
            <span className="sr-only">Đóng</span>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/50 dark:border-red-800">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400 dark:text-red-300" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tên bộ phận
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              disabled={loading}
              className="block w-full rounded-md border-gray-300 shadow-sm p-2 focus:border-brand-500 focus:ring-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm disabled:opacity-50"
              placeholder="Nhập tên bộ phận"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Mô tả
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              disabled={loading}
              rows={3}
              className="block w-full rounded-md border-gray-300 shadow-sm p-2 focus:border-brand-500 focus:ring-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm disabled:opacity-50"
              placeholder="Nhập mô tả"
            />
          </div>

          <div>
            <label htmlFor="managerId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Quản lý
            </label>
            <select
              id="managerId"
              name="managerId"
              value={formData.managerId}
              onChange={handleChange}
              disabled={loading}
              className="block w-full rounded-md border-gray-300 shadow-sm p-2 focus:border-brand-500 focus:ring-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm disabled:opacity-50"
            >
              <option value="">Chọn quản lý (tùy chọn)</option>
              {managers.map((manager) => (
                <option key={manager._id} value={manager._id}>
                  {manager.firstName} {manager.lastName} ({manager.username})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="parentGroupId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Bộ phận cha
            </label>
            <select
              id="parentGroupId"
              name="parentGroupId"
              value={formData.parentGroupId}
              onChange={handleChange}
              disabled={loading}
              className="block w-full rounded-md border-gray-300 shadow-sm p-2 focus:border-brand-500 focus:ring-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm disabled:opacity-50"
            >
              <option value="">Không có bộ phận cha</option>
              {groups.map((group) => (
                <option key={group._id} value={group._id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="handleRequestType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Quyền xử lý yêu cầu
            </label>
            <select
              id="handleRequestType"
              name="handleRequestType"
              value={formData.handleRequestType}
              onChange={handleChange}
              disabled={loading}
              className="block w-full rounded-md border-gray-300 shadow-sm p-2 focus:border-brand-500 focus:ring-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm disabled:opacity-50"
            >
              <option value="">Chọn loại quyền (tùy chọn)</option>
              <option value="confirm">Có thể xác nhận yêu cầu</option>
              <option value="approve">Có thể phê duyệt yêu cầu</option>
            </select>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading || !formData.name.trim()}
              className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-brand-500 border border-transparent rounded-md shadow-sm hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-700"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 mr-2 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Đang thêm...
                </>
              ) : (
                'Thêm bộ phận'
              )}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}; 