
export interface Room {
  id: string;
  number: string;
  type: 'Standard' | 'Deluxe' | 'Suite';
  status: 'Available' | 'Occupied' | 'Maintenance';
  price: number;
  tenantName?: string;
}

export interface TenantDocument {
  id: string;
  name: string;
  mimeType: string;
  data: string; // base64
  uploadDate: string;
}

export interface Tenant {
  id: string;
  name: string;
  roomNumber: string;
  phone: string;
  entryDate: string;
  status: 'Active' | 'Former';
  emergencyName?: string;
  emergencyPhone?: string;
  contractPeriod?: string;
  depositAmount?: number;
}

export interface Booking {
  id: string;
  roomNumber: string;
  tenantName: string;
  phone: string;
  bookingDate: string;
  moveInDate: string;
  status: 'Pending' | 'Confirmed' | 'Cancelled';
}

export interface Invoice {
  id: string;
  roomNumber: string;
  month: string;
  date: string; // ISO format YYYY-MM-DD
  amount: number;
  status: 'Paid' | 'Unpaid' | 'Overdue';
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assignee: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Pending' | 'In Progress' | 'Completed' | 'Cancelled';
  dueDate: string;
  category: 'Maintenance' | 'Admin' | 'Legal' | 'Other';
}

export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  STAF = 'staff'
}
