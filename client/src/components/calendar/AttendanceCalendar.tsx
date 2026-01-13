"use client";
import { useState, useRef, useEffect, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import { EventContentArg, EventSourceFuncArg } from '@fullcalendar/core';
import { useAuth } from '@/context/AuthContext';
import api from '@/utils/api';
import {
  isWorkDay,
  getCheckInColor,
  getCheckOutColor,
  WORK_START_HOUR,
  WORK_START_MINUTE,
  WORK_END_HOUR,
  WORK_END_MINUTE,
  LUNCH_START_HOUR,
  LUNCH_START_MINUTE,
  LUNCH_END_HOUR,
  LUNCH_END_MINUTE,
  WORK_HOURS_REQUIRED
} from '@/constants/workDays';

interface Attendance {
  _id: string;
  checkIn: string;
  checkOut?: string;
}

interface LeaveRequest {
  _id: string;
  type: string;
  startTime: string;
  endTime: string;
  leaveDays: number;
  reason: string;
  status: number;
  user: {
    _id: string;
    name: string;
    email: string;
  };
}

interface TodayAttendance {
  _id: string;
  checkIn?: string;
  checkOut?: string;
}

interface CalendarEventData {
  id: string;
  date: string;
  color: string;
  title?: string;
  extendedProps: {
    time?: string;
    type?: 'attendance' | 'leave';
    leaveDays?: number;
    reason?: string;
  };
}

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  role: string;
}

