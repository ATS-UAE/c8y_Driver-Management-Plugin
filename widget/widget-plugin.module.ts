import { assetPaths } from "../assets/assets";
import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";
import { WidgetPluginComponent } from "./widget-plugin.component";
import {
  FormsModule,
  hookComponent,
  gettext,
  CoreModule,
} from "@c8y/ngx-components";
import { ReactiveFormsModule } from "@angular/forms";
import { HOOK_NAVIGATOR_NODES, NavigatorNode } from "@c8y/ngx-components";
import { WidgetPluginConfigComponent } from "./widget-plugin-config.component";

// Import Driver Management Components
import {
  DriverListComponent,
  FilterPipe,
} from "../driver-management/components/driver-list/driver-list.component";
import { DriverFormComponent } from "../driver-management/components/driver-form/driver-form.component";
import { VehicleListComponent } from "../driver-management/components/vehicle-list/vehicle-list.component";
import { VehicleFormComponent } from "../driver-management/components/vehicle-form/vehicle-form.component";
import { ShiftListComponent } from "../driver-management/components/shift-list/shift-list.component";
import { ShiftFormComponent } from "../driver-management/components/shift-form/shift-form.component";

// Import Driver Management Services
import { DriverService } from "../driver-management/services/driver.service";
import { VehicleService } from "../driver-management/services/vehicle.service";
import { ShiftService } from "../driver-management/services/shift.service";

// Define routes HERE in the same module
const routes: Routes = [
  {
    path: "drivers",
    children: [
      { path: "", component: DriverListComponent },
      { path: "add", component: DriverFormComponent },
      { path: "edit/:id", component: DriverFormComponent },
    ],
  },
  {
    path: "vehicles",
    component: VehicleListComponent, // Read-only, no add/edit routes
  },
  {
    path: "shifts",
    children: [
      { path: "", component: ShiftListComponent },
      { path: "add", component: ShiftFormComponent },
      { path: "edit/:id", component: ShiftFormComponent },
    ],
  },
];

export function driverManagementNavigatorNode() {
  const parentNode = new NavigatorNode({
    label: gettext("Driver Management"),
    icon: "truck",
    path: "/drivers",
    priority: 1000,
  });

  const driversNode = new NavigatorNode({
    label: gettext("Drivers"),
    icon: "user",
    path: "/drivers",
    parent: parentNode,
  });

  const vehiclesNode = new NavigatorNode({
    label: gettext("Vehicles"),
    icon: "car",
    path: "/vehicles",
    parent: parentNode,
  });

  // Remove Shifts from navigation - it's now accessed from driver cards
  // const shiftsNode = new NavigatorNode({
  //   label: gettext('Shifts'),
  //   icon: 'clock-o',
  //   path: '/shifts',
  //   parent: parentNode
  // });

  // parentNode.add(driversNode);
  // parentNode.add(vehiclesNode);
  // parentNode.add(shiftsNode); // Removed from navigation

  return parentNode;
}

@NgModule({
  declarations: [
    WidgetPluginComponent,
    DriverListComponent,
    DriverFormComponent,
    VehicleListComponent,
    ShiftListComponent,
    ShiftFormComponent,
    FilterPipe,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    CoreModule,
    RouterModule.forChild(routes),
  ],
  providers: [
    DriverService,
    VehicleService,
    ShiftService,
    hookComponent({
      id: "angular.widget.plugin",
      label: gettext("Module Federation widget"),
      description: gettext("Widget added via Module Federation"),
      component: WidgetPluginComponent,
      previewImage: assetPaths.previewImage,
      configComponent: WidgetPluginConfigComponent,
    }),
    {
      provide: HOOK_NAVIGATOR_NODES,
      useFactory: driverManagementNavigatorNode,
      multi: true,
    },
  ],
})
export class WidgetPluginModule {
  constructor() {}
}
