// src/models/driver.model.ts
export interface CustomField {
  key: string;
  value: string;
}

export interface Driver {
  creationTime: any;
  c8y_Driver: any;
  id?: string;
  name: string;
  licenseNumber: string;
  phoneNumber: string;
  email: string;
  status: 'active' | 'inactive';
  customFields?: CustomField[];
  createdTime?: string;
}

export interface Vehicle {
  id?: string;
  maker: string;
  vehicleNumber: string;
  type: string;
  status: 'active' | 'inactive';
  assignedDriverId?: string;
  assignedDriverName?: string;
}

export interface Shift {
  id?: string;
  driverId: string;
  driverName?: string;
  vehicleId: string;
  vehicleNumber?: string;
  startTime: string;
  endTime?: string;
  status: 'ongoing' | 'completed';
}