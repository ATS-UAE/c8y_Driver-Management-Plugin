import { Component, OnInit } from '@angular/core';
import { VehicleService } from '../../services/vehicle.service';
import { Vehicle } from '../../models/driver.model';
import { AlertService } from '@c8y/ngx-components';

@Component({
  selector: 'app-vehicle-list',
  templateUrl: './vehicle-list.component.html'
})
export class VehicleListComponent implements OnInit {
  vehicles: Vehicle[] = [];
  loading = false;

  constructor(
    private vehicleService: VehicleService,
    private alertService: AlertService
  ) {
    console.log('✅ VehicleListComponent constructor (Read-Only Mode)');
  }

  ngOnInit() {
    console.log('✅ VehicleListComponent ngOnInit');
    this.loadVehicles();
  }

  async loadVehicles() {
    try {
      this.loading = true;
      console.log('📡 Loading vehicles from device groups...');
      this.vehicles = await this.vehicleService.getVehicles();
      console.log('✅ Vehicles loaded:', this.vehicles.length);
    } catch (error) {
      console.error('❌ Error loading vehicles:', error);
      this.alertService.danger('Failed to load vehicles from device groups');
    } finally {
      this.loading = false;
    }
  }
}