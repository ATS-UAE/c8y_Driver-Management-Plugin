// src/services/driver.service.ts
import { Injectable } from '@angular/core';
import { InventoryService } from '@c8y/client';
import { Driver } from '../models/driver.model';

export interface DriverPage {
  drivers: Driver[];
  hasMore: boolean;
  currentPage: number;
}

@Injectable()
export class DriverService {
  private readonly DRIVER_TYPE = 'c8y_IsDevice';
  readonly DROPDOWN_PAGE_SIZE = 10;

  constructor(private inventory: InventoryService) {}

  // ── Full load (driver list table) ─────────────────────────────
  async getDrivers(): Promise<Driver[]> {
    const filter = {
      type: this.DRIVER_TYPE,
      pageSize: 100
    };
    const { data } = await this.inventory.list(filter);
    console.log('Retrieved drivers:', data);
    return data.map(item => this.mapToDriver(item));
  }

  /**
   * Paginated fetch — used by the scroll-to-load driver dropdown.
   * @param page    1-based page number
   * @param search  local filter applied to the fetched page
   */
  async getDriversPaginated(page: number = 1, search: string = ''): Promise<DriverPage> {
    const filter: any = {
      type: this.DRIVER_TYPE,
      pageSize: this.DROPDOWN_PAGE_SIZE,
      currentPage: page,
      withTotalPages: true
    };

    const response = await this.inventory.list(filter);
    const drivers = (response.data as any[]).map(item => this.mapToDriver(item));

    // Client-side search per page (Cumulocity MO text search is limited)
    const filtered = search.trim()
      ? drivers.filter(d => {
          const t = search.toLowerCase();
          return (
            d.name?.toLowerCase().includes(t) ||
            d.phoneNumber?.toLowerCase().includes(t) ||
            d.email?.toLowerCase().includes(t) ||
            d.licenseNumber?.toLowerCase().includes(t) ||
            d.driverCode?.toLowerCase().includes(t)
          );
        })
      : drivers;

    const paging = (response as any).paging;
    const totalPages: number = paging?.totalPages ?? 1;

    return {
      drivers: filtered,
      hasMore: page < totalPages,
      currentPage: page
    };
  }

  // ── Single driver ──────────────────────────────────────────────
  async getDriver(id: string): Promise<Driver> {
    const { data } = await this.inventory.detail(id);
    return this.mapToDriver(data);
  }

  // ── Create ─────────────────────────────────────────────────────
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
        driverCode: driver.driverCode,
        groupId: driver.groupId || null
      }
    };
    const { data } = await this.inventory.create(managedObject);
    return this.mapToDriver(data);
  }

  // ── Update ─────────────────────────────────────────────────────
  async updateDriver(id: string, driver: Driver): Promise<Driver> {
    const { data: current } = await this.inventory.detail(id);
    const existingC8yDriver = current.c8y_Driver || {};
    const managedObject = {
      id,
      type: this.DRIVER_TYPE,
      name: driver.name,
      c8y_Driver: {
        ...existingC8yDriver,
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

  // ── Group assignment (minimal patch) ──────────────────────────
  async assignDriverToGroup(driverId: string, groupId: string): Promise<Driver> {
    const { data: current } = await this.inventory.detail(driverId);
    const managedObject = {
      id: driverId,
      c8y_Driver: { ...current.c8y_Driver, groupId }
    };
    const { data } = await this.inventory.update(managedObject);
    console.log('✅ Driver assigned to group:', driverId, '->', groupId);
    return this.mapToDriver(data);
  }

  async removeDriverFromGroup(driverId: string): Promise<Driver> {
    const { data: current } = await this.inventory.detail(driverId);
    const managedObject = {
      id: driverId,
      c8y_Driver: { ...current.c8y_Driver, groupId: null }
    };
    const { data } = await this.inventory.update(managedObject);
    console.log('✅ Driver removed from group:', driverId);
    return this.mapToDriver(data);
  }

  // ── Delete ─────────────────────────────────────────────────────
  async deleteDriver(id: string): Promise<void> {
    await this.inventory.delete(id);
  }

  // ── Mapper ─────────────────────────────────────────────────────
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
      groupId: data.c8y_Driver?.groupId || undefined,
      c8y_Driver: data.c8y_Driver
    };
  }
}