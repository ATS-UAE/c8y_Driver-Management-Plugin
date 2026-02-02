import { Component, OnInit, Pipe, PipeTransform } from "@angular/core";
import { Router } from "@angular/router";
import { DriverService } from "../../services/driver.service";
import { Driver } from "../../models/driver.model";
import { AlertService } from "@c8y/ngx-components";

@Pipe({
  name: "filter",
  pure: false,
})
export class FilterPipe implements PipeTransform {
  transform(items: any[], field: string, value: any): any[] {
    if (!items || !field) return items;
    return items.filter((item) => item[field] === value);
  }
}

@Component({
  selector: "app-driver-list",
  templateUrl: "./driver-list.component.html",
})
export class DriverListComponent implements OnInit {
  drivers: Driver[] = [];
  loading = false;
  Object = Object;

  constructor(
    private driverService: DriverService,
    private router: Router,
    private alertService: AlertService,
  ) {}

  ngOnInit() {
    this.loadDrivers();
  }

  async loadDrivers() {
    try {
      this.loading = true;
      this.drivers = await this.driverService.getDrivers();
    } catch (error) {
      this.alertService.danger("Failed to load drivers");
    } finally {
      this.loading = false;
    }
  }

  addDriver() {
    this.router.navigate(["/drivers/add"]);
  }

  editDriver(driver: Driver) {
    this.router.navigate(["/drivers/edit", driver.id]);
  }

  async deleteDriver(driver: Driver) {
    if (confirm(`Are you sure you want to delete driver ${driver.name}?`)) {
      try {
        await this.driverService.deleteDriver(driver.id!);
        this.alertService.success("Driver deleted successfully");
        this.loadDrivers();
      } catch (error) {
        this.alertService.danger("Failed to delete driver");
      }
    }
  }

  manageShifts(driver: Driver) {
    this.router.navigate(["/shifts"], {
      queryParams: { driverId: driver.id, driverName: driver.name },
    });
  }

  getActiveDriversCount(): number {
    return this.drivers.filter((d) => d.status === "active").length;
  }

  hasCustomFields(driver: Driver): boolean {
    return (
      driver.customFields &&
      typeof driver.customFields === "object" &&
      Object.keys(driver.customFields).length > 0
    );
  }

  getCustomFieldsCount(driver: Driver): number {
    if (!driver.customFields || typeof driver.customFields !== "object") {
      return 0;
    }
    return Object.keys(driver.customFields).length;
  }
}
