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
    const filter = { type: this.DRIVER_TYPE, pageSize: 100 };
    const { data } = await this.inventory.list(filter);
    return data.map(item => this.mapToDriver(item));
  }

  /**
   * Paginated fetch — used by scroll-to-load driver dropdowns.
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
    const totalPages: number = (response as any).paging?.totalPages ?? 1;
    return { drivers: filtered, hasMore: page < totalPages, currentPage: page };
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
        groupIds: driver.groupIds || []   // ← array, not single string
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
        ...existingC8yDriver,        // preserves groupIds (and any other fields)
        name: driver.name,
        licenseNumber: driver.licenseNumber,
        phoneNumber: driver.phoneNumber,
        email: driver.email,
        status: driver.status,
        customFields: driver.customFields || [],
        driverCode: driver.driverCode
        // groupIds preserved via spread above
      }
    };
    const { data } = await this.inventory.update(managedObject);
    return this.mapToDriver(data);
  }

  // ── Multi-group assignment ─────────────────────────────────────

  /**
   * Add a driver to one group (non-destructive — existing groups kept).
   */
  async addDriverToGroup(driverId: string, groupId: string): Promise<Driver> {
    const { data: current } = await this.inventory.detail(driverId);
    const existing: string[] = current.c8y_Driver?.groupIds || [];
    const groupIds = existing.includes(groupId) ? existing : [...existing, groupId];
    const { data } = await this.inventory.update({
      id: driverId,
      c8y_Driver: { ...current.c8y_Driver, groupIds }
    });
    console.log('✅ Driver added to group:', driverId, '->', groupId, '| all groups:', groupIds);
    return this.mapToDriver(data);
  }

  /**
   * Remove a driver from one group (other groups untouched).
   */
  async removeDriverFromGroup(driverId: string, groupId: string): Promise<Driver> {
    const { data: current } = await this.inventory.detail(driverId);
    const existing: string[] = current.c8y_Driver?.groupIds || [];
    const groupIds = existing.filter(id => id !== groupId);
    const { data } = await this.inventory.update({
      id: driverId,
      c8y_Driver: { ...current.c8y_Driver, groupIds }
    });
    console.log('✅ Driver removed from group:', driverId, 'x', groupId, '| remaining:', groupIds);
    return this.mapToDriver(data);
  }

  /**
   * Add multiple drivers to one group in parallel.
   * Returns all updated Driver objects.
   */
  async addMultipleDriversToGroup(driverIds: string[], groupId: string): Promise<Driver[]> {
    const results = await Promise.all(
      driverIds.map(id => this.addDriverToGroup(id, groupId))
    );
    console.log('✅ Bulk assignment done — group:', groupId, '| drivers:', driverIds);
    return results;
  }

  // ── Delete ─────────────────────────────────────────────────────
  async deleteDriver(id: string): Promise<void> {
    await this.inventory.delete(id);
  }

  // ── Mapper ─────────────────────────────────────────────────────
  private mapToDriver(data: any): Driver {
    // Support legacy single groupId stored by v1
    const raw = data.c8y_Driver;
    let groupIds: string[] = raw?.groupIds || [];
    if (!groupIds.length && raw?.groupId) {
      // Migrate legacy single groupId to array on read
      groupIds = [raw.groupId];
    }
    return {
      id: data.id,
      name: raw?.name || data.name,
      licenseNumber: raw?.licenseNumber || '',
      phoneNumber: raw?.phoneNumber || '',
      email: raw?.email || '',
      status: raw?.status || 'active',
      customFields: raw?.customFields || [],
      driverCode: raw?.driverCode || '',
      createdTime: raw?.createdTime || data.creationTime,
      creationTime: data.creationTime,
      groupIds,          // ← always an array
      c8y_Driver: raw
    };
  }
}