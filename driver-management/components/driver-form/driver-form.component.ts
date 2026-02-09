import { Component, OnInit, OnDestroy } from "@angular/core";
import {
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
} from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";
import { DriverService } from "../../services/driver.service";
import { AlertService } from "@c8y/ngx-components";

@Component({
  selector: "app-driver-form",
  templateUrl: "./driver-form.component.html",
})
export class DriverFormComponent implements OnInit, OnDestroy {
  driverForm!: FormGroup;
  isEditMode = false;
  driverId?: string;
  loading = false;

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private driverService: DriverService,
    private router: Router,
    private route: ActivatedRoute,
    private alertService: AlertService
  ) {}

  ngOnInit(): void {
    this.initForm();

    this.route.paramMap
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        const id = params.get("id");
        if (id) {
          this.isEditMode = true;
          this.driverId = id;
          this.loadDriver(id);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForm(): void {
    this.driverForm = this.fb.group({
      name: ["", Validators.required],
      licenseNumber: ["", Validators.maxLength(50)],
      phoneNumber: ["", Validators.maxLength(20)],
      email: ["", Validators.email],
      status: ["active", Validators.required],
      driverCode: [""],
      customFields: this.fb.array([]),
    });
  }

  get customFields(): FormArray {
    return this.driverForm.get("customFields") as FormArray;
  }

  addCustomField(): void {
    this.customFields.push(
      this.fb.group({
        key: ["", Validators.required],
        value: ["", Validators.required],
      })
    );
  }

  removeCustomField(index: number): void {
    this.customFields.removeAt(index);
  }

  private async loadDriver(id: string): Promise<void> {
    try {
      this.loading = true;

      // Clear existing custom fields (important!)
      this.customFields.clear();

      const driver = await this.driverService.getDriver(id);

      this.driverForm.patchValue({
        name: driver.name,
        licenseNumber: driver.licenseNumber ?? "",
        phoneNumber: driver.phoneNumber ?? "",
        email: driver.email ?? "",
        status: driver.status ?? "active",
        driverCode: driver.driverCode ?? "",
      });

      if (driver.customFields && typeof driver.customFields === "object") {
        Object.entries(driver.customFields).forEach(([key, value]) => {
          this.customFields.push(
            this.fb.group({
              key: [key, Validators.required],
              value: [String(value), Validators.required],
            })
          );
        });
      }
    } catch (error) {
      console.error("Load driver failed", error);
      this.alertService.danger("Failed to load driver");
    } finally {
      this.loading = false;
    }
  }

  async onSubmit(): Promise<void> {
    if (this.driverForm.invalid) {
      this.driverForm.markAllAsTouched();
      this.alertService.warning("Please fill in all required fields");
      return;
    }

    try {
      this.loading = true;

      const formValue = this.driverForm.value;

      const customFields = formValue.customFields.reduce(
        (acc: Record<string, string>, field: { key: string; value: string }) => {
          if (field.key) {
            acc[field.key] = field.value;
          }
          return acc;
        },
        {}
      );

      const driverPayload = {
        name: formValue.name,
        licenseNumber: formValue.licenseNumber,
        phoneNumber: formValue.phoneNumber,
        email: formValue.email,
        status: formValue.status,
        driverCode: formValue.driverCode,
        customFields,
        creationTime: new Date().toISOString(),
        c8y_Driver: {
          name: formValue.name,
          licenseNumber: formValue.licenseNumber,
          phoneNumber: formValue.phoneNumber,
          email: formValue.email,
          status: formValue.status,
          customFields,
        },
      };

      if (this.isEditMode && this.driverId) {
        await this.driverService.updateDriver(this.driverId, driverPayload);
        this.alertService.success("Driver updated successfully");
      } else {
        await this.driverService.createDriver(driverPayload);
        this.alertService.success("Driver created successfully");
      }

      this.router.navigate(["/drivers"]);
    } catch (error) {
      console.error("Save driver failed", error);
      this.alertService.danger("Failed to save driver");
    } finally {
      this.loading = false;
    }
  }

  onCancel(): void {
    this.router.navigate(["/drivers"]);
  }
}
