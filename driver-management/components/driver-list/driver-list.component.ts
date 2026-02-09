import { Component, OnInit, Pipe, PipeTransform } from '@angular/core';
import { Router } from '@angular/router';
import { DriverService } from '../../services/driver.service';
import { Driver } from '../../models/driver.model';
import { AlertService } from '@c8y/ngx-components';

@Pipe({
  name: 'filter',
  pure: false
})
export class FilterPipe implements PipeTransform {
  transform(items: any[], field: string, value: any): any[] {
    if (!items || !field) return items;
    return items.filter(item => item[field] === value);
  }
}

@Component({
  selector: 'app-driver-list',
  templateUrl: './driver-list.component.html'
})
export class DriverListComponent implements OnInit {
  drivers: Driver[] = [];
  loading = false;
  Object = Object; // Make Object available in template

  constructor(
    private driverService: DriverService,
    private router: Router,
    private alertService: AlertService
  ) {
    console.log('✅ DriverListComponent constructor');
  }

  ngOnInit() {
    console.log('✅ DriverListComponent ngOnInit');
    this.loadDrivers();
  }

  async loadDrivers() {
    try {
      this.loading = true;
      console.log('📡 Loading drivers...');
      this.drivers = await this.driverService.getDrivers();
      console.log('✅ Drivers loaded:', this.drivers.length);
    } catch (error) {
      console.error('❌ Error loading drivers:', error);
      this.alertService.danger('Failed to load drivers');
    } finally {
      this.loading = false;
    }
  }

  addDriver() {
    console.log('➕ Navigate to add driver');
    this.router.navigate(['/drivers/add']);
  }

  editDriver(driver: Driver) {
    console.log('✏️ Navigate to edit driver:', driver.id);
    this.router.navigate(['/drivers/edit', driver.id]);
  }

  async deleteDriver(driver: Driver) {
    if (confirm(`Are you sure you want to delete driver ${driver.name}?`)) {
      try {
        await this.driverService.deleteDriver(driver.id!);
        this.alertService.success('Driver deleted successfully');
        this.loadDrivers();
      } catch (error) {
        console.error('Error deleting driver:', error);
        this.alertService.danger('Failed to delete driver');
      }
    }
  }

  manageShifts(driver: Driver) {
    console.log('🕐 Navigate to manage shifts for driver:', driver.id);
    // Navigate to shifts page with driver pre-selected
    this.router.navigate(['/shifts'], { 
      queryParams: { driverId: driver.id, driverName: driver.name } 
    });
  }

  getActiveDriversCount(): number {
    return this.drivers.filter(d => d.status === 'active').length;
  }

  hasCustomFields(driver: Driver): boolean {
    const customFields = (driver as any).customFields;
    return customFields && typeof customFields === 'object' && Object.keys(customFields).length > 0;
  }

  getCustomFieldsCount(driver: Driver): number {
    const customFields = (driver as any).customFields;
    if (!customFields || typeof customFields !== 'object') return 0;
    return Object.keys(customFields).length;
  }

  getCustomFieldsTooltip(driver: Driver): string {
    const customFields = (driver as any).customFields;
    if (!customFields) return '';
    
    const fields = Object.entries(customFields)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
    
    return fields;
  }

  getCustomFieldsArray(driver: Driver): Array<{key: string, value: string}> {
    const customFields = (driver as any).customFields;
    if (!customFields || typeof customFields !== 'object') return [];
    
    return Object.entries(customFields).map(([key, value]) => ({
      key: key,
      value: String(value)
    }));
  }
}