const formatTimeFromHourMinute = (hour: number, minute: number): string => {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const AttendanceCalendar = () => {
  const { token, user } = useAuth();
  const calendarRef = useRef<FullCalendar | null>(null);

  const [todayAttendance, setTodayAttendance] = useState<TodayAttendance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkOutLoading, setCheckOutLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [ipError, setIpError] = useState<{ message: string, details?: string, clientIP?: string } | null>(null);
  const [leaveMap, setLeaveMap] = useState<Map<string, number>>(new Map());

  // Admin user selection state
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [usersLoading, setUsersLoading] = useState(false);

  const formatTime = useCallback((timeString?: string): string => {
    if (!timeString) return 'N/A';
    const date = new Date(timeString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, []);

  const formatDate = useCallback((date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const getLeaveEventColor = useCallback((): string => {
    return '#2196F3'; // Blue for all leave events
  }, []);

  const handleEventsFetch = useCallback(async (
    info: EventSourceFuncArg,
    successCallback: (events: CalendarEventData[]) => void,
    failureCallback: (error: Error) => void
  ) => {
    try {
      if (!token) {
        failureCallback(new Error('No authorization token'));
        return;
      }

      const params = new URLSearchParams({
        startDate: info.startStr,
        endDate: info.endStr,
      });

      // For admin, add userId parameter if a user is selected
      let apiEndpoint = '/attendance/my';
      if (user?.role === 'admin' && selectedUserId) {
        params.append('userId', selectedUserId);
        apiEndpoint = '/attendance/admin-view';
      }

      const response = await api.get(`${apiEndpoint}?${params}`);

      if (!response.data) {
        failureCallback(new Error('Failed to fetch attendance data'));
        return;
      }

      const { attendance, requests } = response.data;
      const eventData: CalendarEventData[] = [];
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      const today = formatDate(todayDate);

      // Create maps for quick lookup
      const attendanceMap = new Map<string, Attendance>();
      attendance.forEach((att: Attendance) => {
        const date = new Date(att.checkIn);
        attendanceMap.set(formatDate(date), att);
      });

      // Create leave requests map by date (with correct leave type per day)
      const leaveMap = new Map<string, number>(); // 1 for full day, 0.5 for half day
      requests.forEach((req: LeaveRequest) => {
        const startDate = new Date(req.startTime);
        const endDate = new Date(req.endTime);
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          const dateKey = formatDate(d);
          // Xác định khoảng nghỉ phép trong ngày
          const leaveStart = new Date(Math.max(d.getTime(), new Date(req.startTime).getTime()));
          const leaveEnd = new Date(Math.min(new Date(d).setHours(23, 59, 59, 999), new Date(req.endTime).getTime()));
          // Khoảng nghỉ trưa 12:00-13:00
          const noonStart = new Date(d); noonStart.setHours(12, 0, 0, 0);
          const noonEnd = new Date(d); noonEnd.setHours(13, 0, 0, 0);
          // Nếu nghỉ phép giao với 12h-13h thì là 1P, ngược lại là 1/2P
          const isFullDay = leaveStart < noonEnd && leaveEnd > noonStart;
          // Nếu đã có 1P thì ưu tiên 1P
          if (leaveMap.get(dateKey) === 1) continue;
          leaveMap.set(dateKey, isFullDay ? 1 : 0.5);
        }
      });

      // Generate events for each day in the calendar range
      for (let d = new Date(info.startStr); d <= new Date(info.endStr); d.setDate(d.getDate() + 1)) {
        const formattedDate = formatDate(d);
        const isToday = formattedDate === today;

        const attendance = attendanceMap.get(formattedDate);
        const leaveValue = leaveMap.get(formattedDate) ?? 0;

        // Skip weekends and future dates for attendance
        if (!(isWorkDay(d) || attendance) || d > todayDate) {
          // Still show leave requests for weekends/future dates
          if (leaveValue > 0) {
            eventData.push({
              id: `leave_${formattedDate}`,
              date: formattedDate,
              color: getLeaveEventColor(),
              title: leaveValue % 1 === 0 ? `${leaveValue}` : leaveValue.toFixed(1),
              extendedProps: {
                type: 'leave',
                leaveDays: leaveValue
              }
            });
          }
          continue;
        }

        // Add attendance events normally
        if (attendance) {
          eventData.push({
            id: attendance._id + "_in",
            date: formattedDate,
            color: getCheckInColor(attendance.checkIn),
            extendedProps: {
              type: 'attendance',
              time: attendance.checkIn
            }
          });

          if (attendance.checkOut || !isToday) {
            eventData.push({
              id: attendance._id + "_out",
              date: formattedDate,
              color: getCheckOutColor(attendance.checkIn, attendance.checkOut),
              extendedProps: {
                type: 'attendance',
                time: attendance.checkOut
              }
            });
          }
        } else {
          // Show missing attendance if no attendance record
          if (leaveValue !== 1) {
            eventData.push(
              {
                id: formattedDate + '_in',
                date: formattedDate,
                color: '#F44336',
                extendedProps: {
                  type: 'attendance',
                  time: undefined
                }
              },
              {
                id: formattedDate + '_out',
                date: formattedDate,
                color: '#F44336',
                extendedProps: {
                  type: 'attendance',
                  time: undefined
                }
              }
            );
          }
        }

        // Leave event (only if nghỉ phép)
        if (leaveValue) {
          eventData.push({
            id: `leave_${formattedDate}`,
            date: formattedDate,
            color: getLeaveEventColor(),
            title: leaveValue === 1 ? '1P' : '1/2P',
            extendedProps: {
              type: 'leave',
              leaveDays: leaveValue
            }
          });
        }
      }

      setLeaveMap(new Map(leaveMap));
      successCallback(eventData);
    } catch (error) {
      console.error('Error fetching attendance data:', error);
      failureCallback(error instanceof Error ? error : new Error(String(error)));
    }
  }, [token, formatDate, getLeaveEventColor, user?.role, selectedUserId]);

  const renderEventContent = useCallback((eventInfo: EventContentArg) => {
    const { extendedProps } = eventInfo.event;

    if (extendedProps.type === 'leave') {
      const leaveText = extendedProps.leaveDays === 0.5 ? '1/2 P' : '1 P';
      const tooltipText = extendedProps.reason?.includes('yêu cầu nghỉ phép')
        ? `${extendedProps.reason}\nTổng số ngày: ${extendedProps.leaveDays}`
        : `${extendedProps.reason || 'Nghỉ phép'}\nSố ngày: ${extendedProps.leaveDays}`;

      return (
        <div
          className="text-xs p-1 text-white font-medium cursor-help"
          title={tooltipText}
        >
          {leaveText}
        </div>
      );
    }

    // Attendance event
    const time = extendedProps.time ? formatTime(extendedProps.time) : 'K';
    const tooltipText = extendedProps.time
      ? `Thời gian: ${formatTime(extendedProps.time)}`
      : 'Chưa chấm công';

    return (
      <span
        className="text-xs p-1 cursor-help"
        title={tooltipText}
      >
        {time}
      </span>
    );
  }, [formatTime]);

  const fetchTodayAttendance = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await api.get("/attendance/today");
      setTodayAttendance(response.data);
    } catch (err) {
      setError("Error connecting to the server");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchTodayAttendance();
  }, [fetchTodayAttendance]);

  const handleCheckIn = async () => {
    setCheckInLoading(true);
    setActionError(null);
    setIpError(null);
    try {
      const response = await api.post("/attendance/check-in");
      setTodayAttendance(response.data);
      if (calendarRef.current) {
        calendarRef.current.getApi().refetchEvents();
      }
    } catch (err: unknown) {
      const error = err as {
        response?: {
          data?: {
            message?: string,
            details?: string,
            clientIP?: string,
            reason?: string
          },
          status?: number
        }
      };

      // Handle IP restriction errors specifically
      if (error.response?.status === 403 && error.response?.data?.clientIP) {
        setIpError({
          message: error.response.data.message || "Lỗi IP",
          details: error.response.data.details,
          clientIP: error.response.data.clientIP
        });
      } else {
        setActionError(error.response?.data?.message || "Failed to check in");
      }
    } finally {
      setCheckInLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setCheckOutLoading(true);
    setActionError(null);
    setIpError(null);
    try {
      const response = await api.post("/attendance/check-out");
      setTodayAttendance(response.data);
      if (calendarRef.current) {
        calendarRef.current.getApi().refetchEvents();
      }
    } catch (err: unknown) {
      const error = err as {
        response?: {
          data?: {
            message?: string,
            details?: string,
            clientIP?: string,
            reason?: string
          },
          status?: number
        }
      };

      // Handle IP restriction errors specifically
      if (error.response?.status === 403 && error.response?.data?.clientIP) {
        setIpError({
          message: error.response.data.message || "Lỗi IP",
          details: error.response.data.details,
          clientIP: error.response.data.clientIP
        });
      } else {
        setActionError(error.response?.data?.message || "Failed to check out");
      }
    } finally {
      setCheckOutLoading(false);
    }
  };

  // Fetch all users for admin
  const fetchUsers = useCallback(async () => {
    if (!token || user?.role !== 'admin') return;

    setUsersLoading(true);
    try {
      const response = await api.get('/groups/users');
      setUsers(response.data || []);
      // Set current user as default if not admin
      if (response.data && response.data.length > 0 && user?.role !== 'admin') {
        setSelectedUserId(response.data[0]._id);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setUsersLoading(false);
    }
  }, [token, user?.role]);

  // Initialize admin features
  useEffect(() => {
    if (user?.role === 'admin') {
      fetchUsers();
    }
  }, [user?.role, fetchUsers]);

  // Refetch calendar data when selected user changes (for admin)
  useEffect(() => {
    if (user?.role === 'admin' && selectedUserId && calendarRef.current) {
      calendarRef.current.getApi().refetchEvents();
    }
  }, [selectedUserId, user?.role]);

  const hasCheckedIn = todayAttendance && todayAttendance.checkIn;
  const hasCheckedOut = todayAttendance && todayAttendance.checkOut;

  const isAdmin = user?.role === 'admin';
  const selectedUser = users.find(u => u._id === selectedUserId);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-gray-800 dark:bg-gray-900/50">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-4">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Lịch chấm công</h3>

            {/* Admin User Selector */}
            {isAdmin && (
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Nhân viên:
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  disabled={usersLoading}
                  className="min-w-48 rounded-md border-gray-300 shadow-sm p-2 text-sm focus:border-brand-500 focus:ring-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:opacity-50"
                >
                  <option value="">Chọn nhân viên</option>
                  {users.map(user => (
                    <option key={user._id} value={user._id}>
                      {user.firstName} {user.lastName} ({user.username})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {loading ? (
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
          ) : error ? (
            <div className="text-sm text-red-500 dark:text-red-400">{error}</div>
          ) : (
            <div className="flex items-center gap-4">
              {/* Show selected user info for admin */}
              {isAdmin && selectedUser && (
                <div className="text-sm px-3 py-1 rounded-md bg-blue-100 dark:bg-blue-900">
                  <span className="font-medium text-blue-700 dark:text-blue-300">
                    Đang xem: {selectedUser.firstName} {selectedUser.lastName}
                  </span>
                </div>
              )}

              {/* Check-in/out info and buttons - only for non-admin users */}
              {!isAdmin && (
                <>
                  {hasCheckedIn && (
                    <div className="text-sm px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800">
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        Check-in: {formatTime(todayAttendance?.checkIn)}
                      </span>
                    </div>
                  )}

                  {hasCheckedOut && (
                    <div className="text-sm px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800">
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        Check-out: {formatTime(todayAttendance?.checkOut)}
                      </span>
                    </div>
                  )}

                  {(!hasCheckedIn) && (
                    <button
                      onClick={handleCheckIn}
                      disabled={checkInLoading}
                      className="rounded-md bg-green-600 hover:bg-green-700 px-4 py-2 text-sm font-medium text-white"
                    >
                      {checkInLoading ? "Đang điểm danh..." : "Điểm danh"}
                    </button>
                  )}

                  {(hasCheckedIn && !hasCheckedOut) && (
                    <button
                      onClick={handleCheckOut}
                      disabled={checkOutLoading}
                      className="rounded-md bg-red-600 hover:bg-red-700 px-4 py-2 text-sm font-medium text-white"
                    >
                      {checkOutLoading ? "Đang kết thúc..." : "Kết thúc"}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* IP Error Display */}
        {ipError && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                  {ipError.message}
                </h3>
                {ipError.details && (
                  <div className="mt-1 text-sm text-red-700 dark:text-red-300">
                    {ipError.details}
                  </div>
                )}
                {ipError.clientIP && (
                  <div className="mt-1 text-xs text-red-600 dark:text-red-400">
                    IP hiện tại: {ipError.clientIP}
                  </div>
                )}
                <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                  Vui lòng liên hệ quản trị viên nếu bạn đang ở trong mạng công ty.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Regular Action Error Display */}
        {actionError && !ipError && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-md">
            <div className="text-sm text-red-700 dark:text-red-300">
              {actionError}
            </div>
          </div>
        )}

        <div className="attendance-calendar">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin]}
            initialView="dayGridMonth"
            initialDate={new Date()}
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: ''
            }}
            events={handleEventsFetch}
            height="auto"
            eventContent={renderEventContent}
            eventTimeFormat={{
              hour: '2-digit',
              minute: '2-digit',
              meridiem: false
            }}
            firstDay={1}
          />
        </div>
      </div>

      {/* Work Schedule Rules */}
      <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-gray-800 dark:bg-gray-900/50">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Nội quy giờ làm việc
        </h3>
        <div className="gap-4">
          <div className="space-y-2">
            <h4 className="font-medium text-gray-700 dark:text-gray-300">
              Thời gian làm việc: {formatTimeFromHourMinute(WORK_START_HOUR, WORK_START_MINUTE)} - {formatTimeFromHourMinute(WORK_END_HOUR, WORK_END_MINUTE)}
            </h4>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium text-gray-700 dark:text-gray-300">
              Thời gian nghỉ trưa: {formatTimeFromHourMinute(LUNCH_START_HOUR, LUNCH_START_MINUTE)} - {formatTimeFromHourMinute(LUNCH_END_HOUR, LUNCH_END_MINUTE)}
            </h4>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium text-gray-700 dark:text-gray-300">
              Số giờ làm việc yêu cầu: <span className="font-medium">{WORK_HOURS_REQUIRED} giờ/ngày</span>
            </h4>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceCalendar;