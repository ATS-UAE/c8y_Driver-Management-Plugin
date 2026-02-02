import { Component, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, FormArray, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { DriverService } from "../../services/driver.service";
import { AlertService } from "@c8y/ngx-components";

@Component({
  selector: "app-driver-form",
  templateUrl: "./driver-form.component.html",
})
export class DriverFormComponent implements OnInit {
  driverForm!: FormGroup;
  isEditMode = false;
  driverId?: string;
  loading = false;

  constructor(
    private fb: FormBuilder,
    private driverService: DriverService,
    private router: Router,
    private route: ActivatedRoute,
    private alertService: AlertService,
  ) {}

  ngOnInit() {
    this.initForm();
    this.route.params.subscribe((params) => {
      if (params["id"]) {
        this.isEditMode = true;
        this.driverId = params["id"];
        this.loadDriver(this.driverId);
      }
    });
  }

  initForm() {
    this.driverForm = this.fb.group({
      name: ["", Validators.required],
      licenseNumber: [""],
      phoneNumber: [""],
      email: [""],
      status: ["active"],
      customFields: this.fb.array([]),
    });
  }

  get customFields() {
    return this.driverForm.get("customFields") as FormArray;
  }

  addCustomField() {
    const customFieldGroup = this.fb.group({
      key: [""],
      value: [""],
    });
    this.customFields.push(customFieldGroup);
  }

  removeCustomField(index: number) {
    this.customFields.removeAt(index);
  }

  async loadDriver(id: string) {
    try {
      this.loading = true;
      const driver = await this.driverService.getDriver(id);

      this.driverForm.patchValue({
        name: driver.name,
        licenseNumber: driver.licenseNumber || "",
        phoneNumber: driver.phoneNumber || "",
        email: driver.email || "",
        status: driver.status || "active",
      });


      if (driver.customFields && typeof driver.customFields === "object") {
        Object.entries(driver.customFields).forEach(([key, value]) => {
          const customFieldGroup = this.fb.group({
            key: [key],
            value: [value],
          });
          this.customFields.push(customFieldGroup);
        });
      }
    } catch (error) {
      this.alertService.danger("Failed to load driver");
    } finally {
      this.loading = false;
    }
  }

  async onSubmit() {
    if (this.driverForm.invalid) {
      this.alertService.warning("Please fill in all required fields");
      return;
    }

    try {
      this.loading = true;
      const formValue = this.driverForm.value;
      const customFieldsObj: any = {};
      formValue.customFields.forEach((field: any) => {
        if (field.key && field.value) {
          customFieldsObj[field.key] = field.value;
        }
      });

      const driver: any = {
        name: formValue.name,
        licenseNumber: formValue.licenseNumber,
        phoneNumber: formValue.phoneNumber,
        email: formValue.email,
        status: formValue.status,
        customFields: customFieldsObj,
      };

      if (this.isEditMode && this.driverId) {
        await this.driverService.updateDriver(this.driverId, driver);
        this.alertService.success("Driver updated successfully");
      } else {
        await this.driverService.createDriver(driver);
        this.alertService.success("Driver created successfully");
      }

      this.router.navigate(["/drivers"]);
    } catch (error) {
      this.alertService.danger("Failed to save driver");
    } finally {
      this.loading = false;
    }
  }

  onCancel() {
    this.router.navigate(["/drivers"]);
  }
}
