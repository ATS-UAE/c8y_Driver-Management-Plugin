import { Component, OnInit, Pipe, PipeTransform, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { DriverService } from '../../services/driver.service';
import { Driver } from '../../models/driver.model';
import { AlertService } from '@c8y/ngx-components';

@Pipe({ name: 'filter', pure: false })
export class FilterPipe implements PipeTransform {
  transform(items: any[], field: string, value: any): any[] {
    if (!items || !field) return items;
    return items.filter(item => item[field] === value);
  }
}

export interface DriverGroup {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt?: Date;
}

@Component({
  selector: 'app-driver-list',
  templateUrl: './driver-list.component.html'
})
export class DriverListComponent implements OnInit {

  // ── Tab ─────────────────────────────────────────────────────
  activeTab: 'drivers' | 'groups' = 'drivers';

  // ── Drivers ─────────────────────────────────────────────────
  drivers: Driver[] = [];
  filteredDrivers: Driver[] = [];
  loading = false;
  searchTerm = '';
  Object = Object;

  // ── Groups ──────────────────────────────────────────────────
  groups: DriverGroup[] = [];
  filteredGroups: DriverGroup[] = [];
  loadingGroups = false;
  groupSearchTerm = '';

  // ── Modals ──────────────────────────────────────────────────
  showGroupModal = false;
  showAssignDriverModal = false;
  editingGroup: DriverGroup | null = null;
  selectedGroup: DriverGroup | null = null;
  selectedDriver: Driver | null = null;

  groupForm = { name: '', description: '' };
  assignForm = { groupId: '', driverId: '' };

  // ── Searchable select state ──────────────────────────────────
  // Group dropdown (inside assign modal, when no group pre-selected)
  groupDropdownOpen = false;
  groupSelectSearch = '';
  filteredGroupOptions: DriverGroup[] = [];

  // Driver dropdown (inside assign modal)
  driverDropdownOpen = false;
  driverSelectSearch = '';
  filteredDriverOptions: Driver[] = [];

  constructor(
    private driverService: DriverService,
    private router: Router,
    private alertService: AlertService
  ) {}

  ngOnInit() {
    this.loadDrivers();
    this.loadGroups();
  }

  // Close dropdowns when clicking anywhere outside the modal
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.searchable-select')) {
      this.groupDropdownOpen = false;
      this.driverDropdownOpen = false;
    }
  }

  // ==================== DRIVER METHODS ====================

  async loadDrivers() {
    try {
      this.loading = true;
      this.drivers = await this.driverService.getDrivers();
      this.filteredDrivers = [...this.drivers];
    } catch (error) {
      console.error('❌ Error loading drivers:', error);
      this.alertService.danger('Failed to load drivers');
    } finally {
      this.loading = false;
    }
  }

  filterDrivers() {
    const term = this.searchTerm.toLowerCase().trim();
    if (!term) { this.filteredDrivers = [...this.drivers]; return; }
    this.filteredDrivers = this.drivers.filter(d =>
      d.name?.toLowerCase().includes(term) ||
      d.phoneNumber?.toLowerCase().includes(term) ||
      d.email?.toLowerCase().includes(term) ||
      d.licenseNumber?.toLowerCase().includes(term)
    );
  }

  addDriver()               { this.router.navigate(['/drivers/add']); }
  editDriver(d: Driver)     { this.router.navigate(['/drivers/edit', d.id]); }
  manageShifts(d: Driver)   { this.router.navigate(['/shifts'], { queryParams: { driverId: d.id, driverName: d.name } }); }

  async deleteDriver(driver: Driver) {
    if (!confirm(`Are you sure you want to delete driver ${driver.name}?`)) return;
    try {
      await this.driverService.deleteDriver(driver.id!);
      this.alertService.success('Driver deleted successfully');
      await this.loadDrivers();
    } catch (error) {
      this.alertService.danger('Failed to delete driver');
    }
  }

  getActiveDriversCount() { return this.drivers.filter(d => d.status === 'active').length; }

  hasCustomFields(driver: Driver): boolean {
    const cf = (driver as any).customFields;
    return cf && typeof cf === 'object' && Object.keys(cf).length > 0;
  }
  getCustomFieldsCount(driver: Driver): number {
    const cf = (driver as any).customFields;
    return (!cf || typeof cf !== 'object') ? 0 : Object.keys(cf).length;
  }
  getCustomFieldsTooltip(driver: Driver): string {
    const cf = (driver as any).customFields;
    if (!cf) return '';
    return Object.entries(cf).map(([k, v]) => `${k}: ${v}`).join('\n');
  }
  getCustomFieldsArray(driver: Driver): Array<{ key: string; value: string }> {
    const cf = (driver as any).customFields;
    if (!cf || typeof cf !== 'object') return [];
    return Object.entries(cf).map(([key, value]) => ({ key, value: String(value) }));
  }

  // ==================== GROUP METHODS ====================

  async loadGroups() {
    try {
      this.loadingGroups = true;
      const stored = localStorage.getItem('driverGroups');
      this.groups = stored
        ? JSON.parse(stored).map((g: any) => ({
            ...g,
            createdAt: new Date(g.createdAt),
            updatedAt: g.updatedAt ? new Date(g.updatedAt) : undefined
          }))
        : [];
      this.filteredGroups = [...this.groups];
    } catch (error) {
      console.error('❌ Error loading groups:', error);
      this.alertService.danger('Failed to load groups');
      this.groups = [];
      this.filteredGroups = [];
    } finally {
      this.loadingGroups = false;
    }
  }

  filterGroups() {
    const term = this.groupSearchTerm.toLowerCase().trim();
    if (!term) { this.filteredGroups = [...this.groups]; return; }
    this.filteredGroups = this.groups.filter(g =>
      g.name?.toLowerCase().includes(term) ||
      g.description?.toLowerCase().includes(term)
    );
  }

  addGroup() {
    this.editingGroup = null;
    this.groupForm = { name: '', description: '' };
    this.showGroupModal = true;
  }

  editGroup(group: DriverGroup) {
    this.editingGroup = group;
    this.groupForm = { name: group.name, description: group.description };
    this.showGroupModal = true;
  }

  async saveGroup() {
    if (!this.groupForm.name.trim()) {
      this.alertService.warning('Please enter a group name');
      return;
    }
    try {
      if (this.editingGroup) {
        const idx = this.groups.findIndex(g => g.id === this.editingGroup!.id);
        if (idx !== -1) {
          this.groups[idx] = { ...this.groups[idx], ...this.groupForm, updatedAt: new Date() };
          this.alertService.success('Group updated successfully');
        }
      } else {
        this.groups.push({
          id: Date.now().toString(),
          name: this.groupForm.name,
          description: this.groupForm.description,
          createdAt: new Date()
        });
        this.alertService.success('Group created successfully');
      }
      localStorage.setItem('driverGroups', JSON.stringify(this.groups));
      this.filterGroups();
      this.closeGroupModal();
    } catch (error) {
      this.alertService.danger('Failed to save group');
    }
  }

  async deleteGroup(group: DriverGroup) {
    const count = this.getGroupDriverCount(group.id);
    let msg = `Are you sure you want to delete "${group.name}"?`;
    if (count > 0) msg += `\n\nThis will unassign ${count} driver(s).`;
    if (!confirm(msg)) return;
    try {
      const toUnassign = this.drivers.filter(d => d.groupId === group.id);
      for (const driver of toUnassign) {
        const updated = await this.driverService.removeDriverFromGroup(driver.id!);
        const idx = this.drivers.findIndex(d => d.id === driver.id);
        if (idx !== -1) this.drivers[idx] = updated;
      }
      this.groups = this.groups.filter(g => g.id !== group.id);
      localStorage.setItem('driverGroups', JSON.stringify(this.groups));
      this.filterGroups();
      this.filterDrivers();
      this.alertService.success('Group deleted successfully');
    } catch (error) {
      this.alertService.danger('Failed to delete group');
    }
  }

  closeGroupModal() {
    this.showGroupModal = false;
    this.editingGroup = null;
    this.groupForm = { name: '', description: '' };
  }

  // ==================== GROUP-DRIVER RELATIONSHIP ====================

  getGroupName(groupId: string): string {
    return this.groups.find(g => g.id === groupId)?.name ?? 'Unknown Group';
  }
  getGroupDriverCount(groupId: string): number {
    return this.drivers.filter(d => d.groupId === groupId).length;
  }
  getGroupDrivers(groupId: string): Driver[] {
    return this.drivers.filter(d => d.groupId === groupId);
  }
  getAvailableDriversForGroup(groupId?: string): Driver[] {
    return this.drivers.filter(d => !d.groupId || d.groupId === groupId);
  }

  assignGroup(driver: Driver) {
    this.selectedDriver = driver;
    this.selectedGroup = null;
    this.assignForm = { groupId: driver.groupId || '', driverId: driver.id! };
    this._openAssignModal();
  }

  addDriverToGroup(group: DriverGroup) {
    this.selectedGroup = group;
    this.selectedDriver = null;
    this.assignForm = { groupId: group.id, driverId: '' };
    this._openAssignModal();
  }

  private _openAssignModal() {
    // Reset both dropdowns and seed their option lists
    this.groupDropdownOpen = false;
    this.driverDropdownOpen = false;
    this.groupSelectSearch = '';
    this.driverSelectSearch = '';
    this.filteredGroupOptions = [...this.groups];
    this.filteredDriverOptions = this.getAvailableDriversForGroup(this.selectedGroup?.id);
    this.showAssignDriverModal = true;
  }

  async confirmAssignDriver() {
    const groupId  = this.selectedGroup?.id || this.assignForm.groupId;
    const driverId = this.selectedDriver?.id || this.assignForm.driverId;

    if (!groupId || !driverId) {
      this.alertService.warning('Please select both a group and a driver');
      return;
    }
    try {
      const updatedDriver = await this.driverService.assignDriverToGroup(driverId, groupId);
      const idx = this.drivers.findIndex(d => d.id === driverId);
      if (idx !== -1) this.drivers[idx] = updatedDriver;
      this.filterDrivers();
      this.alertService.success(`Driver assigned to "${this.getGroupName(groupId)}"`);
      this.closeAssignDriverModal();
    } catch (error) {
      this.alertService.danger('Failed to assign driver to group');
    }
  }

  async removeDriverFromGroup(driver: Driver, group: DriverGroup) {
    if (!confirm(`Remove ${driver.name} from "${group.name}"?`)) return;
    try {
      const updatedDriver = await this.driverService.removeDriverFromGroup(driver.id!);
      const idx = this.drivers.findIndex(d => d.id === driver.id);
      if (idx !== -1) this.drivers[idx] = updatedDriver;
      this.filterDrivers();
      this.alertService.success(`${driver.name} removed from "${group.name}"`);
    } catch (error) {
      this.alertService.danger('Failed to remove driver from group');
    }
  }

  closeAssignDriverModal() {
    this.showAssignDriverModal = false;
    this.selectedGroup = null;
    this.selectedDriver = null;
    this.assignForm = { groupId: '', driverId: '' };
    this.groupDropdownOpen = false;
    this.driverDropdownOpen = false;
    this.groupSelectSearch = '';
    this.driverSelectSearch = '';
  }

  // ==================== SEARCHABLE SELECT METHODS ====================

  // ── Group dropdown ────────────────────────────────────────────
  toggleGroupDropdown() {
    this.groupDropdownOpen = !this.groupDropdownOpen;
    if (this.groupDropdownOpen) {
      this.driverDropdownOpen = false;   // close sibling
      this.groupSelectSearch = '';
      this.filteredGroupOptions = [...this.groups];
    }
  }

  filterGroupOptions() {
    const term = this.groupSelectSearch.toLowerCase().trim();
    this.filteredGroupOptions = !term
      ? [...this.groups]
      : this.groups.filter(g =>
          g.name?.toLowerCase().includes(term) ||
          g.description?.toLowerCase().includes(term)
        );
  }

  selectGroup(group: DriverGroup) {
    this.assignForm.groupId = group.id;
    this.groupDropdownOpen = false;
    this.groupSelectSearch = '';
    // Refresh available drivers now that a group is selected
    this.filteredDriverOptions = this.getAvailableDriversForGroup(group.id);
    this.assignForm.driverId = '';   // reset driver if group changed
  }

  // ── Driver dropdown ───────────────────────────────────────────
  toggleDriverDropdown() {
    this.driverDropdownOpen = !this.driverDropdownOpen;
    if (this.driverDropdownOpen) {
      this.groupDropdownOpen = false;  // close sibling
      this.driverSelectSearch = '';
      this.filteredDriverOptions = this.getAvailableDriversForGroup(
        this.selectedGroup?.id || this.assignForm.groupId || undefined
      );
    }
  }

  filterDriverOptions() {
    const term = this.driverSelectSearch.toLowerCase().trim();
    const available = this.getAvailableDriversForGroup(
      this.selectedGroup?.id || this.assignForm.groupId || undefined
    );
    this.filteredDriverOptions = !term
      ? available
      : available.filter(d =>
          d.name?.toLowerCase().includes(term) ||
          d.phoneNumber?.toLowerCase().includes(term) ||
          d.email?.toLowerCase().includes(term) ||
          d.licenseNumber?.toLowerCase().includes(term)
        );
  }

  selectDriver(driver: Driver) {
    this.assignForm.driverId = driver.id!;
    this.driverDropdownOpen = false;
    this.driverSelectSearch = '';
  }

  /** Returns a display string for the selected driver in the trigger */
  getDriverDisplayName(driverId: string): string {
    const d = this.drivers.find(dr => dr.id === driverId);
    if (!d) return 'Unknown Driver';
    const contact = d.phoneNumber || d.email || '';
    return contact ? `${d.name} — ${contact}` : d.name;
  }

  // ==================== UTILITY ====================

  formatDate(date: Date): string {
    if (!date) return 'N/A';
    const d = new Date(date);
    const diffDays = Math.ceil(Math.abs(Date.now() - d.getTime()) / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7)  return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return d.toLocaleDateString();
  }
}