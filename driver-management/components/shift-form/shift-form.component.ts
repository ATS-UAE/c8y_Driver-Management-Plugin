import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ShiftService } from '../../services/shift.service';
import { DriverService } from '../../services/driver.service';
import { VehicleService } from '../../services/vehicle.service';
import { Shift, Driver, Vehicle } from "../../models/driver.model";
import { AlertService } from '@c8y/ngx-components';

@Component({
  selector: 'app-shift-form',
  templateUrl: './shift-form.component.html'
})
export class ShiftFormComponent implements OnInit {
[x: string]: any;
  shiftForm: FormGroup;
  isEditMode = false;
  shiftId: string | null = null;
  loading = false;
  drivers: Driver[] = [];
  vehicles: Vehicle[] = [];
  loadingVehicles = false;
  loadingMoreVehicles = false;
  showVehicleDropdown = false;

  constructor(
    private fb: FormBuilder,
    private shiftService: ShiftService,
    private driverService: DriverService,
    private vehicleService: VehicleService,
    private route: ActivatedRoute,
    private router: Router,
    private alertService: AlertService
  ) {
    console.log('✅ ShiftFormComponent constructor');
    this.shiftForm = this.fb.group({
      driverId: ['', Validators.required],
      vehicleId: ['', Validators.required],
      startTime: ['', Validators.required],  // Now required
      endTime: [''],
      status: ['ongoing', Validators.required]
    });
  }

  ngOnInit() {
    console.log('✅ ShiftFormComponent ngOnInit');
    this.shiftId = this.route.snapshot.paramMap.get('id');
    
    // Check for query params (pre-filled driver)
    this.route.queryParams.subscribe(params => {
      const preselectedDriverId = params['driverId'];
      const preselectedDriverName = params['driverName'];
      
      if (preselectedDriverId && !this.isEditMode) {
        console.log('📌 Pre-selecting driver:', preselectedDriverName);
        this.shiftForm.patchValue({ driverId: preselectedDriverId });
      }
    });
    
    this.loadDrivers();
    this.loadInitialVehicles();
    
    if (this.shiftId) {
      this.isEditMode = true;
      this.loadShift();
    } else {
      // Set default start time to now
      const now = new Date();
      const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      this.shiftForm.patchValue({ startTime: localDateTime });
    }
  }

  async loadDrivers() {
    try {
      console.log('📡 Loading drivers for dropdown...');
      const allDrivers = await this.driverService.getDrivers();
      this.drivers = allDrivers.filter(d => d.status === 'active');
      console.log('✅ Active drivers loaded:', this.drivers.length);
    } catch (error) {
      console.error('❌ Error loading drivers:', error);
      this.alertService.warning('Failed to load drivers list');
    }
  }

  async loadInitialVehicles() {
    try {
      this.loadingVehicles = true;
      console.log('📡 Loading initial vehicles...');
      this.vehicles = await this.vehicleService.loadNextPage();
      console.log('✅ Initial vehicles loaded:', this.vehicles.length);
    } catch (error) {
      console.error('❌ Error loading vehicles:', error);
      this.alertService.warning('Failed to load vehicles');
    } finally {
      this.loadingVehicles = false;
    }
  }

  async onVehicleScroll(event: any) {
    const element = event.target;
    // Check if scrolled to bottom (90% threshold)
    const atBottom = element.scrollHeight - element.scrollTop <= element.clientHeight * 1.1;
    
    if (atBottom && !this.loadingMoreVehicles && this.vehicleService.hasMore()) {
      await this.loadMoreVehicles();
    }
  }

  async loadMoreVehicles() {
    try {
      this.loadingMoreVehicles = true;
      console.log('📥 Loading more vehicles...');
      this.vehicles = await this.vehicleService.loadNextPage();
      console.log('✅ More vehicles loaded. Total:', this.vehicles.length);
    } catch (error) {
      console.error('❌ Error loading more vehicles:', error);
    } finally {
      this.loadingMoreVehicles = false;
    }
  }

  async loadShift() {
    try {
      this.loading = true;
      console.log('📡 Loading shift:', this.shiftId);
      const shift = await this.shiftService.getShift(this.shiftId!);
      
      if (shift) {
        console.log('✅ Shift loaded:', shift);
        
        const startTime = new Date(shift.startTime);
        const localStartTime = new Date(startTime.getTime() - startTime.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
        
        let localEndTime = '';
        if (shift.endTime) {
          const endTime = new Date(shift.endTime);
          localEndTime = new Date(endTime.getTime() - endTime.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
        }

        this.shiftForm.patchValue({
          driverId: shift.driverId,
          vehicleId: shift.vehicleId,
          startTime: localStartTime,
          endTime: localEndTime,
          status: shift.status
        });
      }
    } catch (error) {
      console.error('❌ Error loading shift:', error);
      this.alertService.danger('Failed to load shift');
    } finally {
      this.loading = false;
    }
  }

  async onSubmit() {
    console.log('💾 Shift form submitted');

    if (this.shiftForm.invalid) {
      this.alertService.warning('Please fill all required fields');
      return;
    }

    try {
      this.loading = true;
      const formValue = this.shiftForm.value;
      
      const selectedDriver = this.drivers.find(d => d.id === formValue.driverId);
      const selectedVehicle = this.vehicles.find(v => v.id === formValue.vehicleId);

      const shift: any = {
        driverId: formValue.driverId,
        vehicleId: formValue.vehicleId,
        startTime: new Date(formValue.startTime).toISOString(),
        status: formValue.status
      };

      if (formValue.endTime) {
        shift.endTime = new Date(formValue.endTime).toISOString();
      }

      if (selectedDriver) {
        shift.driverName = selectedDriver.name;
      }
      if (selectedVehicle) {
        shift.vehicleNumber = selectedVehicle.vehicleNumber;
      }

      console.log('Saving shift:', shift);

      if (this.isEditMode && this.shiftId) {
        await this.shiftService.updateShift(this.shiftId, shift);
        this.alertService.success('Shift updated successfully');
      } else {
        await this.shiftService.createShift(shift);
        this.alertService.success('Shift created successfully');
      }

      console.log('✅ Shift saved, navigating back');
      this.router.navigate(['/shifts']);
    } catch (error) {
      console.error('❌ Error saving shift:', error);
      this.alertService.danger('Failed to save shift: ' + error);
    } finally {
      this.loading = false;
    }
  }

  onCancel() {
    console.log('❌ Form cancelled');
    this.router.navigate(['/shifts']);
  }

  toggleVehicleDropdown() {
    this.showVehicleDropdown = !this.showVehicleDropdown;
  }

  selectVehicle(vehicle: Vehicle) {
    console.log('✅ Vehicle selected:', vehicle);
    this.shiftForm.patchValue({ vehicleId: vehicle.id });
    this.showVehicleDropdown = false;
  }

  getSelectedVehicleName(): string {
    const vehicleId = this.shiftForm.get('vehicleId')?.value;
    if (!vehicleId) return '';
    const vehicle = this.vehicles.find(v => v.id === vehicleId);
    return vehicle ? `${vehicle.vehicleNumber} - ${vehicle.maker} ${vehicle.type}` : '';
  }
}