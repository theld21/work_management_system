'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import { useForm, SubmitHandler } from 'react-hook-form';
import api from '@/utils/api';

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
  address?: string;
  position?: string;
  group?: {
    _id: string;
    name: string;
  };
  startDate?: string;
}

interface Group {
  _id: string;
  name: string;
}

interface FormValues {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  gender: number;
  dateOfBirth: string;
  phoneNumber: string;
  address: string;
  position: string;
  group: string;
  role: string;
  status: string;
  startDate: string;
}

interface AccountDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account;
  onUpdate: () => void;
  groups: Group[];
}

export const AccountDetailModal: React.FC<AccountDetailModalProps> = ({
  isOpen,
  onClose,
  account,
  onUpdate,
  groups,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormValues>({
    defaultValues: {
      username: account.username,
      email: account.email,
      firstName: account.firstName || '',
      lastName: account.lastName || '',
      employeeId: account.employeeId || '',
      gender: account.gender ?? 1,
      dateOfBirth: account.dateOfBirth ? new Date(account.dateOfBirth).toISOString().split('T')[0] : '',
      phoneNumber: account.phoneNumber || '',
      address: account.address || '',
      position: account.position || '',
      group: account.group?._id || '',
      role: account.role,
      status: account.status,
      startDate: account.startDate ? new Date(account.startDate).toISOString().split('T')[0] : '',
    },
  });

  // Reset form with account data when modal opens or account changes
  useEffect(() => {
    if (isOpen) {
      reset({
        username: account.username,
        email: account.email,
        firstName: account.firstName || '',
        lastName: account.lastName || '',
        employeeId: account.employeeId || '',
        gender: account.gender ?? 1,
        dateOfBirth: account.dateOfBirth ? new Date(account.dateOfBirth).toISOString().split('T')[0] : '',
        phoneNumber: account.phoneNumber || '',
        address: account.address || '',
        position: account.position || '',
        group: account.group?._id || '',
        role: account.role,
        status: account.status,
        startDate: account.startDate ? new Date(account.startDate).toISOString().split('T')[0] : '',
      });
      setError(null);
    }
  }, [isOpen, account, reset]);

  const handleFormSubmit: SubmitHandler<FormValues> = async (data) => {
    setSaving(true);
    setError(null);

    try {
      await api.put(`/admin/accounts/${account._id}`, data);
      onUpdate();
      onClose();
    } catch (err) {
      console.error('Error updating account:', err);
      setError('Failed to update account');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-2xl"
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Chi tiết tài khoản</h2>
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

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tên đăng nhập
              </label>
              <input
                id="username"
                className="block w-full rounded-md border-gray-300 shadow-sm p-2 focus:border-brand-500 focus:ring-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
                {...register('username', {
                  required: 'Tên đăng nhập là bắt buộc',
                  minLength: {
                    value: 3,
                    message: 'Tên đăng nhập phải có ít nhất 3 ký tự',
                  },
                })}
              />
              {errors.username && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.username.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email:
              </label>
              <input
                id="email"
                type="email"
                className="block w-full rounded-md border-gray-300 shadow-sm p-2 focus:border-brand-500 focus:ring-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
                {...register('email', {
                  required: 'Email là bắt buộc',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Email không hợp lệ',
                  },
                })}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tên
              </label>
              <input
                id="firstName"
                className="block w-full rounded-md border-gray-300 shadow-sm p-2 focus:border-brand-500 focus:ring-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
                {...register('firstName', {
                  required: 'Tên là bắt buộc',
                  minLength: {
                    value: 2,
                    message: 'Tên phải có ít nhất 2 ký tự',
                  },
                })}
              />
              {errors.firstName && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.firstName.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Họ
              </label>
              <input
                id="lastName"
                className="block w-full rounded-md border-gray-300 shadow-sm p-2 focus:border-brand-500 focus:ring-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
                {...register('lastName', {
                  required: 'Họ là bắt buộc',
                  minLength: {
                    value: 2,
                    message: 'Họ phải có ít nhất 2 ký tự',
                  },
                })}
              />
              {errors.lastName && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.lastName.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="employeeId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Mã nhân viên
              </label>
              <input
                id="employeeId"
                className="block w-full rounded-md border-gray-300 shadow-sm p-2 focus:border-brand-500 focus:ring-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
                {...register('employeeId')}
              />
            </div>

            <div>
              <label htmlFor="gender" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Giới tính
              </label>
              <select
                id="gender"
                className="block w-full rounded-md border-gray-300 shadow-sm p-2 focus:border-brand-500 focus:ring-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
                {...register('gender')}
              >
                <option value={1}>Nam</option>
                <option value={0}>Nữ</option>
              </select>
            </div>

            <div>
              <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Ngày sinh
              </label>
              <input
                id="dateOfBirth"
                type="date"
                className="block w-full rounded-md border-gray-300 shadow-sm p-2 focus:border-brand-500 focus:ring-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
                {...register('dateOfBirth')}
              />
            </div>

            <div>
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Số điện thoại
              </label>
              <input
                id="phoneNumber"
                type="tel"
                className="block w-full rounded-md border-gray-300 shadow-sm p-2 focus:border-brand-500 focus:ring-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
                {...register('phoneNumber')}
              />
            </div>

            <div>
              <label htmlFor="position" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Chức vụ
              </label>
              <input
                id="position"
                className="block w-full rounded-md border-gray-300 shadow-sm p-2 focus:border-brand-500 focus:ring-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
                {...register('position')}
              />
            </div>

            <div>
              <label htmlFor="group" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Bộ phận
              </label>
              <select
                id="group"
                className="block w-full rounded-md border-gray-300 shadow-sm p-2 focus:border-brand-500 focus:ring-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
                {...register('group')}
              >
                <option value="">Chọn bộ phận</option>
                {groups.map((group) => (
                  <option key={group._id} value={group._id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Role
              </label>
              <select
                id="role"
                className="block w-full rounded-md border-gray-300 shadow-sm p-2 focus:border-brand-500 focus:ring-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
                {...register('role')}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Trạng thái
              </label>
              <select
                id="status"
                className="block w-full rounded-md border-gray-300 shadow-sm p-2 focus:border-brand-500 focus:ring-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
                {...register('status')}
              >
                <option value="active">Hoạt động</option>
                <option value="inactive">Không hoạt động</option>
                <option value="suspended">Tạm khóa</option>
              </select>
            </div>

            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Ngày bắt đầu làm việc
              </label>
              <input
                id="startDate"
                type="date"
                className="block w-full rounded-md border-gray-300 shadow-sm p-2 focus:border-brand-500 focus:ring-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
                {...register('startDate')}
              />
            </div>
          </div>

          <div className="mt-6">
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Địa chỉ
              </label>
              <textarea
                id="address"
                rows={3}
                className="block w-full rounded-md border-gray-300 shadow-sm p-2 focus:border-brand-500 focus:ring-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
                {...register('address')}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-brand-500 border border-transparent rounded-md shadow-sm hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-700"
            >
              {saving ? (
                <>
                  <svg className="w-4 h-4 mr-2 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Đang lưu...
                </>
              ) : (
                'Lưu thay đổi'
              )}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}; 