import { Component, OnInit, HostListener } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ShiftService } from '../../services/shift.service';
import { DriverService } from '../../services/driver.service';
import { VehicleService } from '../../services/vehicle.service';
import { Shift, Driver, Vehicle } from '../../models/driver.model';
import { AlertService } from '@c8y/ngx-components';

@Component({
  selector: 'app-shift-form',
  templateUrl: './shift-form.component.html'
})
export class ShiftFormComponent implements OnInit {
  shiftForm: FormGroup;
  isEditMode = false;
  shiftId: string | null = null;
  loading = false;
  shiftStartTime: string = '';

  // ── Vehicle dropdown (existing, unchanged) ───────────────────
  vehicles: Vehicle[] = [];
  loadingVehicles = false;
  loadingMoreVehicles = false;
  showVehicleDropdown = false;

  // ── Paginated Driver dropdown (new, matches vehicle pattern) ──
  showDriverDropdown    = false;
  driverDropdownSearch  = '';
  dropdownDrivers: Driver[] = [];   // accumulated rows so far
  driverDropdownPage    = 1;
  driverDropdownHasMore = false;
  loadingMoreDrivers    = false;
  private _driverSearchTimer: any = null;

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
      driverId:  ['', Validators.required],
      vehicleId: ['', Validators.required],
      startTime: ['', Validators.required],
      endTime:   [''],
      status:    ['ongoing', Validators.required]
    });
  }

  ngOnInit() {
    console.log('✅ ShiftFormComponent ngOnInit');
    this.shiftId = this.route.snapshot.paramMap.get('id');

    // Pre-fill driver from query params (e.g. navigated from driver list)
    this.route.queryParams.subscribe(params => {
      const preselectedDriverId = params['driverId'];
      if (preselectedDriverId && !this.isEditMode) {
        console.log('📌 Pre-selecting driver:', params['driverName']);
        this.shiftForm.patchValue({ driverId: preselectedDriverId });
      }
    });

    // Seed the driver dropdown with page 1
    this._loadDriverDropdownPage1();
    this.loadInitialVehicles();

    if (this.shiftId) {
      this.isEditMode = true;
      this.loadShift();
    } else {
      // Default start time = now
      const now = new Date();
      const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString().slice(0, 16);
      this.shiftForm.patchValue({ startTime: local });
    }
  }

  /** Close dropdowns when clicking outside */
  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent) {
    const t = e.target as HTMLElement;
    if (!t.closest('.pds-wrap'))     this.showDriverDropdown  = false;
    if (!t.closest('.pvs-wrap'))     this.showVehicleDropdown = false;
  }

  // ==================== VEHICLE METHODS (unchanged) ====================

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
    const el = event.target;
    const atBottom = el.scrollHeight - el.scrollTop <= el.clientHeight * 1.1;
    if (atBottom && !this.loadingMoreVehicles && this.vehicleService.hasMore()) {
      await this.loadMoreVehicles();
    }
  }

  async loadMoreVehicles() {
    try {
      this.loadingMoreVehicles = true;
      this.vehicles = await this.vehicleService.loadNextPage();
    } catch (error) {
      console.error('❌ Error loading more vehicles:', error);
    } finally {
      this.loadingMoreVehicles = false;
    }
  }

  toggleVehicleDropdown() {
    this.showVehicleDropdown = !this.showVehicleDropdown;
    if (this.showVehicleDropdown) this.showDriverDropdown = false;
  }

  selectVehicle(vehicle: Vehicle) {
    this.shiftForm.patchValue({ vehicleId: vehicle.id });
    this.showVehicleDropdown = false;
  }

  getSelectedVehicleName(): string {
    const id = this.shiftForm.get('vehicleId')?.value;
    if (!id) return '';
    const v = this.vehicles.find(v => v.id === id);
    return v ? `${v.vehicleNumber} - ${v.maker} ${v.type}` : '';
  }

  // ==================== PAGINATED DRIVER DROPDOWN ====================

  /** Reset state and load page 1 */
  private async _loadDriverDropdownPage1() {
    this.dropdownDrivers      = [];
    this.driverDropdownPage   = 1;
    this.driverDropdownHasMore = false;
    this.driverDropdownSearch  = '';
    this.loadingMoreDrivers   = true;
    try {
      const page = await this.driverService.getDriversPaginated(1, '');
      // Only show active drivers in the shift form
      this.dropdownDrivers       = page.drivers.filter(d => d.status === 'active');
      this.driverDropdownHasMore = page.hasMore;
      this.driverDropdownPage    = 2;
    } catch (e) {
      console.error('❌ Driver dropdown page 1 failed:', e);
    } finally {
      this.loadingMoreDrivers = false;
    }
  }

  /** Open / close the driver panel */
  toggleDriverDropdown() {
    this.showDriverDropdown = !this.showDriverDropdown;
    if (this.showDriverDropdown) this.showVehicleDropdown = false;
  }

  /** Search input — debounced 300 ms, resets to page 1 */
  onDriverSearchChange() {
    clearTimeout(this._driverSearchTimer);
    this._driverSearchTimer = setTimeout(async () => {
      this.dropdownDrivers      = [];
      this.driverDropdownPage   = 1;
      this.loadingMoreDrivers   = true;
      try {
        const page = await this.driverService.getDriversPaginated(1, this.driverDropdownSearch);
        this.dropdownDrivers       = page.drivers.filter(d => d.status === 'active');
        this.driverDropdownHasMore = page.hasMore;
        this.driverDropdownPage    = 2;
      } catch (e) {
        console.error('❌ Driver search failed:', e);
      } finally {
        this.loadingMoreDrivers = false;
      }
    }, 300);
  }

  /** Scroll handler — appends next page when near bottom */
  async onDriverScroll(event: Event) {
    if (!this.driverDropdownHasMore || this.loadingMoreDrivers) return;
    const el = event.target as HTMLElement;
    if (el.scrollTop + el.clientHeight < el.scrollHeight - 40) return;

    this.loadingMoreDrivers = true;
    try {
      const page = await this.driverService.getDriversPaginated(
        this.driverDropdownPage,
        this.driverDropdownSearch
      );
      const seen = new Set(this.dropdownDrivers.map(d => d.id));
      const fresh = page.drivers.filter(d => d.status === 'active' && !seen.has(d.id));
      this.dropdownDrivers.push(...fresh);
      this.driverDropdownHasMore = page.hasMore;
      this.driverDropdownPage    = page.currentPage + 1;
    } catch (e) {
      console.error('❌ Load more drivers failed:', e);
    } finally {
      this.loadingMoreDrivers = false;
    }
  }

  /** Select a driver row */
  selectDriver(driver: Driver) {
    this.shiftForm.patchValue({ driverId: driver.id });
    this.showDriverDropdown = false;
  }

  /** Label shown in the closed trigger */
  getSelectedDriverName(): string {
    const id = this.shiftForm.get('driverId')?.value;
    if (!id) return '';
    const d = this.dropdownDrivers.find(dr => dr.id === id);
    if (!d) return 'Unknown Driver';
    return d.licenseNumber ? `${d.name} - ${d.licenseNumber}` : d.name;
  }

  // ==================== SHIFT LOAD / SAVE ====================

  async loadShift() {
    try {
      this.loading = true;
      const shift = await this.shiftService.getShift(this.shiftId!);
      if (!shift) return;

      const startTime = new Date(shift.startTime);
      const localStart = new Date(startTime.getTime() - startTime.getTimezoneOffset() * 60000)
        .toISOString().slice(0, 16);

      let localEnd = '';
      if (shift.endTime) {
        const endTime = new Date(shift.endTime);
        localEnd = new Date(endTime.getTime() - endTime.getTimezoneOffset() * 60000)
          .toISOString().slice(0, 16);
      }

      this.shiftStartTime = localStart;

      this.shiftForm.patchValue({
        driverId:  shift.driverId,
        vehicleId: shift.vehicleId,
        startTime: localStart,
        endTime:   localEnd,
        status:    shift.status
      });
    } catch (error) {
      console.error('❌ Error loading shift:', error);
      this.alertService.danger('Failed to load shift');
    } finally {
      this.loading = false;
    }
  }

  async onSubmit() {
    if (this.shiftForm.invalid) {
      this.alertService.warning('Please fill all required fields');
      return;
    }

    try {
      this.loading = true;
      const formValue = this.shiftForm.value;

      const selectedDriver  = this.dropdownDrivers.find(d => d.id === formValue.driverId);
      const selectedVehicle = this.vehicles.find(v => v.id === formValue.vehicleId);

      const shift: any = {
        driverId:  formValue.driverId,
        vehicleId: formValue.vehicleId,
        startTime: new Date(formValue.startTime).toISOString(),
        status:    formValue.status
      };

      if (formValue.endTime)   shift.endTime     = new Date(formValue.endTime).toISOString();
      if (selectedDriver)      shift.driverName  = selectedDriver.name;
      if (selectedVehicle)     shift.vehicleNumber = selectedVehicle.vehicleNumber;

      if (this.isEditMode && this.shiftId) {
        await this.shiftService.updateShift(this.shiftId, shift);
        this.alertService.success('Shift updated successfully');
      } else {
        await this.shiftService.createShift(shift);
        this.alertService.success('Shift created successfully');
      }

      this.router.navigate(['/shifts']);
    } catch (error) {
      console.error('❌ Error saving shift:', error);
      this.alertService.danger('Failed to save shift: ' + error);
    } finally {
      this.loading = false;
    }
  }

  onCancel() {
    this.router.navigate(['/shifts']);
  }
}