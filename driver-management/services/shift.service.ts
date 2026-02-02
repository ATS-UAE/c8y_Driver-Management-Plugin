// src/services/shift.service.ts
import { Injectable } from '@angular/core';
import { InventoryService } from '@c8y/client';
import { Shift } from '../models/driver.model';

@Injectable()
export class ShiftService {
  private readonly SHIFT_TYPE = 'c8y_DriverShift';

  constructor(private inventory: InventoryService) {}

  async getShifts(): Promise<Shift[]> {
    const filter = {
      type: this.SHIFT_TYPE,
      pageSize: 100
    };

    const { data } = await this.inventory.list(filter);
    return data.map(item => this.mapToShift(item));
  }

  async getShift(id: string): Promise<Shift> {
    const { data } = await this.inventory.detail(id);
    return this.mapToShift(data);
  }

  async createShift(shift: Shift): Promise<Shift> {
    const managedObject = {
      type: this.SHIFT_TYPE,
      name: `Shift - ${shift.driverName || shift.driverId}`,
      c8y_DriverShift: {
        driverId: shift.driverId,
        driverName: shift.driverName,
        vehicleId: shift.vehicleId,
        vehicleNumber: shift.vehicleNumber,
        startTime: shift.startTime,
        endTime: shift.endTime,
        status: shift.status
      }
    };

    const { data } = await this.inventory.create(managedObject);
    return this.mapToShift(data);
  }

  async updateShift(id: string, shift: Shift): Promise<Shift> {
    const managedObject = {
      id,
      type: this.SHIFT_TYPE,
      name: `Shift - ${shift.driverName || shift.driverId}`,
      c8y_DriverShift: {
        driverId: shift.driverId,
        driverName: shift.driverName,
        vehicleId: shift.vehicleId,
        vehicleNumber: shift.vehicleNumber,
        startTime: shift.startTime,
        endTime: shift.endTime,
        status: shift.status
      }
    };

    const { data } = await this.inventory.update(managedObject);
    return this.mapToShift(data);
  }

  async deleteShift(id: string): Promise<void> {
    await this.inventory.delete(id);
  }

  private mapToShift(data: any): Shift {
    return {
      id: data.id,
      driverId: data.c8y_DriverShift?.driverId || '',
      driverName: data.c8y_DriverShift?.driverName,
      vehicleId: data.c8y_DriverShift?.vehicleId || '',
      vehicleNumber: data.c8y_DriverShift?.vehicleNumber,
      startTime: data.c8y_DriverShift?.startTime || '',
      endTime: data.c8y_DriverShift?.endTime,
      status: data.c8y_DriverShift?.status || 'ongoing'
    };
  }
}