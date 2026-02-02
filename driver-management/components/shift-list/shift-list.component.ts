import { Component, OnInit } from "@angular/core";
import { Router, ActivatedRoute } from "@angular/router";
import { ShiftService } from "../../services/shift.service";
import { Shift } from "../../models/driver.model";
import { AlertService } from "@c8y/ngx-components";

@Component({
  selector: "app-shift-list",
  templateUrl: "./shift-list.component.html",
})
export class ShiftListComponent implements OnInit {
  shifts: Shift[] = [];
  filteredShifts: Shift[] = [];
  loading = false;
  selectedDriverId: string | null = null;
  selectedDriverName: string | null = null;

  constructor(
    private shiftService: ShiftService,
    private router: Router,
    private route: ActivatedRoute,
    private alertService: AlertService,
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe((params) => {
      this.selectedDriverId = params["driverId"] || null;
      this.selectedDriverName = params["driverName"] || null;

      // if (this.selectedDriverId) {
      // }

      this.loadShifts();
    });
  }

  async loadShifts() {
    try {
      this.loading = true;

      this.shifts = await this.shiftService.getShifts();

      this.filterShifts();
    } catch (error) {
      this.alertService.danger("Failed to load shifts");
    } finally {
      this.loading = false;
    }
  }

  filterShifts() {
    if (this.selectedDriverId) {
      this.filteredShifts = this.shifts.filter(
        (s) => s.driverId === this.selectedDriverId,
      );
    } else {
      this.filteredShifts = this.shifts;
    }
  }

  clearFilter() {
    this.selectedDriverId = null;
    this.selectedDriverName = null;
    this.router.navigate(["/shifts"]);
    this.filterShifts();
  }

  addShift() {
    if (this.selectedDriverId) {
      this.router.navigate(["/shifts/add"], {
        queryParams: {
          driverId: this.selectedDriverId,
          driverName: this.selectedDriverName,
        },
      });
    } else {
      this.router.navigate(["/shifts/add"]);
    }
  }

  editShift(shift: Shift) {
    this.router.navigate(["/shifts/edit", shift.id]);
  }

  async deleteShift(shift: Shift) {
    if (confirm(`Are you sure you want to delete this shift?`)) {
      try {
        await this.shiftService.deleteShift(shift.id!);
        this.alertService.success("Shift deleted successfully");
        this.loadShifts();
      } catch (error) {
        this.alertService.danger("Failed to delete shift");
      }
    }
  }

  formatDateTime(dateTime: string): string {
    if (!dateTime) return "-";
    return new Date(dateTime).toLocaleString();
  }
}
