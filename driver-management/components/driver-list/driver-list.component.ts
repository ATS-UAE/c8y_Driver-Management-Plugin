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

  // ── Tabs ─────────────────────────────────────────────────────
  activeTab: 'drivers' | 'groups' = 'drivers';

  // ── Driver list table (infinite scroll) ──────────────────────
  drivers: Driver[] = [];           // accumulated rows across pages
  filteredDrivers: Driver[] = [];
  loading = false;                  // initial page spinner
  loadingMoreTable = false;         // bottom-of-table spinner
  tableHasMore = false;
  tablePage = 1;                    // next page to fetch
  searchTerm = '';
  Object = Object;

  // ── Groups ───────────────────────────────────────────────────
  groups: DriverGroup[] = [];
  filteredGroups: DriverGroup[] = [];
  loadingGroups = false;
  groupSearchTerm = '';

  // ── Modals ───────────────────────────────────────────────────
  showGroupModal = false;
  showAssignDriverModal = false;
  editingGroup: DriverGroup | null = null;
  selectedGroup: DriverGroup | null = null;
  selectedDriver: Driver | null = null;

  groupForm  = { name: '', description: '' };
  assignForm = { groupId: '', driverId: '' };

  // ── Searchable GROUP dropdown (groups are few, no pagination needed) ──
  groupDropdownOpen   = false;
  groupSelectSearch   = '';
  filteredGroupOptions: DriverGroup[] = [];

  // ── Paginated DRIVER dropdown (scroll-to-load, same pattern as vehicle) ──
  showDriverDropdown    = false;
  driverDropdownSearch  = '';
  dropdownDrivers: Driver[] = [];   // accumulated rows shown so far
  driverDropdownPage    = 1;        // next page to fetch
  driverDropdownHasMore = false;
  loadingMoreDrivers    = false;
  private _driverSearchTimer: any   = null;

  constructor(
    private driverService: DriverService,
    private router: Router,
    private alertService: AlertService
  ) {}

  ngOnInit() {
    this.loadDrivers();
    this.loadGroups();
  }

  /** Close all dropdowns on outside click */
  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent) {
    const t = e.target as HTMLElement;
    if (!t.closest('.searchable-select') && !t.closest('.pds-wrap')) {
      this.groupDropdownOpen  = false;
      this.showDriverDropdown = false;
    }
  }

  // ==================== DRIVER TABLE METHODS ====================

  /** Initial load — resets all rows and fetches page 1 */
  async loadDrivers() {
    try {
      this.loading = true;
      this.drivers = [];
      this.tablePage = 1;
      const page = await this.driverService.getDriversPaginated(1, this.searchTerm);
      this.drivers       = page.drivers;
      this.filteredDrivers = [...this.drivers];
      this.tableHasMore  = page.hasMore;
      this.tablePage     = 2;
    } catch (error) {
      console.error('❌ Error loading drivers:', error);
      this.alertService.danger('Failed to load drivers');
    } finally {
      this.loading = false;
    }
  }

  /** Called by (scroll) on .table-scroll-container — appends next page */
  async onTableScroll(event: Event) {
    if (!this.tableHasMore || this.loadingMoreTable || this.loading) return;
    const el = event.target as HTMLElement;
    if (el.scrollTop + el.clientHeight < el.scrollHeight - 60) return;

    this.loadingMoreTable = true;
    try {
      const page = await this.driverService.getDriversPaginated(this.tablePage, this.searchTerm);
      const seen = new Set(this.drivers.map(d => d.id));
      this.drivers.push(...page.drivers.filter(d => !seen.has(d.id)));
      this.filteredDrivers = [...this.drivers];
      this.tableHasMore = page.hasMore;
      this.tablePage    = page.currentPage + 1;
    } catch (error) {
      console.error('❌ Error loading more drivers:', error);
    } finally {
      this.loadingMoreTable = false;
    }
  }

  /** Search resets to page 1 with the new term */
  filterDrivers() {
    // Reset and reload from backend with search term
    this.loadDrivers();
  }

  addDriver()             { this.router.navigate(['/drivers/add']); }
  editDriver(d: Driver)   { this.router.navigate(['/drivers/edit', d.id]); }
  manageShifts(d: Driver) {
    this.router.navigate(['/shifts'], { queryParams: { driverId: d.id, driverName: d.name } });
  }

  async deleteDriver(driver: Driver) {
    if (!confirm(`Are you sure you want to delete driver ${driver.name}?`)) return;
    try {
      await this.driverService.deleteDriver(driver.id!);
      this.alertService.success('Driver deleted successfully');
      await this.loadDrivers(); // resets to page 1
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
      this.alertService.danger('Failed to load groups');
      this.groups = []; this.filteredGroups = [];
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
    if (!this.groupForm.name.trim()) { this.alertService.warning('Please enter a group name'); return; }
    try {
      if (this.editingGroup) {
        const idx = this.groups.findIndex(g => g.id === this.editingGroup!.id);
        if (idx !== -1) this.groups[idx] = { ...this.groups[idx], ...this.groupForm, updatedAt: new Date() };
        this.alertService.success('Group updated successfully');
      } else {
        this.groups.push({ id: Date.now().toString(), ...this.groupForm, createdAt: new Date() });
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
      for (const driver of this.drivers.filter(d => d.groupId === group.id)) {
        const updated = await this.driverService.removeDriverFromGroup(driver.id!);
        const idx = this.drivers.findIndex(d => d.id === driver.id);
        if (idx !== -1) this.drivers[idx] = updated;
      }
      this.groups = this.groups.filter(g => g.id !== group.id);
      localStorage.setItem('driverGroups', JSON.stringify(this.groups));
      this.filterGroups(); this.filterDrivers();
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

  getGroupName(groupId: string)        { return this.groups.find(g => g.id === groupId)?.name ?? 'Unknown Group'; }
  getGroupDriverCount(groupId: string) { return this.drivers.filter(d => d.groupId === groupId).length; }
  getGroupDrivers(groupId: string)     { return this.drivers.filter(d => d.groupId === groupId); }
  getAvailableDriversForGroup(groupId?: string) {
    return this.drivers.filter(d => !d.groupId || d.groupId === groupId);
  }

  assignGroup(driver: Driver) {
    this.selectedDriver = driver;
    this.selectedGroup  = null;
    this.assignForm = { groupId: driver.groupId || '', driverId: driver.id! };
    this._openAssignModal();
  }
  addDriverToGroup(group: DriverGroup) {
    this.selectedGroup  = group;
    this.selectedDriver = null;
    this.assignForm = { groupId: group.id, driverId: '' };
    this._openAssignModal();
  }

  private _openAssignModal() {
    // Reset group dropdown
    this.groupDropdownOpen    = false;
    this.groupSelectSearch    = '';
    this.filteredGroupOptions = [...this.groups];
    // Reset & load page 1 of driver dropdown
    this._loadDriverDropdownPage1();
    this.showAssignDriverModal = true;
  }

  async confirmAssignDriver() {
    const groupId  = this.selectedGroup?.id || this.assignForm.groupId;
    const driverId = this.selectedDriver?.id || this.assignForm.driverId;
    if (!groupId || !driverId) { this.alertService.warning('Please select both a group and a driver'); return; }
    try {
      const updated = await this.driverService.assignDriverToGroup(driverId, groupId);
      const idx = this.drivers.findIndex(d => d.id === driverId);
      if (idx !== -1) this.drivers[idx] = updated;
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
      const updated = await this.driverService.removeDriverFromGroup(driver.id!);
      const idx = this.drivers.findIndex(d => d.id === driver.id);
      if (idx !== -1) this.drivers[idx] = updated;
      this.filterDrivers();
      this.alertService.success(`${driver.name} removed from "${group.name}"`);
    } catch (error) {
      this.alertService.danger('Failed to remove driver from group');
    }
  }

  closeAssignDriverModal() {
    this.showAssignDriverModal = false;
    this.selectedGroup = null; this.selectedDriver = null;
    this.assignForm = { groupId: '', driverId: '' };
    this.groupDropdownOpen  = false;
    this.showDriverDropdown = false;
    this.groupSelectSearch  = '';
    this.driverDropdownSearch = '';
  }

  // ==================== SEARCHABLE GROUP DROPDOWN ====================

  toggleGroupDropdown() {
    this.groupDropdownOpen = !this.groupDropdownOpen;
    if (this.groupDropdownOpen) {
      this.showDriverDropdown   = false;
      this.groupSelectSearch    = '';
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
    this.assignForm.groupId  = group.id;
    this.groupDropdownOpen   = false;
    this.groupSelectSearch   = '';
    this.assignForm.driverId = '';
    this._loadDriverDropdownPage1(); // refresh available drivers
  }

  // ==================== PAGINATED DRIVER DROPDOWN ====================

  /** Resets and fetches page 1 */
  private async _loadDriverDropdownPage1() {
    this.dropdownDrivers      = [];
    this.driverDropdownPage   = 1;
    this.driverDropdownHasMore = false;
    this.driverDropdownSearch  = '';
    this.loadingMoreDrivers   = true;
    try {
      const page = await this.driverService.getDriversPaginated(1, '');
      this.dropdownDrivers       = page.drivers;
      this.driverDropdownHasMore = page.hasMore;
      this.driverDropdownPage    = 2;
    } catch (e) {
      console.error('❌ Driver dropdown page 1 failed:', e);
    } finally {
      this.loadingMoreDrivers = false;
    }
  }

  /** Toggle panel open/close */
  toggleDriverDropdown() {
    this.showDriverDropdown = !this.showDriverDropdown;
    if (this.showDriverDropdown) {
      this.groupDropdownOpen = false;
    }
  }

  /** Search input — debounce 300 ms then reload from page 1 */
  onDriverSearchChange() {
    clearTimeout(this._driverSearchTimer);
    this._driverSearchTimer = setTimeout(async () => {
      this.dropdownDrivers      = [];
      this.driverDropdownPage   = 1;
      this.loadingMoreDrivers   = true;
      try {
        const page = await this.driverService.getDriversPaginated(1, this.driverDropdownSearch);
        this.dropdownDrivers       = page.drivers;
        this.driverDropdownHasMore = page.hasMore;
        this.driverDropdownPage    = 2;
      } catch (e) {
        console.error('❌ Driver search failed:', e);
      } finally {
        this.loadingMoreDrivers = false;
      }
    }, 300);
  }

  /** Scroll handler — loads next page when near the bottom */
  async onDriverDropdownScroll(event: Event) {
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
      this.dropdownDrivers.push(...page.drivers.filter(d => !seen.has(d.id)));
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
    this.assignForm.driverId = driver.id!;
    this.showDriverDropdown  = false;
  }

  /** Label shown in the closed trigger */
  getSelectedDriverName(): string {
    const id = this.assignForm.driverId;
    if (!id) return '';
    const d = this.dropdownDrivers.find(dr => dr.id === id)
           ?? this.drivers.find(dr => dr.id === id);
    if (!d) return 'Unknown Driver';
    const contact = d.phoneNumber || d.email || '';
    return contact ? `${d.name} — ${contact}` : d.name;
  }

  // ==================== UTILITY ====================

  formatDate(date: Date): string {
    if (!date) return 'N/A';
    const d = new Date(date);
    const diffDays = Math.ceil(Math.abs(Date.now() - d.getTime()) / 86400000);
    if (diffDays === 0)  return 'Today';
    if (diffDays === 1)  return 'Yesterday';
    if (diffDays < 7)    return `${diffDays} days ago`;
    if (diffDays < 30)   return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365)  return `${Math.floor(diffDays / 30)} months ago`;
    return d.toLocaleDateString();
  }
}