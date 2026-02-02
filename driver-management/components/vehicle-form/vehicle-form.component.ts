import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { VehicleService } from '../../services/vehicle.service';
import { DriverService } from '../../services/driver.service';
import { Vehicle, Driver } from '../../models/driver.model';
import { AlertService } from '@c8y/ngx-components';

@Component({
  selector: 'app-vehicle-form',
  templateUrl: './vehicle-form.component.html'
})
export class VehicleFormComponent implements OnInit {
  vehicleForm: FormGroup;
  isEditMode = false;
  vehicleId: string | null = null;
  loading = false;
  drivers: Driver[] = [];

  constructor(
    private fb: FormBuilder,
    private vehicleService: VehicleService,
    private driverService: DriverService,
    private route: ActivatedRoute,
    private router: Router,
    private alertService: AlertService
  ) {
    console.log('✅ VehicleFormComponent constructor');
    this.vehicleForm = this.fb.group({
      maker: ['', Validators.required],
      vehicleNumber: ['', Validators.required],
      type: ['', Validators.required],
      status: ['active', Validators.required],
      driverId: ['']
    });
  }

  ngOnInit() {
    console.log('✅ VehicleFormComponent ngOnInit');
    this.vehicleId = this.route.snapshot.paramMap.get('id');
    this.loadDrivers();
    
    if (this.vehicleId) {
      this.isEditMode = true;
      this.loadVehicle();
    }
  }

  async loadDrivers() {
    try {
      console.log('📡 Loading drivers for dropdown...');
      const allDrivers = await this.driverService.getDrivers();
      // Only show active drivers
      this.drivers = allDrivers.filter(d => d.status === 'active');
      console.log('✅ Active drivers loaded:', this.drivers.length);
    } catch (error) {
      console.error('❌ Error loading drivers:', error);
      this.alertService.warning('Failed to load drivers list');
    }
  }

  async loadVehicle() {
    try {
      this.loading = true;
      console.log('📡 Loading vehicle:', this.vehicleId);
      const vehicle = await this.vehicleService.getVehicle(this.vehicleId!);
      
      if (vehicle) {
        console.log('✅ Vehicle loaded:', vehicle);
        this.vehicleForm.patchValue({
          maker: vehicle.maker,
          vehicleNumber: vehicle.vehicleNumber,
          type: vehicle.type,
          status: vehicle.status,
          driverId: (vehicle as any).driverId || ''
        });
      }
    } catch (error) {
      console.error('❌ Error loading vehicle:', error);
      this.alertService.danger('Failed to load vehicle');
    } finally {
      this.loading = false;
    }
  }

  async onSubmit() {
    console.log('💾 Vehicle form submitted');
    console.log('Form valid:', this.vehicleForm.valid);
    console.log('Form value:', this.vehicleForm.value);

    if (this.vehicleForm.invalid) {
      this.alertService.warning('Please fill all required fields');
      return;
    }

    try {
      this.loading = true;
      const formValue = this.vehicleForm.value;
      
      const vehicle: any = {
        maker: formValue.maker,
        vehicleNumber: formValue.vehicleNumber,
        type: formValue.type,
        status: formValue.status
      };

      // Add driver information if selected
      if (formValue.driverId) {
        const selectedDriver = this.drivers.find(d => d.id === formValue.driverId);
        if (selectedDriver) {
          vehicle.driverId = formValue.driverId;
          vehicle.driverName = selectedDriver.name;
        }
      }

      // console.log('Saving vehicle:', vehicle);

      // if (this.isEditMode && this.vehicleId) {
      //   await this.vehicleService.updateVehicle(this.vehicleId, vehicle);
      //   this.alertService.success('Vehicle updated successfully');
      // } else {
      //   await this.vehicleService.createVehicle(vehicle);
      //   this.alertService.success('Vehicle created successfully');
      // }

      console.log('✅ Vehicle saved, navigating back');
      this.router.navigate(['/vehicles']);
    } catch (error) {
      console.error('❌ Error saving vehicle:', error);
      this.alertService.danger('Failed to save vehicle: ' + error);
    } finally {
      this.loading = false;
    }
  }

  onCancel() {
    console.log('❌ Form cancelled');
    this.router.navigate(['/vehicles']);
  }
}