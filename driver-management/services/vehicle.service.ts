import { Injectable } from "@angular/core";
import { InventoryService } from "@c8y/client";
import { Vehicle } from "../models/driver.model";

@Injectable()
export class VehicleService {
  private readonly DEVICE_GROUP_FRAGMENT = "c8y_IsDevice";
  private readonly PAGE_SIZE = 20;

  private allVehicles: Vehicle[] = [];
  private currentPage = 1;
  private hasMorePages = true;

  constructor(private inventory: InventoryService) {}

  async loadNextPage(): Promise<Vehicle[]> {
    if (!this.hasMorePages) {
      console.log("📌 No more pages to load");
      return this.allVehicles;
    }

    try {
      const filter = {
        fragmentType: this.DEVICE_GROUP_FRAGMENT,
        pageSize: this.PAGE_SIZE,
        currentPage: this.currentPage,
      };

      const response = await this.inventory.list(filter);
      const newVehicles = (response.data || []).map((item) =>
        this.mapToVehicle(item),
      );

      // Add to existing vehicles
      this.allVehicles = [...this.allVehicles, ...newVehicles];

      // Check if there are more pages
      const paging = response.paging || {};
      this.hasMorePages =
        newVehicles.length === this.PAGE_SIZE &&
        ((paging as any).totalPages
          ? this.currentPage < (paging as any).totalPages
          : true);

      this.currentPage++;

      return this.allVehicles;
    } catch (error) {
      console.error("❌ Error loading vehicles:", error);
      throw error;
    }
  }

  async getVehicles(): Promise<Vehicle[]> {
    // If already loaded, return cached
    if (this.allVehicles.length > 0) {
      return this.allVehicles;
    }
    // Load first page
    return this.loadNextPage();
  }

  hasMore(): boolean {
    return this.hasMorePages;
  }

  reset() {
    this.allVehicles = [];
    this.currentPage = 1;
    this.hasMorePages = true;
  }

  async getVehicle(id: string): Promise<Vehicle> {
    try {
      const response = await this.inventory.detail(id);
      return this.mapToVehicle(response.data);
    } catch (error) {
      console.error("❌ Error fetching vehicle:", error);
      throw error;
    }
  }

  private mapToVehicle(data: any): Vehicle {
    return {
      id: data.id,
      vehicleNumber: data.name || data.id,
      maker: data.owner || "Unknown",
      type: data.type || "Device Group",
      status: "active",
    };
  }
}
