// src/services/driver.service.ts
import { Injectable } from '@angular/core';
import { InventoryService } from '@c8y/client';
import { Driver } from '../models/driver.model';

@Injectable()
export class DriverService {
  private readonly DRIVER_TYPE = 'c8y_IsDevice';

  constructor(private inventory: InventoryService) {}

  async getDrivers(): Promise<Driver[]> {
    const filter = {
      type: this.DRIVER_TYPE,
      pageSize: 100
    };

    const { data } = await this.inventory.list(filter);
    console.log('Retrieved drivers:', data);
    return data.map(item => this.mapToDriver(item));
  }

  async getDriver(id: string): Promise<Driver> {
    const { data } = await this.inventory.detail(id);
    return this.mapToDriver(data);
  }

  async createDriver(driver: Driver): Promise<Driver> {
    const managedObject = {
      type: this.DRIVER_TYPE,
      name: driver.name,
      c8y_Driver: {
        name: driver.name,
        licenseNumber: driver.licenseNumber,
        phoneNumber: driver.phoneNumber,
        email: driver.email,
        status: driver.status,
        customFields: driver.customFields || [],
        createdTime: new Date().toISOString(),
        driverCode: driver.driverCode
      }
    };

    const { data } = await this.inventory.create(managedObject);
    return this.mapToDriver(data);
  }

  async updateDriver(id: string, driver: Driver): Promise<Driver> {
    const managedObject = {
      id,
      type: this.DRIVER_TYPE,
      name: driver.name,
      c8y_Driver: {
        name: driver.name,
        licenseNumber: driver.licenseNumber,
        phoneNumber: driver.phoneNumber,
        email: driver.email,
        status: driver.status,
        customFields: driver.customFields || [],
        driverCode: driver.driverCode
      }
    };

    const { data } = await this.inventory.update(managedObject);
    return this.mapToDriver(data);
  }

  async deleteDriver(id: string): Promise<void> {
    await this.inventory.delete(id);
  }

  private mapToDriver(data: any): Driver {
    return {
      id: data.id,
      name: data.c8y_Driver?.name || data.name,
      licenseNumber: data.c8y_Driver?.licenseNumber || '',
      phoneNumber: data.c8y_Driver?.phoneNumber || '',
      email: data.c8y_Driver?.email || '',
      status: data.c8y_Driver?.status || 'active',
      customFields: data.c8y_Driver?.customFields || [],
      driverCode: data.c8y_Driver?.driverCode || '',
      createdTime: data.c8y_Driver?.createdTime || data.creationTime,
      creationTime: data.creationTime,
      c8y_Driver: data.c8y_Driver
    };
  }
}